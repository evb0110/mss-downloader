#!/usr/bin/env node

/**
 * Force clear Florence ContentDM cache to resolve v1.4.47 issues
 * This addresses the critical issue where cached manifests prevent users from accessing the new ultra-simple implementation
 */

const { app } = require('electron');
const path = require('path');
const fs = require('fs').promises;

// Simulate Electron environment for testing
if (!app || !app.getPath) {
    const os = require('os');
    global.app = {
        getPath: (type) => {
            switch (type) {
                case 'userData':
                    return path.join(os.homedir(), 'Library', 'Application Support', 'mss-downloader');
                default:
                    return os.tmpdir();
            }
        }
    };
}

class FlorenceCacheClearer {
    constructor() {
        const userDataPath = global.app.getPath('userData');
        this.cacheDir = path.join(userDataPath, 'cache');
        this.cacheFile = path.join(this.cacheDir, 'manifests.json');
    }

    async clearFlorenceCache() {
        console.log('🧹 Clearing Florence ContentDM cache...');
        
        try {
            // Read existing cache
            const data = await fs.readFile(this.cacheFile, 'utf-8');
            const cached = JSON.parse(data);
            
            let clearedCount = 0;
            const keysToDelete = [];
            
            // Find all Florence ContentDM entries
            for (const [key, value] of Object.entries(cached)) {
                if (key !== '_cacheVersion' && value.manifest?.originalUrl) {
                    const url = value.manifest.originalUrl.toLowerCase();
                    if (url.includes('cdm21059.contentdm.oclc.org') || 
                        url.includes('florenceContentDM') ||
                        url.includes('plutei')) {
                        keysToDelete.push(key);
                        clearedCount++;
                    }
                }
            }
            
            // Remove Florence entries
            for (const key of keysToDelete) {
                delete cached[key];
            }
            
            // Update cache version to force refresh
            cached._cacheVersion = (cached._cacheVersion || 1) + 1;
            
            // Write back
            await fs.writeFile(this.cacheFile, JSON.stringify(cached, null, 2));
            
            console.log(`✅ Successfully cleared ${clearedCount} Florence cache entries`);
            console.log(`📈 Cache version updated to ${cached._cacheVersion}`);
            
            return { success: true, clearedCount, newVersion: cached._cacheVersion };
            
        } catch (error) {
            if (error.code === 'ENOENT') {
                console.log('ℹ️ No cache file found - this is expected for new installations');
                return { success: true, clearedCount: 0, message: 'No cache to clear' };
            }
            throw error;
        }
    }

    async validateClearance() {
        console.log('🔍 Validating cache clearance...');
        
        try {
            const data = await fs.readFile(this.cacheFile, 'utf-8');
            const cached = JSON.parse(data);
            
            let florenceEntries = 0;
            for (const [key, value] of Object.entries(cached)) {
                if (key !== '_cacheVersion' && value.manifest?.originalUrl) {
                    const url = value.manifest.originalUrl.toLowerCase();
                    if (url.includes('cdm21059.contentdm.oclc.org') || 
                        url.includes('florenceContentDM') ||
                        url.includes('plutei')) {
                        florenceEntries++;
                    }
                }
            }
            
            if (florenceEntries === 0) {
                console.log('✅ Cache clearance validated - no Florence entries remain');
                return { success: true, remainingEntries: 0 };
            } else {
                console.log(`⚠️ Warning: ${florenceEntries} Florence entries still in cache`);
                return { success: false, remainingEntries: florenceEntries };
            }
            
        } catch (error) {
            console.log('ℹ️ No cache file to validate');
            return { success: true, remainingEntries: 0 };
        }
    }
}

async function main() {
    console.log('🚀 Starting Florence cache clearing process...');
    
    const clearer = new FlorenceCacheClearer();
    
    try {
        // Clear Florence cache
        const result = await clearer.clearFlorenceCache();
        console.log('Cache clearing result:', result);
        
        // Validate clearance
        const validation = await clearer.validateClearance();
        console.log('Validation result:', validation);
        
        if (result.success && validation.success) {
            console.log('🎉 Florence cache clearing completed successfully!');
            console.log('Users should now access the new ultra-simple implementation in v1.4.47');
        } else {
            console.error('❌ Cache clearing failed validation');
            process.exit(1);
        }
        
    } catch (error) {
        console.error('❌ Failed to clear Florence cache:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { FlorenceCacheClearer };