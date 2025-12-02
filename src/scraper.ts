import puppeteer, { Browser, Page } from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';
import { AdData, PageMetadata } from './types';

export class MetaAdsLibraryScraper {
  private dbPath = './ads_database';

  constructor() {
    this.ensureDbExists();
  }

  private async ensureDbExists(): Promise<void> {
    try {
      await fs.access(this.dbPath);
    } catch {
      await fs.mkdir(this.dbPath, { recursive: true });
    }
  }

  private async saveAd(ad: AdData): Promise<void> {
    const pageDir = path.join(this.dbPath, ad.page_id);
    await fs.mkdir(pageDir, { recursive: true });
    
    const adPath = path.join(pageDir, `${ad.id}.json`);
    await fs.writeFile(adPath, JSON.stringify(ad, null, 2));
  }

  private async loadAd(pageId: string, adId: string): Promise<AdData | null> {
    try {
      const adPath = path.join(this.dbPath, pageId, `${adId}.json`);
      const data = await fs.readFile(adPath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  private async savePageMetadata(metadata: PageMetadata): Promise<void> {
    const pageDir = path.join(this.dbPath, metadata.page_id);
    await fs.mkdir(pageDir, { recursive: true });
    
    const metaPath = path.join(pageDir, '_metadata.json');
    await fs.writeFile(metaPath, JSON.stringify(metadata, null, 2));
  }

  private async loadPageMetadata(pageId: string): Promise<PageMetadata | null> {
    try {
      const metaPath = path.join(this.dbPath, pageId, '_metadata.json');
      const data = await fs.readFile(metaPath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  private extractAdData(response: any): AdData[] {
    const ads: AdData[] = [];
    
    try {
      const data = response?.data;
      if (!data) return ads;

      // Facebook's current structure: data.ad_library_main.search_results_connection.edges
      const edges = data?.ad_library_main?.search_results_connection?.edges;
      
      if (!edges || !Array.isArray(edges)) {
        console.log('No edges found in search_results_connection');
        return ads;
      }
      
      console.log(`Processing ${edges.length} edges from GraphQL response`);
      
      for (const edge of edges) {
        const node = edge?.node;
        if (!node) continue;

        // Each node contains collated_results array with the actual ads
        const collatedResults = node.collated_results || [];
        
        for (const adResult of collatedResults) {
          if (!adResult) continue;

          const snapshot = adResult.snapshot || {};
          
          const ad: AdData = {
            id: adResult.ad_archive_id || adResult.id || `unknown_${Date.now()}`,
            page_id: adResult.page_id || snapshot.page_id || 'unknown_page',
            is_active: adResult.is_active !== undefined ? adResult.is_active : true,
            start_date: adResult.start_date || adResult.delivery_start_time,
            end_date: adResult.end_date || adResult.delivery_stop_time,
            snapshot_url: adResult.snapshot_url,
            creative_bodies: [snapshot.body?.text].filter(Boolean),
            fetched_at: new Date().toISOString(),
            raw_data: {
              ...adResult,
              snapshot: snapshot
            }
          };

          // Only add if we have a valid ID
          if (ad.id && ad.id !== `unknown_${Date.now()}`) {
            ads.push(ad);
          }
        }
      }
    } catch (error) {
      console.error('Error extracting ad data:', error);
    }

    return ads;
  }

  async initialSync(url: string, max?: number): Promise<void> {
    let browser: Browser | null = null;
    const capturedAds = new Map<string, AdData>();

    try {
      console.log('Starting initial sync...');
      browser = await puppeteer.launch({ 
        headless: true, // Set to false for debugging
        args: [
          '--no-sandbox', 
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--disable-features=VizDisplayCompositor',
          '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ]
      });
      
      const page = await browser.newPage();
      
      // Set viewport and user agent to appear more like a real browser
      await page.setViewport({ width: 1366, height: 768 });
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      // Remove automation indicators
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
        });
      });
      
      // Intercept GraphQL responses
      await page.setRequestInterception(true);
      
      page.on('request', (request) => {
        request.continue();
      });

      page.on('response', async (response) => {
        try {
          const url = response.url();
          const contentType = response.headers()['content-type'] || '';
          
          // Check for various Facebook API endpoints that might contain ad data
          const isRelevantRequest = (
            (url.includes('graphql') && (url.includes('ad_library') || url.includes('AdLibrary'))) ||
            url.includes('/api/graphql/') ||
            url.includes('ads/library') ||
            url.includes('ad_archive') ||
            (url.includes('facebook.com') && contentType.includes('application/json'))
          );

          if (isRelevantRequest && response.status() === 200) {
            console.log(`Intercepting response from: ${url.substring(0, 100)}...`);
            
            const text = await response.text();
            let json;
            
            try {
              json = JSON.parse(text);
            } catch (parseError) {
              console.log('Failed to parse JSON response');
              return;
            }

            const ads = this.extractAdData(json);
            
            if (ads.length > 0) {
              console.log(`Found ${ads.length} ads in response`);
              
              for (const ad of ads) {
                if (!max || capturedAds.size < max) {
                  capturedAds.set(ad.id, ad);
                  await this.saveAd(ad);
                  console.log(`Saved ad: ${ad.id} (Total: ${capturedAds.size})`);
                  
                  if (max && capturedAds.size >= max) {
                    console.log(`Reached maximum limit of ${max} ads`);
                    break;
                  }
                }
              }
            } else {
              // Log the structure for debugging
              console.log('No ads found in response. Response structure:', Object.keys(json));
            }
          }
        } catch (error) {
          // Silently ignore errors for non-relevant responses
          if (error instanceof Error && !error.message.includes('Protocol error')) {
            console.log('Response processing error:', error.message);
          }
        }
      });

      // Navigate to the page
      console.log(`Navigating to: ${url}`);
      await page.goto(url, { 
        waitUntil: 'domcontentloaded',
        timeout: 60000 
      });

      // Wait for initial content to load
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Wait for any potential loading indicators to disappear
      try {
        await page.waitForSelector('[role="main"]', { timeout: 10000 });
        console.log('Main content area found');
      } catch (error) {
        console.log('Main content selector not found, continuing...');
      }

      // Scroll to load more ads with more realistic behavior
      let previousCount = 0;
      let noChangeCount = 0;
      let scrollAttempts = 0;
      const maxScrollAttempts = 20;
      
      console.log('Starting to scroll and load ads...');
      
      while ((!max || capturedAds.size < max) && scrollAttempts < maxScrollAttempts) {
        // Scroll down gradually like a human would
        await page.evaluate(() => {
          const scrollHeight = document.body.scrollHeight;
          const currentScroll = window.pageYOffset;
          const clientHeight = window.innerHeight;
          
          // Scroll by viewport height
          window.scrollBy(0, clientHeight * 0.8);
        });
        
        // Wait for content to load
        await new Promise(resolve => setTimeout(resolve, 3000 + Math.random() * 2000));
        
        scrollAttempts++;
        console.log(`Scroll attempt ${scrollAttempts}, ads found: ${capturedAds.size}`);
        
        if (capturedAds.size === previousCount) {
          noChangeCount++;
          if (noChangeCount >= 5) {
            console.log('No new ads found after 5 scroll attempts');
            break;
          }
        } else {
          noChangeCount = 0;
          previousCount = capturedAds.size;
        }
        
        // Check if we've reached the bottom
        const isAtBottom = await page.evaluate(() => {
          return window.innerHeight + window.pageYOffset >= document.body.offsetHeight - 1000;
        });
        
        if (isAtBottom && noChangeCount >= 2) {
          console.log('Reached bottom of page');
          break;
        }
      }

      // Save metadata for each page
      const pageIds = new Set(Array.from(capturedAds.values()).map(ad => ad.page_id));
      for (const pageId of pageIds) {
        const pageAds = Array.from(capturedAds.values()).filter(ad => ad.page_id === pageId);
        await this.savePageMetadata({
          page_id: pageId,
          last_synced: new Date().toISOString(),
          total_ads: pageAds.length
        });
      }

      console.log(`Initial sync completed. Total ads: ${capturedAds.size}`);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('timeout')) {
          console.error('Timeout error during initial sync');
        } else {
          console.error('Error during initial sync:', error.message);
        }
      }
      throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  async incrementalSync(pageId: string): Promise<void> {
    let browser: Browser | null = null;
    const updatedAds = new Map<string, AdData>();

    try {
      console.log(`Starting incremental sync for page: ${pageId}`);
      
      const metadata = await this.loadPageMetadata(pageId);
      console.log(`Last synced: ${metadata?.last_synced || 'Never'}`);

      browser = await puppeteer.launch({ 
        headless: true, // Set to false for debugging
        args: [
          '--no-sandbox', 
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ]
      });
      
      const page = await browser.newPage();
      await page.setViewport({ width: 1366, height: 768 });
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
        });
      });
      
      await page.setRequestInterception(true);

      page.on('request', (request) => {
        request.continue();
      });

      page.on('response', async (response) => {
        try {
          const url = response.url();
          const contentType = response.headers()['content-type'] || '';
          
          const isRelevantRequest = (
            (url.includes('graphql') && (url.includes('ad_library') || url.includes('AdLibrary'))) ||
            url.includes('/api/graphql/') ||
            url.includes('ads/library') ||
            url.includes('ad_archive') ||
            (url.includes('facebook.com') && contentType.includes('application/json'))
          );

          if (isRelevantRequest && response.status() === 200) {
            const text = await response.text();
            let json;
            
            try {
              json = JSON.parse(text);
            } catch (parseError) {
              return;
            }

            const ads = this.extractAdData(json);
            
            for (const ad of ads) {
              if (ad.page_id === pageId) {
                const existingAd = await this.loadAd(pageId, ad.id);
                
                // Check if ad is new or updated (comprehensive comparison)
                if (!existingAd || 
                    existingAd.is_active !== ad.is_active ||
                    existingAd.end_date !== ad.end_date ||
                    existingAd.start_date !== ad.start_date ||
                    JSON.stringify(existingAd.creative_bodies) !== JSON.stringify(ad.creative_bodies)) {
                  updatedAds.set(ad.id, ad);
                  await this.saveAd(ad);
                  console.log(`Updated ad: ${ad.id} (${!existingAd ? 'new' : 'modified'})`);
                }
              }
            }
          }
        } catch (error) {
          // Silently ignore errors for non-relevant responses
        }
      });

      const url = `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=ALL&view_all_page_id=${pageId}`;
      await page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: 60000 
      });

      // Scroll to load ads
      for (let i = 0; i < 5; i++) {
        await page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight);
        });
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Update metadata
      await this.savePageMetadata({
        page_id: pageId,
        last_synced: new Date().toISOString(),
        total_ads: (metadata?.total_ads || 0) + updatedAds.size
      });

      console.log(`Incremental sync completed. Updated ads: ${updatedAds.size}`);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('timeout')) {
          console.error('Timeout error during incremental sync');
        } else {
          console.error('Error during incremental sync:', error.message);
        }
      }
      throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }
}

export default MetaAdsLibraryScraper;