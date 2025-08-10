/**
 * Validation script for Bordeaux progress fix
 * Analyzes the code to ensure the fix is correctly implemented
 */

const fs = require('fs');
const path = require('path');

console.log('=== VALIDATING BORDEAUX PROGRESS FIX ===\n');

// Read the modified files
const directTileProcessorPath = path.join(__dirname, '../../src/main/services/DirectTileProcessor.ts');
const enhancedDownloaderPath = path.join(__dirname, '../../src/main/services/EnhancedManuscriptDownloaderService.ts');

const directTileContent = fs.readFileSync(directTileProcessorPath, 'utf8');
const enhancedContent = fs.readFileSync(enhancedDownloaderPath, 'utf8');

let allChecksPassed = true;

console.log('CHECKING DirectTileProcessor.ts:\n');

// Check 1: processPage signature includes onProgress
const processPageMatch = directTileContent.match(/async processPage\([^)]*onProgress\?: \(downloaded: number, total: number\) => void\)/);
if (processPageMatch) {
    console.log('✅ processPage() has onProgress parameter');
} else {
    console.log('❌ processPage() missing onProgress parameter');
    allChecksPassed = false;
}

// Check 2: processTiledImage signature includes onProgress
const processTiledImageMatch = directTileContent.match(/async processTiledImage\([^)]*onProgress\?: \(downloaded: number, total: number\) => void\)/);
if (processTiledImageMatch) {
    console.log('✅ processTiledImage() has onProgress parameter');
} else {
    console.log('❌ processTiledImage() missing onProgress parameter');
    allChecksPassed = false;
}

// Check 3: downloadTiles signature includes onProgress
const downloadTilesMatch = directTileContent.match(/private async downloadTiles\([^)]*onProgress\?: \(downloaded: number, total: number\) => void\)/);
if (downloadTilesMatch) {
    console.log('✅ downloadTiles() has onProgress parameter');
} else {
    console.log('❌ downloadTiles() missing onProgress parameter');
    allChecksPassed = false;
}

// Check 4: downloadTiles calls onProgress
const progressCallMatch = directTileContent.match(/if \(onProgress\) \{\s*onProgress\(validTiles, tiles\.length\);/);
if (progressCallMatch) {
    console.log('✅ downloadTiles() calls onProgress callback');
} else {
    console.log('❌ downloadTiles() not calling onProgress callback');
    allChecksPassed = false;
}

// Check 5: processTiledImage passes onProgress to downloadTiles
const passProgressMatch = directTileContent.match(/await this\.downloadTiles\(tiles, onProgress\)/);
if (passProgressMatch) {
    console.log('✅ processTiledImage() passes onProgress to downloadTiles()');
} else {
    console.log('❌ processTiledImage() not passing onProgress to downloadTiles()');
    allChecksPassed = false;
}

console.log('\nCHECKING EnhancedManuscriptDownloaderService.ts:\n');

// Check 6: tileProgressCallback is defined
const callbackMatch = enhancedContent.match(/const tileProgressCallback = \(tilesDownloaded: number, totalTiles: number\) =>/);
if (callbackMatch) {
    console.log('✅ tileProgressCallback is defined');
} else {
    console.log('❌ tileProgressCallback not defined');
    allChecksPassed = false;
}

// Check 7: processPage is called with tileProgressCallback
const processPageCallMatch = enhancedContent.match(/await this\.directTileProcessor\.processPage\([^)]*tileProgressCallback\s*\)/);
if (processPageCallMatch) {
    console.log('✅ processPage() called with tileProgressCallback');
} else {
    console.log('❌ processPage() not called with tileProgressCallback');
    allChecksPassed = false;
}

// Check 8: tileProgressCallback calculates sub-progress
const subProgressMatch = enhancedContent.match(/const pageProgress = tilesDownloaded \/ totalTiles/);
if (subProgressMatch) {
    console.log('✅ tileProgressCallback calculates tile sub-progress');
} else {
    console.log('❌ tileProgressCallback not calculating sub-progress');
    allChecksPassed = false;
}

// Check 9: tileProgressCallback reports details
const detailsMatch = enhancedContent.match(/details: `Downloading tiles: \$\{tilesDownloaded\}\/\$\{totalTiles\}`/);
if (detailsMatch) {
    console.log('✅ tileProgressCallback reports tile download details');
} else {
    console.log('❌ tileProgressCallback not reporting details');
    allChecksPassed = false;
}

// Check 10: updateProgress() is called after success
const updateAfterSuccessMatch = enhancedContent.match(/if \(result\.success\) \{[\s\S]*?completedPages\+\+;\s*updateProgress\(\);/);
if (updateAfterSuccessMatch) {
    console.log('✅ updateProgress() called after successful page completion');
} else {
    console.log('❌ updateProgress() not called after success');
    allChecksPassed = false;
}

console.log('\n=== VALIDATION RESULTS ===\n');

if (allChecksPassed) {
    console.log('✅ ALL CHECKS PASSED - Fix is correctly implemented!\n');
    console.log('The fix will:');
    console.log('1. Report progress incrementally as tiles download');
    console.log('2. Show tile download details in the progress bar');
    console.log('3. Provide smooth progress updates instead of jumping from 0% to 100%');
    console.log('4. Improve user experience for Bordeaux manuscript downloads');
} else {
    console.log('❌ SOME CHECKS FAILED - Please review the implementation');
}

console.log('\n=== VALIDATION COMPLETE ===');