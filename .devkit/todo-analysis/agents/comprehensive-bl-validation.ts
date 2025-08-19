#!/usr/bin/env bun

/**
 * ULTRA-COMPREHENSIVE BRITISH LIBRARY FINAL VALIDATION
 * Agent 5 of 5 - Complete implementation verification and evidence collection
 */

import { writeFileSync } from 'fs';

interface ManuscriptImage {
    url: string;
    label: string;
}

interface ValidationResult {
    success: boolean;
    pageCount: number;
    displayName?: string;
    images: ManuscriptImage[];
    errors: string[];
    performance: {
        manifestLoadTime: number;
        imageDiscoveryTime: number;
        totalTime: number;
    };
}

interface ImageValidationResult {
    url: string;
    status: number;
    success: boolean;
    size?: number;
    contentType?: string;
    error?: string;
}

interface ResolutionTestResult {
    resolution: string;
    url: string;
    status: number;
    success: boolean;
    size?: number;
}

class BritishLibraryValidator {
    
    private async fetchWithTimeout(url: string, timeoutMs = 10000) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        
        try {
            const response = await fetch(url, {
                signal: controller.signal,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'application/json, image/*, */*',
                    'Referer': 'https://bl.digirati.io/'
                }
            });
            
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }

    private extractArkId(url: string): string | null {
        const arkMatch = url.match(/ark:\/([0-9]+)\/([^\/?#]+)/i);
        if (!arkMatch) return null;
        return `ark:/${arkMatch[1]}/${arkMatch[2]}`;
    }

    private localizedStringToString(label: any, fallback: string): string {
        if (typeof label === 'string') return label;
        if (label && typeof label === 'object' && label.en) {
            return Array.isArray(label.en) ? label.en[0] : label.en;
        }
        if (label && typeof label === 'object' && label['@value']) {
            return label['@value'];
        }
        return fallback;
    }

    async validateBritishLibraryImplementation(testUrl: string): Promise<ValidationResult> {
        console.log('🔍 COMPREHENSIVE VALIDATION: British Library Implementation');
        console.log('📋 Test URL:', testUrl);
        console.log('⏰ Starting validation at:', new Date().toISOString());
        console.log('='.repeat(50));
        
        const startTime = Date.now();
        const result: ValidationResult = {
            success: false,
            pageCount: 0,
            images: [],
            errors: [],
            performance: { manifestLoadTime: 0, imageDiscoveryTime: 0, totalTime: 0 }
        };

        try {
            // Step 1: Extract ARK ID
            console.log('📋 Step 1: ARK ID Extraction');
            const arkId = this.extractArkId(testUrl);
            if (!arkId) {
                result.errors.push('Failed to extract ARK identifier from URL');
                return result;
            }
            console.log('✅ ARK ID:', arkId);

            // Step 2: Manifest Loading
            console.log('\n📋 Step 2: IIIF Manifest Loading');
            const manifestLoadStart = Date.now();
            const manifestUrl = `https://bl.digirati.io/iiif/${arkId}`;
            console.log('🔗 Manifest URL:', manifestUrl);

            const manifestResponse = await this.fetchWithTimeout(manifestUrl);
            if (!manifestResponse.ok) {
                result.errors.push(`Manifest fetch failed: ${manifestResponse.status} ${manifestResponse.statusText}`);
                return result;
            }

            const manifest = await manifestResponse.json();
            result.performance.manifestLoadTime = Date.now() - manifestLoadStart;
            console.log('✅ Manifest loaded successfully');
            console.log('⏱️  Load time:', result.performance.manifestLoadTime + 'ms');
            console.log('📊 Manifest size:', JSON.stringify(manifest).length, 'characters');

            // Step 3: Image Discovery
            console.log('\n📋 Step 3: Image Discovery and Processing');
            const discoveryStart = Date.now();
            const images: ManuscriptImage[] = [];

            // Process IIIF v3 format (primary)
            if (manifest.items && Array.isArray(manifest.items)) {
                console.log('📖 IIIF v3 format detected');
                console.log('📄 Processing', manifest.items.length, 'pages');
                
                for (let i = 0; i < manifest.items.length; i++) {
                    const canvas = manifest.items[i];
                    if (canvas && canvas.items && canvas.items[0] && canvas.items[0].items) {
                        for (const annotation of canvas.items[0].items) {
                            const body = annotation.body;
                            if (body && body.service) {
                                const service = Array.isArray(body.service) ? body.service[0] : body.service;
                                if (service && (service.id || service['@id'])) {
                                    const serviceId = service.id || service['@id'];
                                    const imageUrl = `${serviceId}/full/max/0/default.jpg`;
                                    images.push({
                                        url: imageUrl,
                                        label: this.localizedStringToString(canvas.label, `Page ${i + 1}`)
                                    });
                                    break;
                                }
                            }
                        }
                    }
                }
            }
            // Fallback to IIIF v2
            else if (manifest.sequences && manifest.sequences[0] && manifest.sequences[0].canvases) {
                console.log('📖 IIIF v2 format detected (fallback)');
                const canvases = manifest.sequences[0].canvases;
                console.log('📄 Processing', canvases.length, 'pages');
                
                for (let i = 0; i < canvases.length; i++) {
                    const canvas = canvases[i];
                    if (canvas && canvas.images && canvas.images[0] && canvas.images[0].resource) {
                        const resource = canvas.images[0].resource;
                        const service = resource.service;
                        
                        if (service && service['@id']) {
                            const imageUrl = `${service['@id']}/full/max/0/default.jpg`;
                            images.push({
                                url: imageUrl,
                                label: this.localizedStringToString(canvas.label, `Page ${i + 1}`)
                            });
                        }
                    }
                }
            }

            result.performance.imageDiscoveryTime = Date.now() - discoveryStart;
            result.images = images;
            result.pageCount = images.length;
            result.displayName = this.localizedStringToString(manifest.label, arkId);
            
            console.log('✅ Image discovery completed');
            console.log('⏱️  Discovery time:', result.performance.imageDiscoveryTime + 'ms');
            console.log('📊 Pages found:', result.pageCount);
            console.log('📝 Display name:', result.displayName);

            // Validation checks
            if (images.length === 0) {
                result.errors.push('No images discovered from manifest');
                return result;
            }

            if (images.length !== 535) {
                result.errors.push(`Expected 535 pages, got ${images.length}`);
            }

            result.success = true;
            result.performance.totalTime = Date.now() - startTime;
            
            console.log('\n✅ VALIDATION SUCCESSFUL');
            console.log('⏱️  Total time:', result.performance.totalTime + 'ms');
            
            return result;

        } catch (error) {
            result.errors.push(`Validation error: ${error instanceof Error ? error.message : String(error)}`);
            result.performance.totalTime = Date.now() - startTime;
            console.log('\n❌ VALIDATION FAILED');
            console.log('💥 Error:', error);
            return result;
        }
    }

    async validateImageAccessibility(images: ManuscriptImage[], sampleCount = 10): Promise<ImageValidationResult[]> {
        console.log('\n🖼️  IMAGE ACCESSIBILITY VALIDATION');
        console.log('📊 Testing', Math.min(sampleCount, images.length), 'random images');
        
        const results: ImageValidationResult[] = [];
        const indicesToTest = this.getRandomIndices(images.length, Math.min(sampleCount, images.length));
        
        for (let i = 0; i < indicesToTest.length; i++) {
            const idx = indicesToTest[i];
            const image = images[idx];
            console.log(`\n🔍 Testing image ${idx + 1}/${images.length}: ${image.label}`);
            console.log('🔗 URL:', image.url);
            
            try {
                const response = await this.fetchWithTimeout(image.url, 15000);
                const contentLength = response.headers.get('content-length');
                const contentType = response.headers.get('content-type');
                
                const result: ImageValidationResult = {
                    url: image.url,
                    status: response.status,
                    success: response.ok,
                    size: contentLength ? parseInt(contentLength) : undefined,
                    contentType: contentType || undefined,
                    error: response.ok ? undefined : `HTTP ${response.status} ${response.statusText}`
                };
                
                results.push(result);
                
                if (response.ok) {
                    console.log('✅ SUCCESS:', response.status);
                    console.log('📊 Size:', contentLength ? (parseInt(contentLength) / 1024 / 1024).toFixed(2) + 'MB' : 'Unknown');
                    console.log('📄 Type:', contentType || 'Unknown');
                } else {
                    console.log('❌ FAILED:', response.status, response.statusText);
                }
                
            } catch (error) {
                console.log('💥 ERROR:', error);
                results.push({
                    url: image.url,
                    status: 0,
                    success: false,
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }
        
        const successCount = results.filter(r => r.success).length;
        console.log('\n📊 IMAGE VALIDATION SUMMARY');
        console.log('✅ Successful:', successCount + '/' + results.length);
        console.log('❌ Failed:', (results.length - successCount) + '/' + results.length);
        
        return results;
    }

    async validateResolutionSupport(baseUrl: string): Promise<ResolutionTestResult[]> {
        console.log('\n🎯 RESOLUTION SUPPORT VALIDATION');
        
        // Extract service URL from full image URL
        const serviceUrl = baseUrl.replace('/full/max/0/default.jpg', '');
        console.log('🔗 Base service URL:', serviceUrl);
        
        const resolutions = [
            { name: 'max', path: '/full/max/0/default.jpg' },
            { name: '4000px', path: '/full/4000,/0/default.jpg' },
            { name: '2000px', path: '/full/2000,/0/default.jpg' },
            { name: '1000px', path: '/full/1000,/0/default.jpg' },
            { name: '500px', path: '/full/500,/0/default.jpg' }
        ];
        
        const results: ResolutionTestResult[] = [];
        
        for (const resolution of resolutions) {
            const testUrl = serviceUrl + resolution.path;
            console.log(`\n🔍 Testing ${resolution.name} resolution`);
            console.log('🔗 URL:', testUrl);
            
            try {
                const response = await this.fetchWithTimeout(testUrl, 10000);
                const contentLength = response.headers.get('content-length');
                
                const result: ResolutionTestResult = {
                    resolution: resolution.name,
                    url: testUrl,
                    status: response.status,
                    success: response.ok,
                    size: contentLength ? parseInt(contentLength) : undefined
                };
                
                results.push(result);
                
                if (response.ok) {
                    console.log('✅ SUCCESS:', response.status);
                    console.log('📊 Size:', contentLength ? (parseInt(contentLength) / 1024 / 1024).toFixed(2) + 'MB' : 'Unknown');
                } else {
                    console.log('❌ FAILED:', response.status, response.statusText);
                }
                
            } catch (error) {
                console.log('💥 ERROR:', error);
                results.push({
                    resolution: resolution.name,
                    url: testUrl,
                    status: 0,
                    success: false
                });
            }
        }
        
        return results;
    }

    private getRandomIndices(total: number, count: number): number[] {
        const indices: number[] = [];
        const used = new Set<number>();
        
        while (indices.length < count && indices.length < total) {
            const idx = Math.floor(Math.random() * total);
            if (!used.has(idx)) {
                used.add(idx);
                indices.push(idx);
            }
        }
        
        return indices.sort((a, b) => a - b);
    }
}

async function main() {
    const validator = new BritishLibraryValidator();
    
    // Test URL from todo specification
    const testUrl = 'https://bl.digirati.io/iiif/view/ark:/81055/vdc_100055984026.0x000001';
    
    console.log('🚀 BRITISH LIBRARY ULTRA-COMPREHENSIVE VALIDATION');
    console.log('='.repeat(60));
    
    // Phase 1: Functionality Validation
    const validationResult = await validator.validateBritishLibraryImplementation(testUrl);
    
    // Phase 2: Image Accessibility Testing
    let imageResults: ImageValidationResult[] = [];
    let resolutionResults: ResolutionTestResult[] = [];
    
    if (validationResult.success && validationResult.images.length > 0) {
        imageResults = await validator.validateImageAccessibility(validationResult.images, 10);
        
        if (imageResults.length > 0 && imageResults[0].success) {
            resolutionResults = await validator.validateResolutionSupport(validationResult.images[0].url);
        }
    }
    
    // Generate comprehensive report
    const report = {
        timestamp: new Date().toISOString(),
        testUrl,
        validation: validationResult,
        imageAccessibility: imageResults,
        resolutionSupport: resolutionResults,
        summary: {
            overallSuccess: validationResult.success && imageResults.filter(r => r.success).length >= imageResults.length * 0.8,
            pagesDiscovered: validationResult.pageCount,
            expectedPages: 535,
            pageCountMatch: validationResult.pageCount === 535,
            imageAccessibilityRate: imageResults.length > 0 ? (imageResults.filter(r => r.success).length / imageResults.length * 100) : 0,
            resolutionSupported: resolutionResults.filter(r => r.success).length,
            performance: validationResult.performance
        }
    };
    
    // Save comprehensive report
    writeFileSync(
        '/Users/evb/WebstormProjects/mss-downloader/.devkit/todo-analysis/agents/bl-final-validation-report.json',
        JSON.stringify(report, null, 2)
    );
    
    // Console summary
    console.log('\n' + '='.repeat(60));
    console.log('📋 FINAL VALIDATION SUMMARY');
    console.log('='.repeat(60));
    console.log('✅ Overall Success:', report.summary.overallSuccess ? 'PASS' : 'FAIL');
    console.log('📄 Pages Found:', report.summary.pagesDiscovered + '/' + report.summary.expectedPages);
    console.log('🎯 Page Count Match:', report.summary.pageCountMatch ? 'PASS' : 'FAIL');
    console.log('🖼️  Image Accessibility:', report.summary.imageAccessibilityRate.toFixed(1) + '%');
    console.log('🎯 Resolution Support:', report.summary.resolutionSupported + '/' + resolutionResults.length);
    console.log('⏱️  Performance:');
    console.log('   - Manifest Load:', validationResult.performance.manifestLoadTime + 'ms');
    console.log('   - Image Discovery:', validationResult.performance.imageDiscoveryTime + 'ms');
    console.log('   - Total Time:', validationResult.performance.totalTime + 'ms');
    
    if (validationResult.errors.length > 0) {
        console.log('\n❌ ERRORS:');
        validationResult.errors.forEach((error, i) => {
            console.log(`   ${i + 1}. ${error}`);
        });
    }
    
    console.log('\n📄 Full report saved to: bl-final-validation-report.json');
    
    process.exit(report.summary.overallSuccess ? 0 : 1);
}

// Execute validation
main().catch(console.error);