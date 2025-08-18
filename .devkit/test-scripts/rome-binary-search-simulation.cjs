#!/usr/bin/env node

const http = require('http');

// Simulate the exact fetchDirect method behavior 
function fetchDirect(url, options = {}) {
    return new Promise((resolve, reject) => {
        const method = options.method || 'GET';
        console.log(`[fetchDirect] ${method} ${url}`);
        
        const req = http.request(url, { 
            method: method,
            timeout: 10000 
        }, (res) => {
            const response = {
                ok: res.statusCode >= 200 && res.statusCode < 300,
                status: res.statusCode,
                statusText: res.statusMessage,
                headers: {
                    get: (name) => res.headers[name.toLowerCase()]
                }
            };
            
            resolve(response);
        });
        
        req.on('error', (err) => {
            console.log(`[fetchDirect] Error: ${err.message}`);
            reject(err);
        });
        
        req.on('timeout', () => {
            console.log(`[fetchDirect] Timeout`);
            req.destroy();
            reject(new Error('Request timeout'));
        });
        
        req.end();
    });
}

// Simulate the exact checkPageExists method from RomeLoader.ts
async function checkPageExists(collectionType, manuscriptId, pageNum) {
    const imageUrl = `http://digitale.bnc.roma.sbn.it/tecadigitale/img/${collectionType}/${manuscriptId}/${manuscriptId}/${pageNum}/original`;
    
    try {
        console.log(`\n[checkPageExists] Testing page ${pageNum}...`);
        
        // ULTRATHINK FIX: Use HEAD for existence check, GET was downloading entire images
        const response = await fetchDirect(imageUrl, {
            method: 'HEAD'
        });
        
        console.log(`[checkPageExists] Response - Status: ${response.status}, OK: ${response.ok}`);
        
        if (response.ok) {
            const contentType = response.headers.get('content-type');
            console.log(`[checkPageExists] Content-Type: ${contentType || 'not set'}`);
            
            // Rome returns 200 OK with text/html for non-existent pages
            // Real pages have image/jpeg content type
            if (contentType && contentType.includes('text/html')) {
                console.log(`[checkPageExists] Page ${pageNum}: ❌ Phantom page detected - HTML response`);
                return false;
            }
            
            // Valid image if it has image content type
            // Don't rely on content-length as it's not always provided by HEAD
            const isValidImage = contentType && contentType.includes('image');
            
            if (isValidImage) {
                console.log(`[checkPageExists] Page ${pageNum}: ✅ Exists (${contentType})`);
                return true;
            } else {
                console.log(`[checkPageExists] Page ${pageNum}: ❌ Invalid (${contentType || 'no type'})`);
                return false;
            }
        }
        
        console.log(`[checkPageExists] Page ${pageNum}: ❌ Not OK status`);
        return false;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.log(`[checkPageExists] Page ${pageNum}: ❌ Request failed - ${errorMessage}`);
        return false;
    }
}

// Simulate the exact binary search logic from samplePagesWithGet
async function samplePagesWithGet(collectionType, manuscriptId) {
    console.log(`\n🔍 Starting GET-based binary search for ${manuscriptId}...`);
    
    // First verify page 1 exists
    const page1Exists = await checkPageExists(collectionType, manuscriptId, 1);
    if (!page1Exists) {
        console.log(`\n❌ CRITICAL: Page 1 doesn't exist or returns HTML - manuscript may be invalid`);
        // Still try to find if any pages exist
    } else {
        console.log(`\n✅ Page 1 confirmed to exist`);
    }
    
    // Find upper bound with exponential search - NO CAPS!
    let upperBound = 1;
    let attempts = 0;
    const maxAttempts = 20; // Reasonable iteration limit, not page limit
    
    console.log(`\n🚀 Finding upper bound...`);
    
    // Start searching from a reasonable initial bound
    while (attempts < maxAttempts) {
        console.log(`\n--- Attempt ${attempts + 1}: Testing upperBound ${upperBound} ---`);
        
        const exists = await checkPageExists(collectionType, manuscriptId, upperBound);
        if (!exists) {
            console.log(`\n🎯 Found upper bound at page ${upperBound} (does not exist)`);
            break;
        }
        console.log(`\n✅ Page ${upperBound} exists, doubling upperBound...`);
        upperBound *= 2;
        attempts++;
    }
    
    // If we never found a non-existent page, use the last tested upperBound
    if (attempts >= maxAttempts) {
        console.log(`\n⚠️ Reached max attempts, using upperBound ${upperBound}`);
    }
    
    // Edge case: if upperBound is 1 and page 1 doesn't exist
    if (upperBound === 1 && !page1Exists) {
        console.log(`\n❌ No valid pages found, returning 0`);
        return 0;
    }
    
    // Binary search for exact count
    let low = upperBound === 1 ? 1 : Math.floor(upperBound / 2);
    let high = upperBound;
    
    console.log(`\n🎯 Binary search phase: low=${low}, high=${high}`);
    
    while (low < high - 1) {
        const mid = Math.floor((low + high) / 2);
        console.log(`\n--- Binary search: low=${low}, high=${high}, mid=${mid} ---`);
        
        const exists = await checkPageExists(collectionType, manuscriptId, mid);
        
        if (exists) {
            low = mid;
            console.log(`✅ Mid ${mid} exists, new low=${low}`);
        } else {
            high = mid;
            console.log(`❌ Mid ${mid} doesn't exist, new high=${high}`);
        }
    }
    
    // Final check
    console.log(`\n🏁 Final validation: checking page ${high}`);
    const finalExists = await checkPageExists(collectionType, manuscriptId, high);
    const result = finalExists ? high : low;
    
    console.log(`\n📊 Binary search complete: ${result} pages`);
    console.log(`Final result: ${finalExists ? 'high' : 'low'} = ${result}`);
    
    return result;
}

async function testRomeBinarySearch() {
    console.log('ROME BINARY SEARCH SIMULATION');
    console.log('==============================');
    console.log('Simulating the exact RomeLoader.samplePagesWithGet() logic\n');
    
    const collectionType = 'manoscrittoantico';
    const manuscriptId = 'BNCR_Ms_SESS_0062';
    
    try {
        const pageCount = await samplePagesWithGet(collectionType, manuscriptId);
        console.log(`\n🎉 FINAL RESULT: ${pageCount} pages detected`);
        
        if (pageCount === 1) {
            console.log(`\n🚨 PROBLEM REPRODUCED: Only 1 page detected!`);
            console.log(`This matches the user's report.`);
        } else if (pageCount > 1) {
            console.log(`\n✅ Multiple pages detected, algorithm working.`);
        } else {
            console.log(`\n❌ Zero pages detected, complete failure.`);
        }
        
    } catch (error) {
        console.log(`\n💥 SIMULATION FAILED: ${error.message}`);
    }
}

testRomeBinarySearch();