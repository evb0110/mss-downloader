const { app, BrowserWindow } = require('electron');
const path = require('path');

async function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, '../../src/main/preload.js')
        }
    });

    // Load the app
    if (process.env.VITE_DEV_SERVER_URL) {
        await win.loadURL(process.env.VITE_DEV_SERVER_URL);
    } else {
        await win.loadFile(path.join(__dirname, '../../dist/index.html'));
    }

    // Open DevTools
    win.webContents.openDevTools();

    // Wait for content to load
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test the Add More Documents functionality
    await win.webContents.executeJavaScript(`
        (async () => {
            console.log('=== Testing Add More Documents Functionality ===');
            
            // First add a test URL to create a queue item
            const testUrl = 'https://gallica.bnf.fr/ark:/12148/btv1b8452111v';
            
            // Find the bulk URL textarea
            const bulkTextarea = document.querySelector('textarea.bulk-textarea');
            if (!bulkTextarea) {
                console.error('❌ Bulk textarea not found!');
                return;
            }
            
            // Add URL and trigger processing
            bulkTextarea.value = testUrl;
            bulkTextarea.dispatchEvent(new Event('input', { bubbles: true }));
            
            // Find and click the Add to Queue button
            const addButton = document.querySelector('button[data-testid="add-button"]');
            if (!addButton) {
                console.error('❌ Add to Queue button not found!');
                return;
            }
            
            console.log('✅ Adding first URL to queue...');
            addButton.click();
            
            // Wait for processing
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Now test the Add More Documents button
            const addMoreBtn = document.querySelector('.add-more-btn');
            if (!addMoreBtn) {
                console.error('❌ Add More Documents button not found!');
                return;
            }
            
            console.log('✅ Found Add More Documents button, clicking...');
            addMoreBtn.click();
            
            // Wait for modal to open
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Check if modal opened
            const modal = document.querySelector('.modal-overlay');
            if (!modal) {
                console.error('❌ Modal did not open!');
                return;
            }
            
            console.log('✅ Modal opened successfully');
            
            // Find the modal textarea
            const modalTextarea = document.querySelector('#modal-bulk-urls');
            if (!modalTextarea) {
                console.error('❌ Modal textarea not found!');
                return;
            }
            
            // Add test URLs
            const testUrls = [
                'https://e-codices.unifr.ch/en/list/one/csg/0018',
                'https://digi.vatlib.it/view/MSS_Vat.lat.3225'
            ];
            
            modalTextarea.value = testUrls.join('\\n');
            modalTextarea.dispatchEvent(new Event('input', { bubbles: true }));
            
            console.log('✅ Added test URLs to modal textarea');
            
            // Find the modal's Add to Queue button
            const modalAddBtn = Array.from(document.querySelectorAll('.modal-content button')).find(
                btn => btn.textContent.includes('Add to Queue')
            );
            
            if (!modalAddBtn) {
                console.error('❌ Modal Add to Queue button not found!');
                return;
            }
            
            console.log('✅ Found modal Add to Queue button');
            console.log('Button disabled:', modalAddBtn.disabled);
            console.log('Button onclick:', modalAddBtn.onclick);
            
            // Check Vue instance
            const vueApp = document.querySelector('#app').__vueApp__;
            if (vueApp) {
                console.log('✅ Vue app found');
            }
            
            // Try clicking the button
            console.log('Clicking modal Add to Queue button...');
            modalAddBtn.click();
            
            // Check if modal closed
            await new Promise(resolve => setTimeout(resolve, 1000));
            const modalStillOpen = document.querySelector('.modal-overlay');
            if (modalStillOpen) {
                console.error('❌ Modal is still open after clicking Add to Queue!');
                
                // Check for any error messages
                const errorMsg = document.querySelector('.error-message');
                if (errorMsg) {
                    console.error('Error message:', errorMsg.textContent);
                }
            } else {
                console.log('✅ Modal closed successfully');
            }
            
            // Check queue items
            const queueItems = document.querySelectorAll('.queue-item');
            console.log('Queue items count:', queueItems.length);
            
            console.log('=== Test Complete ===');
        })();
    `);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});