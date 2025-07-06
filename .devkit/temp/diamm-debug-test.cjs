const https = require('https');
const fs = require('fs');
const path = require('path');

// Test individual DIAMM URLs to debug the issue
const testUrls = [
  'https://iiif.diamm.net/images/I-Ra-Ms1383/I-Ra-Ms1383_000-Regle.tif/full/full/0/default.jpg',
  'https://iiif.diamm.net/images/I-Ra-Ms1383/I-Ra-Ms1383_000-Regle.tif/full/max/0/default.jpg',  
  'https://iiif.diamm.net/images/I-Ra-Ms1383/I-Ra-Ms1383_000-Regle.tif/full/2000/0/default.jpg',
  'https://iiif.diamm.net/images/I-Ra-Ms1383/I-Ra-Ms1383_000-Regle.tif/full/1000/0/default.jpg',
  'https://iiif.diamm.net/images/I-Ra-Ms1383/I-Ra-Ms1383_000-Regle.tif/info.json'
];

async function debugUrl(url) {
  console.log(`\n=== Testing URL: ${url} ===`);
  
  return new Promise((resolve) => {
    const request = https.get(url, { timeout: 10000 }, (response) => {
      console.log(`Status: ${response.statusCode} ${response.statusMessage}`);
      console.log(`Headers:`, response.headers);
      
      if (response.statusCode === 200) {
        let data = '';
        response.on('data', (chunk) => {
          data += chunk;
        });
        
        response.on('end', () => {
          console.log(`Content length: ${data.length}`);
          if (url.includes('info.json')) {
            console.log('Info JSON:', data.substring(0, 200) + '...');
          }
          resolve({ success: true, status: response.statusCode, data: data.substring(0, 100) });
        });
      } else {
        let errorData = '';
        response.on('data', (chunk) => {
          errorData += chunk;
        });
        
        response.on('end', () => {
          console.log(`Error response: ${errorData}`);
          resolve({ success: false, status: response.statusCode, error: errorData });
        });
      }
    });
    
    request.on('timeout', () => {
      console.log('Request timeout');
      request.destroy();
      resolve({ success: false, error: 'timeout' });
    });
    
    request.on('error', (err) => {
      console.log(`Request error: ${err.message}`);
      resolve({ success: false, error: err.message });
    });
  });
}

async function runDebugTest() {
  console.log('Starting DIAMM Debug Test...');
  
  for (const url of testUrls) {
    try {
      await debugUrl(url);
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
    } catch (error) {
      console.log(`Error testing ${url}:`, error);
    }
  }
  
  console.log('\n=== Debug Test Complete ===');
}

runDebugTest();