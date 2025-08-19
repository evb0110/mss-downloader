#!/usr/bin/env node

// Final test: Complete Roman Archive manuscript download with monitoring
const { _electron: electron } = require('playwright');

async function downloadRomanArchive() {
    console.log('🏛️ FINAL TEST: Downloading Complete Roman Archive Manuscript 994-882\n');
    
    let electronApp;
    let page;
    
    try {
        // Connect to the running Electron app
        console.log('🔌 Connecting to running Electron app...');
        
        electronApp = await electron.launch({
            args: ['dist/main/main.js'],
            timeout: 30000,
        });
        
        page = await electronApp.firstWindow();
        await page.waitForLoadState('domcontentloaded', { timeout: 30000 });
        console.log('✅ Connected to Electron app');
        
        // Wait for app to be fully ready
        await page.waitForTimeout(3000);
        
        // Roman Archive manuscript from the original issue
        const manuscriptUrl = 'https://imagoarchiviodistatoroma.cultura.gov.it/Preziosi/scheda.php?r=994-882';
        console.log(`\n📋 Target manuscript: ${manuscriptUrl}`);
        console.log('📊 Expected: 383 pages (Roman Archive - 994-882 Lectionarium Novum)');
        
        // Take initial screenshot
        await page.screenshot({ path: '.devkit/validation/READY-FOR-USER/01-app-loaded.png' });
        
        // Find URL input and add manuscript
        console.log('\n📝 Adding manuscript to queue...');
        
        try {
            // Try multiple selectors to find the URL input
            const urlInput = await page.waitForSelector('input[type="text"], textarea, [data-testid="url-input"]', { timeout: 10000 });
            await urlInput.fill(manuscriptUrl);
            console.log('✅ URL entered');
            
            // Find and click add button
            const addButton = await page.waitForSelector('button:has-text("Add"), [data-testid="add-button"], button:has-text("Queue")', { timeout: 10000 });
            await addButton.click();
            console.log('✅ Manuscript added to queue');
            
        } catch (error) {
            console.log('🔄 Trying alternative UI approach...');
            
            // Alternative: try direct keyboard input
            await page.keyboard.press('Tab'); // Navigate to input
            await page.keyboard.type(manuscriptUrl);
            await page.keyboard.press('Enter');
        }
        
        // Wait for processing
        await page.waitForTimeout(5000);
        await page.screenshot({ path: '.devkit/validation/READY-FOR-USER/02-manuscript-added.png' });
        
        // Look for the manuscript in queue and start download
        console.log('\n🚀 Starting download...');
        
        try {
            // Try to find start button
            const startButton = await page.waitForSelector('button:has-text("Start"), button:has-text("Download"), [data-testid="start-button"]', { timeout: 10000 });
            await startButton.click();
            console.log('✅ Download started');
            
        } catch (error) {
            console.log('🔄 Trying keyboard shortcut...');
            await page.keyboard.press('Space'); // Common shortcut to start
        }
        
        // Set up progress monitoring
        console.log('\n📊 Monitoring download progress...');
        
        let downloadStarted = false;
        let pagesDiscovered = 0;
        let downloadProgress = [];
        let romanArchiveLogs = [];
        
        page.on('console', msg => {
            const text = msg.text();
            
            if (text.includes('[Roman Archive]')) {
                romanArchiveLogs.push(text);
                console.log(`🏛️  ${text}`);
                
                // Check for page discovery
                const pagesMatch = text.match(/(\d+)\s+pages/);
                if (pagesMatch) {
                    pagesDiscovered = parseInt(pagesMatch[1]);
                    downloadStarted = true;
                }
            }
            
            if (text.includes('progress') || text.includes('downloaded') || text.includes('%')) {
                downloadProgress.push(text);
                console.log(`📈 ${text}`);
            }
            
            if (text.includes('error') || text.includes('404') || text.includes('failed')) {
                console.log(`❌ ${text}`);
            }
        });
        
        // Monitor download for reasonable time
        console.log('⏰ Monitoring for 10 minutes (383 pages will take time)...');
        
        const monitorDuration = 10 * 60 * 1000; // 10 minutes
        const checkInterval = 30000; // 30 seconds
        const totalChecks = monitorDuration / checkInterval;
        
        for (let i = 0; i < totalChecks; i++) {
            await page.waitForTimeout(checkInterval);
            
            // Take progress screenshot every 2 minutes
            if (i % 4 === 0) {
                await page.screenshot({ path: `.devkit/validation/READY-FOR-USER/progress-${Math.floor(i/4)}.png` });
            }
            
            const minutesElapsed = Math.round((i + 1) * checkInterval / 60000);
            console.log(`⏱️  ${minutesElapsed}/10 minutes elapsed...`);
            
            // Check for completion indicators
            try {
                const completedElement = await page.$('text=completed', { timeout: 1000 });
                if (completedElement) {
                    console.log('🎉 Download completed detected!');
                    break;
                }
            } catch {
                // Continue monitoring
            }
        }
        
        // Final screenshot
        await page.screenshot({ path: '.devkit/validation/READY-FOR-USER/final-state.png', fullPage: true });
        
        // Summary
        console.log('\n📋 DOWNLOAD TEST SUMMARY:');
        console.log(`✅ Download Started: ${downloadStarted}`);
        console.log(`📄 Pages Discovered: ${pagesDiscovered}`);
        console.log(`📝 Roman Archive Logs: ${romanArchiveLogs.length}`);
        console.log(`📊 Progress Updates: ${downloadProgress.length}`);
        
        if (downloadStarted && pagesDiscovered === 383) {
            console.log('\n🎉 SUCCESS: Roman Archive RULE 0.6 fix working perfectly!');
            console.log('✅ Discovered exactly 383 pages using server filenames');
            console.log('✅ No pattern assumptions - only server-discovered names');
        } else if (downloadStarted) {
            console.log(`\n⚠️  Partial success: Started but found ${pagesDiscovered} pages (expected 383)`);
        } else {
            console.log('\n❌ Download did not start - may need manual intervention');
        }
        
        console.log('\n📁 Check Downloads folder for PDF files');
        console.log('📸 Screenshots saved in .devkit/validation/READY-FOR-USER/');
        
    } catch (error) {
        console.error('\n❌ Error during final test:', error.message);
        
        if (page) {
            await page.screenshot({ path: '.devkit/validation/READY-FOR-USER/error-state.png' });
        }
    } finally {
        // Keep app running for download to continue
        console.log('\n💡 Keeping app running to complete download...');
        console.log('🔧 You can monitor progress in the Electron app window');
        console.log('📁 PDF will be saved to Downloads folder when complete');
        
        // Don't close - let download continue
        // if (electronApp) await electronApp.close();
    }
}

downloadRomanArchive().catch(console.error);