#!/usr/bin/env bun

/**
 * Production Code Test Framework for Orchestrated Issue Resolution
 * Tests ACTUAL production code with EXACT user URLs
 */

import path from 'path';
import fs from 'fs';
import https from 'https';
import http from 'http';
import { execSync } from 'child_process';

// Import ACTUAL production SharedManifestLoaders
import { SharedManifestLoaders } from '../../src/shared/SharedManifestLoaders';
import type { EnhancedManifest, CanvasInfo } from '../../src/shared/SharedManifestTypes';

// Test case interface
interface TestCase {
    issueNumber: number;
    title: string;
    url: string;
    expectedLibrary: string;
    description: string;
}

// Test result interface
interface TestResult {
    success: boolean;
    library?: string;
    pageCount?: number;
    manifestLoaded?: boolean;
    error?: string;
    stack?: string;
}

// Detailed error interface
interface DetailedError {
    issue: number;
    title: string;
    url: string;
    error: string;
    needsFix: boolean;
}

// Test cases with EXACT user URLs
const TEST_CASES: Record<string, TestCase> = {
    issue_2: {
        issueNumber: 2,
        title: 'грац (Graz)',
        url: 'https://digi.landesbibliothek.at/viewer/image/116/',
        expectedLibrary: 'linz',
        description: 'Upper Austrian State Library (mislabeled as Graz)'
    },
    issue_4: {
        issueNumber: 4,
        title: 'морган (Morgan)',
        url: 'https://www.themorgan.org/collection/lindau-gospels/thumbs',
        expectedLibrary: 'morgan',
        description: 'Morgan Library'
    },
    issue_5: {
        issueNumber: 5,
        title: 'Флоренция (Florence)',
        url: 'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/317515/',
        expectedLibrary: 'bmlonline',
        description: 'Biblioteca Medicea Laurenziana'
    },
    issue_6: {
        issueNumber: 6,
        title: 'Бордо (Bordeaux)',
        url: 'https://selene.bordeaux.fr/ark:/27705/330636101_MS_0778',
        expectedLibrary: 'bordeaux',
        description: 'Bordeaux Municipal Library'
    },
    issue_11: {
        issueNumber: 11,
        title: 'BNE',
        url: 'https://bdh-rd.bne.es/viewer.vm?id=0000007619&page=1',
        expectedLibrary: 'bne',
        description: 'Biblioteca Nacional de España'
    },
    issue_25: {
        issueNumber: 25,
        title: 'линц (Linz)',
        url: 'https://digi.landesbibliothek.at/viewer/image/116/',
        expectedLibrary: 'linz',
        description: 'Upper Austrian State Library'
    }
};

export class ProductionCodeTester {
    private loaders: SharedManifestLoaders;
    private results: Record<string, TestResult> = {};
    private detailedErrors: Record<string, DetailedError> = {};

    constructor() {
        this.loaders = new SharedManifestLoaders();
    }

    async testLibrary(testId: string, config: TestCase): Promise<boolean> {
        console.log(`\n=== Testing ${config.title} ===`);
        console.log(`Issue #${config.issueNumber}: ${config.description}`);
        console.log(`URL: ${config.url}`);
        
        try {
            // Step 1: Test library detection
            const detectedLibrary = this.detectLibrary(config.url);
            console.log(`Detected library: ${detectedLibrary || 'NONE'}`);
            
            if (!detectedLibrary) {
                throw new Error('Library not detected from URL');
            }
            
            // Step 2: Test manifest loading using actual production method
            console.log('Loading manifest...');
            const manifest = await this.loaders.getManifestForLibrary(detectedLibrary, config.url);
            
            if (!manifest) {
                throw new Error('Manifest returned null or undefined');
            }
            
            // Step 3: Validate manifest structure
            // Support both IIIF format (with sequences) and simple format (with images array)
            let pageCount: number;
            if ((manifest as any).sequences && (manifest as any).sequences[0] && (manifest as any).sequences[0].canvases) {
                pageCount = (manifest as any).sequences[0].canvases.length;
            } else if ((manifest as EnhancedManifest).images && Array.isArray((manifest as EnhancedManifest).images)) {
                pageCount = (manifest as EnhancedManifest).images.length;
            } else {
                throw new Error('Invalid manifest structure - missing sequences/canvases or images array');
            }
            
            console.log(`✅ SUCCESS: Loaded manifest with ${pageCount} pages`);
            
            // Step 4: Test page image extraction
            let imageUrl: string | null = null;
            if ((manifest as any).sequences && (manifest as any).sequences[0]) {
                const firstCanvas = (manifest as any).sequences[0].canvases[0];
                imageUrl = this.extractImageUrl(firstCanvas);
            } else if ((manifest as EnhancedManifest).images && (manifest as EnhancedManifest).images[0]) {
                const firstImage = (manifest as EnhancedManifest).images[0];
                imageUrl = firstImage.url || (firstImage as any)['@id'];
            }
            if (imageUrl) {
                console.log(`First page image: ${imageUrl}`);
            }
            
            this.results[testId] = {
                success: true,
                library: detectedLibrary,
                pageCount: pageCount,
                manifestLoaded: true
            };
            
            return true;
            
        } catch (error: any) {
            console.log(`❌ FAILED: ${error.message}`);
            
            this.results[testId] = {
                success: false,
                error: error.message,
                stack: error.stack
            };
            
            this.detailedErrors[testId] = {
                issue: config.issueNumber,
                title: config.title,
                url: config.url,
                error: error.message,
                needsFix: true
            };
            
            return false;
        }
    }
    
    detectLibrary(url: string): string | null {
        // Use production detection logic - matching SharedManifestLoaders
        if (url.includes('digi.landesbibliothek.at')) return 'linz'; // Upper Austrian State Library
        if (url.includes('unipub.uni-graz.at')) return 'graz'; // University of Graz
        if (url.includes('themorgan.org')) return 'morgan';
        if (url.includes('contentdm.oclc.org')) return 'florence'; // Florence uses ContentDM
        if (url.includes('bordeaux.fr')) return 'bordeaux';
        if (url.includes('bne.es')) return 'bne';
        
        return null;
    }
    
    extractImageUrl(canvas: CanvasInfo): string | null {
        if (canvas.images && canvas.images[0]) {
            const image = canvas.images[0];
            if (image.resource) {
                return (image.resource as any)['@id'] || image.resource.id || null;
            }
        }
        return null;
    }
    
    async runAllTests(): Promise<boolean> {
        console.log('=== PRODUCTION CODE TEST FRAMEWORK ===');
        console.log(`Testing ${Object.keys(TEST_CASES).length} issues with exact user URLs\n`);
        
        let successCount = 0;
        let failCount = 0;
        
        for (const [id, config] of Object.entries(TEST_CASES)) {
            const success = await this.testLibrary(id, config);
            if (success) successCount++;
            else failCount++;
        }
        
        // Summary
        console.log('\n=== TEST SUMMARY ===');
        console.log(`Total: ${Object.keys(TEST_CASES).length} issues`);
        console.log(`Success: ${successCount}`);
        console.log(`Failed: ${failCount}`);
        
        if (failCount > 0) {
            console.log('\n=== ISSUES NEEDING FIXES ===');
            for (const [id, error] of Object.entries(this.detailedErrors)) {
                console.log(`Issue #${error.issue} (${error.title}): ${error.error}`);
            }
        }
        
        // Save results
        const reportPath = path.join(__dirname, 'test-results.json');
        fs.writeFileSync(reportPath, JSON.stringify({
            timestamp: new Date().toISOString(),
            results: this.results,
            errors: this.detailedErrors,
            summary: {
                total: Object.keys(TEST_CASES).length,
                success: successCount,
                failed: failCount
            }
        }, null, 2));
        
        console.log(`\nResults saved to: ${reportPath}`);
        
        return failCount === 0;
    }
}

// Run tests if executed directly
if (import.meta.main) {
    const tester = new ProductionCodeTester();
    tester.runAllTests().then(allPassed => {
        process.exit(allPassed ? 0 : 1);
    }).catch(err => {
        console.error('Fatal error:', err);
        process.exit(1);
    });
}

export { TEST_CASES };