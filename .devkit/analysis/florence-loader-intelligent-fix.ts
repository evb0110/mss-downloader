/**
 * ULTRATHINK SOLUTION: FlorenceLoader.ts with Intelligent URL Parsing
 * 
 * This shows the exact code changes needed to fix the Florence URL parsing error.
 * The changes integrate intelligent URL detection for all Florence URL formats.
 */

// Add this interface near the top of FlorenceLoader.ts (around line 36)
interface ParsedFlorenceUrl {
    collection: string;
    itemId: string;
    urlType: 'manuscript_viewer' | 'iiif_image' | 'iiif_info' | 'iiif_manifest';
    originalFormat: string;
}

// Add this method to the FlorenceLoader class (around line 112, after getSessionHeaders())
private parseFlorence Url(originalUrl: string): ParsedFlorenceUrl {
    this.deps.logger.log({
        level: 'info',
        library: 'florence',
        message: `Analyzing Florence URL format: ${originalUrl}`
    });
    
    // Pattern 1: Manuscript viewer URLs (EXISTING SUPPORT)
    // https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/25456/rec/1
    const manuscriptMatch = originalUrl.match(/cdm21059\.contentdm\.oclc\.org\/digital\/collection\/([^/]+)\/id\/(\d+)/);
    if (manuscriptMatch) {
        const [, collection, itemId] = manuscriptMatch;
        this.deps.logger.log({
            level: 'info',
            library: 'florence',
            message: `Manuscript viewer URL detected: collection=${collection}, itemId=${itemId}`
        });
        return {
            collection: collection!,
            itemId: itemId!,
            urlType: 'manuscript_viewer',
            originalFormat: 'digital/collection/{collection}/id/{id}'
        };
    }
    
    // Pattern 2: IIIF URLs (NEW SUPPORT)
    // https://cdm21059.contentdm.oclc.org/iiif/2/plutei:217702/full/max/0/default.jpg
    // https://cdm21059.contentdm.oclc.org/iiif/2/plutei:217702/info.json
    // https://cdm21059.contentdm.oclc.org/iiif/2/plutei:217702/manifest.json
    const iiifMatch = originalUrl.match(/cdm21059\.contentdm\.oclc\.org\/iiif\/2\/([^:]+):(\d+)\//);
    if (iiifMatch) {
        const [, collection, itemId] = iiifMatch;
        
        let urlType: ParsedFlorenceUrl['urlType'];
        if (originalUrl.includes('/full/') && originalUrl.includes('/default.jpg')) {
            urlType = 'iiif_image';
        } else if (originalUrl.endsWith('/info.json')) {
            urlType = 'iiif_info';
        } else if (originalUrl.endsWith('/manifest.json')) {
            urlType = 'iiif_manifest';
        } else {
            urlType = 'iiif_image'; // Default assumption for IIIF URLs
        }
        
        this.deps.logger.log({
            level: 'info',
            library: 'florence',
            message: `IIIF URL detected (${urlType}): collection=${collection}, itemId=${itemId}`
        });
        
        return {
            collection: collection!,
            itemId: itemId!,
            urlType,
            originalFormat: 'iiif/2/{collection}:{id}'
        };
    }
    
    // Pattern 3: ContentDM API URLs (ADDITIONAL SUPPORT)
    // https://cdm21059.contentdm.oclc.org/digital/api/singleitem/image/plutei/217702/default.jpg
    const apiMatch = originalUrl.match(/cdm21059\.contentdm\.oclc\.org\/digital\/api\/singleitem\/image\/([^/]+)\/(\d+)/);
    if (apiMatch) {
        const [, collection, itemId] = apiMatch;
        this.deps.logger.log({
            level: 'info',
            library: 'florence',
            message: `ContentDM API URL detected: collection=${collection}, itemId=${itemId}`
        });
        return {
            collection: collection!,
            itemId: itemId!,
            urlType: 'manuscript_viewer', // Treat as manuscript viewer
            originalFormat: 'digital/api/singleitem/image/{collection}/{id}'
        };
    }
    
    // No pattern matched - provide helpful error
    const error = new Error(
        `Florence URL format not supported. The URL parsing failed to extract collection and item ID.\n\n` +
        `Supported Florence URL formats:\n` +
        `1. Manuscript viewer: https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/XXXXX/rec/1\n` +
        `2. IIIF image: https://cdm21059.contentdm.oclc.org/iiif/2/plutei:XXXXX/full/max/0/default.jpg\n` +
        `3. IIIF info: https://cdm21059.contentdm.oclc.org/iiif/2/plutei:XXXXX/info.json\n` +
        `4. IIIF manifest: https://cdm21059.contentdm.oclc.org/iiif/2/plutei:XXXXX/manifest.json\n\n` +
        `Your URL: ${originalUrl}\n\n` +
        `If this URL is from the Florence library website, please copy the manuscript viewer URL instead of direct image links.`
    );
    
    this.deps.logger.logDownloadError('florence', originalUrl, error);
    throw error;
}

// Replace the existing URL parsing code in loadManifest() method (around lines 389-400)
// REPLACE THIS CODE:
/*
// Extract collection and item ID from URL
// Format: https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/25456/rec/1
const urlMatch = originalUrl.match(/cdm21059\.contentdm\.oclc\.org\/digital\/collection\/([^/]+)\/id\/(\d+)/);
if (!urlMatch) {
    const error = new Error('Could not extract collection and item ID from Florence URL');
    this.deps.logger.logDownloadError('florence', originalUrl, error);
    throw error;
}

const collection = urlMatch[1]!;
const itemId = urlMatch[2]!;
*/

// WITH THIS CODE:
const parsed = this.parseFlorenceUrl(originalUrl);
const collection = parsed.collection;
const itemId = parsed.itemId;

// Log the intelligent handling strategy
let processingNote = '';
switch (parsed.urlType) {
    case 'manuscript_viewer':
        processingNote = 'Using manuscript viewer URL for standard processing';
        break;
    case 'iiif_image':
        processingNote = 'Single IIIF image detected - will discover full manuscript';
        break;
    case 'iiif_info':
        processingNote = 'IIIF info.json detected - will discover full manuscript';
        break;
    case 'iiif_manifest':
        processingNote = 'IIIF manifest detected - will discover full manuscript';
        break;
}

this.deps.logger.log({
    level: 'info',
    library: 'florence',
    message: `Florence URL processing: ${processingNote} (collection: ${collection}, itemId: ${itemId})`
});

// Continue with existing logic...
console.log(`🔍 Florence: collection=${collection}, itemId=${itemId}`);