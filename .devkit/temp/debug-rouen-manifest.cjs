#!/usr/bin/env node

const https = require('https');
const zlib = require('zlib');

/**
 * Debug script to examine Rouen manifest structure
 */

function makeRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const req = https.request(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': 'application/json,text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate, br',
                'Referer': 'https://www.rotomagus.fr/',
                ...options.headers
            },
            timeout: 30000
        }, (res) => {
            const chunks = [];
            
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => {
                let buffer = Buffer.concat(chunks);
                
                // Handle compression
                const encoding = res.headers['content-encoding'];
                if (encoding === 'gzip') {
                    buffer = zlib.gunzipSync(buffer);
                } else if (encoding === 'deflate') {
                    buffer = zlib.inflateSync(buffer);
                } else if (encoding === 'br') {
                    buffer = zlib.brotliDecompressSync(buffer);
                }
                
                const data = buffer.toString('utf8');
                
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    data: data,
                    url: url
                });
            });
        });
        
        req.on('error', reject);
        req.on('timeout', () => reject(new Error('Request timeout')));
        req.end();
    });
}

async function debugManifest() {
    const manifestUrl = 'https://www.rotomagus.fr/ark:/12148/btv1b10052442z/manifest.json';
    
    console.log('🔍 Debugging Rouen manifest structure...');
    console.log(`📋 Fetching: ${manifestUrl}`);
    
    try {
        const response = await makeRequest(manifestUrl);
        
        console.log(`✅ Status: ${response.statusCode}`);
        console.log(`📄 Content-Type: ${response.headers['content-type']}`);
        console.log(`📦 Content-Encoding: ${response.headers['content-encoding'] || 'none'}`);
        console.log(`📏 Content-Length: ${response.headers['content-length']}`);
        
        try {
            const manifest = JSON.parse(response.data);
            
            console.log('\n📊 Manifest Structure Analysis:');
            console.log(`   @context: ${manifest['@context']}`);
            console.log(`   @type: ${manifest['@type']}`);
            console.log(`   @id: ${manifest['@id']}`);
            console.log(`   label: ${manifest.label}`);
            
            // Check for different possible structures
            if (manifest.sequences) {
                console.log(`   ✓ Found sequences: ${manifest.sequences.length}`);
                if (manifest.sequences[0] && manifest.sequences[0].canvases) {
                    console.log(`   ✓ Found canvases: ${manifest.sequences[0].canvases.length}`);
                }
            }
            
            if (manifest.items) {
                console.log(`   ✓ Found items: ${manifest.items.length}`);
            }
            
            if (manifest.structures) {
                console.log(`   ✓ Found structures: ${manifest.structures.length}`);
            }
            
            if (manifest.service) {
                console.log(`   ✓ Found service: ${Array.isArray(manifest.service) ? manifest.service.length + ' services' : 'single service'}`);
            }
            
            // Log all top-level keys
            console.log('\n🔑 Top-level keys:');
            Object.keys(manifest).forEach(key => {
                const value = manifest[key];
                const type = Array.isArray(value) ? `array[${value.length}]` : typeof value;
                console.log(`   ${key}: ${type}`);
            });
            
            // Look for any structure that might contain pages/images
            console.log('\n🔍 Looking for page structures...');
            
            function findPagesRecursive(obj, path = '') {
                if (!obj || typeof obj !== 'object') return;
                
                Object.keys(obj).forEach(key => {
                    const value = obj[key];
                    const currentPath = path ? `${path}.${key}` : key;
                    
                    if (Array.isArray(value) && value.length > 0) {
                        console.log(`   Found array at ${currentPath}: ${value.length} items`);
                        
                        // Check first item in array
                        if (value[0] && typeof value[0] === 'object') {
                            const firstItem = value[0];
                            if (firstItem['@id'] || firstItem.id) {
                                console.log(`     First item ID: ${firstItem['@id'] || firstItem.id}`);
                            }
                            if (firstItem.width && firstItem.height) {
                                console.log(`     First item dimensions: ${firstItem.width}x${firstItem.height}`);
                            }
                            if (firstItem.images || firstItem.items) {
                                console.log(`     First item has images/items`);
                            }
                        }
                    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
                        findPagesRecursive(value, currentPath);
                    }
                });
            }
            
            findPagesRecursive(manifest);
            
            // Save the full manifest for inspection
            const fs = require('fs');
            const path = require('path');
            const manifestPath = path.join(__dirname, '../reports/rouen-manifest-sample.json');
            fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
            console.log(`\n💾 Full manifest saved to: ${manifestPath}`);
            
        } catch (parseError) {
            console.log(`❌ JSON parse error: ${parseError.message}`);
            console.log(`📄 Raw response (first 500 chars):`);
            console.log(response.data.substring(0, 500));
        }
        
    } catch (error) {
        console.log(`❌ Request failed: ${error.message}`);
    }
}

debugManifest().catch(console.error);