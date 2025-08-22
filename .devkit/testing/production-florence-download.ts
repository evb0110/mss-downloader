#!/usr/bin/env bun

/**
 * Production Florence manuscript download using the complete workflow
 * with fixed ContentDM native API URLs - should achieve near 100% success
 */

import { EnhancedManuscriptDownloaderService } from '../../src/main/services/EnhancedManuscriptDownloaderService';
import fs from 'fs';
import path from 'path';

// Mock logger for production testing
const mockLogger = {
    log: (entry: any) => {
        const timestamp = new Date().toISOString().substring(11, 19);
        console.log(`[${timestamp}] [${entry.level?.toUpperCase()}] ${entry.library || 'SYSTEM'}: ${entry.message}`);
    },
    logDownloadStart: (library: string, url: string, details: any) => {
        console.log(`[DOWNLOAD-START] ${library}: ${details.displayName} (${details.totalPages} pages)`);
    },
    logDownloadComplete: (library: string, url: string, details: any) => {
        console.log(`[DOWNLOAD-COMPLETE] ${library}: ${details.displayName} - ${details.pagesDownloaded} pages in ${details.duration}ms`);
    },
    logDownloadError: (library: string, url: string, error: Error) => {
        console.log(`[DOWNLOAD-ERROR] ${library}: ${error.message}`);
    }
};

// Mock storage for minimal working setup
const mockStorage = {
    getConfig: () => ({ 
        downloadDirectory: '.devkit/validation/PRODUCTION-FLORENCE-COMPLETE',
        splitParts: true,
        partSize: 30
    }),
    setManuscriptData: () => {},
    getManuscriptData: () => null,
    addToQueue: () => {},
    removeFromQueue: () => {},
    getQueueData: () => ({ manuscripts: [] }),
    clearCompleted: () => {},
    clearFailed: () => {},
    clearAll: () => {}
};

// Mock IPC for minimal working setup  
const mockIpc = {
    send: (channel: string, data: any) => {
        console.log(`[IPC] ${channel}:`, data.type || data);
    }
};

async function productionDownload() {
    console.log('🚀 PRODUCTION FLORENCE DOWNLOAD - COMPLETE WORKFLOW');
    console.log('===================================================\n');
    
    const testUrl = 'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/217710/rec/2';
    console.log(`📚 Target: Plut.16.39 Calendarium`);
    console.log(`🔗 URL: ${testUrl}\n`);
    
    // Ensure output directory exists
    const outputDir = '.devkit/validation/PRODUCTION-FLORENCE-COMPLETE';
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    try {
        // Step 1: Create downloader service
        console.log('🔧 Step 1: Initialize Downloader Service');
        const downloader = new EnhancedManuscriptDownloaderService(
            mockLogger as any,
            mockStorage as any,
            mockIpc as any
        );
        console.log('   Service initialized\n');

        // Step 2: Detect library
        console.log('🔍 Step 2: Library Detection');
        const detectedLibrary = downloader.detectLibrary(testUrl);
        console.log(`   Detected: ${detectedLibrary}\n`);
        
        if (detectedLibrary !== 'florence') {
            throw new Error(`Expected 'florence', got '${detectedLibrary}'`);
        }

        // Step 3: Load manifest
        console.log('📋 Step 3: Load Manuscript Manifest');
        const manifest = await downloader.loadManifest(testUrl);
        console.log(`   ✅ Manifest loaded: ${manifest.totalPages} pages`);
        console.log(`   📖 Title: ${manifest.displayName}`);
        console.log(`   📚 Library: ${manifest.library}\n`);

        // Step 4: Start download
        console.log('📥 Step 4: Start Complete Download');
        const manuscriptId = `florence-${Date.now()}`;
        
        const downloadConfig = {
            url: testUrl,
            library: 'florence',
            displayName: manifest.displayName,
            totalPages: manifest.totalPages,
            pageLinks: manifest.pageLinks,
            startPage: 1,
            endPage: manifest.totalPages,
            splitDownload: true,
            maxPartSize: 30 // Smaller parts for stability
        };

        console.log(`   📦 Will split into ~${Math.ceil(manifest.totalPages / 30)} parts`);
        console.log(`   🎯 Expecting ~${Math.round(manifest.totalPages * 0.1)}MB total\n`);

        // Use the production download method
        const downloadPromise = downloader.downloadManuscript(
            manuscriptId,
            downloadConfig.url,
            downloadConfig.library,
            downloadConfig.displayName,
            downloadConfig.totalPages,
            downloadConfig.pageLinks,
            downloadConfig.startPage,
            downloadConfig.endPage,
            downloadConfig.splitDownload,
            downloadConfig.maxPartSize
        );

        // Monitor download progress
        const startTime = Date.now();
        const result = await downloadPromise;
        const duration = Date.now() - startTime;

        console.log('\n🎯 PRODUCTION DOWNLOAD RESULTS');
        console.log('==============================');
        console.log(`   Duration: ${Math.round(duration / 1000)}s`);
        console.log(`   Status: ${result.success ? 'SUCCESS' : 'FAILED'}`);
        
        if (result.success) {
            console.log(`   📁 Output: ${result.outputPath}`);
            console.log(`   📄 Pages: ${result.pagesDownloaded || 'N/A'}`);
            console.log(`   📊 Success Rate: ${result.successRate || 'N/A'}%`);
            
            // Check if PDF was created
            if (result.outputPath && fs.existsSync(result.outputPath)) {
                const stats = fs.statSync(result.outputPath);
                const sizeMB = (stats.size / 1024 / 1024).toFixed(1);
                console.log(`   💾 PDF Size: ${sizeMB}MB`);
                
                console.log('\n✅ COMPLETE SUCCESS!');
                console.log(`🎉 Florence manuscript downloaded and converted to PDF`);
                console.log(`📖 Ready for user: ${result.outputPath}`);
            } else {
                console.log('\n⚠️ PARTIAL SUCCESS: Download completed but PDF not found');
            }
        } else {
            console.log(`   ❌ Error: ${result.error}`);
            console.log('\n❌ DOWNLOAD FAILED');
        }

        // List all files created
        console.log('\n📁 Files Created:');
        if (fs.existsSync(outputDir)) {
            const files = fs.readdirSync(outputDir);
            files.forEach(file => {
                const filePath = path.join(outputDir, file);
                const stats = fs.statSync(filePath);
                const sizeMB = (stats.size / 1024 / 1024).toFixed(1);
                console.log(`   📄 ${file} (${sizeMB}MB)`);
            });
        }

    } catch (error) {
        console.error('\n❌ PRODUCTION WORKFLOW FAILED:', error);
        if (error instanceof Error) {
            console.error('   Stack:', error.stack);
        }
    }
}

productionDownload();