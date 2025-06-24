import { test, expect } from '@playwright/test';
import { ElectronApplication, Page, _electron as electron } from 'playwright';
import path from 'path';
import fs from 'fs';

let electronApp: ElectronApplication;
let page: Page;

test.beforeAll(async () => {
    // Clear cache before testing
    const userDataPath = path.join(process.cwd(), 'electron-user-data-test');
    if (fs.existsSync(userDataPath)) {
        fs.rmSync(userDataPath, { recursive: true, force: true });
    }

    electronApp = await electron.launch({
        args: [path.join(process.cwd(), 'dist/main/main.js'), '--headless'],
        cwd: process.cwd(),
        headless: true,
        env: { 
            ...process.env, 
            NODE_ENV: 'test',
            DISPLAY: ':99',
            ELECTRON_USER_DATA: userDataPath
        }
    });
    
    page = await electronApp.firstWindow();
    await page.waitForLoadState('domcontentloaded');
});

test.afterAll(async () => {
    await electronApp?.close();
});

test('Orleans manifest loading shows progress bar', async () => {
    // Clear cache first to ensure fresh manifest loading
    const cleanupBtn = page.getByText('Cleanup Cache');
    if (await cleanupBtn.count() > 0) {
        await cleanupBtn.click();
        await page.getByTestId('confirm-delete').click();
        await page.waitForTimeout(2000);
    }
    
    // Check if Orleans item is already in queue
    const existingItems = await page.locator('[data-testid="queue-item"]').count();
    
    if (existingItems === 0) {
        // No items in queue, add Orleans URL
        const orleansUrl = 'https://mediatheques.orleans.fr/recherche/viewnotice/clef/OUVRAGESDEPSEUDOISIDORE--PSEUDOISIDORE----28/id/746238';
        
        // Enter URL and add to queue
        await page.getByTestId('url-input').fill(orleansUrl);
        await page.getByTestId('add-button').click();
        
        // Wait for URL to be added to queue
        await page.waitForTimeout(2000);
        
        // Check if item was added
        const queueItems = await page.locator('[data-testid="queue-item"]').count();
        expect(queueItems).toBeGreaterThan(0);
    }
    
    // Start the queue to trigger manifest loading
    await page.getByText('Start Queue').click();
    
    // Wait for loading to begin
    await page.waitForTimeout(2000);
    
    // Look for progress indicators
    const progressBars = page.locator('.item-progress-bar');
    const progressStats = page.locator('.item-progress-stats');
    const manifestProgress = page.locator('text=/Loading manifest.*pages.*%/');
    
    // Wait up to 15 seconds for progress to appear
    let progressFound = false;
    for (let i = 0; i < 15; i++) {
        const hasProgressBar = await progressBars.count() > 0;
        const hasProgressStats = await progressStats.count() > 0;
        const hasManifestProgress = await manifestProgress.count() > 0;
        
        if (hasProgressBar || hasProgressStats || hasManifestProgress) {
            progressFound = true;
            console.log('Progress indicators found:');
            console.log('- Progress bars:', hasProgressBar);
            console.log('- Progress stats:', hasProgressStats);
            console.log('- Manifest progress text:', hasManifestProgress);
            
            if (hasProgressStats) {
                const progressText = await progressStats.first().textContent();
                console.log('Progress text:', progressText);
            }
            
            break;
        }
        
        await page.waitForTimeout(1000);
    }
    
    // Verify that progress indicators were found
    expect(progressFound).toBe(true);
    
    // Wait for manifest loading to complete
    await page.waitForTimeout(30000);
    
    // Check final state - should have moved past loading
    const finalState = await page.locator('[data-testid="queue-item"]').first().getAttribute('data-status');
    console.log('Final queue item status:', finalState);
    
    // Should not be stuck in loading state
    expect(finalState).not.toBe('loading');
});