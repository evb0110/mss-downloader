import { test, expect } from './helpers/electron';

test.describe('Threshold Configuration Test', () => {
  
  test('should set auto-split threshold to 30MB for testing', async ({ page }) => {
    // Wait for app to load
    await page.waitForLoadState('domcontentloaded');
    
    // Set threshold via direct API call to main process
    const thresholdSet = await page.evaluate(async () => {
      if (window.electronAPI && window.electronAPI.setGlobalSettings) {
        await window.electronAPI.setGlobalSettings({ autoSplitThresholdMB: 30 });
        return true;
      }
      return false;
    });
    
    if (thresholdSet) {
      console.log('✓ Set auto-split threshold to 30MB via API');
    } else {
      console.log('❌ Could not set threshold via API, trying UI method');
      
      // Fallback to UI method with better debugging
      await page.evaluate(() => window.scrollTo(0, 0));
      
      // Take initial screenshot
      await page.screenshot({ path: 'test-results/initial-state.png', fullPage: true });
      
      // Look for settings area - might not be a button but a clickable div/span
      const settingsElements = await page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('*')).filter(el => {
          const text = el.textContent || '';
          return text.includes('Default Download Settings') || text.includes('⚙️');
        });
        return elements.map(el => ({
          tagName: el.tagName,
          className: el.className,
          textContent: el.textContent?.slice(0, 50),
          clickable: el.onclick !== null || el.style.cursor === 'pointer'
        }));
      });
      
      console.log('Found settings elements:', settingsElements);
      
      // Try clicking on any element containing the settings text
      for (const element of settingsElements) {
        try {
          const locator = page.locator(`${element.tagName.toLowerCase()}:has-text("Default Download Settings")`).first();
          if (await locator.isVisible()) {
            await locator.click();
            console.log(`✓ Clicked on ${element.tagName} element`);
            
            // Wait and check if slider appeared
            await page.waitForTimeout(1000);
            const sliders = page.locator('input[type="range"]');
            const sliderCount = await sliders.count();
            console.log(`Found ${sliderCount} range sliders after click`);
            
            if (sliderCount > 0) {
              const slider = sliders.first();
              const currentValue = await slider.inputValue();
              console.log(`Current slider value: ${currentValue}`);
              
              // Set to 30
              await slider.evaluate((el) => {
                el.value = '30';
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
              });
              
              const newValue = await slider.inputValue();
              console.log(`New slider value: ${newValue}`);
              break;
            }
          }
        } catch (error) {
          console.log(`Failed to click ${element.tagName}:`, error.message);
        }
      }
    }
    
    // Take final screenshot
    await page.screenshot({ path: 'test-results/threshold-test-final.png', fullPage: true });
  });
});