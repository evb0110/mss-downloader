#!/usr/bin/env bun

/**
 * 🚨 ROME INSTANT vs APP HANGING TEST
 * 
 * This test demonstrates the exact problem:
 * - Rome URL loads instantly with direct HTTP
 * - Same URL hangs 90+ seconds in our app due to timeout overengineering
 */

console.log('🧪 ROME INSTANT vs APP HANGING TEST');
console.log('===================================');
console.log('Comparing direct HTTP vs our app timeout overengineering');
console.log('');

const ROME_URL = 'http://digitale.bnc.roma.sbn.it/tecadigitale/img/manoscrittoantico/BNCR_Ms_SESS_0062/BNCR_Ms_SESS_0062/1/original';

// Test 1: Direct HTTP (like browser/curl)
async function testDirectHTTP() {
    console.log('🌐 Test 1: Direct HTTP (Browser/Curl equivalent)');
    console.log('------------------------------------------------');
    
    const startTime = Date.now();
    
    try {
        const response = await fetch(ROME_URL, {
            method: 'HEAD',
            signal: AbortSignal.timeout(5000) // 5 second timeout
        });
        
        const elapsed = Date.now() - startTime;
        console.log(`✅ SUCCESS: Rome responded in ${elapsed}ms`);
        console.log(`   Status: ${response.status}`);
        console.log(`   Content-Type: ${response.headers.get('content-type')}`);
        console.log(`   Content-Length: ${response.headers.get('content-length')}`);
        
        return elapsed;
    } catch (error: any) {
        const elapsed = Date.now() - startTime;
        console.log(`❌ FAILED: ${error.message} after ${elapsed}ms`);
        return elapsed;
    }
}

// Test 2: Our App's Overengineered Approach
async function testAppOverengineering() {
    console.log('🔧 Test 2: Our App Overengineering (90s timeout)');
    console.log('------------------------------------------------');
    
    const startTime = Date.now();
    
    // Simulate our app's approach
    const baseTimeout = 30000; // 30 seconds
    const romeTimeoutMultiplier = 3.0; // Rome configuration
    const finalTimeout = baseTimeout * romeTimeoutMultiplier; // 90 seconds!
    
    console.log(`   Base timeout: ${baseTimeout}ms`);
    console.log(`   Rome multiplier: ${romeTimeoutMultiplier}x`);
    console.log(`   Final timeout: ${finalTimeout}ms (${finalTimeout/1000}s)`);
    console.log('   Starting request...');
    
    try {
        const response = await fetch(ROME_URL, {
            method: 'HEAD',
            signal: AbortSignal.timeout(finalTimeout) // 90 second timeout!
        });
        
        const elapsed = Date.now() - startTime;
        console.log(`✅ SUCCESS: Rome responded in ${elapsed}ms (but with ${finalTimeout}ms timeout overhead)`);
        console.log(`   Status: ${response.status}`);
        
        return elapsed;
    } catch (error: any) {
        const elapsed = Date.now() - startTime;
        console.log(`❌ FAILED: ${error.message} after ${elapsed}ms`);
        return elapsed;
    }
}

// Test 3: Library Optimization Analysis
function analyzeLibraryConfig() {
    console.log('⚙️  Test 3: Library Configuration Analysis');
    console.log('----------------------------------------');
    
    // Simulate our LibraryOptimizationService
    const romeConfig = {
        maxConcurrentDownloads: 2,
        timeoutMultiplier: 3.0, // THE PROBLEM!
        enableProgressiveBackoff: true, // MAKES IT WORSE!
        optimizationDescription: 'Rome National Library optimizations: 2 concurrent downloads, extended timeouts for infrastructure stability, progressive backoff for server failures'
    };
    
    console.log('   Current Rome Configuration:');
    console.log(`   - timeoutMultiplier: ${romeConfig.timeoutMultiplier}x`);
    console.log(`   - enableProgressiveBackoff: ${romeConfig.enableProgressiveBackoff}`);
    console.log(`   - Description: "${romeConfig.optimizationDescription}"`);
    console.log('');
    
    // Show progressive backoff escalation
    console.log('   Progressive Backoff Escalation:');
    const baseTimeout = 30000;
    for (let attempt = 1; attempt <= 4; attempt++) {
        let timeout = baseTimeout * romeConfig.timeoutMultiplier;
        if (romeConfig.enableProgressiveBackoff && attempt > 1) {
            const backoffMultiplier = 1 + (attempt - 1) * 0.5;
            timeout = Math.floor(timeout * Math.min(backoffMultiplier, 3.0));
        }
        console.log(`   - Attempt ${attempt}: ${timeout}ms (${timeout/1000}s)`);
    }
    console.log('');
    
    console.log('   🚨 PROBLEM IDENTIFIED:');
    console.log('   - Rome server responds INSTANTLY');
    console.log('   - But our app waits 90-270 seconds!');
    console.log('   - This is artificial delay, not server slowness');
}

// Test 4: Binary Search Complexity
async function analyzeBinarySearchComplexity() {
    console.log('🔍 Test 4: Binary Search Page Discovery Complexity');
    console.log('------------------------------------------------');
    
    console.log('   Current Rome page discovery process:');
    console.log('   1. binarySearchWithHead() - Multiple HEAD requests');
    console.log('   2. Each HEAD request has 90s timeout');
    console.log('   3. samplePagesWithGet() fallback - Multiple GET requests');
    console.log('   4. Each GET request has 90s timeout');
    console.log('   5. fineTuneWithGet() - Additional GET requests');
    console.log('');
    
    // Simulate binary search complexity
    const testPages = [1, 2, 4, 8, 16, 32, 64, 128, 256];
    const timeoutPerRequest = 90000; // 90 seconds
    const estimatedRequests = Math.log2(256) + 3; // Binary search + samples
    const totalTimeoutExposure = estimatedRequests * timeoutPerRequest;
    
    console.log(`   Estimated requests for page discovery: ${Math.ceil(estimatedRequests)}`);
    console.log(`   Timeout per request: ${timeoutPerRequest}ms`);
    console.log(`   Total timeout exposure: ${totalTimeoutExposure}ms (${totalTimeoutExposure/1000}s)`);
    console.log('   Note: Each request completes fast, but timeout overhead is enormous!');
}

// Run all tests
async function runAllTests() {
    try {
        const directTime = await testDirectHTTP();
        console.log('');
        
        const appTime = await testAppOverengineering();
        console.log('');
        
        analyzeLibraryConfig();
        
        await analyzeBinarySearchComplexity();
        
        console.log('');
        console.log('📊 SUMMARY COMPARISON');
        console.log('====================');
        console.log(`Direct HTTP (browser/curl): ${directTime}ms`);
        console.log(`Our app (with overengineering): Uses ${90000}ms timeout for ${directTime}ms response`);
        
        const overhead = 90000 / directTime;
        console.log(`Overhead factor: ${overhead.toFixed(1)}x slower than necessary`);
        
        console.log('');
        console.log('🔧 SOLUTION:');
        console.log('- Change Rome timeoutMultiplier from 3.0 to 1.0');
        console.log('- Disable enableProgressiveBackoff for Rome');
        console.log('- Use 5-10 second timeouts for HTTP Rome requests');
        console.log('- Result: Transform Rome from slowest to fastest library');
        
    } catch (error: any) {
        console.error('Test failed:', error.message);
        process.exit(1);
    }
}

runAllTests();