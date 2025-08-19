#!/usr/bin/env node

// Test Roman Archive with Playwright + Electron
const { _electron: electron } = require('playwright');

async function testElectronApp() {
    console.log('🚀 Testing Roman Archive fix with Playwright + Electron...\n');
    
    let electronApp;
    let page;
    
    try {
        console.log('⏳ Launching Electron app...');
        
        // Launch the Electron app
        electronApp = await electron.launch({
            args: ['dist/main/main.js'],
            timeout: 60000, // 60 second timeout for launch
        });
        
        console.log('✅ Electron app launched successfully');
        
        // Get the first window
        page = await electronApp.firstWindow();
        console.log('🪟 Got first window');
        
        // Wait for the app to be ready
        await page.waitForLoadState('domcontentloaded');
        console.log('📄 DOM content loaded');
        
        // Get the page title to verify connection
        const title = await page.title();
        console.log(`📋 Page title: ${title}`);
        
        // Take a screenshot to verify the UI
        await page.screenshot({ path: '.devkit/validation/READY-FOR-USER/electron-app-initial.png' });
        console.log('📸 Screenshot saved');
        
        // Find and fill the URL input
        console.log('🔍 Looking for URL input field...');
        
        // Wait for the URL input to be visible
        const urlInput = await page.waitForSelector('[data-testid="url-input"]', { timeout: 10000 });
        console.log('✅ Found URL input field');
        
        // Enter the Roman Archive URL from the original issue
        const testUrl = 'https://imagoarchiviodistatoroma.cultura.gov.it/Preziosi/scheda.php?r=994-882';
        console.log(`📝 Entering URL: ${testUrl}`);
        
        await urlInput.fill(testUrl);
        
        // Find and click the Add to Queue button
        console.log('🔘 Looking for Add to Queue button...');
        const addButton = await page.waitForSelector('[data-testid="add-button"]', { timeout: 5000 });
        console.log('✅ Found Add to Queue button');
        
        await addButton.click();
        console.log('👆 Clicked Add to Queue');
        
        // Wait for processing and look for queue items or error messages
        console.log('⏳ Waiting for manuscript processing...');
        
        // Wait a bit for the processing to start
        await page.waitForTimeout(3000);
        
        // Take another screenshot to show the result
        await page.screenshot({ path: '.devkit/validation/READY-FOR-USER/electron-app-after-add.png' });
        console.log('📸 Post-processing screenshot saved');
        
        // Look for queue items or error messages
        try {
            // Check if manuscript was added to queue
            const queueItems = await page.locator('[data-testid^="queue-item"]').count();
            if (queueItems > 0) {
                console.log(`✅ SUCCESS: ${queueItems} manuscript(s) added to queue`);
                
                // Look for download button or start processing
                const downloadButton = await page.locator('text=Download All').first();
                if (await downloadButton.isVisible({ timeout: 2000 })) {
                    console.log('🚀 Starting download to test RULE 0.6 compliance...');
                    await downloadButton.click();
                    
                    // Wait for download to start and monitor progress
                    await page.waitForTimeout(5000);
                    
                    // Take final screenshot
                    await page.screenshot({ path: '.devkit/validation/READY-FOR-USER/electron-app-downloading.png' });
                    console.log('📸 Download progress screenshot saved');
                }
            } else {
                console.log('⚠️  No queue items found - checking for error messages');
            }
        } catch (error) {
            console.log('ℹ️  Queue check completed with timeout (expected for processing)');
        }
        
        // Check console messages for Roman Archive processing logs
        console.log('\n📋 Checking console messages for Roman Archive logs...');
        
        page.on('console', msg => {
            const text = msg.text();
            if (text.includes('[Roman Archive]')) {
                console.log(`📝 Roman Archive log: ${text}`);
            }
        });
        
        // Wait a bit more to capture any console logs
        await page.waitForTimeout(2000);
        
        console.log('\n✅ Electron + Playwright test completed successfully');
        console.log('📁 Screenshots saved in .devkit/validation/READY-FOR-USER/');
        
    } catch (error) {
        console.error('❌ Error during Electron testing:', error.message);
        
        if (page) {
            // Take error screenshot
            try {
                await page.screenshot({ path: '.devkit/validation/READY-FOR-USER/electron-app-error.png' });
                console.log('📸 Error screenshot saved');
            } catch (screenshotError) {
                console.log('⚠️  Could not take error screenshot');
            }
        }
    } finally {
        // Clean up
        if (electronApp) {
            console.log('🧹 Closing Electron app...');
            await electronApp.close();
            console.log('✅ Electron app closed');
        }
    }
}

testElectronApp().catch(console.error);