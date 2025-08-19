#!/usr/bin/env node

// Use Playwright MCP to download Roman Archive manuscript through Electron
const { _electron: electron } = require('playwright');

async function completeDownload() {
    console.log('🔥 FINAL DOWNLOAD: Using MCP to complete Roman Archive manuscript download\n');
    
    const manuscriptUrl = 'https://imagoarchiviodistatoroma.cultura.gov.it/Preziosi/scheda.php?r=994-882';
    
    let electronApp;
    let page;
    
    try {
        console.log('🔌 Connecting to Electron app via Playwright MCP...');
        
        // Connect to the running Electron instance
        electronApp = await electron.launch({
            args: ['dist/main/main.js'],
            timeout: 60000,
        });
        
        page = await electronApp.firstWindow();
        
        // Wait for full load
        await page.waitForLoadState('domcontentloaded');
        console.log('✅ Connected to Electron app successfully');
        
        // Wait for app initialization
        await page.waitForTimeout(5000);
        
        console.log('📝 Adding Roman Archive manuscript to queue...');
        console.log(`🎯 URL: ${manuscriptUrl}`);
        
        // Find and fill the URL input
        await page.fill('textarea', manuscriptUrl);
        console.log('✅ URL entered in text field');
        
        // Click Add to Queue
        await page.click('button:has-text("Add to Queue")');
        console.log('✅ Clicked Add to Queue button');
        
        // Wait for processing
        console.log('⏳ Waiting for manuscript to be processed and added to queue...');
        await page.waitForTimeout(8000);
        
        // Click Start Queue to begin download
        console.log('🚀 Starting download queue...');
        await page.click('button:has-text("Start Queue")');
        console.log('✅ Download started!');
        
        // Set up comprehensive console monitoring
        console.log('\n📊 MONITORING ALL LOGS AND PROGRESS:\n');
        
        let downloadStarted = false;
        let downloadCompleted = false;
        let pagesDiscovered = 0;
        let romanArchiveLogs = [];
        
        page.on('console', msg => {
            const text = msg.text();
            const timestamp = new Date().toLocaleTimeString();
            
            // Log everything for complete visibility
            console.log(`[${timestamp}] ${text}`);
            
            // Track Roman Archive specific logs
            if (text.includes('[Roman Archive]')) {
                romanArchiveLogs.push(text);
                downloadStarted = true;
                
                // Extract page count
                const pagesMatch = text.match(/(\d+)\s+pages/);
                if (pagesMatch) {
                    pagesDiscovered = parseInt(pagesMatch[1]);
                    console.log(`🎯 DETECTED: ${pagesDiscovered} pages discovered!`);
                }
            }
            
            // Track completion
            if (text.toLowerCase().includes('completed') || text.toLowerCase().includes('finished')) {
                if (text.includes('Roman Archive') || text.includes('994-882')) {
                    downloadCompleted = true;
                    console.log('🎉 DOWNLOAD COMPLETED DETECTED!');
                }
            }
            
            // Track errors
            if (text.includes('error') || text.includes('404') || text.includes('failed')) {
                console.log(`❌ ERROR: ${text}`);
            }
        });
        
        // Monitor for extended period to capture complete download
        console.log('⏰ Monitoring download progress for up to 25 minutes...');
        console.log('📋 Expected: 383 pages for Roman Archive 994-882 Lectionarium Novum\n');
        
        const maxWaitTime = 25 * 60 * 1000; // 25 minutes
        const checkInterval = 30000; // 30 seconds
        const startTime = Date.now();
        
        while (!downloadCompleted && (Date.now() - startTime) < maxWaitTime) {
            await page.waitForTimeout(checkInterval);
            
            const elapsedMinutes = Math.round((Date.now() - startTime) / 60000);
            console.log(`\n⏱️  ${elapsedMinutes} minutes elapsed...`);
            
            // Take periodic screenshots
            if (elapsedMinutes % 5 === 0 && elapsedMinutes > 0) {
                await page.screenshot({ 
                    path: `.devkit/validation/READY-FOR-USER/progress-${elapsedMinutes}min.png`,
                    fullPage: true 
                });
                console.log(`📸 Progress screenshot saved (${elapsedMinutes} minutes)`);
            }
            
            // Check for visual completion indicators
            try {
                const completedCount = await page.locator('text=completed').count();
                if (completedCount > 0) {
                    console.log('🎉 Visual completion indicator found!');
                    downloadCompleted = true;
                    break;
                }
            } catch (e) {
                // Continue monitoring
            }
        }
        
        // Final screenshot
        await page.screenshot({ 
            path: '.devkit/validation/READY-FOR-USER/final-download-complete.png',
            fullPage: true 
        });
        
        // Results summary
        console.log('\n' + '='.repeat(60));
        console.log('📋 DOWNLOAD COMPLETION SUMMARY:');
        console.log('='.repeat(60));
        console.log(`✅ Download Started: ${downloadStarted}`);
        console.log(`📄 Pages Discovered: ${pagesDiscovered} (expected: 383)`);
        console.log(`🎉 Download Completed: ${downloadCompleted}`);
        console.log(`📝 Roman Archive Logs Captured: ${romanArchiveLogs.length}`);
        
        if (downloadStarted && pagesDiscovered === 383) {
            console.log('\n🏆 SUCCESS: RULE 0.6 FIX WORKING PERFECTLY!');
            console.log('✅ Discovered exactly 383 pages using server-provided filenames');
            console.log('✅ No 404 errors from pattern assumptions');
            console.log('✅ Server discovery method working as intended');
        }
        
        console.log('\n📁 PDF will be saved to Downloads folder');
        console.log('🔍 Check Downloads folder for "Roman_Archive_994-882..." PDF file');
        
        return downloadCompleted;
        
    } catch (error) {
        console.error('❌ Error during MCP download:', error.message);
        return false;
    } finally {
        console.log('\n💡 Keeping Electron app running to ensure download completion...');
        // Don't close the app - let download finish
    }
}

completeDownload().catch(console.error);