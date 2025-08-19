#!/usr/bin/env node

// Direct API call to download the Roman Archive manuscript
const http = require('http');

async function triggerDownload() {
    console.log('📥 Triggering Roman Archive manuscript download via API...\n');
    
    const manuscriptUrl = 'https://imagoarchiviodistatoroma.cultura.gov.it/Preziosi/scheda.php?r=994-882';
    console.log(`📋 Manuscript: ${manuscriptUrl}`);
    
    // Since Electron is running headless, let's use the IPC API approach
    // First, let's try to connect via the renderer port and send the URL
    
    const postData = JSON.stringify({
        action: 'addManuscript',
        url: manuscriptUrl
    });
    
    const options = {
        hostname: 'localhost',
        port: 5173,
        path: '/api/manuscripts',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    };
    
    console.log('🔌 Attempting to connect to renderer API...');
    
    const req = http.request(options, (res) => {
        console.log(`📊 Status: ${res.statusCode}`);
        console.log(`📋 Headers:`, res.headers);
        
        let data = '';
        res.on('data', (chunk) => {
            data += chunk;
        });
        
        res.on('end', () => {
            console.log('📝 Response:', data);
            if (res.statusCode === 200) {
                console.log('✅ Manuscript added successfully!');
                console.log('🚀 Download should start automatically...');
            } else {
                console.log('⚠️  API call failed, trying alternative approach...');
                tryAlternativeApproach();
            }
        });
    });
    
    req.on('error', (error) => {
        console.log('❌ Direct API failed:', error.message);
        console.log('🔄 Trying file-based approach...');
        tryFileBased();
    });
    
    req.write(postData);
    req.end();
}

function tryAlternativeApproach() {
    console.log('\n🔄 Alternative: Using file drop approach...');
    
    // Create a temporary file that the app can monitor
    const fs = require('fs');
    const path = require('path');
    
    const dropFile = path.join(__dirname, 'manuscript-request.json');
    const manuscriptUrl = 'https://imagoarchiviodistatoroma.cultura.gov.it/Preziosi/scheda.php?r=994-882';
    
    const requestData = {
        action: 'download',
        url: manuscriptUrl,
        timestamp: Date.now()
    };
    
    fs.writeFileSync(dropFile, JSON.stringify(requestData, null, 2));
    console.log(`📁 Request file created: ${dropFile}`);
    console.log('💡 Manual step: Open the Electron app and add this URL:');
    console.log(`   ${manuscriptUrl}`);
}

function tryFileBased() {
    console.log('\n📝 File-based approach: Creating download request...');
    
    const fs = require('fs');
    const path = require('path');
    
    const manuscriptUrl = 'https://imagoarchiviodistatoroma.cultura.gov.it/Preziosi/scheda.php?r=994-882';
    
    // Create a batch file for the manuscript
    const batchContent = manuscriptUrl;
    const batchFile = path.join(process.cwd(), 'roman-archive-batch.txt');
    
    fs.writeFileSync(batchFile, batchContent);
    console.log(`📄 Batch file created: ${batchFile}`);
    console.log('💡 You can drag this file into the Electron app to add the manuscript');
    console.log('\n🎯 To complete the test:');
    console.log('1. The Electron app is running in headless mode');
    console.log('2. Open a regular Electron instance: npm run dev');
    console.log('3. Add this URL to the queue');
    console.log('4. Start the download');
    console.log(`\n📋 Manuscript URL: ${manuscriptUrl}`);
}

triggerDownload().catch(console.error);