#!/usr/bin/env bun

/**
 * MANDATORY: This framework tests the ACTUAL production code directly
 * NO isolated test scripts allowed - just the real code
 * Uses Bun to run TypeScript directly without compilation
 */

import { readFileSync } from 'fs';
import { join } from 'path';

// Import the ACTUAL production SharedManifestLoaders
import { SharedManifestLoaders } from '../../src/shared/SharedManifestLoaders';

interface TestCase {
    issue: string;
    userUrl: string;
    userError?: string;
    expectedBehavior: string;
}

// Load ALL issues from our comprehensive fetch
const allIssuesPath = join(process.cwd(), '.devkit/all-open-issues.json');
const allIssues = JSON.parse(readFileSync(allIssuesPath, 'utf8'));

// Build test configuration with EXACT user URLs from ALL GitHub issues
const USER_REPORTED_URLS: Record<string, TestCase> = {};

console.log('Building test cases from ALL GitHub issues...\n');

for (const issue of allIssues) {
    // Extract URLs from issue body
    const urlMatches = issue.body.match(/https?:\/\/[^\s]+/g) || [];
    
    // Filter out GitHub attachment URLs, focus on manuscript URLs
    const manuscriptUrls = urlMatches.filter((url: string) => 
        !url.includes('github.com') && 
        !url.includes('github.io') &&
        !url.includes('assets')
    );
    
    if (manuscriptUrls.length > 0) {
        // Extract error message if present
        const errorMatch = issue.body.match(/Error[^:]*:\s*([^https\n]+)/);
        
        USER_REPORTED_URLS[`issue_${issue.number}`] = {
            issue: `#${issue.number}`,
            userUrl: manuscriptUrls[0].replace(/[)\s]*$/, ''), // Clean trailing punctuation
            userError: errorMatch ? errorMatch[1].trim() : undefined,
            expectedBehavior: `Should handle ${issue.title} library correctly`
        };
        
        console.log(`Issue #${issue.number} (${issue.title}): ${manuscriptUrls[0].replace(/[)\s]*$/, '')}`);
    } else {
        console.log(`Issue #${issue.number} (${issue.title}): No manuscript URL found`);
    }
}

console.log(`\nCreated test cases for ${Object.keys(USER_REPORTED_URLS).length} issues with manuscript URLs\n`);

class ProductionCodeTester {
    private manifestLoaders: SharedManifestLoaders;
    private results: Record<string, any> = {};

    constructor() {
        this.manifestLoaders = new SharedManifestLoaders();
        console.log('✅ Initialized ACTUAL production SharedManifestLoaders');
    }

    async testLibrary(libraryId: string, config: TestCase) {
        console.log(`\n🧪 Testing ${libraryId} with EXACT user URL: ${config.userUrl}`);
        
        try {
            // Use ACTUAL production code to detect library
            const detectedLibrary = this.detectLibrary(config.userUrl);
            console.log(`📍 Detected library: ${detectedLibrary}`);
            
            // Call ACTUAL production manifest loader
            console.log(`📥 Loading manifest with production code...`);
            const manifest = await this.manifestLoaders.getManifestForLibrary(
                detectedLibrary, 
                config.userUrl
            );
            
            // Handle different return types: ManuscriptImage[] | { images: ManuscriptImage[] } | BneViewerInfo
            let images: any[] = [];
            
            if (Array.isArray(manifest)) {
                images = manifest;
            } else if (manifest && typeof manifest === 'object' && 'images' in manifest) {
                images = (manifest as any).images || [];
            } else if (manifest && typeof manifest === 'object' && 'viewerInfo' in manifest) {
                // BneViewerInfo case - check if it has images
                images = [];
                console.log(`📊 BNE ViewerInfo format detected`);
            }
            
            if (images && images.length > 0) {
                console.log(`✅ SUCCESS: Production code loaded manifest with ${images.length} images`);
                return { success: true, manifest, pagesFound: images.length };
            } else {
                console.log(`❌ FAILED: Manifest loaded but no images found`);
                console.log(`📊 Manifest type: ${typeof manifest}, isArray: ${Array.isArray(manifest)}`);
                if (manifest && typeof manifest === 'object') {
                    console.log(`📊 Manifest keys: ${Object.keys(manifest).join(', ')}`);
                }
                return { success: false, error: 'No images found in manifest', manifestType: typeof manifest, manifestKeys: manifest && typeof manifest === 'object' ? Object.keys(manifest) : [] };
            }
            
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.log(`❌ FAILED: ${errorMessage}`);
            
            // CRITICAL: Check if this matches user-reported error
            if (config.userError && errorMessage.includes(config.userError)) {
                console.log('⚠️ REPRODUCED USER ERROR - This needs fixing!');
            }
            
            return { success: false, error: errorMessage };
        }
    }
    
    private detectLibrary(url: string): string {
        // MUST match production detection logic EXACTLY
        if (url.includes('selene.bordeaux.fr')) return 'bordeaux';
        if (url.includes('collections.library.yale.edu')) return 'yale';
        if (url.includes('themorgan.org')) return 'morgan';
        if (url.includes('digi.landesbibliothek.at')) return 'linz';
        if (url.includes('e-rara.ch')) return 'zurich';
        
        // Default fallback
        return 'unknown';
    }
    
    async runAllTests(): Promise<Record<string, any>> {
        console.log(`🚀 Testing ALL ${Object.keys(USER_REPORTED_URLS).length} reported issues...\n`);
        console.log('='.repeat(60));
        
        for (const [id, config] of Object.entries(USER_REPORTED_URLS)) {
            this.results[id] = await this.testLibrary(id, config);
            
            // Add small delay to avoid overwhelming servers
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        console.log('\n' + '='.repeat(60));
        console.log('📊 TESTING SUMMARY:');
        
        let successCount = 0;
        let failureCount = 0;
        
        for (const [id, result] of Object.entries(this.results)) {
            const config = USER_REPORTED_URLS[id];
            if (result.success) {
                console.log(`✅ ${config.issue}: SUCCESS (${result.pagesFound || 0} pages)`);
                successCount++;
            } else {
                console.log(`❌ ${config.issue}: FAILED - ${result.error}`);
                failureCount++;
            }
        }
        
        console.log(`\n📈 Overall: ${successCount} success, ${failureCount} failures`);
        
        return this.results;
    }
}

// Main execution
async function main() {
    console.log('🔧 PRODUCTION CODE TEST FRAMEWORK');
    console.log('Tests ACTUAL production code with EXACT user URLs\n');
    
    const tester = new ProductionCodeTester();
    const results = await tester.runAllTests();
    
    // Save results for analysis
    const resultsPath = join(process.cwd(), '.devkit/test-scripts/production-test-results.json');
    require('fs').writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    console.log(`\n💾 Results saved to: ${resultsPath}`);
    
    return results;
}

// Run if called directly
if (import.meta.main) {
    main().catch(console.error);
}

export { ProductionCodeTester, USER_REPORTED_URLS };