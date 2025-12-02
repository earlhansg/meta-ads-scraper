# 🎯 Meta Ads Library Scraper

A robust TypeScript-based scraper for Facebook's Ads Library that captures ad data via GraphQL API interception and stores it in a local JSON database.

## 📋 Technical Overview

**Challenge**: Build a reliable scraper that can extract Facebook ads data and maintain 100% sync with live Meta Ads Library.

**Solution**: 
- **Puppeteer-based scraping** with GraphQL response interception
- **Anti-detection measures** to avoid Facebook's bot protection
- **Incremental sync system** to efficiently update only changed ads
- **Local JSON database** organized by page ID for easy data management
- **Comprehensive testing** to detect Facebook API changes quickly

**Key Features**:
- ✅ Initial sync with configurable limits
- ✅ Smart incremental updates
- ✅ Real-time progress tracking
- ✅ Robust error handling
- ✅ TypeScript type safety
- ✅ Unit test coverage

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ 
- npm or yarn

### Installation
```bash
npm install
```

### Run the Scraper
```bash
# Development mode (with TypeScript)
npm run dev

# Production mode (compiled JavaScript)
npm run build
npm start
```

### Run Tests
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch
```

### Build Project
```bash
# Compile TypeScript to JavaScript
npm run build

# Clean build directory
npm run clean
```

### Lint Code
```bash
# Check for linting issues
npm run lint

# Auto-fix linting issues
npm run lint:fix
```

## 📁 Project Structure

```
meta-ads-scraper/
├── src/
│   ├── index.ts          # Main entry point
│   ├── scraper.ts        # Core scraper logic
│   ├── types.ts          # TypeScript definitions
│   └── scraper.test.ts   # Unit tests
├── ads_database/         # Local JSON database
│   └── [page_id]/
│       ├── [ad_id].json  # Individual ad files
│       └── _metadata.json # Sync metadata
├── dist/                 # Compiled JavaScript
└── package.json          # Dependencies & scripts
```

## 🔧 Usage Examples

### Basic Scraping
```typescript
import { MetaAdsLibraryScraper } from './scraper';

const scraper = new MetaAdsLibraryScraper();

// Initial sync - fetch up to 50 ads
const url = 'https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=ALL&view_all_page_id=YOUR_PAGE_ID';
await scraper.initialSync(url, 50);

// Incremental sync - update only changed ads
await scraper.incrementalSync('YOUR_PAGE_ID');
```

### Data Structure
Each ad is saved as JSON with the following structure:
```typescript
{
  "id": "855757530477365",
  "page_id": "282592881929497", 
  "is_active": true,
  "start_date": "2024-01-01",
  "end_date": "2024-12-31",
  "creative_bodies": ["Ad text content"],
  "fetched_at": "2024-12-03T10:30:00.000Z",
  "raw_data": { /* Complete Facebook API response */ }
}
```

## 🧪 Testing Strategy

The test suite includes:
- **Data structure validation** - Ensures correct ad format
- **API change detection** - Fails when Facebook modifies GraphQL structure  
- **Error handling** - Tests malformed responses and edge cases
- **Field capture verification** - Validates all critical fields are extracted

Run tests after any changes to ensure reliability.

## ⚠️ Important Notes

- **Rate Limiting**: Facebook actively blocks automated scraping. Use reasonable delays.
- **Legal Compliance**: Ensure usage complies with Facebook's Terms of Service.
- **API Changes**: Facebook frequently updates their internal APIs. Tests will detect changes.
- **Anti-Detection**: Browser runs in headless mode with anti-automation measures.

## 📊 Performance

- **Initial Sync**: ~2-3 seconds per ad (including delays)
- **Incremental Sync**: Only processes changed ads for efficiency
- **Storage**: ~5-50KB per ad depending on content richness
- **Memory Usage**: ~100-200MB during scraping

## 🛠️ Development

### Available Scripts
- `npm run dev` - Run in development mode
- `npm run build` - Build for production  
- `npm start` - Run built application
- `npm test` - Run test suite
- `npm run lint` - Check code quality

### Contributing
1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

---

**Built with TypeScript, Puppeteer, and Jest** 🚀
