#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');

async function downloadImage(url, filepath) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filepath);
        https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0',
                'Accept': 'image/*'
            }
        }, (response) => {
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', reject);
    });
}

async function downloadSamplePages() {
    const outputDir = '.devkit/issue-1/samples';
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    console.log('Downloading sample pages from HHU manuscript...\n');
    
    // Download pages from beginning, middle, and end
    const pages = [
        { num: 1, url: 'https://digital.ulb.hhu.de/i3f/v20/7674176/canvas/p1/full/800,/0/default.jpg' },
        { num: 150, url: 'https://digital.ulb.hhu.de/i3f/v20/7674176/canvas/p150/full/800,/0/default.jpg' },
        { num: 299, url: 'https://digital.ulb.hhu.de/i3f/v20/7674176/canvas/p299/full/800,/0/default.jpg' }
    ];
    
    for (const page of pages) {
        const filename = `page_${page.num}.jpg`;
        const filepath = path.join(outputDir, filename);
        console.log(`Downloading page ${page.num}...`);
        try {
            await downloadImage(page.url, filepath);
            console.log(`✅ Saved to ${filepath}`);
        } catch (error) {
            console.error(`❌ Failed to download page ${page.num}: ${error.message}`);
        }
    }
    
    console.log('\nDone! Sample pages saved to:', outputDir);
}

downloadSamplePages().catch(console.error);