#!/usr/bin/env node

/**
 * Internet Culturale Small Batch Test
 * 
 * This script tests downloading just 3-5 pages from Internet Culturale
 * to investigate why PDFs contain repeated library pages instead of manuscript images.
 */

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// Test URL - same one from the investigation report
const testUrl = 'https://www.internetculturale.it/jmms/iccuviewer/iccu.jsp?id=oai%3Abncf.firenze.sbn.it%3A21%3AFI0098%3AManoscrittiInRete%3AB.R.231&mode=all&teca=Bncf';

async function runTest() {
    console.log('🔍 Internet Culturale Small Batch Investigation Test');
    console.log('=' .repeat(60));
    console.log(`📖 Test URL: ${testUrl}`);
    console.log(`📄 Testing: First 5 pages only`);
    console.log(`🎯 Goal: Verify if downloaded images are different or identical`);
    console.log('');

    try {
        // Step 1: Test manifest loading
        console.log('🔄 Step 1: Testing manifest loading...');
        const manifestResult = await testManifestLoading();
        
        if (!manifestResult.success) {
            console.error('❌ Manifest loading failed:', manifestResult.error);
            return;
        }
        
        console.log(`✅ Manifest loaded: ${manifestResult.totalPages} pages found`);
        console.log(`📋 Title: ${manifestResult.title}`);
        console.log(`🔗 First 5 image URLs:`);
        
        const testUrls = manifestResult.imageUrls.slice(0, 5);
        testUrls.forEach((url, i) => {
            console.log(`   ${i + 1}. ${url}`);
        });
        
        console.log('');
        
        // Step 2: Download individual images
        console.log('🔄 Step 2: Downloading individual images...');
        const downloadResults = await downloadTestImages(testUrls);
        
        console.log(`✅ Downloaded ${downloadResults.successful.length}/${testUrls.length} images`);
        
        if (downloadResults.failed.length > 0) {
            console.log(`❌ Failed downloads:`);
            downloadResults.failed.forEach(fail => {
                console.log(`   • ${fail.url}: ${fail.error}`);
            });
        }
        
        // Step 3: Analyze downloaded images
        console.log('');
        console.log('🔄 Step 3: Analyzing downloaded images...');
        const analysisResults = await analyzeDownloadedImages(downloadResults.successful);
        
        console.log(`📊 Analysis Results:`);
        console.log(`   • Total images: ${analysisResults.totalImages}`);
        console.log(`   • Unique file sizes: ${analysisResults.uniqueSizes.length}`);
        console.log(`   • Unique content hashes: ${analysisResults.uniqueHashes.length}`);
        console.log(`   • Average file size: ${Math.round(analysisResults.avgSize / 1024)} KB`);
        
        if (analysisResults.uniqueHashes.length === 1) {
            console.log('');
            console.log('🚨 PROBLEM IDENTIFIED: All images have identical content!');
            console.log('   This confirms the bug - different URLs return the same image.');
        } else {
            console.log('');
            console.log('✅ Images have different content - problem may be in PDF creation pipeline.');
        }
        
        // Step 4: Display detailed analysis
        console.log('');
        console.log('📋 Detailed File Analysis:');
        analysisResults.fileDetails.forEach((file, i) => {
            console.log(`   ${i + 1}. Size: ${Math.round(file.size / 1024)}KB, Hash: ${file.hash.substring(0, 12)}...`);
        });
        
        // Cleanup
        console.log('');
        console.log('🧹 Cleaning up test files...');
        await cleanupTestFiles(downloadResults.successful);
        console.log('✅ Cleanup complete');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
    }
}

async function testManifestLoading() {
    // Simulate the manifest loading logic from the actual code
    try {
        const oaiMatch = testUrl.match(/id=([^&]+)/);
        if (!oaiMatch) {
            throw new Error('Could not extract OAI identifier');
        }
        
        const oaiId = decodeURIComponent(oaiMatch[1]);
        const tecaMatch = testUrl.match(/teca=([^&]+)/);
        const teca = tecaMatch ? decodeURIComponent(tecaMatch[1]) : 'Unknown';
        
        const apiUrl = `https://www.internetculturale.it/jmms/magparser?id=${encodeURIComponent(oaiId)}&teca=${encodeURIComponent(teca)}&mode=all&fulltext=0`;
        
        console.log(`   🌐 API URL: ${apiUrl}`);
        
        // Use fetch to get the manifest
        const fetch = (await import('node-fetch')).default;
        
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/xml, application/xml, */*; q=0.01',
            'Accept-Language': 'en-US,en;q=0.9,it;q=0.8',
            'Referer': testUrl,
            'X-Requested-With': 'XMLHttpRequest',
        };
        
        const response = await fetch(apiUrl, { headers });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const xmlText = await response.text();
        
        if (!xmlText || xmlText.trim().length === 0) {
            throw new Error('Empty response from API');
        }
        
        console.log(`   📄 Response size: ${xmlText.length} characters`);
        
        // Extract title
        let title = 'Internet Culturale Manuscript';
        const titleMatch = xmlText.match(/<info key="Titolo">\s*<value>(.*?)<\/value>/);
        if (titleMatch) {
            title = titleMatch[1].trim();
        }
        
        // Extract image URLs
        const imageUrls = [];
        const pageRegex = /<page[^>]+src="([^"]+)"[^>]*>/g;
        let match;
        
        while ((match = pageRegex.exec(xmlText)) !== null) {
            let relativePath = match[1];
            
            // Apply the same fix as in the actual code
            if (relativePath.includes('cacheman/normal/')) {
                relativePath = relativePath.replace('cacheman/normal/', 'cacheman/web/');
            }
            
            const imageUrl = `https://www.internetculturale.it/jmms/${relativePath}`;
            imageUrls.push(imageUrl);
        }
        
        return {
            success: true,
            totalPages: imageUrls.length,
            title,
            imageUrls
        };
        
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

async function downloadTestImages(urls) {
    const fetch = (await import('node-fetch')).default;
    const successful = [];
    const failed = [];
    
    for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        const filename = `test_image_${i + 1}.jpg`;
        const filepath = path.join(__dirname, filename);
        
        try {
            console.log(`   📥 Downloading image ${i + 1}/${urls.length}...`);
            
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Referer': testUrl
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const buffer = await response.buffer();
            await fs.writeFile(filepath, buffer);
            
            successful.push({
                url,
                filename,
                filepath,
                size: buffer.length
            });
            
        } catch (error) {
            failed.push({
                url,
                error: error.message
            });
        }
    }
    
    return { successful, failed };
}

async function analyzeDownloadedImages(files) {
    const fileDetails = [];
    const sizes = [];
    const hashes = new Set();
    
    for (const file of files) {
        const content = await fs.readFile(file.filepath);
        const hash = crypto.createHash('sha256').update(content).digest('hex');
        
        fileDetails.push({
            filename: file.filename,
            size: content.length,
            hash
        });
        
        sizes.push(content.length);
        hashes.add(hash);
    }
    
    const avgSize = sizes.reduce((sum, size) => sum + size, 0) / sizes.length;
    const uniqueSizes = [...new Set(sizes)];
    
    return {
        totalImages: files.length,
        fileDetails,
        uniqueSizes,
        uniqueHashes: Array.from(hashes),
        avgSize
    };
}

async function cleanupTestFiles(files) {
    for (const file of files) {
        try {
            await fs.unlink(file.filepath);
        } catch (error) {
            // Ignore cleanup errors
        }
    }
}

// Run the test
runTest().catch(console.error);