#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const zlib = require('zlib');

async function fetchWithFallback(url, options = {}) {
    const urlObj = new URL(url);
    const requestOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: options.method || 'GET',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            ...options.headers
        }
    };

    return new Promise((resolve, reject) => {
        const req = https.request(requestOptions, (res) => {
            let data = [];
            res.on('data', (chunk) => {
                data.push(chunk);
            });
            res.on('end', () => {
                const buffer = Buffer.concat(data);
                let responseText = '';
                
                if (res.headers['content-encoding'] === 'gzip') {
                    try {
                        responseText = zlib.gunzipSync(buffer).toString();
                    } catch (e) {
                        responseText = buffer.toString();
                    }
                } else if (res.headers['content-encoding'] === 'deflate') {
                    try {
                        responseText = zlib.inflateSync(buffer).toString();
                    } catch (e) {
                        responseText = buffer.toString();
                    }
                } else {
                    responseText = buffer.toString();
                }
                
                resolve({
                    ok: res.statusCode >= 200 && res.statusCode < 300,
                    status: res.statusCode,
                    headers: res.headers,
                    buffer: () => Promise.resolve(buffer),
                    text: () => Promise.resolve(responseText)
                });
            });
        });

        req.on('error', reject);
        req.end();
    });
}

async function loadBvpbManifestFixed(originalUrl) {
    try {
        const pathMatch = originalUrl.match(/path=([^&]+)/);
        if (!pathMatch) {
            throw new Error('Could not extract path from BVPB URL');
        }
        
        const pathId = pathMatch[1];
        console.log(`Extracting BVPB manuscript path: ${pathId}`);
        
        const allImageIds = [];
        let currentPosition = 1;
        let hasMorePages = true;
        let totalPages = 0;
        let pageTitle = 'BVPB Manuscript';
        
        while (hasMorePages) {
            const catalogUrl = `https://bvpb.mcu.es/es/catalogo_imagenes/grupo.do?path=${pathId}&posicion=${currentPosition}`;
            console.log(`Discovering BVPB manuscript pages starting at position ${currentPosition}...`);
            
            const response = await fetchWithFallback(catalogUrl);
            if (!response.ok) {
                throw new Error(`Failed to load BVPB catalog page: ${response.status}`);
            }
            
            const html = await response.text();
            
            // Extract title from first page
            if (currentPosition === 1) {
                try {
                    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
                    if (titleMatch) {
                        pageTitle = titleMatch[1]
                            .replace(/Biblioteca Virtual del Patrimonio Bibliográfico[^>]*>\s*/gi, '')
                            .replace(/^\s*Búsqueda[^>]*>\s*/gi, '')
                            .replace(/\s*\(Objetos digitales\)\s*/gi, '')
                            .replace(/&gt;/g, '>')
                            .replace(/&rsaquo;/g, '›')
                            .replace(/&[^;]+;/g, ' ')
                            .replace(/\s+/g, ' ')
                            .trim() || pageTitle;
                    }
                } catch (titleError) {
                    console.warn('Could not extract BVPB title:', titleError.message);
                }
                
                // Extract total pages count
                const totalMatch = html.match(/(\d+)\s*de\s*(\d+)/);
                if (totalMatch) {
                    totalPages = parseInt(totalMatch[2]);
                    console.log(`Found total pages: ${totalPages}`);
                }
            }
            
            // Extract image IDs from current page
            const imageIdPattern = /object-miniature\.do\?id=(\d+)/g;
            const pageImageIds = [];
            let match;
            while ((match = imageIdPattern.exec(html)) !== null) {
                const imageId = match[1];
                if (!pageImageIds.includes(imageId)) {
                    pageImageIds.push(imageId);
                }
            }
            
            console.log(`Found ${pageImageIds.length} images on page starting at position ${currentPosition}`);
            allImageIds.push(...pageImageIds);
            
            // Check if there are more pages
            if (totalPages > 0 && allImageIds.length >= totalPages) {
                hasMorePages = false;
                console.log(`Reached total pages limit: ${totalPages}`);
            } else if (pageImageIds.length === 0) {
                hasMorePages = false;
                console.log('No more images found, stopping pagination');
            } else {
                // Move to next page (BVPB shows 12 images per page)
                currentPosition += 12;
                
                // Safety check - don't go beyond reasonable limits
                if (currentPosition > 10000) {
                    console.warn('Reached safety limit, stopping pagination');
                    hasMorePages = false;
                }
            }
        }
        
        if (allImageIds.length === 0) {
            throw new Error('No images found for this BVPB manuscript');
        }
        
        console.log(`BVPB manuscript discovery completed: ${allImageIds.length} pages found`);
        
        // Remove duplicates and sort by numeric ID to ensure proper order
        const uniqueImageIds = [...new Set(allImageIds)].sort((a, b) => parseInt(a) - parseInt(b));
        console.log(`Unique image IDs: ${uniqueImageIds.length}`);
        
        const pageLinks = uniqueImageIds.map(imageId => 
            `https://bvpb.mcu.es/es/media/object.do?id=${imageId}`
        );
        
        return {
            pageLinks,
            totalPages: pageLinks.length,
            library: 'bvpb',
            displayName: pageTitle,
            originalUrl: originalUrl,
        };
        
    } catch (error) {
        throw new Error(`Failed to load BVPB manuscript: ${error.message}`);
    }
}

async function downloadImages(manifest, outputDir, maxPages = 15) {
    console.log(`\nDownloading first ${maxPages} images to ${outputDir}...`);
    
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const pagesToDownload = manifest.pageLinks.slice(0, maxPages);
    const downloadedFiles = [];
    
    for (let i = 0; i < pagesToDownload.length; i++) {
        const url = pagesToDownload[i];
        const filename = `page_${(i + 1).toString().padStart(3, '0')}.jpg`;
        const filepath = path.join(outputDir, filename);
        
        try {
            console.log(`Downloading page ${i + 1}/${pagesToDownload.length}: ${filename}`);
            const response = await fetchWithFallback(url);
            
            if (!response.ok) {
                console.warn(`Failed to download ${filename}: HTTP ${response.status}`);
                continue;
            }
            
            const buffer = await response.buffer();
            fs.writeFileSync(filepath, buffer);
            downloadedFiles.push(filepath);
            
            console.log(`✓ Downloaded ${filename} (${buffer.length} bytes)`);
            
        } catch (error) {
            console.warn(`Failed to download ${filename}: ${error.message}`);
        }
    }
    
    return downloadedFiles;
}

async function createPDF(imageFiles, outputPath, title) {
    console.log(`\nCreating PDF: ${outputPath}`);
    
    return new Promise((resolve, reject) => {
        // Use img2pdf to create PDF from images
        const img2pdfCmd = [
            'img2pdf',
            '--output', outputPath,
            '--title', title,
            ...imageFiles.sort() // Ensure proper order
        ];
        
        const process = spawn('img2pdf', img2pdfCmd.slice(1), {
            stdio: ['pipe', 'pipe', 'pipe']
        });
        
        let stdout = '';
        let stderr = '';
        
        process.stdout.on('data', (data) => {
            stdout += data.toString();
        });
        
        process.stderr.on('data', (data) => {
            stderr += data.toString();
        });
        
        process.on('close', (code) => {
            if (code === 0) {
                console.log(`✓ PDF created successfully: ${outputPath}`);
                resolve(outputPath);
            } else {
                console.error('img2pdf stderr:', stderr);
                reject(new Error(`img2pdf failed with code ${code}: ${stderr}`));
            }
        });
        
        process.on('error', (error) => {
            reject(new Error(`Failed to start img2pdf: ${error.message}`));
        });
    });
}

async function createBvpbValidation() {
    console.log('=== CREATING BVPB VALIDATION PDF ===');
    
    const testUrl = 'https://bvpb.mcu.es/es/catalogo_imagenes/grupo.do?path=11000651';
    const outputDir = '/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/CURRENT-VALIDATION';
    const imageDir = path.join(outputDir, 'bvpb-validation-images');
    const pdfPath = path.join(outputDir, 'BVPB-PAGINATION-FIX-VALIDATION.pdf');
    
    try {
        // Load manifest with pagination fix
        console.log('Loading BVPB manifest with pagination fix...');
        const manifest = await loadBvpbManifestFixed(testUrl);
        
        console.log(`\n=== MANIFEST RESULTS ===`);
        console.log(`Title: ${manifest.displayName}`);
        console.log(`Total Pages Found: ${manifest.totalPages}`);
        console.log(`Library: ${manifest.library}`);
        console.log(`Original URL: ${manifest.originalUrl}`);
        
        // Validate that we have more than 12 pages (the old limit)
        if (manifest.totalPages <= 12) {
            throw new Error(`Pagination fix failed: Only found ${manifest.totalPages} pages (expected >12)`);
        }
        
        console.log(`✓ Pagination fix SUCCESS: Found ${manifest.totalPages} pages (>12)`);
        
        // Download first 15 pages for validation
        const downloadedFiles = await downloadImages(manifest, imageDir, 15);
        
        if (downloadedFiles.length < 15) {
            console.warn(`Warning: Only downloaded ${downloadedFiles.length} out of 15 requested pages`);
        }
        
        // Create PDF
        await createPDF(downloadedFiles, pdfPath, manifest.displayName);
        
        // Get PDF info
        const stats = fs.statSync(pdfPath);
        console.log(`\n=== PDF VALIDATION ===`);
        console.log(`PDF File: ${pdfPath}`);
        console.log(`PDF Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
        console.log(`Images Included: ${downloadedFiles.length}`);
        
        // Clean up image directory
        console.log('\nCleaning up temporary images...');
        downloadedFiles.forEach(file => {
            try {
                fs.unlinkSync(file);
            } catch (error) {
                console.warn(`Failed to delete ${file}: ${error.message}`);
            }
        });
        
        try {
            fs.rmdirSync(imageDir);
        } catch (error) {
            console.warn(`Failed to remove directory ${imageDir}: ${error.message}`);
        }
        
        console.log('\n=== VALIDATION COMPLETE ===');
        console.log(`✅ BVPB pagination fix verified`);
        console.log(`✅ Successfully downloaded ${downloadedFiles.length} pages`);
        console.log(`✅ PDF created: ${pdfPath}`);
        console.log(`✅ Original issue: Only 12 pages downloaded`);
        console.log(`✅ Fixed result: ${manifest.totalPages} pages available`);
        console.log('');
        console.log(`Please review the PDF to confirm it contains multiple different manuscript pages.`);
        
        return pdfPath;
        
    } catch (error) {
        console.error('Validation failed:', error.message);
        throw error;
    }
}

createBvpbValidation().catch(error => {
    console.error('Error creating BVPB validation:', error.message);
    process.exit(1);
});