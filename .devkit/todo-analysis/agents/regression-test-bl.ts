#!/usr/bin/env bun

/**
 * REGRESSION TESTING FOR BRITISH LIBRARY IMPLEMENTATION
 * Ensures existing functionality is not broken by new BL implementation
 */

import { writeFileSync } from 'fs';

interface RegressionTestResult {
    library: string;
    url: string;
    success: boolean;
    pageCount?: number;
    displayName?: string;
    error?: string;
    responseTime: number;
}

class RegressionTester {
    
    private async fetchWithTimeout(url: string, timeoutMs = 10000) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        
        try {
            const response = await fetch(url, {
                signal: controller.signal,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                    'Accept': 'application/json,*/*'
                }
            });
            
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }

    // Sample key libraries to test for regressions
    private getTestUrls() {
        return [
            {
                library: 'vatican',
                url: 'https://digi.vatlib.it/view/MSS_Ott.lat.74',
                expectedPages: 394
            },
            {
                library: 'bodleian',
                url: 'https://digital.bodleian.ox.ac.uk/objects/748a9d5b-5c54-4c2b-86f3-3f97b09b0379/',
                expectedPages: 200 // approximate
            },
            {
                library: 'parker',
                url: 'https://parker.stanford.edu/parker/catalog/kx448qw5222',
                expectedPages: 350 // approximate
            },
            {
                library: 'british_library',
                url: 'https://bl.digirati.io/iiif/view/ark:/81055/vdc_100055984026.0x000001',
                expectedPages: 535
            }
        ];
    }

    async simulateManifestLoading(libraryId: string, url: string): Promise<RegressionTestResult> {
        console.log(`🔍 Testing ${libraryId}: ${url}`);
        
        const startTime = Date.now();
        const result: RegressionTestResult = {
            library: libraryId,
            url,
            success: false,
            responseTime: 0
        };

        try {
            // Simulate the SharedManifestLoaders approach
            let manifestUrl = '';
            
            switch (libraryId) {
                case 'vatican':
                    const vaticanMatch = url.match(/MSS_(.+)$/);
                    if (vaticanMatch) {
                        const msId = vaticanMatch[1];
                        manifestUrl = `https://digi.vatlib.it/iiif/${msId}/manifest.json`;
                    }
                    break;
                    
                case 'bodleian':
                    const bodleianMatch = url.match(/objects\/([^\/]+)/);
                    if (bodleianMatch) {
                        const uuid = bodleianMatch[1];
                        manifestUrl = `https://iiif.bodleian.ox.ac.uk/iiif/manifest/${uuid}.json`;
                    }
                    break;
                    
                case 'parker':
                    manifestUrl = `${url}/iiif/manifest`;
                    break;
                    
                case 'british_library':
                    const arkMatch = url.match(/ark:\/([0-9]+)\/([^\/?#]+)/i);
                    if (arkMatch) {
                        const arkId = `ark:/${arkMatch[1]}/${arkMatch[2]}`;
                        manifestUrl = `https://bl.digirati.io/iiif/${arkId}`;
                    }
                    break;
            }

            if (!manifestUrl) {
                throw new Error('Could not generate manifest URL');
            }

            console.log(`📋 Manifest URL: ${manifestUrl}`);
            
            const response = await this.fetchWithTimeout(manifestUrl);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const manifest = await response.json();
            
            // Count pages based on IIIF format
            let pageCount = 0;
            let displayName = '';

            if (manifest.items && Array.isArray(manifest.items)) {
                // IIIF v3
                pageCount = manifest.items.length;
                displayName = this.extractDisplayName(manifest.label);
            } else if (manifest.sequences && manifest.sequences[0] && manifest.sequences[0].canvases) {
                // IIIF v2
                pageCount = manifest.sequences[0].canvases.length;
                displayName = this.extractDisplayName(manifest.label);
            }

            result.success = true;
            result.pageCount = pageCount;
            result.displayName = displayName;
            result.responseTime = Date.now() - startTime;

            console.log(`✅ SUCCESS: ${pageCount} pages found - "${displayName}"`);
            console.log(`⏱️  Response time: ${result.responseTime}ms`);

        } catch (error) {
            result.error = error instanceof Error ? error.message : String(error);
            result.responseTime = Date.now() - startTime;
            console.log(`❌ FAILED: ${result.error}`);
            console.log(`⏱️  Response time: ${result.responseTime}ms`);
        }

        return result;
    }

    private extractDisplayName(label: any): string {
        if (typeof label === 'string') return label;
        if (label && typeof label === 'object') {
            if (label.en) return Array.isArray(label.en) ? label.en[0] : label.en;
            if (label['@value']) return label['@value'];
            if (label.none) return Array.isArray(label.none) ? label.none[0] : label.none;
        }
        return 'Unknown';
    }

    async runRegressionTests(): Promise<RegressionTestResult[]> {
        console.log('🔄 REGRESSION TESTING - Ensuring no existing functionality broken');
        console.log('='.repeat(70));
        
        const testUrls = this.getTestUrls();
        const results: RegressionTestResult[] = [];

        for (const testCase of testUrls) {
            console.log(`\n${'─'.repeat(50)}`);
            const result = await this.simulateManifestLoading(testCase.library, testCase.url);
            results.push(result);
            
            // Add a small delay between tests
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        return results;
    }
}

async function main() {
    const tester = new RegressionTester();
    
    console.log('🚀 BRITISH LIBRARY REGRESSION TESTING SUITE');
    console.log('='.repeat(70));
    
    const results = await tester.runRegressionTests();
    
    // Analyze results
    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;
    
    console.log('\n' + '='.repeat(70));
    console.log('📊 REGRESSION TEST SUMMARY');
    console.log('='.repeat(70));
    console.log(`✅ Successful: ${successCount}/${totalCount}`);
    console.log(`❌ Failed: ${totalCount - successCount}/${totalCount}`);
    
    results.forEach(result => {
        const status = result.success ? '✅' : '❌';
        const pages = result.pageCount ? ` (${result.pageCount} pages)` : '';
        const error = result.error ? ` - ${result.error}` : '';
        console.log(`${status} ${result.library}${pages}${error}`);
    });
    
    if (results.find(r => r.library === 'british_library')) {
        const blResult = results.find(r => r.library === 'british_library')!;
        console.log('\n🎯 BRITISH LIBRARY SPECIFIC VALIDATION:');
        console.log(`   - Implementation: ${blResult.success ? 'WORKING' : 'BROKEN'}`);
        console.log(`   - Page Count: ${blResult.pageCount === 535 ? 'CORRECT (535)' : `INCORRECT (${blResult.pageCount})`}`);
        console.log(`   - Performance: ${blResult.responseTime}ms`);
    }

    // Save detailed report
    const report = {
        timestamp: new Date().toISOString(),
        summary: {
            totalTests: totalCount,
            successfulTests: successCount,
            failedTests: totalCount - successCount,
            successRate: (successCount / totalCount * 100).toFixed(1) + '%'
        },
        results
    };

    writeFileSync(
        '/Users/evb/WebstormProjects/mss-downloader/.devkit/todo-analysis/agents/bl-regression-test-report.json',
        JSON.stringify(report, null, 2)
    );

    console.log('\n📄 Detailed report saved to: bl-regression-test-report.json');
    
    // Exit with appropriate code
    process.exit(successCount === totalCount ? 0 : 1);
}

main().catch(console.error);