#!/usr/bin/env node

// Complete Roman Archive manuscript download test
const { _electron: electron } = require('playwright');

async function downloadCompleteManuscript() {
    console.log('📥 Downloading complete Roman Archive manuscript 994-882...\n');
    
    let electronApp;
    let page;
    
    try {
        console.log('⏳ Launching Electron app...');
        
        electronApp = await electron.launch({
            args: ['dist/main/main.js'],
            timeout: 60000,
        });
        
        page = await electronApp.firstWindow();
        await page.waitForLoadState('domcontentloaded');
        console.log('✅ Electron app ready');
        
        // Add the complete Roman Archive manuscript from the original issue
        const manuscriptUrl = 'https://imagoarchiviodistatoroma.cultura.gov.it/Preziosi/scheda.php?r=994-882';
        console.log(`📋 Adding manuscript: ${manuscriptUrl}`);
        
        // Find and fill URL input
        await page.waitForSelector('[data-testid="url-input"]', { timeout: 30000 });
        await page.fill('[data-testid="url-input"]', manuscriptUrl);
        
        // Add to queue
        await page.click('[data-testid="add-button"]');
        console.log('➕ Manuscript added to queue');
        
        // Wait for processing
        await page.waitForTimeout(5000);
        
        // Start the download queue
        console.log('🚀 Starting download queue...');
        await page.click('text=Start Queue');
        
        console.log('📊 Monitoring download progress...');
        console.log('⏰ This will take several minutes for 383 pages...\n');
        
        let downloadCompleted = false;
        let downloadStarted = false;
        let currentProgress = '';
        
        // Monitor console for download progress
        page.on('console', msg => {
            const text = msg.text();
            
            if (text.includes('[Roman Archive]') || 
                text.includes('progress') || 
                text.includes('downloaded') ||
                text.includes('pages')) {
                console.log(`📝 ${text}`);
                
                if (text.includes('Found') && text.includes('pages')) {
                    downloadStarted = true;
                }
                
                if (text.includes('completed') || text.includes('finished') || text.includes('success')) {
                    downloadCompleted = true;
                }
            }
        });
        
        // Monitor for up to 20 minutes (383 pages will take time)
        const maxWaitMinutes = 20;
        const maxWaitMs = maxWaitMinutes * 60 * 1000;
        const checkIntervalMs = 30000; // Check every 30 seconds
        const totalChecks = maxWaitMs / checkIntervalMs;
        
        console.log(`⏱️  Will monitor for up to ${maxWaitMinutes} minutes...`);
        
        for (let i = 0; i < totalChecks; i++) {
            await page.waitForTimeout(checkIntervalMs);
            
            // Check current page status
            try {
                // Look for download progress indicators
                const queueStatus = await page.textContent('.queue-progress', { timeout: 1000 }).catch(() => null);
                if (queueStatus && queueStatus !== currentProgress) {
                    currentProgress = queueStatus;
                    console.log(`📊 Queue status: ${queueStatus}`);
                }
                
                // Check if download completed
                const completedText = await page.textContent('text=completed', { timeout: 1000 }).catch(() => null);
                if (completedText) {
                    downloadCompleted = true;
                    console.log('🎉 Download completed detected!');
                    break;
                }
                
            } catch (error) {
                // Continue monitoring
            }
            
            const minutesElapsed = Math.round((i + 1) * checkIntervalMs / 60000);
            console.log(`⏰ ${minutesElapsed}/${maxWaitMinutes} minutes elapsed...`);
            
            if (downloadCompleted) {
                break;
            }
        }
        
        // Take final screenshot
        await page.screenshot({ path: '.devkit/validation/READY-FOR-USER/roman-complete-download.png', fullPage: true });
        console.log('📸 Final screenshot saved');
        
        if (downloadCompleted) {
            console.log('\n🎉 SUCCESS: Roman Archive manuscript download completed!');
            console.log('📁 Check Downloads folder for the PDF file');
        } else {
            console.log('\n⏳ Download still in progress after monitoring period');
            console.log('📁 Check Downloads folder - partial files may be available');
        }
        
        console.log('\n🔍 Checking Downloads folder for Roman Archive files...');
        
    } catch (error) {
        console.error('❌ Error during complete download test:', error.message);
    } finally {
        if (electronApp) {
            console.log('\n🧹 Keeping app open for continued download...');
            console.log('💡 You can close the app manually when download is complete');
            // Don't close automatically - let download continue
            // await electronApp.close();
        }
    }
}

downloadCompleteManuscript().catch(console.error);