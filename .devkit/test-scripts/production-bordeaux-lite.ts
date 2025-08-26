#!/usr/bin/env bun
// Production-like Bordeaux test that avoids Electron dependencies

import { EnhancedManuscriptDownloaderService } from '../../src/main/services/EnhancedManuscriptDownloaderService';
import * as fs from 'fs';
import * as path from 'path';

async function productionBordeauxLite() {
  console.log('🏭 Production-like Bordeaux Download Test (Node-compatible)');

  const testUrl = 'https://selene.bordeaux.fr/ark:/27705/330636101_MS_0778';

  try {
    console.log('📋 Step 1: Initialize downloader...');
    const downloader = new EnhancedManuscriptDownloaderService();

    console.log('📋 Step 2: Load manifest...');
    const manifest = await downloader.loadManifest(testUrl);

    console.log('✓ Manifest loaded:');
    console.log(`  - Library: ${manifest.library}`);
    console.log(`  - Display Name: ${manifest.displayName}`);
    console.log(`  - Total Pages: ${manifest.totalPages}`);
    console.log(`  - Page Links: ${manifest.pageLinks.length}`);
    console.log(`  - Requires Tile Processor: ${(manifest as any).requiresTileProcessor}`);

    const tileConfig = (manifest as any).tileConfig;
    if (tileConfig && tileConfig.baseId) {
      console.log(`  - Base ID for tiles: ${tileConfig.baseId}`);
      if (String(tileConfig.baseId).includes('_MS_')) {
        console.log('❌ CRITICAL ERROR: Base ID contains underscore (_MS_) - should be MS without underscore');
      } else {
        console.log('✅ Base ID format looks correct');
      }
    }

    console.log('\n📋 Step 3: Download first 5 pages...');

    // Slice first 5 pageLinks to keep scope small
    const pageLinks5 = manifest.pageLinks.slice(0, 5);

    let lastProgress = 0;
    const pdfPath = await downloader.downloadManuscript(testUrl, {
      onProgress: (p) => {
        if (typeof p === 'object') {
          const pct = Math.floor((p.progress || 0) * 100);
          if (pct !== lastProgress) {
            lastProgress = pct;
            console.log(`  Progress: ${pct}% (${p.downloadedPages || 0}/${p.totalPages || 0})`);
          }
        }
      },
      library: manifest.library,
      displayName: 'Bordeaux Production Lite (5 pages)',
      pageLinks: pageLinks5,
      totalPages: 5,
      requiresTileProcessor: (manifest as any).requiresTileProcessor,
      tileConfig: (manifest as any).tileConfig,
      startPage: 1,
      endPage: 5,
    });

    console.log('\n📋 Step 4: Validate results...');

    if (!pdfPath || typeof pdfPath !== 'string') {
      console.log('❌ Download did not return a file path');
      process.exit(1);
    }

    if (!fs.existsSync(pdfPath)) {
      console.log('❌ Output PDF not found:', pdfPath);
      process.exit(1);
    }

    const stats = fs.statSync(pdfPath);
    console.log(`✓ PDF created: ${path.basename(pdfPath)} (${(stats.size / 1024).toFixed(1)}KB)`);

    if (stats.size > 100000) {
      console.log('✅ HIGH RESOLUTION: File size suggests quality content');
    } else if (stats.size > 10000) {
      console.log('⚠️  MEDIUM RESOLUTION: File size suggests basic content');
    } else {
      console.log('❌ LOW RESOLUTION: File size too small - likely failed');
      process.exit(1);
    }

    console.log('\n🎉 SUCCESS: Production-like Bordeaux download works (5 pages)');
    console.log('📄 Output:', pdfPath);
    process.exit(0);
  } catch (error) {
    console.log('💥 FAILURE:', error);
    process.exit(1);
  }
}

productionBordeauxLite();

