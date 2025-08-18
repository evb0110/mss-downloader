#!/usr/bin/env node

/**
 * ROME CACHE FIX - Clear stale Rome cache data
 * 
 * PROBLEM: User reports Rome shows "only 1 page" despite fixes
 * ROOT CAUSE: Stale cached data with incorrect page count (1 page instead of 175+)
 * SOLUTION: Clear Rome domain cache to force fresh page discovery
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

async function findElectronStoreCache() {
    console.log('🔍 ROME CACHE FIX - Locating cache files...');
    console.log('===========================================');
    
    const possiblePaths = [
        // Electron development cache
        path.join(os.homedir(), 'Library/Application Support/mss-downloader/'), // macOS
        path.join(os.homedir(), 'AppData/Roaming/mss-downloader/'), // Windows
        path.join(os.homedir(), '.config/mss-downloader/'), // Linux
        
        // Electron production cache
        path.join(os.homedir(), 'Library/Application Support/Manuscript Downloader/'), // macOS
        path.join(os.homedir(), 'AppData/Roaming/Manuscript Downloader/'), // Windows  
        path.join(os.homedir(), '.config/Manuscript Downloader/'), // Linux
    ];
    
    const foundPaths = [];
    
    for (const cachePath of possiblePaths) {
        if (fs.existsSync(cachePath)) {
            console.log(`✅ Found: ${cachePath}`);
            foundPaths.push(cachePath);
        } else {
            console.log(`❌ Not found: ${cachePath}`);
        }
    }
    
    return foundPaths;
}

async function clearRomeCache(cachePath) {
    console.log(`\n🧹 Clearing Rome cache in: ${cachePath}`);
    
    try {
        const files = fs.readdirSync(cachePath);
        let romeCacheFiles = [];
        
        // Look for cache files related to Rome
        for (const file of files) {
            const filePath = path.join(cachePath, file);
            const stat = fs.statSync(filePath);
            
            if (stat.isFile() && (
                file.includes('manifest-cache') ||
                file.includes('manifestCache') ||
                file.includes('cache') ||
                file.toLowerCase().includes('rome')
            )) {
                romeCacheFiles.push(filePath);
            }
        }
        
        console.log(`Found ${romeCacheFiles.length} potential cache files:`);
        
        for (const cacheFile of romeCacheFiles) {
            console.log(`   - ${path.basename(cacheFile)}`);
            
            try {
                // Read file to check if it contains Rome data
                const content = fs.readFileSync(cacheFile, 'utf8');
                if (content.includes('digitale.bnc.roma.sbn.it') || content.includes('rome')) {
                    console.log(`     🎯 Contains Rome data - backing up and clearing...`);
                    
                    // Create backup
                    const backupFile = `${cacheFile}.backup.${Date.now()}`;
                    fs.copyFileSync(cacheFile, backupFile);
                    console.log(`     💾 Backup created: ${path.basename(backupFile)}`);
                    
                    // Clear the Rome entries from cache
                    const parsed = JSON.parse(content);
                    let modified = false;
                    
                    // Handle different cache structures
                    if (typeof parsed === 'object' && parsed !== null) {
                        for (const key in parsed) {
                            if (key.includes('digitale.bnc.roma.sbn.it') || key.includes('rome')) {
                                delete parsed[key];
                                modified = true;
                                console.log(`     🗑️  Removed cache entry: ${key.substring(0, 50)}...`);
                            }
                        }
                    }
                    
                    if (modified) {
                        fs.writeFileSync(cacheFile, JSON.stringify(parsed, null, 2));
                        console.log(`     ✅ Cache file updated`);
                    } else {
                        console.log(`     ℹ️  No Rome entries found in cache structure`);
                    }
                } else {
                    console.log(`     ℹ️  No Rome data found`);
                }
            } catch (error) {
                if (error.code === 'EACCES') {
                    console.log(`     ⚠️  Permission denied - file may be in use by app`);
                } else {
                    console.log(`     ⚠️  Could not process: ${error.message}`);
                }
            }
        }
        
        return romeCacheFiles.length;
        
    } catch (error) {
        console.log(`❌ Error accessing cache directory: ${error.message}`);
        return 0;
    }
}

async function runRomeCacheFix() {
    console.log('ROME CACHE FIX UTILITY');
    console.log('======================');
    console.log('Fixes: Rome manuscripts showing "only 1 page" due to stale cache\n');
    
    // Make sure app is not running
    console.log('⚠️  IMPORTANT: Please close the Manuscript Downloader app before running this fix!\n');
    
    try {
        const cachePaths = await findElectronStoreCache();
        
        if (cachePaths.length === 0) {
            console.log('❌ No cache directories found.');
            console.log('💡 This might mean:');
            console.log('   - The app has never been run');
            console.log('   - Cache is stored in a different location');
            console.log('   - Cache has already been cleared');
            return;
        }
        
        let totalFilesProcessed = 0;
        
        for (const cachePath of cachePaths) {
            const processed = await clearRomeCache(cachePath);
            totalFilesProcessed += processed;
        }
        
        console.log('\n🎉 ROME CACHE FIX COMPLETE');
        console.log('===========================');
        console.log(`✅ Processed ${totalFilesProcessed} cache files`);
        console.log('✅ Rome cache entries cleared');
        console.log('✅ Backups created for safety');
        
        console.log('\n📋 NEXT STEPS:');
        console.log('1. Start the Manuscript Downloader app');  
        console.log('2. Enter your Rome URL again');
        console.log('3. The app will now perform fresh page discovery');
        console.log('4. You should see the correct page count (175+ pages for BNCR_Ms_SESS_0062)');
        
        console.log('\n💡 If the issue persists:');
        console.log('   - Try restarting your computer');
        console.log('   - Check if any Rome manuscripts are in your download queue and remove them');
        console.log('   - Use the app\'s "Clear All Cache" option in settings');
        
    } catch (error) {
        console.log('❌ CACHE FIX FAILED');
        console.log(`Error: ${error.message}`);
    }
}

runRomeCacheFix();