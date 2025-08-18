#!/usr/bin/env node
/**
 * Clear Rome cache to force fresh page discovery
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');

async function clearRomeCache() {
    console.log('🗑️ Clearing Rome cache to force fresh page discovery...');
    
    // Find the Electron userData path
    let cacheFile;
    
    // Try common locations
    const possiblePaths = [
        path.join(os.homedir(), '.config', 'Electron', 'cache', 'manifests.json'),
        path.join(os.homedir(), '.config', 'Abba Ababus (MSS Downloader)', 'cache', 'manifests.json'),
        path.join(os.homedir(), 'AppData', 'Roaming', 'Abba Ababus (MSS Downloader)', 'cache', 'manifests.json'),
        path.join(os.homedir(), 'Library', 'Application Support', 'Abba Ababus (MSS Downloader)', 'cache', 'manifests.json')
    ];
    
    // Find which path exists
    for (const testPath of possiblePaths) {
        try {
            await fs.access(testPath);
            cacheFile = testPath;
            console.log(`Found cache at: ${testPath}`);
            break;
        } catch {}
    }
    
    if (!cacheFile) {
        console.log('⚠️ Cache file not found in any known location');
        return;
    }
    
    try {
        // Read the cache file
        const cacheData = await fs.readFile(cacheFile, 'utf-8');
        const cache = JSON.parse(cacheData);
        
        // Count Rome entries before
        const romeBefore = Object.keys(cache).filter(key => 
            cache[key].manifest && 
            cache[key].manifest.originalUrl && 
            cache[key].manifest.originalUrl.includes('digitale.bnc.roma.sbn.it')
        ).length;
        
        console.log(`Found ${romeBefore} Rome entries in cache`);
        
        // Remove all Rome entries
        const newCache = {};
        for (const [key, value] of Object.entries(cache)) {
            if (value.manifest && 
                value.manifest.originalUrl && 
                !value.manifest.originalUrl.includes('digitale.bnc.roma.sbn.it')) {
                newCache[key] = value;
            }
        }
        
        // Preserve cache version
        if (cache._cacheVersion) {
            newCache._cacheVersion = cache._cacheVersion;
        }
        
        // Write back the cleaned cache
        await fs.writeFile(cacheFile, JSON.stringify(newCache, null, 2));
        
        const romeAfter = Object.keys(newCache).filter(key => 
            newCache[key].manifest && 
            newCache[key].manifest.originalUrl && 
            newCache[key].manifest.originalUrl.includes('digitale.bnc.roma.sbn.it')
        ).length;
        
        console.log(`✅ Rome cache cleared: ${romeBefore} entries removed`);
        console.log(`✅ Remaining entries: ${Object.keys(newCache).length - 1} (excluding _cacheVersion)`);
        
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log('⚠️ Cache file not found - nothing to clear');
        } else {
            console.error('❌ Error clearing cache:', error.message);
        }
    }
}

clearRomeCache();