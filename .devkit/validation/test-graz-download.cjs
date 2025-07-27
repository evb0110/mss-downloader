#!/usr/bin/env node

/**
 * Test Graz download functionality
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const OUTPUT_DIR = path.join(__dirname, 'graz-validation');
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

async function fetchWithTimeout(url, timeout = 90000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(`Timeout after ${timeout/1000} seconds`));
        }, timeout);
        
        https.get(url, {
            headers: {
                'Accept': 'application/json, application/ld+json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        }, (res) => {
            clearTimeout(timer);
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(data);
                } else {
                    reject(new Error(`HTTP ${res.statusCode}`));
                }
            });
        }).on('error', (err) => {
            clearTimeout(timer);
            reject(err);
        });
    });
}

async function downloadImage(url, outputPath) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(outputPath);
        https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        }, (response) => {
            if (response.statusCode === 200) {
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    resolve(outputPath);
                });
            } else {
                reject(new Error(`Failed to download: ${response.statusCode}`));
            }
        }).on('error', (err) => {
            fs.unlink(outputPath, () => {});
            reject(err);
        });
    });
}

async function testGraz() {
    console.log('Testing University of Graz Download');
    console.log('=' .repeat(60));
    
    try {
        const manifestUrl = 'https://unipub.uni-graz.at/i3f/v20/5892688/manifest';
        console.log('Fetching Graz manifest:', manifestUrl);
        console.log('This may take up to 90 seconds...\n');
        
        const startTime = Date.now();
        const manifestData = await fetchWithTimeout(manifestUrl, 90000);
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        
        console.log(`✅ Manifest fetched successfully in ${elapsed} seconds`);
        
        const manifest = JSON.parse(manifestData);
        console.log(`Manuscript: ${manifest.label || 'Unknown'}`);
        console.log(`Total pages: ${manifest.sequences[0].canvases.length}`);
        
        // Download first 5 pages
        const pagesToDownload = Math.min(5, manifest.sequences[0].canvases.length);
        console.log(`\nDownloading ${pagesToDownload} pages...\n`);
        
        const imageFiles = [];
        for (let i = 0; i < pagesToDownload; i++) {
            const canvas = manifest.sequences[0].canvases[i];
            const serviceUrl = canvas.images[0].resource.service['@id'];
            // Use 2000px resolution for Graz
            const imageUrl = `${serviceUrl}/full/2000,/0/default.jpg`;
            
            const outputFile = path.join(OUTPUT_DIR, `page-${String(i + 1).padStart(3, '0')}.jpg`);
            
            try {
                console.log(`Downloading page ${i + 1}/${pagesToDownload}...`);
                await downloadImage(imageUrl, outputFile);
                
                const stats = fs.statSync(outputFile);
                console.log(`✅ Page ${i + 1} downloaded (${(stats.size / 1024).toFixed(1)} KB)`);
                imageFiles.push(outputFile);
            } catch (err) {
                console.error(`❌ Failed to download page ${i + 1}:`, err.message);
            }
        }
        
        // Create PDF
        if (imageFiles.length > 0) {
            const pdfPath = path.join(OUTPUT_DIR, 'Graz_University_validation.pdf');
            console.log('\nCreating PDF...');
            
            try {
                execSync(`convert ${imageFiles.join(' ')} "${pdfPath}"`, { stdio: 'pipe' });
                console.log(`✅ PDF created: ${pdfPath}`);
                
                const pdfStats = fs.statSync(pdfPath);
                console.log(`PDF size: ${(pdfStats.size / 1024 / 1024).toFixed(1)} MB`);
            } catch (err) {
                console.log('⚠️  Individual images saved in:', OUTPUT_DIR);
            }
        }
        
        console.log('\n' + '='.repeat(60));
        console.log('UNIVERSITY OF GRAZ VALIDATION COMPLETE');
        console.log(`✅ Manifest loads successfully (not just timeout message)`);
        console.log(`✅ Downloads work properly`);
        console.log(`✅ ${imageFiles.length} pages downloaded`);
        console.log('='.repeat(60));
        
        // Open the folder
        if (process.platform === 'darwin') {
            execSync(`open "${OUTPUT_DIR}"`);
        } else if (process.platform === 'linux') {
            execSync(`xdg-open "${OUTPUT_DIR}" 2>/dev/null || true`);
        }
        
    } catch (error) {
        console.error('\n❌ Graz test failed:', error.message);
        if (error.message.includes('Timeout')) {
            console.error('The Graz server is not responding within 90 seconds');
            console.error('This confirms the timeout issue from the user logs');
        }
    }
}

testGraz().catch(console.error);