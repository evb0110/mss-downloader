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

test('Take screenshot during Orleans manifest loading', async () => {
    // Clear cache first
    const cleanupBtn = page.getByText('Cleanup Cache');
    if (await cleanupBtn.count() > 0) {
        await cleanupBtn.click();
        await page.getByTestId('confirm-delete').click();
        await page.waitForTimeout(2000);
    }
    
    // Add Orleans URL if not present
    const existingItems = await page.locator('[data-testid="queue-item"]').count();
    if (existingItems === 0) {
        const orleansUrl = 'https://mediatheques.orleans.fr/recherche/viewnotice/clef/OUVRAGESDEPSEUDOISIDORE--PSEUDOISIDORE----28/id/746238';
        await page.getByTestId('url-input').fill(orleansUrl);
        await page.getByTestId('add-button').click();
        await page.waitForTimeout(2000);
    }
    
    // Get console logs for debugging FIRST
    page.on('console', msg => {
        if (msg.text().includes('shouldShowGroupProgress debug') || 
            msg.text().includes('Orleans:') || 
            msg.text().includes('Queue state update') ||
            msg.text().includes('Main process sending')) {
            console.log('PAGE LOG:', msg.text());
        }
    });
    
    // Take immediate screenshot to see current state
    await page.screenshot({ path: 'test-results/orleans-initial-screenshot.png', fullPage: true });
    
    // Check if queue is already running (if resume button is disabled)
    const resumeBtn = page.getByText('Resume Queue');
    const isResumeDisabled = await resumeBtn.count() > 0 && await resumeBtn.isDisabled();
    
    if (!isResumeDisabled) {
        // Try to start the queue
        const startBtn = page.getByText('Start Queue');
        
        if (await startBtn.count() > 0) {
            await startBtn.click();
        } else if (await resumeBtn.count() > 0) {
            await resumeBtn.click();
        }
    } else {
        console.log('Queue is already running (Resume button is disabled)');
    }
    
    // Wait a moment for loading to begin
    await page.waitForTimeout(3000);
    
    // Take screenshot during loading
    await page.screenshot({ path: 'test-results/orleans-loading-screenshot.png', fullPage: true });
    
    // Wait longer and take another screenshot to see progress
    await page.waitForTimeout(10000);
    await page.screenshot({ path: 'test-results/orleans-progress-screenshot.png', fullPage: true });
    
    // Check for any progress elements
    const progressElements = await page.locator('.item-progress').count();
    const progressBars = await page.locator('.item-progress-bar').count();
    const progressStats = await page.locator('.item-progress-stats').count();
    
    console.log('Progress elements found:', progressElements);
    console.log('Progress bars found:', progressBars);
    console.log('Progress stats found:', progressStats);
    
    // Wait longer to see if debug logs appear
    await page.waitForTimeout(15000);
    
    expect(true).toBe(true); // Always pass, just for screenshots
});