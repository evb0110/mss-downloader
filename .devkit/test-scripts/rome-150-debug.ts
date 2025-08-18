#!/usr/bin/env bun

import { RomeLoader } from '../../src/main/services/library-loaders/RomeLoader';

console.log('🔍 ROME 150 PAGES DEBUG');
console.log('========================');

// Mock dependencies with detailed logging
const loaderDeps = {
    fetchWithHTTPS: async (url: string, options?: any) => {
        const timeout = options?.timeout || 30000;
        console.log(`[DEBUG] fetchWithHTTPS called:`);
        console.log(`  URL: ${url}`);
        console.log(`  Method: ${options?.method || 'GET'}`);
        console.log(`  Timeout: ${timeout}ms`);
        
        // Simulate network request - let's see what pages it's checking
        const pageNumMatch = url.match(/\/(\d+)\/original$/);
        if (pageNumMatch) {
            const pageNum = parseInt(pageNumMatch[1]);
            console.log(`  → Checking page ${pageNum}`);
            
            // Simulate that pages exist up to a certain number
            // Let's simulate different scenarios to see what causes 150
            
            // Scenario 1: Pages exist up to 150 exactly
            const exists = pageNum <= 150;
            
            if (options?.method === 'HEAD') {
                // Simulate HEAD request failure (ECONNRESET)
                if (Math.random() < 0.7) { // 70% failure rate
                    throw new Error('ECONNRESET: socket hang up');
                }
            }
            
            return {
                ok: exists,
                headers: {
                    get: (name: string) => {
                        if (name === 'content-type' && exists) return 'image/jpeg';
                        if (name === 'content-length' && exists) return '50000';
                        return null;
                    }
                }
            };
        }
        
        return { ok: false, headers: { get: () => null } };
    },
    fetchDirect: async () => { throw new Error('Not implemented'); },
    fetchSSLBypass: async () => { throw new Error('Not implemented'); },
    fetchWithRetry: async () => { throw new Error('Not implemented'); },
    sanitizeUrl: (url: string) => url,
    logger: console,
    configService: {
        get: (key: string) => {
            if (key === 'requestTimeout') return 30000;
            return null;
        }
    }
};

const romeLoader = new RomeLoader(loaderDeps as any);

async function debugRomePageDiscovery() {
    const testUrl = 'http://digitale.bnc.roma.sbn.it/tecadigitale/manoscrittoantico/BNCR_Ms_SESS_0062/BNCR_Ms_SESS_0062/1';
    
    console.log('\n📊 Testing Rome page discovery:');
    console.log(`URL: ${testUrl}`);
    console.log('');
    
    try {
        const result = await romeLoader.loadManifest(testUrl);
        console.log('\n✅ RESULT:');
        console.log(`  Total pages: ${result.totalPages}`);
        console.log(`  Library: ${result.library}`);
        console.log(`  Display name: ${result.displayName}`);
        
        if (result.totalPages === 150) {
            console.log('\n⚠️  WARNING: Got exactly 150 pages!');
            console.log('This suggests:');
            console.log('1. Binary search is stopping at 150');
            console.log('2. OR the server actually has 150 pages');
            console.log('3. OR there\'s a hardcoded limit somewhere');
        }
    } catch (error: any) {
        console.error('\n❌ ERROR:', error.message);
        
        if (error.message.includes('Unable to determine page count')) {
            console.log('\n✅ GOOD: Properly failing without fallback');
        }
    }
}

// Trace the binary search algorithm
console.log('\n🔬 Analyzing binary search behavior:');
console.log('The binary search starts with upperBound = 1');
console.log('Then doubles it: 1 → 2 → 4 → 8 → 16 → 32 → 64 → 128 → 256');
console.log('If it finds page 128 exists but 256 doesn\'t, it searches between 128-256');
console.log('The midpoint would be 192, then if that doesn\'t exist, 160, then 144, then 152, then 148, then 150');
console.log('');

debugRomePageDiscovery();