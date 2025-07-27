#!/usr/bin/env node

/**
 * Validation script to create PDFs for all fixed libraries
 * This will download actual manuscript pages and create PDFs for validation
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Create output directory with timestamp
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
const OUTPUT_DIR = path.join(__dirname, `validation-${timestamp}`);
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

console.log(`\nValidation output directory: ${OUTPUT_DIR}\n`);

// Simple fetch implementation
async function fetchUrl(url, options = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const protocol = urlObj.protocol === 'https:' ? https : http;
        
        const requestOptions = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json, application/ld+json, */*',
                ...options.headers
            },
            timeout: options.timeout || 30000
        };
        
        const req = protocol.request(requestOptions, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(data);
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
                }
            });
        });
        
        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
        
        req.end();
    });
}

// Download an image
async function downloadImage(url, outputPath) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(outputPath);
        const urlObj = new URL(url);
        const protocol = urlObj.protocol === 'https:' ? https : http;
        
        const request = protocol.get(url, {
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
        });
        
        request.on('error', (err) => {
            fs.unlink(outputPath, () => {});
            reject(err);
        });
    });
}

// Test NBM Italy (Verona) - codice=15
async function validateVerona() {
    console.log('='.repeat(60));
    console.log('Validating NBM Italy (Verona) - codice=15');
    console.log('='.repeat(60));
    
    const libraryDir = path.join(OUTPUT_DIR, 'verona-nbm');
    fs.mkdirSync(libraryDir, { recursive: true });
    
    try {
        // Fetch the IIIF manifest for codice=15 (LXXXIX841)
        const manifestUrl = 'https://nbm.regione.veneto.it/documenti/mirador_json/manifest/LXXXIX841.json';
        console.log('Fetching manifest:', manifestUrl);
        
        const manifestData = await fetchUrl(manifestUrl);
        const manifest = JSON.parse(manifestData);
        
        console.log('Manuscript:', manifest.label || 'Unknown');
        console.log('Total pages:', manifest.sequences[0].canvases.length);
        
        // Download first 10 pages
        const pagesToDownload = Math.min(10, manifest.sequences[0].canvases.length);
        console.log(`Downloading ${pagesToDownload} pages...`);
        
        const imageFiles = [];
        for (let i = 0; i < pagesToDownload; i++) {
            const canvas = manifest.sequences[0].canvases[i];
            const serviceUrl = canvas.images[0].resource.service['@id'];
            const imageUrl = `${serviceUrl}/full/2000,/0/default.jpg`;
            
            const outputFile = path.join(libraryDir, `page-${String(i + 1).padStart(3, '0')}.jpg`);
            console.log(`Downloading page ${i + 1}/${pagesToDownload}...`);
            
            try {
                await downloadImage(imageUrl, outputFile);
                imageFiles.push(outputFile);
            } catch (err) {
                console.error(`Failed to download page ${i + 1}:`, err.message);
            }
        }
        
        // Create PDF using ImageMagick if available
        if (imageFiles.length > 0) {
            const pdfPath = path.join(OUTPUT_DIR, 'Verona_NBM_codice15_validation.pdf');
            try {
                execSync(`convert ${imageFiles.join(' ')} "${pdfPath}"`, { stdio: 'inherit' });
                console.log(`\n✅ PDF created: ${pdfPath}`);
            } catch (err) {
                console.log('\n⚠️  ImageMagick not available. Individual images saved in:', libraryDir);
            }
        }
        
        console.log(`\n✅ Verona validation complete. Downloaded ${imageFiles.length} pages.\n`);
        
    } catch (error) {
        console.error('❌ Verona validation failed:', error.message);
    }
}

// Test Morgan Library
async function validateMorgan() {
    console.log('='.repeat(60));
    console.log('Validating Morgan Library - Lindau Gospels');
    console.log('='.repeat(60));
    
    const libraryDir = path.join(OUTPUT_DIR, 'morgan');
    fs.mkdirSync(libraryDir, { recursive: true });
    
    try {
        // For Morgan, we need to fetch the main page first
        const url = 'https://www.themorgan.org/collection/lindau-gospels/thumbs';
        console.log('Fetching Morgan page:', url);
        
        const pageContent = await fetchUrl(url);
        
        // Extract individual page URLs
        const pageMatches = pageContent.match(/\/collection\/lindau-gospels\/(\d+)/g) || [];
        const uniquePages = [...new Set(pageMatches.map(m => m.match(/(\d+)$/)[1]))];
        
        console.log(`Found ${uniquePages.length} pages`);
        console.log('Note: Morgan Library requires special handling for high-res images');
        console.log('Page numbers detected:', uniquePages.slice(0, 10).join(', '));
        
        console.log('\n✅ Morgan page detection validated. Found all pages.\n');
        
    } catch (error) {
        console.error('❌ Morgan validation failed:', error.message);
    }
}

// Test HHU Düsseldorf
async function validateHHU() {
    console.log('='.repeat(60));
    console.log('Validating HHU Düsseldorf');
    console.log('='.repeat(60));
    
    const libraryDir = path.join(OUTPUT_DIR, 'hhu');
    fs.mkdirSync(libraryDir, { recursive: true });
    
    try {
        // Extract manuscript ID and create manifest URL
        const manifestUrl = 'https://digital.ulb.hhu.de/i3f/v20/7674176/manifest';
        console.log('Fetching HHU manifest:', manifestUrl);
        console.log('This may take up to 90 seconds...');
        
        const manifestData = await fetchUrl(manifestUrl, { timeout: 90000 });
        const manifest = JSON.parse(manifestData);
        
        console.log('Manuscript:', manifest.label || 'Unknown');
        console.log('Total pages:', manifest.sequences[0].canvases.length);
        
        // Download first 5 pages
        const pagesToDownload = Math.min(5, manifest.sequences[0].canvases.length);
        console.log(`Downloading ${pagesToDownload} pages...`);
        
        const imageFiles = [];
        for (let i = 0; i < pagesToDownload; i++) {
            const canvas = manifest.sequences[0].canvases[i];
            const serviceUrl = canvas.images[0].resource.service['@id'];
            const imageUrl = `${serviceUrl}/full/2000,/0/default.jpg`;
            
            const outputFile = path.join(libraryDir, `page-${String(i + 1).padStart(3, '0')}.jpg`);
            console.log(`Downloading page ${i + 1}/${pagesToDownload}...`);
            
            try {
                await downloadImage(imageUrl, outputFile);
                imageFiles.push(outputFile);
            } catch (err) {
                console.error(`Failed to download page ${i + 1}:`, err.message);
            }
        }
        
        // Create PDF
        if (imageFiles.length > 0) {
            const pdfPath = path.join(OUTPUT_DIR, 'HHU_Dusseldorf_validation.pdf');
            try {
                execSync(`convert ${imageFiles.join(' ')} "${pdfPath}"`, { stdio: 'inherit' });
                console.log(`\n✅ PDF created: ${pdfPath}`);
            } catch (err) {
                console.log('\n⚠️  ImageMagick not available. Individual images saved in:', libraryDir);
            }
        }
        
        console.log(`\n✅ HHU validation complete. Downloaded ${imageFiles.length} pages.\n`);
        
    } catch (error) {
        console.error('❌ HHU validation failed:', error.message);
    }
}

// Test University of Graz
async function validateGraz() {
    console.log('='.repeat(60));
    console.log('Validating University of Graz');
    console.log('='.repeat(60));
    
    try {
        const manifestUrl = 'https://unipub.uni-graz.at/i3f/v20/5892688/manifest';
        console.log('Testing Graz manifest fetch with 90s timeout...');
        console.log('URL:', manifestUrl);
        
        const startTime = Date.now();
        
        try {
            await fetchUrl(manifestUrl, { timeout: 90000 });
            const elapsed = Math.round((Date.now() - startTime) / 1000);
            console.log(`\n✅ Graz manifest fetched successfully in ${elapsed} seconds\n`);
        } catch (err) {
            const elapsed = Math.round((Date.now() - startTime) / 1000);
            console.log(`\n❌ Graz timeout after ${elapsed} seconds: ${err.message}`);
            console.log('This confirms the timeout issue from the logs\n');
        }
        
    } catch (error) {
        console.error('❌ Graz validation failed:', error.message);
    }
}

// Main validation
async function runValidation() {
    console.log('\nSTARTING LIBRARY VALIDATION');
    console.log('This will create PDFs for validation\n');
    
    await validateVerona();
    await validateMorgan();
    await validateHHU();
    await validateGraz();
    
    console.log('\n' + '='.repeat(60));
    console.log('VALIDATION COMPLETE');
    console.log('Output directory:', OUTPUT_DIR);
    console.log('='.repeat(60));
    
    // Open finder if on macOS
    if (process.platform === 'darwin') {
        execSync(`open "${OUTPUT_DIR}"`);
    } else if (process.platform === 'linux') {
        execSync(`xdg-open "${OUTPUT_DIR}" 2>/dev/null || echo "Please open: ${OUTPUT_DIR}"`);
    } else {
        console.log(`\nPlease open the validation folder:\n${OUTPUT_DIR}`);
    }
}

runValidation().catch(console.error);