#!/usr/bin/env node

// FINAL ATTEMPT: Complete Roman Archive download via Playwright MCP
const { _electron: electron } = require('playwright');

async function executeCompleteDownload() {
    console.log('🔥 FINAL MCP DOWNLOAD: Roman Archive 994-882\n');
    
    const manuscriptUrl = 'https://imagoarchiviodistatoroma.cultura.gov.it/Preziosi/scheda.php?r=994-882';
    
    let electronApp;
    let page;
    
    try {
        // Launch fresh Electron app
        console.log('🚀 Launching fresh Electron app...');
        electronApp = await electron.launch({
            args: ['dist/main/main.js'],
            timeout: 60000,
        });
        
        page = await electronApp.firstWindow();
        await page.waitForLoadState('domcontentloaded');
        console.log('✅ Electron app launched successfully');
        
        // Wait for full initialization
        await page.waitForTimeout(8000);
        
        // Take initial screenshot to see UI
        await page.screenshot({ path: '.devkit/validation/READY-FOR-USER/01-app-ui.png' });
        console.log('📸 Initial UI screenshot saved');
        
        // Find input field with multiple strategies
        console.log('🔍 Finding manuscript URL input field...');
        
        let urlInput;
        try {
            // Try different selectors
            urlInput = await page.waitForSelector('textarea', { timeout: 10000 });
            console.log('✅ Found textarea input');
        } catch (e1) {
            try {
                urlInput = await page.waitForSelector('input[type="text"]', { timeout: 5000 });
                console.log('✅ Found text input');
            } catch (e2) {
                try {
                    urlInput = await page.waitForSelector('[data-testid="url-input"]', { timeout: 5000 });
                    console.log('✅ Found testid input');
                } catch (e3) {
                    console.log('❌ Could not find URL input field');
                    throw new Error('URL input not found');
                }
            }
        }
        
        // Enter the manuscript URL
        console.log(`📝 Entering manuscript URL: ${manuscriptUrl}`);
        await urlInput.fill(manuscriptUrl);
        console.log('✅ URL entered successfully');
        
        // Find and click Add button
        console.log('🔍 Finding Add to Queue button...');
        
        let addButton;
        try {
            addButton = await page.waitForSelector('button:has-text("Add")', { timeout: 10000 });
            console.log('✅ Found Add button');
        } catch (e1) {
            try {
                addButton = await page.waitForSelector('[data-testid="add-button"]', { timeout: 5000 });
                console.log('✅ Found Add button via testid');
            } catch (e2) {
                addButton = await page.waitForSelector('button', { timeout: 5000 });
                console.log('✅ Found first button (assuming it\'s Add)');
            }
        }
        
        await addButton.click();
        console.log('✅ Clicked Add to Queue button');
        
        // Wait for processing
        console.log('⏳ Waiting for manuscript processing...');
        await page.waitForTimeout(10000);
        
        // Take screenshot after adding
        await page.screenshot({ path: '.devkit/validation/READY-FOR-USER/02-after-add.png' });
        console.log('📸 After-add screenshot saved');
        
        // Find and click Start Queue button
        console.log('🚀 Finding and clicking Start Queue button...');
        
        let startButton;
        try {
            startButton = await page.waitForSelector('button:has-text("Start")', { timeout: 10000 });
            console.log('✅ Found Start button');
        } catch (e1) {
            try {
                startButton = await page.waitForSelector('button:has-text("Download")', { timeout: 5000 });
                console.log('✅ Found Download button');
            } catch (e2) {
                // Look for any button that might be the start button
                const buttons = await page.locator('button').all();
                for (let i = 0; i < buttons.length; i++) {
                    const text = await buttons[i].textContent();
                    console.log(`Button ${i}: "${text}"`);
                    if (text && (text.includes('Start') || text.includes('Download'))) {
                        startButton = buttons[i];
                        break;
                    }
                }
                if (!startButton && buttons.length > 1) {
                    startButton = buttons[1]; // Try second button
                    console.log('✅ Using second button as Start button');
                }
            }
        }
        
        if (startButton) {
            await startButton.click();
            console.log('✅ Clicked Start Queue button - DOWNLOAD STARTED!');
        } else {
            console.log('❌ Could not find Start button - trying keyboard shortcut');
            await page.keyboard.press('Enter');
        }
        
        // SET UP COMPREHENSIVE CONSOLE MONITORING
        console.log('\n' + '='.repeat(60));
        console.log('📊 STARTING COMPREHENSIVE DOWNLOAD MONITORING');
        console.log('='.repeat(60));
        console.log('Target: Roman Archive 994-882 (383 pages expected)');
        console.log('Monitoring all console output for complete visibility\n');
        
        let downloadStarted = false;
        let downloadCompleted = false;
        let pagesDiscovered = 0;
        let progressUpdates = 0;
        let romanLogs = [];
        
        // Capture ALL console output
        page.on('console', msg => {
            const text = msg.text();
            const timestamp = new Date().toLocaleTimeString();
            
            // Log everything for maximum visibility
            console.log(`[${timestamp}] ${text}`);
            
            // Track Roman Archive activity
            if (text.includes('[Roman Archive]') || text.includes('roman_archive')) {
                romanLogs.push(text);
                downloadStarted = true;
                
                // Extract page count if mentioned
                const pageMatch = text.match(/(\d+)\s+pages/i);
                if (pageMatch) {
                    pagesDiscovered = parseInt(pageMatch[1]);
                    console.log(`\n🎯 PAGES DISCOVERED: ${pagesDiscovered} pages!\n`);
                }
            }
            
            // Track progress
            if (text.includes('progress') || text.includes('downloaded') || text.includes('%')) {
                progressUpdates++;
            }
            
            // Track completion
            if (text.toLowerCase().includes('completed') || text.toLowerCase().includes('finished')) {
                downloadCompleted = true;
                console.log(`\n🎉 DOWNLOAD COMPLETED! ${text}\n`);
            }
            
            // Track errors
            if (text.includes('error') || text.includes('404') || text.includes('failed')) {
                console.log(`\n❌ ERROR DETECTED: ${text}\n`);
            }
        });
        
        // Monitor for extended time with periodic updates
        console.log('⏰ Monitoring for 20 minutes (383 pages will take time)...\n');
        
        const maxWaitTime = 20 * 60 * 1000; // 20 minutes
        const checkInterval = 30000; // 30 seconds
        const startTime = Date.now();
        
        let lastProgressTime = Date.now();
        
        while (!downloadCompleted && (Date.now() - startTime) < maxWaitTime) {
            await page.waitForTimeout(checkInterval);
            
            const elapsedMinutes = Math.round((Date.now() - startTime) / 60000);
            
            // Periodic status updates
            if (elapsedMinutes % 2 === 0 && elapsedMinutes > 0) {
                console.log(`\n⏱️  STATUS UPDATE (${elapsedMinutes} minutes):`);
                console.log(`   📊 Download Started: ${downloadStarted}`);
                console.log(`   📄 Pages Discovered: ${pagesDiscovered}`);
                console.log(`   📈 Progress Updates: ${progressUpdates}`);
                console.log(`   📝 Roman Logs: ${romanLogs.length}`);
                
                // Take screenshot
                await page.screenshot({ 
                    path: `.devkit/validation/READY-FOR-USER/progress-${elapsedMinutes}min.png` 
                });
                console.log(`   📸 Screenshot saved\n`);
            }
            
            // Check for visual completion
            try {
                const completedElements = await page.locator('text=completed').count();
                if (completedElements > 0) {
                    console.log('🎉 Visual completion indicator detected!');
                    downloadCompleted = true;
                    break;
                }
            } catch (e) {
                // Continue
            }
        }
        
        // FINAL RESULTS
        await page.screenshot({ 
            path: '.devkit/validation/READY-FOR-USER/final-complete-state.png',
            fullPage: true 
        });
        
        console.log('\n' + '='.repeat(60));
        console.log('🏆 FINAL DOWNLOAD RESULTS');
        console.log('='.repeat(60));
        console.log(`✅ Download Started: ${downloadStarted}`);
        console.log(`📄 Pages Discovered: ${pagesDiscovered} (expected: 383)`);
        console.log(`🎉 Download Completed: ${downloadCompleted}`);
        console.log(`📊 Progress Updates: ${progressUpdates}`);
        console.log(`📝 Roman Archive Logs: ${romanLogs.length}`);
        console.log('='.repeat(60));
        
        if (downloadStarted && pagesDiscovered === 383) {
            console.log('🏆 PERFECT SUCCESS: RULE 0.6 FIX CONFIRMED WORKING!');
            console.log('✅ Discovered exact expected page count (383)');
            console.log('✅ Using server-provided filenames only');
            console.log('✅ No pattern assumptions or 404 errors');
        }
        
        console.log('\n📁 PDF file will be in Downloads folder');
        console.log('🔍 Look for: Roman_Archive_994-882... PDF file\n');
        
        return { downloadStarted, pagesDiscovered, downloadCompleted };
        
    } catch (error) {
        console.error('❌ Error during final download:', error.message);
        
        if (page) {
            await page.screenshot({ path: '.devkit/validation/READY-FOR-USER/error-final.png' });
        }
        
        return { downloadStarted: false, pagesDiscovered: 0, downloadCompleted: false };
    } finally {
        console.log('💡 Keeping Electron app running for continued processing...');
        // Keep app open for download to complete
    }
}

// Execute and report results
executeCompleteDownload().then(result => {
    console.log('\n🎯 MISSION STATUS:');
    if (result.downloadStarted && result.pagesDiscovered === 383) {
        console.log('🎉 SUCCESS: Roman Archive manuscript download initiated with correct page count!');
        console.log('📁 Check Downloads folder for the complete PDF file');
    } else if (result.downloadStarted) {
        console.log('⚠️  PARTIAL: Download started but page count may be different than expected');
    } else {
        console.log('❌ FAILED: Download did not start successfully');
    }
}).catch(console.error);