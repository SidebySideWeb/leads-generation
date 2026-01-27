import { pool } from '../config/database.js';
import type { Business } from '../types/index.js';
import { computeNormalizedBusinessId } from '../utils/normalize.js';

/**
 * Get business by Google Place ID within a specific dataset
 * This prevents cross-dataset contamination
 */
export async function getBusinessByGooglePlaceId(
  google_place_id: string,
  dataset_id: string
): Promise<Business | null> {
  const result = await pool.query<Business>(
    'SELECT * FROM businesses WHERE google_place_id = $1 AND dataset_id = $2',
    [google_place_id, dataset_id]
  );
  return result.rows[0] || null;
}

/**
 * Get business by normalized name within a specific dataset
 * Used for duplicate detection on (dataset_id, normalized_name)
 */
export async function getBusinessByNormalizedName(
  normalized_name: string,
  dataset_id: string
): Promise<Business | null> {
  const result = await pool.query<Business>(
    'SELECT * FROM businesses WHERE normalized_name = $1 AND dataset_id = $2',
    [normalized_name, dataset_id]
  );
  return result.rows[0] || null;
}

export async function createBusiness(data: {
  name: string;
  address: string | null;
  postal_code: string | null;
  city_id: number;
  industry_id: number | null;
  google_place_id: string | null;
  dataset_id: string; // UUID
  owner_user_id: string;
}): Promise<Business> {
  // Compute a stable normalized identifier BEFORE insert (never empty)
  const normalized_name = computeNormalizedBusinessId({
    name: data.name,
    googlePlaceId: data.google_place_id
  });

  // Safety logging
  console.log(`[createBusiness] Processing business:`, {
    name: data.name,
    normalized_name,
    dataset_id: data.dataset_id,
    google_place_id: data.google_place_id || 'null'
  });

  // Try to insert, handling conflicts on (dataset_id, normalized_name)
  // On conflict: DO NOTHING and return existing business id
  const result = await pool.query<Business>(
    `INSERT INTO businesses (
      name, normalized_name, address, postal_code, city_id, 
      industry_id, google_place_id, dataset_id, owner_user_id,
      created_at, updated_at
    )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
     ON CONFLICT (dataset_id, normalized_name) 
     DO NOTHING
     RETURNING *`,
    [
      data.name,
      normalized_name,
      data.address,
      data.postal_code,
      data.city_id,
      data.industry_id,
      data.google_place_id,
      data.dataset_id,
      data.owner_user_id
    ]
  );

  // If insert succeeded, return the new business
  if (result.rows.length > 0) {
    console.log(`[createBusiness] INSERT path:`, {
      business_id: result.rows[0].id,
      normalized_name: result.rows[0].normalized_name,
      dataset_id: result.rows[0].dataset_id
    });
    return result.rows[0];
  }

  // If conflict occurred (DO NOTHING), fetch and return existing business
  const existingBusiness = await getBusinessByNormalizedName(normalized_name, data.dataset_id);
  
  if (existingBusiness) {
    console.log(`[createBusiness] DUPLICATE (DO NOTHING) - returning existing:`, {
      business_id: existingBusiness.id,
      normalized_name: existingBusiness.normalized_name,
      dataset_id: existingBusiness.dataset_id
    });
    return existingBusiness;
  }

  // This should never happen, but handle gracefully
  throw new Error(`Failed to create or find business with normalized_name: ${normalized_name}`);
}

export async function updateBusiness(id: number, data: {
  name?: string;
  address?: string | null;
  postal_code?: string | null;
  city_id?: number;
  industry_id?: number | null;
}): Promise<Business> {
  const updates: string[] = [];
  const values: any[] = [];
  let paramCount = 1;

  if (data.name !== undefined) {
    // Normalize and validate name (never empty; falls back to id if needed)
    // This is computed BEFORE update to ensure consistency
    const normalized_name = computeNormalizedBusinessId({
      name: data.name,
      businessId: id
    });
    updates.push(`name = $${paramCount++}`, `normalized_name = $${paramCount++}`);
    values.push(data.name, normalized_name);
    
    console.log(`[updateBusiness] Updating name:`, {
      business_id: id,
      name: data.name,
      normalized_name
    });
  }
  if (data.address !== undefined) {
    updates.push(`address = $${paramCount++}`);
    values.push(data.address);
  }
  if (data.postal_code !== undefined) {
    updates.push(`postal_code = $${paramCount++}`);
    values.push(data.postal_code);
  }
  if (data.city_id !== undefined) {
    updates.push(`city_id = $${paramCount++}`);
    values.push(data.city_id);
  }
  if (data.industry_id !== undefined) {
    updates.push(`industry_id = $${paramCount++}`);
    values.push(data.industry_id);
  }

  // Always update updated_at (trigger will also set it, but explicit is safer)
  // Note: updated_at is set by trigger, but we include it for clarity
  updates.push(`updated_at = NOW()`);
  values.push(id);

  if (updates.length === 1) {
    // Only updated_at, no other changes
    const result = await pool.query<Business>(
      `UPDATE businesses SET updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );
    if (result.rows.length === 0) {
      throw new Error(`Business with id ${id} not found`);
    }
    return result.rows[0];
  }

  const result = await pool.query<Business>(
    `UPDATE businesses SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
    values
  );
  
  if (result.rows.length === 0) {
    throw new Error(`Business with id ${id} not found`);
  }
  
  return result.rows[0];
}
