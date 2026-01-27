/**
 * Export Worker v1
 * 
 * Requirements:
 * - Input: datasetId + format (csv | xlsx) + userPlan
 * - Enforce pricing gates
 * - Always return: rows_returned, rows_total, gated
 * - Formats: CSV (UTF-8, Excel-safe), XLSX (single sheet)
 * - Never return more rows than allowed
 * - Never throw error for limits (graceful degradation)
 */

import { pool } from '../config/database.js';
import { enforceExportLimits, type UserPlan } from '../limits/enforcePlanLimits.js';
import { checkUsageLimit } from '../limits/usageLimits.js';
import { getUserPermissions } from '../db/permissions.js';
import { getDataset, getUserUsage, incrementUsage, saveExport } from '../persistence/index.js';
import { logExportAction } from '../utils/actionLogger.js';
import { 
  buildSimplifiedExportRows, 
  exportSimplifiedToCSV,
  type SimplifiedBusinessExportData 
} from '../exports/schemaSimplified.js';
import { buildXlsxFile, type XlsxColumn } from '../utils/xlsx.js';
import ExcelJS from 'exceljs';

export interface ExportWorkerV1Input {
  datasetId: string;
  format: 'csv' | 'xlsx';
  userId: string; // User ID - plan is resolved from database (source of truth)
  // userPlan removed - always resolved from database via getUserPermissions()
}

export interface ExportWorkerV1Result {
  success: boolean;
  rows_returned: number;
  rows_total: number;
  gated: boolean;
  file?: Buffer;
  filename?: string;
  error?: string;
  upgrade_hint?: string;
}

/**
 * Query businesses with all related data for export
 */
interface BusinessExportQuery {
  business_id: number;
  business_name: string;
  address: string | null;
  google_place_id: string | null;
  rating: number | null;
  reviews_count: number | null;
  industry: string | null;
  city: string;
  website_url: string | null;
  last_crawled_at: Date | null;
  email: string | null;
  phone: string | null;
  contact_page_url: string | null;
  facebook: string | null;
  instagram: string | null;
  linkedin: string | null;
}

/**
 * Export Worker v1 - Main function
 */
export async function exportWorkerV1(
  input: ExportWorkerV1Input
): Promise<ExportWorkerV1Result> {
  const { datasetId, format, userId } = input;

  try {
    // 1. Get user permissions from database (source of truth: Stripe subscription)
    // Never trust client payload - always query database
    const permissions = await getUserPermissions(userId);
    const userPlan = permissions.plan;
    const isInternalUser = permissions.is_internal_user; // Server-side only

    // 2. Check monthly usage limit (never throws - graceful degradation)
    // Internal users bypass usage limits
    const usage = await getUserUsage(userId);
    const usageCheck = checkUsageLimit(userPlan, 'export', usage.exports_this_month, isInternalUser);
    
    if (!usageCheck.allowed) {
      // Log action (usage limit exceeded)
      logExportAction({
        userId,
        datasetId,
        resultSummary: `Export blocked: usage limit exceeded (${usage.exports_this_month}/${usageCheck.limit} exports this month)`,
        gated: true,
        error: usageCheck.reason || 'Usage limit exceeded',
        metadata: {
          usage_count: usage.exports_this_month,
          usage_limit: usageCheck.limit,
          upgrade_hint: usageCheck.upgrade_hint,
        },
      });

      // Return partial result with usage limit info
      return {
        success: false,
        rows_returned: 0,
        rows_total: 0,
        gated: true,
        error: usageCheck.reason,
        upgrade_hint: usageCheck.upgrade_hint,
      };
    }

    // 3. Verify dataset exists (works with DB or local JSON)
    const dataset = await getDataset(datasetId);
    if (!dataset) {
      // Log action (dataset not found)
      logExportAction({
        userId,
        datasetId,
        resultSummary: `Export failed: dataset not found`,
        gated: false,
        error: `Dataset ${datasetId} not found`,
      });

      return {
        success: false,
        rows_returned: 0,
        rows_total: 0,
        gated: false,
        error: `Dataset ${datasetId} not found`,
      };
    }

    // 4. Query all businesses for dataset (with related data)
    const businesses = await queryBusinessesForExport(datasetId);

    // 5. Get total row count
    const rowsTotal = businesses.length;

    // 6. Enforce plan limits using permissions (never throws - graceful degradation)
    // Use max_export_rows from permissions instead of pricing gate
    const maxRows = permissions.max_export_rows;
    const isGated = rowsTotal > maxRows;
    const rowsToExport = Math.min(rowsTotal, maxRows);

    // 7. Aggregate business data
    const aggregatedData = aggregateBusinessData(businesses.slice(0, rowsToExport));

    // 8. Build export rows using simplified schema
    const exportTier = userPlan === 'demo' ? 'demo' : 'paid';
    const exportRows = buildSimplifiedExportRows(aggregatedData, exportTier);

    // 8. Generate file
    let file: Buffer;
    let filename: string;

    if (format === 'csv') {
      const csv = exportSimplifiedToCSV(exportRows);
      file = Buffer.from(csv, 'utf-8');
      filename = `export-${datasetId}-${Date.now()}.csv`;
    } else {
      // XLSX format
      const columns: XlsxColumn[] = [
        { header: 'Business Name', key: 'business_name', width: 30 },
        { header: 'Industry', key: 'industry', width: 20 },
        { header: 'City', key: 'city', width: 20 },
        { header: 'Address', key: 'address', width: 40 },
        { header: 'Phone', key: 'phone', width: 20 },
        { header: 'Email', key: 'email', width: 30 },
        { header: 'Website', key: 'website', width: 40 },
        { header: 'Google Maps URL', key: 'google_maps_url', width: 50 },
        { header: 'Rating', key: 'rating', width: 10 },
        { header: 'Reviews Count', key: 'reviews_count', width: 15 },
        { header: 'Contact Page URL', key: 'contact_page_url', width: 50 },
        { header: 'Facebook', key: 'facebook', width: 40 },
        { header: 'Instagram', key: 'instagram', width: 40 },
        { header: 'LinkedIn', key: 'linkedin', width: 40 },
        { header: 'Last Crawled At', key: 'last_crawled_at', width: 25 },
      ];

      // Convert export rows to record format for XLSX
      const xlsxRows = exportRows.map(row => ({
        business_name: row.business_name,
        industry: row.industry,
        city: row.city,
        address: row.address,
        phone: row.phone,
        email: row.email,
        website: row.website,
        google_maps_url: row.google_maps_url,
        rating: row.rating,
        reviews_count: row.reviews_count,
        contact_page_url: row.contact_page_url,
        facebook: row.facebook,
        instagram: row.instagram,
        linkedin: row.linkedin,
        last_crawled_at: row.last_crawled_at,
      }));

      file = await buildXlsxFile(xlsxRows, columns, 'Export', isGated ? enforcement.upgrade_hint : undefined);
      filename = `export-${datasetId}-${Date.now()}.xlsx`;
    }

    // 9. Increment usage counter (only on successful export)
    // Works with DB or local JSON
    await incrementUsage(userId, 'export');

    // 10. Return result with partial results if gated
    const upgradeHint = isGated
      ? userPlan === 'demo'
        ? 'Upgrade to Starter plan for up to 1,000 rows per export.'
        : userPlan === 'starter'
        ? 'Upgrade to Pro plan for unlimited exports.'
        : undefined
      : undefined;

    // Log successful export action
    logExportAction({
      userId,
      datasetId,
      resultSummary: `Export completed: ${rowsToExport} of ${rowsTotal} rows exported (format: ${format})`,
      gated: isGated,
      error: null,
      metadata: {
        format,
        rows_returned: rowsToExport,
        rows_total: rowsTotal,
        upgrade_hint: upgradeHint,
      },
    });

    return {
      success: true,
      rows_returned: rowsToExport,
      rows_total: rowsTotal,
      gated: isGated,
      file,
      filename,
      upgrade_hint: upgradeHint,
    };
  } catch (error: any) {
    console.error('[exportWorkerV1] Error:', error);
    
    // Log error action
    logExportAction({
      userId: input.userId,
      datasetId: input.datasetId,
      resultSummary: `Export failed: ${error.message || 'Unknown error'}`,
      gated: false,
      error: error.message || 'Export failed',
      metadata: {
        format: input.format,
        error_type: error.name || 'Error',
      },
    });

    return {
      success: false,
      rows_returned: 0,
      rows_total: 0,
      gated: false,
      error: error.message || 'Export failed',
    };
  }
}

/**
 * Query businesses with all related data for export
 */
async function queryBusinessesForExport(datasetId: string): Promise<BusinessExportQuery[]> {
  const result = await pool.query<BusinessExportQuery>(
    `
    SELECT DISTINCT ON (b.id)
      b.id AS business_id,
      b.name AS business_name,
      b.address,
      b.google_place_id,
      -- Rating and reviews from Google Places (not stored in DB yet, will be null)
      NULL::numeric AS rating,
      NULL::integer AS reviews_count,
      i.name AS industry,
      c.name AS city,
      w.url AS website_url,
      w.last_crawled_at,
      -- Best email (highest confidence or most recent)
      (
        SELECT ct.email
        FROM contacts ct
        JOIN contact_sources cs ON cs.contact_id = ct.id
        WHERE ct.business_id = b.id
          AND ct.email IS NOT NULL
          AND ct.is_active = TRUE
        ORDER BY 
          CASE cs.page_type
            WHEN 'contact' THEN 1
            WHEN 'homepage' THEN 2
            WHEN 'footer' THEN 3
            ELSE 4
          END,
          ct.last_verified_at DESC NULLS LAST
        LIMIT 1
      ) AS email,
      -- Best phone (most recent)
      (
        SELECT COALESCE(ct.phone, ct.mobile)
        FROM contacts ct
        WHERE ct.business_id = b.id
          AND (ct.phone IS NOT NULL OR ct.mobile IS NOT NULL)
          AND ct.is_active = TRUE
        ORDER BY ct.last_verified_at DESC NULLS LAST
        LIMIT 1
      ) AS phone,
      -- Contact page URL
      (
        SELECT cs.source_url
        FROM contact_sources cs
        JOIN contacts ct ON ct.id = cs.contact_id
        WHERE ct.business_id = b.id
          AND (cs.page_type = 'contact' 
               OR cs.source_url ILIKE '%/contact%'
               OR cs.source_url ILIKE '%/επικοινωνια%')
        LIMIT 1
      ) AS contact_page_url,
      -- Social links from crawl_results (if available)
      -- Note: crawl_results.business_id is UUID, businesses.id is integer
      -- We'll need to join properly or use a different approach
      NULL::text AS facebook,
      NULL::text AS instagram,
      NULL::text AS linkedin
    FROM businesses b
    JOIN cities c ON b.city_id = c.id
    LEFT JOIN industries i ON b.industry_id = i.id
    LEFT JOIN websites w ON w.business_id = b.id
    WHERE b.dataset_id = $1
    ORDER BY b.id, b.name ASC
    `,
    [datasetId]
  );

  return result.rows;
}

/**
 * Aggregate business query results into SimplifiedBusinessExportData format
 */
function aggregateBusinessData(
  businesses: BusinessExportQuery[]
): SimplifiedBusinessExportData[] {
  return businesses.map(b => {
    // Group contacts by business (for future expansion)
    const contacts = [];
    if (b.email) {
      contacts.push({
        email: b.email,
        phone: null,
        source_url: b.contact_page_url || '',
        page_type: b.contact_page_url ? 'contact' : 'homepage',
      });
    }
    if (b.phone) {
      contacts.push({
        email: null,
        phone: b.phone,
        source_url: b.contact_page_url || '',
        page_type: b.contact_page_url ? 'contact' : 'homepage',
      });
    }

    // Build social links object
    const social: { facebook?: string; instagram?: string; linkedin?: string } = {};
    if (b.facebook) social.facebook = b.facebook;
    if (b.instagram) social.instagram = b.instagram;
    if (b.linkedin) social.linkedin = b.linkedin;

    return {
      business: {
        name: b.business_name,
        address: b.address,
        google_place_id: b.google_place_id,
        rating: b.rating,
        reviews_count: b.reviews_count,
      },
      industry: b.industry ? { name: b.industry } : null,
      city: { name: b.city },
      website: b.website_url
        ? {
            url: b.website_url,
            last_crawled_at: b.last_crawled_at,
          }
        : null,
      contacts,
      social,
    };
  });
}
