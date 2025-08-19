#!/usr/bin/env node

// Test Roman Archive download with Playwright + Electron
const { _electron: electron } = require('playwright');

async function testRomanDownload() {
    console.log('📥 Testing Roman Archive download with Playwright + Electron...\n');
    
    let electronApp;
    let page;
    
    try {
        console.log('⏳ Launching Electron app...');
        
        electronApp = await electron.launch({
            args: ['dist/main/main.js'],
            timeout: 60000,
        });
        
        console.log('✅ Electron app launched');
        
        page = await electronApp.firstWindow();
        await page.waitForLoadState('domcontentloaded');
        console.log('📄 App loaded');
        
        // Add the Roman Archive manuscript
        const testUrl = 'https://imagoarchiviodistatoroma.cultura.gov.it/Preziosi/scheda.php?r=994-882';
        console.log(`📝 Adding manuscript: ${testUrl}`);
        
        const urlInput = await page.waitForSelector('[data-testid="url-input"]');
        await urlInput.fill(testUrl);
        
        const addButton = await page.waitForSelector('[data-testid="add-button"]');
        await addButton.click();
        
        // Wait for manuscript to be added to queue
        console.log('⏳ Waiting for manuscript to be added to queue...');
        await page.waitForTimeout(3000);
        
        // Look for the Start Queue button
        console.log('🚀 Looking for Start Queue button...');
        const startButton = await page.waitForSelector('text=Start Queue', { timeout: 10000 });
        console.log('✅ Found Start Queue button');
        
        // Set up console monitoring for Roman Archive logs
        const romanArchiveLogs = [];
        const downloadProgress = [];
        
        page.on('console', msg => {
            const text = msg.text();
            if (text.includes('[Roman Archive]')) {
                romanArchiveLogs.push(text);
                console.log(`📝 ${text}`);
            } else if (text.includes('progress') || text.includes('downloaded') || text.includes('error')) {
                downloadProgress.push(text);
                console.log(`⚡ ${text}`);
            }
        });
        
        // Start the download
        console.log('🚀 Starting download...');
        await startButton.click();
        
        // Wait for download to progress - monitor for a reasonable time
        console.log('⏳ Monitoring download progress (60 seconds)...');
        
        let downloadStarted = false;
        let downloadCompleted = false;
        let errorOccurred = false;
        
        // Monitor for 60 seconds
        for (let i = 0; i < 60; i++) {
            await page.waitForTimeout(1000);
            
            // Check if we have download progress
            if (romanArchiveLogs.some(log => log.includes('Found') && log.includes('pages'))) {
                downloadStarted = true;
                console.log('✅ Download started - Roman Archive processing detected');
            }
            
            // Check for completion or errors
            if (downloadProgress.some(log => log.includes('completed') || log.includes('finished'))) {
                downloadCompleted = true;
                console.log('🎉 Download appears to be completed!');
                break;
            }
            
            if (romanArchiveLogs.some(log => log.includes('404') || log.includes('error'))) {
                errorOccurred = true;
                console.log('❌ Error detected in Roman Archive processing');
                break;
            }
            
            // Show progress every 10 seconds
            if (i % 10 === 9) {
                console.log(`⏱️  Progress check: ${i + 1}s elapsed...`);
            }
        }
        
        // Take final screenshot
        await page.screenshot({ path: '.devkit/validation/READY-FOR-USER/roman-download-final.png' });
        console.log('📸 Final screenshot saved');
        
        // Summary
        console.log('\n📊 Download Test Results:');
        console.log(`✅ Download Started: ${downloadStarted}`);
        console.log(`🎉 Download Completed: ${downloadCompleted}`);
        console.log(`❌ Errors Occurred: ${errorOccurred}`);
        console.log(`📝 Roman Archive Logs: ${romanArchiveLogs.length}`);
        console.log(`⚡ Progress Logs: ${downloadProgress.length}`);
        
        if (romanArchiveLogs.length > 0) {
            console.log('\n📋 Key Roman Archive Logs:');
            romanArchiveLogs.slice(0, 5).forEach((log, i) => {
                console.log(`   ${i + 1}. ${log}`);
            });
        }
        
        if (downloadStarted && !errorOccurred) {
            console.log('\n🎉 SUCCESS: Roman Archive RULE 0.6 fix working - no 404 errors detected!');
        } else if (errorOccurred) {
            console.log('\n⚠️  Issues detected - may need further investigation');
        } else {
            console.log('\n⏳ Download in progress - may need more time to complete');
        }
        
    } catch (error) {
        console.error('❌ Error during download test:', error.message);
    } finally {
        if (electronApp) {
            console.log('\n🧹 Closing Electron app...');
            await electronApp.close();
        }
    }
}

testRomanDownload().catch(console.error);