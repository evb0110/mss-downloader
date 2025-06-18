#!/usr/bin/env node

// Simple test script to upload file to cloud
const CloudUploader = require('./cloud-uploader');
const path = require('path');

async function testUpload() {
    const filePath = process.argv[2];
    
    if (!filePath) {
        console.log('Usage: node simple-upload.js <file-path>');
        process.exit(1);
    }
    
    const uploader = new CloudUploader();
    
    try {
        console.log('Testing cloud upload...');
        const result = await uploader.uploadFile(filePath);
        console.log('\n✅ Upload successful!');
        console.log('Service:', result.service);
        console.log('URL:', result.url);
        console.log('Expires:', result.expires);
        console.log('\nFormatted message:');
        console.log(uploader.formatDownloadMessage(result));
    } catch (error) {
        console.error('❌ Upload failed:', error.message);
    }
}

testUpload();