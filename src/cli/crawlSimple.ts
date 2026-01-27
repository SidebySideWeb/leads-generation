/**
 * CLI for Crawl Worker v1 Simple
 * 
 * Usage:
 *   npm run crawl-simple -- --business-id <id> --website <url> --max-depth <n> --dataset <uuid>
 */

import { crawlWorkerV1Simple } from '../workers/crawlWorkerV1Simple.js';

const args = process.argv.slice(2);

function getArg(name: string): string | null {
  const index = args.indexOf(`--${name}`);
  if (index === -1 || index === args.length - 1) {
    return null;
  }
  return args[index + 1];
}

async function main() {
  const businessId = getArg('business-id');
  const website = getArg('website');
  const maxDepth = getArg('max-depth');
  const datasetId = getArg('dataset');

  if (!businessId || !website || !maxDepth || !datasetId) {
    console.error('Usage: npm run crawl-simple -- --business-id <id> --website <url> --max-depth <n> --dataset <uuid>');
    process.exit(1);
  }

  const depth = Number.parseInt(maxDepth, 10);
  if (isNaN(depth) || depth < 0) {
    console.error('Error: max-depth must be a non-negative number');
    process.exit(1);
  }

  console.log(`\n🔍 Starting crawl for business ${businessId}`);
  console.log(`   Website: ${website}`);
  console.log(`   Max Depth: ${depth}`);
  console.log(`   Dataset: ${datasetId}\n`);

  try {
    const result = await crawlWorkerV1Simple({
      business: {
        id: Number.parseInt(businessId, 10),
        website,
      },
      maxDepth: depth,
      datasetId,
    });

    if (result.success) {
      console.log(`\n✅ Crawl completed successfully`);
      console.log(`   Pages crawled: ${result.pages_crawled}`);
      console.log(`   Emails found: ${result.emails_found}`);
      console.log(`   Phones found: ${result.phones_found}`);
      console.log(`   Social links: ${result.social_links_found}`);
      console.log(`   Contacts saved: ${result.contacts_saved}`);
    } else {
      console.error(`\n❌ Crawl failed: ${result.error}`);
      process.exit(1);
    }
  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  }
}

main();
