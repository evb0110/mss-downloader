
const { app } = require('electron');
const path = require('path');

// Prevent Electron from starting
app.whenReady = () => Promise.resolve();

// Load the built service
const { EnhancedManuscriptDownloaderService } = require('./dist/main/services/EnhancedManuscriptDownloaderService.js');

async function test() {
    const service = new EnhancedManuscriptDownloaderService();
    const url = 'https://bdh-rd.bne.es/viewer.vm?id=0000049109&page=1';
    
    console.log('Starting manifest load...');
    const startTime = Date.now();
    
    try {
        const manifest = await service.loadManifest(url);
        const loadTime = Date.now() - startTime;
        
        console.log(`✅ Success in ${loadTime}ms`);
        console.log(`   Pages found: ${manifest.totalPages}`);
        console.log(`   Library: ${manifest.library}`);
        console.log(`   Display name: ${manifest.displayName}`);
        
        if (loadTime > 10000) {
            console.log('⚠️  Warning: Load time exceeded 10 seconds');
        }
        
        return manifest;
    } catch (error) {
        const errorTime = Date.now() - startTime;
        console.error(`❌ Failed after ${errorTime}ms: ${error.message}`);
        
        if (errorTime > 30000) {
            console.error('🚨 CRITICAL: Timeout exceeded 30 seconds - hang detected!');
        }
        
        throw error;
    }
}

test().then(() => process.exit(0)).catch(() => process.exit(1));
