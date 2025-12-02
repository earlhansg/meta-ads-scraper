// src/index.ts
import { MetaAdsLibraryScraper } from './scraper';

async function main() {
  const scraper = new MetaAdsLibraryScraper();
  
  try {
    // Example 1: Initial sync with limit
    const url = 'https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=ALL&view_all_page_id=282592881929497';
    
    console.log('=== Starting Initial Sync ===');
    await scraper.initialSync(url, 50);
    
    console.log('\n=== Waiting 30 seconds before incremental sync ===');
    await new Promise(resolve => setTimeout(resolve, 30000));
    
    // Example 2: Incremental sync
    console.log('\n=== Starting Incremental Sync ===');
    await scraper.incrementalSync('282592881929497');
    
    console.log('\n=== All operations completed successfully ===');
  } catch (error) {
    console.error('Error in main:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { MetaAdsLibraryScraper } from './scraper';
export * from './types';