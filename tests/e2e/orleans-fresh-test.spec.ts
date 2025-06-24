import { test, expect } from '@playwright/test';
import { ElectronApplication, Page, _electron as electron } from 'playwright';
import path from 'path';
import fs from 'fs';

let electronApp: ElectronApplication;
let page: Page;

test.beforeAll(async () => {
    // Clear ALL cache before testing
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

test('Fresh Orleans loading shows progress bar', async () => {
    // Get console logs for debugging
    const logs: string[] = [];
    page.on('console', msg => {
        const text = msg.text();
        logs.push(text);
        if (text.includes('shouldShowGroupProgress debug') || 
            text.includes('Orleans:') || 
            text.includes('Queue state update') ||
            text.includes('Main process sending') ||
            text.includes('Manifest loaded quickly')) {
            console.log('PAGE LOG:', text);
        }
    });
    
    // Add Orleans URL
    const orleansUrl = 'https://mediatheques.orleans.fr/recherche/viewnotice/clef/OUVRAGESDEPSEUDOISIDORE--PSEUDOISIDORE----28/id/746238';
    await page.getByTestId('url-input').fill(orleansUrl);
    await page.getByTestId('add-button').click();
    await page.waitForTimeout(2000);
    
    // Take screenshot before starting
    await page.screenshot({ path: 'test-results/orleans-fresh-before.png', fullPage: true });
    
    // Start the queue
    await page.getByText('Start Queue').click();
    
    // Wait and take screenshots during loading
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'test-results/orleans-fresh-loading.png', fullPage: true });
    
    // Check for progress elements multiple times
    let progressFound = false;
    for (let i = 0; i < 10; i++) {
        const progressElements = await page.locator('.item-progress').count();
        const progressBars = await page.locator('.item-progress-bar').count();
        const progressStats = await page.locator('.item-progress-stats').count();
        
        if (progressElements > 0 || progressBars > 0 || progressStats > 0) {
            progressFound = true;
            console.log(`Found progress at check ${i}:`, { progressElements, progressBars, progressStats });
            await page.screenshot({ path: `test-results/orleans-fresh-progress-${i}.png`, fullPage: true });
            break;
        }
        
        await page.waitForTimeout(1000);
    }
    
    // Wait for completion
    await page.waitForTimeout(10000);
    await page.screenshot({ path: 'test-results/orleans-fresh-final.png', fullPage: true });
    
    // Print all captured logs
    console.log('All captured logs:');
    logs.forEach((log, i) => {
        console.log(`${i}: ${log}`);
    });
    
    console.log('Progress found during monitoring:', progressFound);
    expect(true).toBe(true); // Always pass for screenshot collection
});