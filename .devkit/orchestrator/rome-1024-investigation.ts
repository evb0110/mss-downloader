#!/usr/bin/env bun

/**
 * ULTRATHINK AGENT: Rome 1024 Pages Investigation
 * 
 * Testing BNCR_Ms_SESS_0062 manuscript to understand why it shows 1024 pages
 * when content quality validation should reduce this number.
 */

const manuscriptId = 'BNCR_Ms_SESS_0062';
const collectionType = 'manoscrittoantico';

interface TestResult {
    page: number;
    exists: boolean;
    contentLength: number;
    contentType: string | null;
    responseTime: number;
    error?: string;
}

/**
 * Test specific pages to understand bounds
 */
async function testPageRange(pages: number[]): Promise<TestResult[]> {
    const results: TestResult[] = [];
    
    for (const page of pages) {
        const imageUrl = `http://digitale.bnc.roma.sbn.it/tecadigitale/img/${collectionType}/${manuscriptId}/${manuscriptId}/${page}/original`;
        const startTime = Date.now();
        
        try {
            console.log(`Testing page ${page}...`);
            const response = await fetch(imageUrl, { method: 'HEAD' });
            const responseTime = Date.now() - startTime;
            
            const contentLength = parseInt(response.headers.get('content-length') || '0');
            const contentType = response.headers.get('content-type');
            
            results.push({
                page,
                exists: response.ok,
                contentLength,
                contentType,
                responseTime
            });
            
            console.log(`Page ${page}: ${response.ok ? 'EXISTS' : 'NOT FOUND'} (${contentLength} bytes, ${responseTime}ms)`);
            
        } catch (error) {
            const responseTime = Date.now() - startTime;
            const errorMsg = error instanceof Error ? error.message : String(error);
            
            results.push({
                page,
                exists: false,
                contentLength: 0,
                contentType: null,
                responseTime,
                error: errorMsg
            });
            
            console.log(`Page ${page}: ERROR - ${errorMsg} (${responseTime}ms)`);
        }
        
        // Delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return results;
}

/**
 * Simulate the binary search algorithm to see where it goes wrong
 */
async function simulateBinarySearch(): Promise<number> {
    console.log('\n🔍 SIMULATING BINARY SEARCH ALGORITHM');
    console.log('=' .repeat(50));
    
    let upperBound = 1;
    let attempts = 0;
    const maxAttempts = 10;
    
    // Find upper bound (mimicking RomeLoader logic)
    console.log('\nPhase 1: Finding upper bound by doubling...');
    while (attempts < maxAttempts) {
        const imageUrl = `http://digitale.bnc.roma.sbn.it/tecadigitale/img/${collectionType}/${manuscriptId}/${manuscriptId}/${upperBound}/original`;
        
        try {
            console.log(`Testing upper bound: ${upperBound}`);
            const response = await fetch(imageUrl, { method: 'HEAD' });
            
            if (response.ok) {
                const contentLength = parseInt(response.headers.get('content-length') || '0');
                const contentType = response.headers.get('content-type');
                
                const isValidImage = contentLength > 1000 && 
                                    contentType && contentType.includes('image');
                
                if (!isValidImage) {
                    console.log(`Upper bound found at ${upperBound} (invalid image)`);
                    break;
                }
                
                console.log(`✅ Page ${upperBound} exists (${contentLength} bytes)`);
                upperBound *= 2;
                attempts++;
                
                if (upperBound > 1000) {
                    console.log(`❌ Hit limit at ${upperBound}, breaking...`);
                    break;
                }
            } else {
                console.log(`Upper bound found at ${upperBound} (HTTP ${response.status})`);
                break;
            }
        } catch (error) {
            console.log(`Upper bound found at ${upperBound} (ERROR: ${error})`);
            break;
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`\nPhase 2: Binary search between ${Math.floor(upperBound / 2)} and ${upperBound}`);
    
    // Binary search
    let low = Math.floor(upperBound / 2);
    let high = upperBound;
    
    while (low < high - 1) {
        const mid = Math.floor((low + high) / 2);
        const imageUrl = `http://digitale.bnc.roma.sbn.it/tecadigitale/img/${collectionType}/${manuscriptId}/${manuscriptId}/${mid}/original`;
        
        try {
            console.log(`Binary search: testing page ${mid} (range: ${low}-${high})`);
            const response = await fetch(imageUrl, { method: 'HEAD' });
            
            if (response.ok) {
                const contentLength = parseInt(response.headers.get('content-length') || '0');
                const contentType = response.headers.get('content-type');
                
                const isValidImage = contentLength > 1000 && 
                                    contentType && contentType.includes('image');
                
                if (isValidImage) {
                    console.log(`✅ Page ${mid} exists, moving low to ${mid}`);
                    low = mid;
                } else {
                    console.log(`❌ Page ${mid} invalid, moving high to ${mid}`);
                    high = mid;
                }
            } else {
                console.log(`❌ Page ${mid} not found, moving high to ${mid}`);
                high = mid;
            }
        } catch (error) {
            console.log(`❌ Page ${mid} error, moving high to ${mid}`);
            high = mid;
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Final check
    const imageUrl = `http://digitale.bnc.roma.sbn.it/tecadigitale/img/${collectionType}/${manuscriptId}/${manuscriptId}/${high}/original`;
    try {
        const response = await fetch(imageUrl, { method: 'HEAD' });
        const exists = response.ok && 
                      parseInt(response.headers.get('content-length') || '0') > 1000;
        
        const finalPageCount = exists ? high : low;
        console.log(`\n🎯 Binary search result: ${finalPageCount} pages`);
        return finalPageCount;
    } catch {
        console.log(`\n🎯 Binary search result: ${low} pages`);
        return low;
    }
}

/**
 * Test content quality validation logic
 */
async function testContentQuality(detectedPages: number): Promise<number> {
    console.log('\n📊 TESTING CONTENT QUALITY VALIDATION');
    console.log('=' .repeat(50));
    
    if (detectedPages < 10) {
        console.log('Skipping validation for small manuscript');
        return detectedPages;
    }
    
    // Sample 3 representative pages from middle section
    const sampleIndices = [
        Math.floor(detectedPages * 0.3),
        Math.floor(detectedPages * 0.5), 
        Math.floor(detectedPages * 0.7)
    ];
    
    console.log(`Sampling pages: ${sampleIndices.join(', ')}`);
    
    let totalSampleSize = 0;
    let validSamples = 0;
    
    for (const pageNum of sampleIndices) {
        const imageUrl = `http://digitale.bnc.roma.sbn.it/tecadigitale/img/${collectionType}/${manuscriptId}/${manuscriptId}/${pageNum}/original`;
        
        try {
            const response = await fetch(imageUrl, { method: 'HEAD' });
            
            if (response.ok) {
                const contentLength = parseInt(response.headers.get('content-length') || '0');
                const contentType = response.headers.get('content-type');
                
                if (contentType && contentType.includes('image') && contentLength > 0) {
                    totalSampleSize += contentLength;
                    validSamples++;
                    console.log(`✅ Page ${pageNum}: ${Math.round(contentLength / 1024)}KB`);
                }
            }
        } catch (error) {
            console.log(`❌ Page ${pageNum}: ERROR`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (validSamples === 0) {
        console.log('No valid samples for content quality analysis');
        return detectedPages;
    }
    
    const averagePageSize = totalSampleSize / validSamples;
    const minAcceptableSize = averagePageSize * 0.3; // 30% of average
    
    console.log(`Average content size: ${Math.round(averagePageSize / 1024)}KB`);
    console.log(`Minimum acceptable: ${Math.round(minAcceptableSize / 1024)}KB`);
    
    // Check final 15 pages for minimal content
    const finalCheckStart = Math.max(1, detectedPages - 14);
    let lastSubstantialPage = detectedPages;
    
    console.log(`\nChecking final pages ${finalCheckStart}-${detectedPages} for minimal content...`);
    
    for (let pageNum = detectedPages; pageNum >= finalCheckStart; pageNum--) {
        const imageUrl = `http://digitale.bnc.roma.sbn.it/tecadigitale/img/${collectionType}/${manuscriptId}/${manuscriptId}/${pageNum}/original`;
        
        try {
            const response = await fetch(imageUrl, { method: 'HEAD' });
            
            if (response.ok) {
                const contentLength = parseInt(response.headers.get('content-length') || '0');
                const contentType = response.headers.get('content-type');
                
                if (contentType && contentType.includes('image') && contentLength >= minAcceptableSize) {
                    lastSubstantialPage = pageNum;
                    console.log(`✅ Page ${pageNum}: ${Math.round(contentLength / 1024)}KB - Above threshold, substantial content`);
                    break;
                } else {
                    console.log(`❌ Page ${pageNum}: ${Math.round(contentLength / 1024)}KB - Below threshold, minimal content`);
                }
            }
        } catch {
            console.log(`❌ Page ${pageNum}: ERROR`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (lastSubstantialPage < detectedPages) {
        console.log(`\n🎯 Content quality filter: ${detectedPages} → ${lastSubstantialPage} pages`);
        console.log(`   Filtered ${detectedPages - lastSubstantialPage} minimal-content pages`);
        return lastSubstantialPage;
    }
    
    console.log(`\n🎯 All ${detectedPages} pages have substantial content`);
    return detectedPages;
}

/**
 * Main investigation function
 */
async function investigateRome1024Issue(): Promise<void> {
    console.log('🔬 ULTRATHINK AGENT: Rome 1024 Pages Investigation');
    console.log('=' .repeat(60));
    console.log(`Manuscript: ${manuscriptId}`);
    console.log(`Collection: ${collectionType}`);
    console.log();
    
    // Phase 1: Test specific page ranges around 1024
    console.log('📋 PHASE 1: Testing specific pages around 1024');
    console.log('=' .repeat(50));
    
    const testPages = [1, 100, 500, 800, 900, 1000, 1020, 1024, 1025, 1030, 1100];
    const results = await testPageRange(testPages);
    
    // Analyze results
    const existingPages = results.filter(r => r.exists);
    const lastExistingPage = existingPages.length > 0 ? 
                            Math.max(...existingPages.map(r => r.page)) : 0;
    
    console.log(`\n📊 Phase 1 Results:`);
    console.log(`   Last existing page found: ${lastExistingPage}`);
    console.log(`   Pages that exist: ${existingPages.map(r => r.page).join(', ')}`);
    
    // Phase 2: Simulate binary search algorithm
    const binarySearchResult = await simulateBinarySearch();
    
    // Phase 3: Test content quality validation
    const qualityValidatedResult = await testContentQuality(binarySearchResult);
    
    // Final analysis
    console.log('\n🎯 FINAL ANALYSIS');
    console.log('=' .repeat(60));
    console.log(`Phase 1 - Direct testing last page: ${lastExistingPage}`);
    console.log(`Phase 2 - Binary search result: ${binarySearchResult}`);
    console.log(`Phase 3 - After content quality: ${qualityValidatedResult}`);
    
    // Identify the issue
    if (binarySearchResult === 1024) {
        console.log('\n🚨 ISSUE IDENTIFIED: Binary search is stopping at exactly 1024!');
        console.log('   This suggests the algorithm is hitting a power-of-2 limit.');
        console.log('   1024 = 2^10, which indicates the upper bound doubling stopped at 1024.');
    }
    
    if (binarySearchResult === qualityValidatedResult) {
        console.log('\n⚠️  CONTENT QUALITY VALIDATION NOT WORKING');
        console.log('   The validation should reduce the page count if final pages have minimal content.');
    }
    
    if (lastExistingPage < binarySearchResult) {
        console.log('\n🎯 RECOMMENDED FIX:');
        console.log(`   Actual last page appears to be around ${lastExistingPage}`);
        console.log(`   Binary search is overestimating by ${binarySearchResult - lastExistingPage} pages`);
    }
}

// Run the investigation
investigateRome1024Issue().catch(console.error);