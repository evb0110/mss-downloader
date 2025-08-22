#!/usr/bin/env bun

/**
 * ContentDM IIIF Size Limits Research
 * Testing different IIIF size parameters with Florence ContentDM server
 * Focus on manuscript ID plutei:217706 that returns 403 Forbidden at 6000px width
 */

interface TestResult {
    size: string;
    url: string;
    status: number;
    statusText: string;
    success: boolean;
    error?: string;
    responseTime?: number;
    contentType?: string;
    contentLength?: number;
}

// Test different IIIF size parameters
const testSizes = [
    'full/max/0/default.jpg',          // Maximum available
    'full/6000,/0/default.jpg',        // Current failing size
    'full/4000,/0/default.jpg',        // Large
    'full/3000,/0/default.jpg',        // Medium-large
    'full/2000,/0/default.jpg',        // Medium
    'full/1500,/0/default.jpg',        // Medium-small
    'full/1000,/0/default.jpg',        // Small
    'full/800,/0/default.jpg',         // Small
    'full/600,/0/default.jpg',         // Smaller
    'full/400,/0/default.jpg',         // Very small
    'full/200,/0/default.jpg',         // Minimum
    'full/100,/0/default.jpg',         // Tiny
    'full/pct:100/0/default.jpg',      // 100% scale
    'full/pct:200/0/default.jpg',      // 200% scale (should fail based on error message)
    'full/pct:150/0/default.jpg',      // 150% scale
    'full/pct:50/0/default.jpg',       // 50% scale
];

async function testIIIFSize(collection: string, itemId: string, sizeParam: string): Promise<TestResult> {
    const url = `https://cdm21059.contentdm.oclc.org/iiif/2/${collection}:${itemId}/${sizeParam}`;
    const startTime = Date.now();
    
    try {
        console.log(`Testing: ${sizeParam}`);
        
        const response = await fetch(url, {
            method: 'HEAD',  // Use HEAD to avoid downloading full images
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                'Referer': 'https://cdm21059.contentdm.oclc.org/',
            }
        });
        
        const responseTime = Date.now() - startTime;
        const contentLength = response.headers.get('content-length');
        const contentType = response.headers.get('content-type');
        
        return {
            size: sizeParam,
            url,
            status: response.status,
            statusText: response.statusText,
            success: response.ok,
            responseTime,
            contentType: contentType || undefined,
            contentLength: contentLength ? parseInt(contentLength) : undefined
        };
    } catch (error) {
        const responseTime = Date.now() - startTime;
        return {
            size: sizeParam,
            url,
            status: 0,
            statusText: 'Network Error',
            success: false,
            error: error instanceof Error ? error.message : String(error),
            responseTime
        };
    }
}

async function testContentDMLimits() {
    console.log('🔍 ContentDM IIIF Size Limits Research');
    console.log('📋 Testing Florence manuscript plutei:217706');
    console.log('⏱️  Starting comprehensive size parameter testing...\n');
    
    const collection = 'plutei';
    const itemId = '217706';
    const results: TestResult[] = [];
    
    // Test each size parameter
    for (const sizeParam of testSizes) {
        const result = await testIIIFSize(collection, itemId, sizeParam);
        results.push(result);
        
        // Log immediate results
        const statusEmoji = result.success ? '✅' : '❌';
        const sizeInfo = result.contentLength ? `(${Math.round(result.contentLength / 1024)}KB)` : '';
        console.log(`${statusEmoji} ${result.size} → ${result.status} ${result.statusText} ${sizeInfo} [${result.responseTime}ms]`);
        
        if (!result.success && result.error) {
            console.log(`   Error: ${result.error}`);
        }
        
        // Be nice to the server
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('\n📊 Analysis Summary:');
    
    // Analyze results
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    const forbidden = results.filter(r => r.status === 403);
    
    console.log(`✅ Successful requests: ${successful.length}/${results.length}`);
    console.log(`❌ Failed requests: ${failed.length}/${results.length}`);
    console.log(`🚫 403 Forbidden: ${forbidden.length}/${results.length}`);
    
    if (successful.length > 0) {
        console.log('\n✅ Working size parameters:');
        successful.forEach(r => {
            const sizeInfo = r.contentLength ? `(${Math.round(r.contentLength / 1024)}KB)` : '';
            console.log(`   ${r.size} ${sizeInfo}`);
        });
    }
    
    if (forbidden.length > 0) {
        console.log('\n🚫 403 Forbidden (size limits exceeded):');
        forbidden.forEach(r => {
            console.log(`   ${r.size}`);
        });
    }
    
    // Find maximum working size
    const workingSizes = successful.filter(r => r.contentLength && r.contentLength > 0);
    if (workingSizes.length > 0) {
        const maxSize = workingSizes.reduce((max, curr) => 
            (curr.contentLength || 0) > (max.contentLength || 0) ? curr : max
        );
        console.log(`\n🎯 Recommended maximum size: ${maxSize.size} (${Math.round((maxSize.contentLength || 0) / 1024)}KB)`);
    }
    
    return results;
}

// Additional test: Check IIIF info.json to understand server capabilities
async function testIIIFInfo(collection: string, itemId: string): Promise<any> {
    const infoUrl = `https://cdm21059.contentdm.oclc.org/iiif/2/${collection}:${itemId}/info.json`;
    
    try {
        console.log('\n📋 Checking IIIF info.json for server capabilities...');
        const response = await fetch(infoUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': 'application/json',
                'Referer': 'https://cdm21059.contentdm.oclc.org/',
            }
        });
        
        if (response.ok) {
            const info = await response.json();
            console.log('✅ IIIF Info Retrieved:');
            console.log(`   Width: ${info.width}px`);
            console.log(`   Height: ${info.height}px`);
            console.log(`   Max Width: ${info.profile?.[1]?.maxWidth || 'Not specified'}`);
            console.log(`   Max Height: ${info.profile?.[1]?.maxHeight || 'Not specified'}`);
            console.log(`   Max Area: ${info.profile?.[1]?.maxArea || 'Not specified'}`);
            console.log(`   Scales: ${JSON.stringify(info.profile?.[1]?.scaleFactors) || 'Not specified'}`);
            return info;
        } else {
            console.log(`❌ Failed to retrieve IIIF info: ${response.status} ${response.statusText}`);
            return null;
        }
    } catch (error) {
        console.log(`❌ Error retrieving IIIF info: ${error instanceof Error ? error.message : String(error)}`);
        return null;
    }
}

// Main execution
async function main() {
    try {
        // Test IIIF info first
        const info = await testIIIFInfo('plutei', '217706');
        
        // Then test various size parameters
        const results = await testContentDMLimits();
        
        // Save results to JSON for detailed analysis
        const report = {
            timestamp: new Date().toISOString(),
            collection: 'plutei',
            itemId: '217706',
            server: 'cdm21059.contentdm.oclc.org',
            iiifInfo: info,
            testResults: results
        };
        
        console.log('\n💾 Saving detailed results to contentdm-test-results.json');
        await Bun.write('.devkit/research/contentdm-test-results.json', JSON.stringify(report, null, 2));
        
    } catch (error) {
        console.error('❌ Test execution failed:', error);
    }
}

if (import.meta.main) {
    main();
}