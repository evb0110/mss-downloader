/**
 * ULTRATHINK SOLUTION: Intelligent Florence URL Parser
 * 
 * Handles multiple Florence URL formats intelligently:
 * 1. Manuscript viewer URLs: /digital/collection/{collection}/id/{id}/rec/{page}
 * 2. Direct IIIF image URLs: /iiif/2/{collection}:{id}/full/max/0/default.jpg
 * 3. IIIF info.json URLs: /iiif/2/{collection}:{id}/info.json
 * 4. IIIF manifest URLs: /iiif/2/{collection}:{id}/manifest.json
 */

interface ParsedFlorenceUrl {
    collection: string;
    itemId: string;
    urlType: 'manuscript_viewer' | 'iiif_image' | 'iiif_info' | 'iiif_manifest';
    originalFormat: string;
}

class IntelligentFlorenceUrlParser {
    
    /**
     * Parse any Florence URL format and extract collection/itemId
     */
    static parseUrl(originalUrl: string): ParsedFlorenceUrl {
        console.log(`🔍 Florence URL Parser: Analyzing ${originalUrl}`);
        
        // Pattern 1: Manuscript viewer URLs
        // https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/25456/rec/1
        const manuscriptMatch = originalUrl.match(/cdm21059\.contentdm\.oclc\.org\/digital\/collection\/([^/]+)\/id\/(\d+)/);
        if (manuscriptMatch) {
            const [, collection, itemId] = manuscriptMatch;
            console.log(`✅ Manuscript viewer URL: collection=${collection}, itemId=${itemId}`);
            return {
                collection: collection!,
                itemId: itemId!,
                urlType: 'manuscript_viewer',
                originalFormat: 'digital/collection/{collection}/id/{id}'
            };
        }
        
        // Pattern 2: IIIF URLs (image, info.json, manifest.json)
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
                urlType = 'iiif_image'; // Default assumption
            }
            
            console.log(`✅ IIIF URL (${urlType}): collection=${collection}, itemId=${itemId}`);
            return {
                collection: collection!,
                itemId: itemId!,
                urlType,
                originalFormat: 'iiif/2/{collection}:{id}'
            };
        }
        
        // Pattern 3: ContentDM API URLs (for completeness)
        // https://cdm21059.contentdm.oclc.org/digital/api/singleitem/image/plutei/217702/default.jpg
        const apiMatch = originalUrl.match(/cdm21059\.contentdm\.oclc\.org\/digital\/api\/singleitem\/image\/([^/]+)\/(\d+)/);
        if (apiMatch) {
            const [, collection, itemId] = apiMatch;
            console.log(`✅ ContentDM API URL: collection=${collection}, itemId=${itemId}`);
            return {
                collection: collection!,
                itemId: itemId!,
                urlType: 'manuscript_viewer', // Treat as manuscript viewer
                originalFormat: 'digital/api/singleitem/image/{collection}/{id}'
            };
        }
        
        // No pattern matched
        throw new Error(
            `Florence URL format not recognized. Supported formats:\n` +
            `1. Manuscript viewer: https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/ID/rec/1\n` +
            `2. IIIF image: https://cdm21059.contentdm.oclc.org/iiif/2/plutei:ID/full/max/0/default.jpg\n` +
            `3. IIIF info: https://cdm21059.contentdm.oclc.org/iiif/2/plutei:ID/info.json\n` +
            `4. IIIF manifest: https://cdm21059.contentdm.oclc.org/iiif/2/plutei:ID/manifest.json\n` +
            `\nProvided URL: ${originalUrl}`
        );
    }
    
    /**
     * Generate manuscript viewer URL from any Florence URL
     */
    static toManuscriptViewerUrl(collection: string, itemId: string): string {
        return `https://cdm21059.contentdm.oclc.org/digital/collection/${collection}/id/${itemId}/rec/1`;
    }
    
    /**
     * Generate IIIF image URL from collection and itemId
     */
    static toIIIFImageUrl(collection: string, itemId: string, resolution: string = 'max'): string {
        return `https://cdm21059.contentdm.oclc.org/iiif/2/${collection}:${itemId}/full/${resolution}/0/default.jpg`;
    }
    
    /**
     * Intelligent URL handling: convert any URL to the format needed for processing
     */
    static handleIntelligently(originalUrl: string): { collection: string; itemId: string; processingStrategy: string } {
        const parsed = this.parseUrl(originalUrl);
        
        let processingStrategy: string;
        
        switch (parsed.urlType) {
            case 'manuscript_viewer':
                processingStrategy = 'Use provided URL directly for manuscript discovery';
                break;
                
            case 'iiif_image':
                processingStrategy = 'Single image provided - discover full manuscript from collection/itemId';
                break;
                
            case 'iiif_info':
                processingStrategy = 'IIIF info.json provided - discover full manuscript from collection/itemId';
                break;
                
            case 'iiif_manifest':
                processingStrategy = 'IIIF manifest provided - discover full manuscript from collection/itemId';
                break;
        }
        
        console.log(`🎯 Processing strategy: ${processingStrategy}`);
        
        return {
            collection: parsed.collection,
            itemId: parsed.itemId,
            processingStrategy
        };
    }
}

// Test cases for validation
const testUrls = [
    'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/217702/rec/1',
    'https://cdm21059.contentdm.oclc.org/iiif/2/plutei:217702/full/max/0/default.jpg',
    'https://cdm21059.contentdm.oclc.org/iiif/2/plutei:217702/info.json',
    'https://cdm21059.contentdm.oclc.org/iiif/2/plutei:217702/manifest.json',
    'https://cdm21059.contentdm.oclc.org/digital/api/singleitem/image/plutei/217702/default.jpg'
];

console.log('🧪 Testing Florence URL Parser:');
for (const url of testUrls) {
    try {
        const result = IntelligentFlorenceUrlParser.handleIntelligently(url);
        console.log(`✅ ${url} → collection=${result.collection}, itemId=${result.itemId}`);
    } catch (error) {
        console.log(`❌ ${url} → Error: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export { IntelligentFlorenceUrlParser, type ParsedFlorenceUrl };