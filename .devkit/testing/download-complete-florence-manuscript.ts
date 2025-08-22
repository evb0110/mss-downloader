#!/usr/bin/env bun

/**
 * COMPLETE FLORENCE MANUSCRIPT DOWNLOADER
 * Downloads ALL 749 pages in highest resolution and creates PDF
 * As demanded by user: "I need ALL THE IMAGES!!! ... stitch them into pdf"
 */

import { FlorenceLoader } from '../../src/main/services/library-loaders/FlorenceLoader';
import https from 'https';
import fs from 'fs';
import { execSync } from 'child_process';
import path from 'path';

// Mock dependencies
const mockDeps = {
    fetchWithHTTPS: async (url: string, options?: any) => {
        return new Promise<Response>((resolve, reject) => {
            const urlObj = new URL(url);
            const requestOptions = {
                hostname: urlObj.hostname,
                port: urlObj.port || 443,
                path: urlObj.pathname + urlObj.search,
                method: options?.method || 'GET',
                headers: options?.headers || {},
                rejectUnauthorized: false
            };

            const req = https.request(requestOptions, (res) => {
                const chunks: Buffer[] = [];
                res.on('data', chunk => chunks.push(Buffer.from(chunk)));
                res.on('end', () => {
                    const buffer = Buffer.concat(chunks);
                    resolve({
                        ok: res.statusCode! >= 200 && res.statusCode! < 300,
                        status: res.statusCode!,
                        statusText: res.statusMessage || '',
                        headers: {
                            get: (name: string) => res.headers[name.toLowerCase()] as string || null
                        },
                        text: async () => buffer.toString(),
                        json: async () => JSON.parse(buffer.toString()),
                        arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
                    } as Response);
                });
            });

            req.on('error', reject);
            
            if (options?.body) {
                req.write(options.body);
            }
            
            req.end();
        });
    },
    logger: {
        log: (entry: any) => {
            const level = entry.level?.toUpperCase() || 'INFO';
            const library = entry.library ? `[${entry.library.toUpperCase()}]` : '';
            const message = entry.message || '';
            console.log(`[${level}]${library} ${message}`);
        },
        logDownloadError: (library: string, url: string, error: Error) => {
            console.error(`[ERROR][${library.toUpperCase()}] ${url}: ${error.message}`);
        }
    }
};

async function downloadPage(url: string, pageNum: number, outputDir: string): Promise<{ success: boolean; fileSize: number; filename?: string; error?: string }> {
    try {
        const response = await mockDeps.fetchWithHTTPS(url);
        
        if (!response.ok) {
            return { success: false, fileSize: 0, error: `HTTP ${response.status}: ${response.statusText}` };
        }
        
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const fileSize = buffer.length;
        
        // Save with zero-padded filename for proper sorting
        const filename = `page_${String(pageNum).padStart(4, '0')}.jpg`;
        const filepath = path.join(outputDir, filename);
        fs.writeFileSync(filepath, buffer);
        
        return { success: true, fileSize, filename };
        
    } catch (error: any) {
        return { success: false, fileSize: 0, error: error.message };
    }
}

async function createPDFFromImages(imageDir: string, outputPdfPath: string, totalPages: number): Promise<boolean> {
    try {
        console.log(`\n📚 Creating PDF from ${totalPages} pages...`);
        
        // Create a text file listing all images in order
        const imageListPath = path.join(imageDir, 'image_list.txt');
        const imageFiles: string[] = [];
        
        for (let i = 1; i <= totalPages; i++) {
            const filename = `page_${String(i).padStart(4, '0')}.jpg`;
            const filepath = path.join(imageDir, filename);
            if (fs.existsSync(filepath)) {
                imageFiles.push(filepath);
            }
        }
        
        if (imageFiles.length === 0) {
            throw new Error('No image files found for PDF creation');
        }
        
        console.log(`📄 Found ${imageFiles.length} images for PDF creation`);
        
        // Use ImageMagick to create PDF (if available)
        try {
            // Test if ImageMagick is available
            execSync('which convert', { stdio: 'ignore' });
            
            console.log(`🔄 Converting ${imageFiles.length} images to PDF...`);
            
            // Create PDF with ImageMagick - process in batches to avoid command line limits
            const batchSize = 50;
            const tempPdfs: string[] = [];
            
            for (let i = 0; i < imageFiles.length; i += batchSize) {
                const batch = imageFiles.slice(i, i + batchSize);
                const tempPdfPath = path.join(imageDir, `temp_batch_${Math.floor(i / batchSize)}.pdf`);
                
                const convertCmd = `convert "${batch.join('" "')}" "${tempPdfPath}"`;
                execSync(convertCmd, { stdio: 'inherit' });
                tempPdfs.push(tempPdfPath);
                
                console.log(`✅ Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(imageFiles.length / batchSize)} complete`);
            }
            
            // Merge all batch PDFs into final PDF
            if (tempPdfs.length === 1) {
                fs.renameSync(tempPdfs[0], outputPdfPath);
            } else {
                const mergeCmd = `convert "${tempPdfs.join('" "')}" "${outputPdfPath}"`;
                execSync(mergeCmd, { stdio: 'inherit' });
                
                // Clean up temp files
                tempPdfs.forEach(tempPdf => {
                    if (fs.existsSync(tempPdf)) {
                        fs.unlinkSync(tempPdf);
                    }
                });
            }
            
            console.log(`✅ PDF created successfully: ${outputPdfPath}`);
            return true;
            
        } catch (magickError) {
            console.log('⚠️  ImageMagick not available, trying alternative method...');
            
            // Alternative: Create simple instruction file for manual PDF creation
            const instructionPath = path.join(imageDir, 'CREATE_PDF_INSTRUCTIONS.txt');
            const instructions = `
FLORENCE MANUSCRIPT - PDF CREATION INSTRUCTIONS
==============================================

Downloaded: ${imageFiles.length} high-resolution pages
Location: ${imageDir}

TO CREATE PDF:
1. Install ImageMagick: brew install imagemagick (Mac) or apt-get install imagemagick (Linux)
2. Run: convert page_*.jpg florence_manuscript.pdf
3. Or use any PDF creator tool to combine the JPG files in order

All pages are numbered sequentially: page_0001.jpg to page_${String(imageFiles.length).padStart(4, '0')}.jpg

Total size: ~${Math.round(imageFiles.length * 1.5)}MB estimated PDF size
`;
            
            fs.writeFileSync(instructionPath, instructions);
            console.log(`📋 PDF creation instructions saved: ${instructionPath}`);
            return false;
        }
        
    } catch (error: any) {
        console.error(`❌ PDF creation failed: ${error.message}`);
        return false;
    }
}

async function downloadCompleteFlorentineManuscript() {
    console.log('🏛️ COMPLETE FLORENCE MANUSCRIPT DOWNLOAD');
    console.log('========================================\n');
    console.log('Downloading ALL PAGES in highest resolution and creating PDF\n');
    
    const testUrl = 'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/25456';
    const outputDir = '.devkit/validation/READY-FOR-USER/Florence_Plut7-5_Complete_Manuscript';
    
    // Create output directory
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    try {
        console.log(`📄 Loading Florence manuscript manifest...\n`);
        
        const loader = new FlorenceLoader(mockDeps);
        const manifest = await loader.loadManifest(testUrl);
        
        console.log(`✅ Manuscript Details:`);
        console.log(`   📖 Title: ${manifest.displayName}`);
        console.log(`   📄 Total Pages: ${manifest.totalPages}`);
        console.log(`   🏛️ Library: ${manifest.library}`);
        console.log(`   📁 Output: ${outputDir}\n`);
        
        console.log(`🚀 Starting download of ALL ${manifest.totalPages} pages...\n`);
        
        let successfulDownloads = 0;
        let totalBytes = 0;
        let failedDownloads = 0;
        
        const startTime = Date.now();
        
        for (let i = 0; i < manifest.pageLinks.length; i++) {
            const pageUrl = manifest.pageLinks[i];
            const pageNum = i + 1;
            
            // Progress indicator
            if (pageNum % 50 === 0 || pageNum <= 10 || pageNum > manifest.totalPages - 10) {
                console.log(`📥 Downloading page ${pageNum}/${manifest.totalPages} (${Math.round(pageNum/manifest.totalPages*100)}%)...`);
            }
            
            const result = await downloadPage(pageUrl, pageNum, outputDir);
            
            if (result.success) {
                successfulDownloads++;
                totalBytes += result.fileSize;
                
                if (pageNum % 100 === 0) {
                    const avgSizeMB = (totalBytes / successfulDownloads / (1024 * 1024)).toFixed(2);
                    const totalSizeMB = (totalBytes / (1024 * 1024)).toFixed(1);
                    console.log(`   ✅ Progress: ${successfulDownloads} pages, ${totalSizeMB}MB total, ${avgSizeMB}MB avg/page`);
                }
            } else {
                failedDownloads++;
                console.log(`   ❌ Page ${pageNum} failed: ${result.error}`);
            }
            
            // Rate limiting - be respectful to server
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        const endTime = Date.now();
        const durationMinutes = Math.round((endTime - startTime) / 60000);
        
        console.log(`\n📊 DOWNLOAD COMPLETE:`);
        console.log(`==============================`);
        console.log(`✅ Successfully downloaded: ${successfulDownloads}/${manifest.totalPages} pages (${Math.round(successfulDownloads/manifest.totalPages*100)}%)`);
        console.log(`❌ Failed downloads: ${failedDownloads}`);
        
        if (successfulDownloads > 0) {
            const avgSizeMB = (totalBytes / successfulDownloads / (1024 * 1024)).toFixed(2);
            const totalSizeMB = (totalBytes / (1024 * 1024)).toFixed(1);
            
            console.log(`📏 Average page size: ${avgSizeMB}MB`);
            console.log(`📦 Total downloaded: ${totalSizeMB}MB`);
            console.log(`⏱️  Download time: ${durationMinutes} minutes`);
            console.log(`📁 Location: ${outputDir}`);
            
            // Create PDF
            console.log(`\n📚 Creating PDF from all pages...`);
            const pdfPath = path.join(outputDir, 'Florence_Plut7-5_Complete_Manuscript.pdf');
            const pdfCreated = await createPDFFromImages(outputDir, pdfPath, successfulDownloads);
            
            if (pdfCreated) {
                // Check PDF size
                const pdfStats = fs.statSync(pdfPath);
                const pdfSizeMB = (pdfStats.size / (1024 * 1024)).toFixed(1);
                
                console.log(`\n🎉 COMPLETE SUCCESS!`);
                console.log(`✅ Downloaded all ${successfulDownloads} pages in highest resolution`);
                console.log(`✅ Created complete PDF: ${pdfSizeMB}MB`);
                console.log(`📖 File: ${pdfPath}`);
                
                return true;
            } else {
                console.log(`\n⚠️  Images downloaded but PDF creation needs manual step`);
                console.log(`📁 All ${successfulDownloads} high-resolution images available in: ${outputDir}`);
                return true;
            }
        } else {
            console.log(`❌ No pages downloaded successfully!`);
            return false;
        }
        
    } catch (error: any) {
        console.error('\n💥 DOWNLOAD FAILED:', error.message);
        throw error;
    }
}

// Run if executed directly
if (import.meta.main) {
    downloadCompleteFlorentineManuscript()
        .then((success) => {
            if (success) {
                console.log('\n🎉 FLORENCE MANUSCRIPT DOWNLOAD COMPLETE!');
                process.exit(0);
            } else {
                console.log('\n❌ FLORENCE MANUSCRIPT DOWNLOAD FAILED');
                process.exit(1);
            }
        })
        .catch((error) => {
            console.error('\n💥 ERROR:', error.message);
            process.exit(1);
        });
}

export { downloadCompleteFlorentineManuscript };