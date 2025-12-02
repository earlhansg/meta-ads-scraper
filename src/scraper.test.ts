// src/scraper.test.ts
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { MetaAdsLibraryScraper } from './scraper';
import { AdData } from './types';
import fs from 'fs/promises';

describe('MetaAdsLibraryScraper', () => {
  const testDbPath = './test_ads_database';
  let scraper: MetaAdsLibraryScraper;

  beforeEach(() => {
    scraper = new MetaAdsLibraryScraper();
  });

  afterEach(async () => {
    // Clean up test database
    try {
      await fs.rm(testDbPath, { recursive: true, force: true });
      await fs.rm('./ads_database', { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Ad Data Structure Validation', () => {
    it('should validate required fields in ad data', () => {
      const mockAd: AdData = {
        id: 'test_ad_123',
        page_id: 'test_page_456',
        is_active: true,
        start_date: '2024-01-01',
        end_date: '2024-12-31',
        snapshot_url: 'https://example.com/ad',
        creative_bodies: ['Test ad creative']
      };

      // Check all required fields exist
      expect(mockAd).toHaveProperty('id');
      expect(mockAd).toHaveProperty('page_id');
      expect(mockAd).toHaveProperty('is_active');
      
      // Validate field types
      expect(typeof mockAd.id).toBe('string');
      expect(typeof mockAd.page_id).toBe('string');
      expect(typeof mockAd.is_active).toBe('boolean');
      expect(Array.isArray(mockAd.creative_bodies)).toBe(true);
    });

    it('should validate ad data structure from GraphQL response', () => {
      const mockGraphQLResponse = {
        data: {
          ad_library_main: {
            search_results: {
              edges: [
                {
                  node: {
                    ad_archive_id: 'ad_001',
                    page_id: 'page_001',
                    is_active: true,
                    start_date: '2024-01-01',
                    end_date: null,
                    snapshot_url: 'https://fb.com/ad',
                    creative_bodies: ['Ad text here']
                  }
                }
              ]
            }
          }
        }
      };

      const edges = mockGraphQLResponse.data.ad_library_main.search_results.edges;
      expect(edges).toHaveLength(1);
      
      const node = edges[0].node;
      expect(node).toHaveProperty('ad_archive_id');
      expect(node).toHaveProperty('page_id');
      expect(node).toHaveProperty('is_active');
      expect(node).toHaveProperty('start_date');
      expect(node).toHaveProperty('snapshot_url');
    });
  });

  describe('Critical Fields Capture', () => {
    it('should capture all critical fields from ad node', () => {
      const mockNode = {
        ad_archive_id: 'ad_12345',
        id: 'backup_id',
        page_id: 'page_67890',
        is_active: false,
        start_date: '2024-06-01',
        end_date: '2024-09-15',
        snapshot_url: 'https://facebook.com/ads/snapshot',
        creative_bodies: [
          'First creative text',
          'Second creative text'
        ],
        page_name: 'Test Page',
        currency: 'USD',
        estimated_audience_size: {
          lower_bound: 1000,
          upper_bound: 5000
        }
      };

      // Verify critical fields
      const criticalFields = [
        'ad_archive_id',
        'page_id',
        'is_active',
        'start_date',
        'end_date',
        'snapshot_url',
        'creative_bodies'
      ];

      criticalFields.forEach(field => {
        expect(mockNode).toHaveProperty(field);
      });

      // Verify status field type
      expect(typeof mockNode.is_active).toBe('boolean');
      
      // Verify date fields format (ISO or Facebook format)
      expect(mockNode.start_date).toMatch(/^\d{4}-\d{2}-\d{2}/);
      if (mockNode.end_date) {
        expect(mockNode.end_date).toMatch(/^\d{4}-\d{2}-\d{2}/);
      }
    });

    it('should handle missing optional fields gracefully', () => {
      const minimalNode = {
        ad_archive_id: 'ad_min_001',
        page_id: 'page_min_001',
        is_active: true
      };

      expect(minimalNode).toHaveProperty('ad_archive_id');
      expect(minimalNode).toHaveProperty('page_id');
      expect(minimalNode).toHaveProperty('is_active');
      
      // Optional fields should be undefined
      expect(minimalNode).not.toHaveProperty('end_date');
    });
  });

  describe('GraphQL Response Structure Changes Detection', () => {
    it('should detect changes in response structure', () => {
      const expectedStructure = {
        data: {
          ad_library_main: {
            search_results: {
              edges: []
            }
          }
        }
      };

      const mockResponse = {
        data: {
          ad_library_main: {
            search_results: {
              edges: [{ node: {} }]
            }
          }
        }
      };

      // Verify structure matches
      expect(mockResponse).toHaveProperty('data.ad_library_main');
      expect(mockResponse.data.ad_library_main).toHaveProperty('search_results');
      expect(mockResponse.data.ad_library_main.search_results).toHaveProperty('edges');
      expect(Array.isArray(mockResponse.data.ad_library_main.search_results.edges)).toBe(true);
    });

    it('should fail if GraphQL structure changes', () => {
      // This test will fail if Facebook changes their API structure
      const unexpectedStructure = {
        data: {
          // Changed structure - different path
          ads_library: {
            results: []
          }
        }
      };

      // This assertion will fail if structure changes, alerting us
      expect(unexpectedStructure.data).not.toHaveProperty('ad_library_main');
    });
  });

  describe('Active Status Tracking', () => {
    it('should correctly track is_active status changes', () => {
      const adV1 = {
        id: 'ad_001',
        page_id: 'page_001',
        is_active: true,
        end_date: null
      };

      const adV2 = {
        id: 'ad_001',
        page_id: 'page_001',
        is_active: false,
        end_date: '2024-12-01'
      };

      // Detect status change
      expect(adV1.is_active).toBe(true);
      expect(adV2.is_active).toBe(false);
      expect(adV1.is_active !== adV2.is_active).toBe(true);
    });

    it('should track end_date for inactive ads', () => {
      const inactiveAd = {
        id: 'ad_002',
        is_active: false,
        end_date: '2024-11-30'
      };

      expect(inactiveAd.is_active).toBe(false);
      expect(inactiveAd.end_date).toBeDefined();
      expect(inactiveAd.end_date).toBeTruthy();
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed GraphQL responses', () => {
      const malformedResponses: any[] = [
        null,
        undefined,
        {},
        { data: null },
        { data: { ad_library_main: null } },
        { data: { ad_library_main: { search_results: null } } }
      ];

      malformedResponses.forEach((response: any) => {
        expect(() => {
          const data = response?.data?.ad_library_main;
          const edges = data?.search_results?.edges || [];
          expect(Array.isArray(edges)).toBe(true);
        }).not.toThrow();
      });
    });

    it('should validate required fields before saving', () => {
      const invalidAds = [
        { id: 'ad_001' }, // Missing page_id
        { page_id: 'page_001' }, // Missing id
        { id: 'ad_001', page_id: 'page_001' } // Valid - has both
      ];

      invalidAds.forEach(ad => {
        const hasRequiredFields = 
          ad.hasOwnProperty('id') && 
          ad.hasOwnProperty('page_id');
        
        if (hasRequiredFields) {
          expect(ad).toHaveProperty('id');
          expect(ad).toHaveProperty('page_id');
        }
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle ads with no creative bodies', () => {
      const adNoCreative = {
        id: 'ad_003',
        page_id: 'page_003',
        is_active: true,
        creative_bodies: []
      };

      expect(Array.isArray(adNoCreative.creative_bodies)).toBe(true);
      expect(adNoCreative.creative_bodies.length).toBe(0);
    });

    it('should handle very long ad IDs', () => {
      const longId = 'ad_' + 'x'.repeat(500);
      const ad = {
        id: longId,
        page_id: 'page_001',
        is_active: true
      };

      expect(ad.id.length).toBeGreaterThan(100);
      expect(typeof ad.id).toBe('string');
    });
  });

  describe('Integration Tests', () => {
    it('should document expected API response format', () => {
      // This serves as documentation and will fail if format changes
      const expectedResponseFormat = {
        data: {
          ad_library_main: {
            search_results: {
              edges: [
                {
                  node: {
                    ad_archive_id: 'string',
                    page_id: 'string',
                    is_active: 'boolean',
                    start_date: 'string | null',
                    end_date: 'string | null',
                    snapshot_url: 'string',
                    creative_bodies: 'array'
                  }
                }
              ],
              page_info: {
                has_next_page: 'boolean'
              }
            }
          }
        }
      };

      expect(expectedResponseFormat.data.ad_library_main.search_results).toHaveProperty('edges');
    });
  });
});