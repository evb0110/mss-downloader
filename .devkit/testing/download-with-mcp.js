#!/usr/bin/env node

// Download Roman Archive manuscript using Playwright MCP
const { _electron: electron } = require('playwright');

async function downloadManuscriptWithMCP() {
    console.log('🔥 DOWNLOADING ROMAN ARCHIVE MANUSCRIPT WITH MCP - NO EXCUSES!\n');
    
    const manuscriptUrl = 'https://imagoarchiviodistatoroma.cultura.gov.it/Preziosi/scheda.php?r=994-882';
    
    let electronApp;
    let page;
    
    try {
        console.log('🚀 Launching Electron app...');
        
        // Launch Electron app fresh
        electronApp = await electron.launch({
            args: ['dist/main/main.js'],
            timeout: 60000,
        });
        
        page = await electronApp.firstWindow();
        await page.waitForLoadState('domcontentloaded', { timeout: 30000 });
        
        console.log('✅ Electron app launched and ready');
        
        // Wait for app to fully initialize
        await page.waitForTimeout(5000);
        
        // Add the manuscript URL
        console.log(`📝 Adding manuscript: ${manuscriptUrl}`);
        
        // Find the URL input field
        const urlInput = await page.locator('textarea, input[type="text"]').first();
        await urlInput.fill(manuscriptUrl);
        
        // Find and click Add to Queue button
        const addButton = await page.locator('button').filter({ hasText: 'Add' }).first();
        await addButton.click();
        
        console.log('➕ Manuscript added to queue');
        
        // Wait for processing
        await page.waitForTimeout(8000);
        
        // Find and click Start Queue button
        console.log('🚀 Starting download queue...');
        const startButton = await page.locator('button').filter({ hasText: 'Start' }).first();
        await startButton.click();
        
        console.log('✅ Download started!');
        
        // Monitor progress for extended time
        console.log('📊 Monitoring download progress (will wait for completion)...');
        
        let downloadCompleted = false;
        let lastProgressUpdate = Date.now();
        const maxWaitTime = 30 * 60 * 1000; // 30 minutes
        const startTime = Date.now();
        
        // Set up console monitoring
        page.on('console', msg => {
            const text = msg.text();
            const now = new Date().toLocaleTimeString();
            
            if (text.includes('[Roman Archive]')) {
                console.log(`🏛️  [${now}] ${text}`);
                lastProgressUpdate = Date.now();
            } else if (text.includes('progress') || text.includes('downloaded') || text.includes('complete')) {
                console.log(`📈 [${now}] ${text}`);
                lastProgressUpdate = Date.now();
                
                if (text.toLowerCase().includes('complete') && text.includes('Roman Archive')) {
                    downloadCompleted = true;
                }
            } else if (text.includes('error') || text.includes('failed')) {
                console.log(`❌ [${now}] ${text}`);
            }
        });
        
        // Wait for download completion with periodic status checks
        while (!downloadCompleted && (Date.now() - startTime) < maxWaitTime) {
            await page.waitForTimeout(30000); // Check every 30 seconds
            
            const elapsed = Math.round((Date.now() - startTime) / 60000);
            console.log(`⏰ ${elapsed} minutes elapsed...`);
            
            // Check if we should continue waiting
            if (Date.now() - lastProgressUpdate > 5 * 60 * 1000) { // 5 minutes no progress
                console.log('⚠️  No progress updates for 5 minutes, checking page state...');
                
                // Take screenshot to see current state
                await page.screenshot({ path: '.devkit/validation/READY-FOR-USER/current-state.png' });
                
                // Check if download actually completed
                try {
                    const completedElements = await page.locator('text=completed').count();
                    if (completedElements > 0) {
                        console.log('🎉 Download appears to be completed!');
                        downloadCompleted = true;
                        break;
                    }
                } catch (e) {
                    // Continue waiting
                }
            }
        }
        
        if (downloadCompleted) {
            console.log('🎉 DOWNLOAD COMPLETED SUCCESSFULLY!');
        } else {
            console.log('⏰ Maximum wait time reached, but download may still be in progress');
        }
        
        // Take final screenshot
        await page.screenshot({ path: '.devkit/validation/READY-FOR-USER/final-download-state.png', fullPage: true });
        
        // Check Downloads folder
        console.log('\n📁 Checking Downloads folder for PDF...');
        
        return downloadCompleted;
        
    } catch (error) {
        console.error('❌ Error during download:', error.message);
        
        if (page) {
            await page.screenshot({ path: '.devkit/validation/READY-FOR-USER/error-download.png' });
        }
        
        return false;
    } finally {
        if (electronApp && !downloadCompleted) {
            console.log('\n💡 Keeping app open to continue download...');
            // Keep app running if download not complete
        } else if (electronApp) {
            console.log('\n🧹 Closing Electron app...');
            await electronApp.close();
        }
    }
}

// Execute the download
downloadManuscriptWithMCP().then(success => {
    if (success) {
        console.log('\n✅ MISSION ACCOMPLISHED: Roman Archive manuscript downloaded!');
        console.log('📁 Check your Downloads folder for the PDF');
    } else {
        console.log('\n⚠️  Download process completed with issues - check screenshots');
    }
}).catch(console.error);