const fs = require('fs');
const path = require('path');

/**
 * Test CONTENTdm URL patterns for image extraction
 * Testing various standard CONTENTdm endpoints with MDC Catalonia as example
 */

const testUrls = [
    'https://mdc.csuc.cat/digital/collection/butlletins/id/1'
];

const contentdmPatterns = [
    // IIIF API patterns
    {
        name: 'IIIF Info (Cantaloupe)',
        pattern: (collection, id) => `https://mdc.csuc.cat/digital/iiif/2/${collection}:${id}/info.json`,
        description: 'Standard IIIF info endpoint for Cantaloupe-based servers'
    },
    {
        name: 'IIIF Info (Non-Cantaloupe)',
        pattern: (collection, id) => `https://mdc.csuc.cat/digital/iiif/${collection}/${id}/info.json`,
        description: 'Standard IIIF info endpoint for non-Cantaloupe servers'
    },
    {
        name: 'IIIF Image Full Max',
        pattern: (collection, id) => `https://mdc.csuc.cat/digital/iiif/2/${collection}:${id}/full/max/0/default.jpg`,
        description: 'Maximum resolution image via IIIF API'
    },
    {
        name: 'IIIF Image Full/Full',
        pattern: (collection, id) => `https://mdc.csuc.cat/digital/iiif/2/${collection}:${id}/full/full/0/default.jpg`,
        description: 'Full resolution image via IIIF API'
    },
    {
        name: 'IIIF Thumbnail',
        pattern: (collection, id) => `https://mdc.csuc.cat/digital/iiif/2/${collection}:${id}/full/150,/0/default.jpg`,
        description: 'Thumbnail image via IIIF API'
    },
    
    // Standard CONTENTdm Utils patterns
    {
        name: 'Utils GetThumbnail',
        pattern: (collection, id) => `https://mdc.csuc.cat/utils/getthumbnail/collection/${collection}/id/${id}`,
        description: 'Standard CONTENTdm thumbnail endpoint'
    },
    {
        name: 'Utils GetFile',
        pattern: (collection, id) => `https://mdc.csuc.cat/utils/getfile/collection/${collection}/id/${id}`,
        description: 'Standard CONTENTdm file download endpoint'
    },
    {
        name: 'Utils GetStream',
        pattern: (collection, id) => `https://mdc.csuc.cat/utils/getstream/collection/${collection}/id/${id}`,
        description: 'Standard CONTENTdm stream endpoint'
    },
    
    // Direct server patterns
    {
        name: 'Direct Server Access',
        pattern: (collection, id) => `https://mdc.csuc.cat/digital/collection/${collection}/id/${id}/file`,
        description: 'Direct server file access'
    },
    {
        name: 'CDM Bridge',
        pattern: (collection, id) => `https://mdc.csuc.cat/cdm/ref/collection/${collection}/id/${id}`,
        description: 'CONTENTdm reference bridge'
    },
    
    // Image server patterns
    {
        name: 'Image Server Direct',
        pattern: (collection, id) => `https://mdc.csuc.cat/images/${collection}/${id}.jpg`,
        description: 'Direct image server access'
    },
    {
        name: 'Image Server PNG',
        pattern: (collection, id) => `https://mdc.csuc.cat/images/${collection}/${id}.png`,
        description: 'Direct image server PNG format'
    },
    
    // Alternative patterns
    {
        name: 'Alternative Utils GetFile with filename',
        pattern: (collection, id) => `https://mdc.csuc.cat/utils/getfile/collection/${collection}/id/${id}/filename/${id}.jpg`,
        description: 'Utils GetFile with explicit filename'
    },
    {
        name: 'Alternative IIIF Thumbnail',
        pattern: (collection, id) => `https://mdc.csuc.cat/digital/iiif/${collection}/${id}/thumbnail`,
        description: 'Alternative IIIF thumbnail endpoint'
    }
];

async function testContentdmPatterns() {
    console.log('Testing CONTENTdm URL patterns for image extraction...\n');
    
    const results = [];
    
    for (const testUrl of testUrls) {
        console.log(`\nTesting URL: ${testUrl}`);
        
        // Extract collection and ID from URL
        const urlMatch = testUrl.match(/\/collection\/([^\/]+)\/id\/(\d+)/);
        if (!urlMatch) {
            console.log('Could not parse URL - skipping');
            continue;
        }
        
        const collection = urlMatch[1];
        const id = urlMatch[2];
        
        console.log(`Collection: ${collection}, ID: ${id}\n`);
        
        for (const pattern of contentdmPatterns) {
            const testPatternUrl = pattern.pattern(collection, id);
            console.log(`Testing ${pattern.name}:`);
            console.log(`  URL: ${testPatternUrl}`);
            
            try {
                const response = await fetch(testPatternUrl, {
                    method: 'HEAD',
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                    }
                });
                
                const statusInfo = {
                    status: response.status,
                    statusText: response.statusText,
                    contentType: response.headers.get('content-type'),
                    contentLength: response.headers.get('content-length')
                };
                
                console.log(`  Status: ${statusInfo.status} ${statusInfo.statusText}`);
                console.log(`  Content-Type: ${statusInfo.contentType || 'N/A'}`);
                console.log(`  Content-Length: ${statusInfo.contentLength || 'N/A'}`);
                
                results.push({
                    url: testUrl,
                    collection,
                    id,
                    pattern: pattern.name,
                    description: pattern.description,
                    testUrl: testPatternUrl,
                    ...statusInfo,
                    working: response.ok
                });
                
                if (response.ok) {
                    console.log(`  ✓ WORKING`);
                } else {
                    console.log(`  ✗ FAILED`);
                }
                
            } catch (error) {
                console.log(`  ✗ ERROR: ${error.message}`);
                results.push({
                    url: testUrl,
                    collection,
                    id,
                    pattern: pattern.name,
                    description: pattern.description,
                    testUrl: testPatternUrl,
                    status: 'ERROR',
                    error: error.message,
                    working: false
                });
            }
            
            console.log(''); // Empty line for readability
            
            // Small delay to avoid overwhelming the server
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }
    
    // Generate summary report
    console.log('\n=== SUMMARY REPORT ===\n');
    
    const workingPatterns = results.filter(r => r.working);
    const failedPatterns = results.filter(r => !r.working);
    
    console.log(`Working patterns: ${workingPatterns.length}`);
    console.log(`Failed patterns: ${failedPatterns.length}`);
    console.log(`Total patterns tested: ${results.length}\n`);
    
    if (workingPatterns.length > 0) {
        console.log('WORKING PATTERNS:');
        workingPatterns.forEach(result => {
            console.log(`  ✓ ${result.pattern}: ${result.contentType || 'Unknown type'} (${result.contentLength || 'Unknown size'})`);
            console.log(`    ${result.testUrl}`);
        });
    }
    
    if (failedPatterns.length > 0) {
        console.log('\nFAILED PATTERNS:');
        failedPatterns.forEach(result => {
            console.log(`  ✗ ${result.pattern}: ${result.status} ${result.statusText || result.error || ''}`);
        });
    }
    
    // Save results to file
    const reportPath = path.join(__dirname, '../reports/contentdm-pattern-test-results.json');
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    console.log(`\nDetailed results saved to: ${reportPath}`);
    
    return results;
}

async function testMetadataApis() {
    console.log('\n=== TESTING METADATA APIs ===\n');
    
    const metadataPatterns = [
        {
            name: 'CONTENTdm Info API',
            url: 'https://mdc.csuc.cat/digital/api/collections/butlletins/items/1/info',
            description: 'CONTENTdm item information API'
        },
        {
            name: 'CONTENTdm Item API',
            url: 'https://mdc.csuc.cat/digital/api/collections/butlletins/items/1',
            description: 'CONTENTdm item metadata API'
        },
        {
            name: 'CONTENTdm Collection API',
            url: 'https://mdc.csuc.cat/digital/api/collections/butlletins',
            description: 'CONTENTdm collection metadata API'
        },
        {
            name: 'IIIF Manifest',
            url: 'https://mdc.csuc.cat/digital/iiif/butlletins/1/manifest',
            description: 'IIIF Presentation API manifest'
        },
        {
            name: 'IIIF Manifest v2',
            url: 'https://mdc.csuc.cat/digital/iiif/2/butlletins:1/manifest',
            description: 'IIIF Presentation API v2 manifest'
        }
    ];
    
    const metadataResults = [];
    
    for (const pattern of metadataPatterns) {
        console.log(`Testing ${pattern.name}:`);
        console.log(`  URL: ${pattern.url}`);
        
        try {
            const response = await fetch(pattern.url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });
            
            console.log(`  Status: ${response.status} ${response.statusText}`);
            console.log(`  Content-Type: ${response.headers.get('content-type') || 'N/A'}`);
            
            if (response.ok) {
                const text = await response.text();
                console.log(`  Content length: ${text.length} chars`);
                
                // Try to parse as JSON
                try {
                    const json = JSON.parse(text);
                    console.log(`  ✓ Valid JSON response`);
                    metadataResults.push({
                        ...pattern,
                        status: response.status,
                        contentType: response.headers.get('content-type'),
                        working: true,
                        dataType: 'json',
                        sample: JSON.stringify(json, null, 2).substring(0, 500)
                    });
                } catch (e) {
                    console.log(`  ✓ Text response (not JSON)`);
                    metadataResults.push({
                        ...pattern,
                        status: response.status,
                        contentType: response.headers.get('content-type'),
                        working: true,
                        dataType: 'text',
                        sample: text.substring(0, 500)
                    });
                }
            } else {
                console.log(`  ✗ FAILED`);
                metadataResults.push({
                    ...pattern,
                    status: response.status,
                    working: false
                });
            }
            
        } catch (error) {
            console.log(`  ✗ ERROR: ${error.message}`);
            metadataResults.push({
                ...pattern,
                status: 'ERROR',
                error: error.message,
                working: false
            });
        }
        
        console.log('');
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Save metadata results
    const metadataReportPath = path.join(__dirname, '../reports/contentdm-metadata-test-results.json');
    fs.writeFileSync(metadataReportPath, JSON.stringify(metadataResults, null, 2));
    console.log(`Metadata test results saved to: ${metadataReportPath}`);
    
    return metadataResults;
}

// Run the tests
async function runAllTests() {
    console.log('CONTENTdm Image Extraction Pattern Analysis');
    console.log('==========================================\n');
    
    const patternResults = await testContentdmPatterns();
    const metadataResults = await testMetadataApis();
    
    console.log('\n=== FINAL ANALYSIS ===\n');
    
    const workingImagePatterns = patternResults.filter(r => r.working);
    const workingMetadataPatterns = metadataResults.filter(r => r.working);
    
    if (workingImagePatterns.length > 0) {
        console.log('RECOMMENDED IMAGE EXTRACTION PATTERNS:');
        workingImagePatterns.forEach((result, index) => {
            console.log(`${index + 1}. ${result.pattern}`);
            console.log(`   ${result.description}`);
            console.log(`   Content: ${result.contentType} (${result.contentLength || 'Unknown size'})`);
            console.log(`   URL: ${result.testUrl}`);
            console.log('');
        });
    }
    
    if (workingMetadataPatterns.length > 0) {
        console.log('RECOMMENDED METADATA EXTRACTION PATTERNS:');
        workingMetadataPatterns.forEach((result, index) => {
            console.log(`${index + 1}. ${result.name}`);
            console.log(`   ${result.description}`);
            console.log(`   Content: ${result.contentType} (${result.dataType})`);
            console.log(`   URL: ${result.url}`);
            console.log('');
        });
    }
    
    return {
        patternResults,
        metadataResults
    };
}

// Run if called directly
if (require.main === module) {
    runAllTests().catch(console.error);
}

module.exports = { testContentdmPatterns, testMetadataApis, runAllTests };