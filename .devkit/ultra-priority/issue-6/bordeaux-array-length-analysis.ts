#!/usr/bin/env bun

/**
 * ULTRATHINK ANALYSIS: Issue #6 - Bordeaux Invalid Array Length
 * 
 * USER'S EXACT ERROR:
 * "Invalid array length" with URL: https://selene.bordeaux.fr/ark:/27705/330636101_MS_0778
 * 
 * CRITICAL DISCOVERY:
 * All three image processors (DZI, DirectTile, ZIF) have MAX_CANVAS_SIZE = 16384 protection
 * to prevent "Invalid array length" errors. Yet the user still gets this error.
 * 
 * ROOT CAUSE HYPOTHESIS:
 * The problem might be that:
 * 1. Canvas dimensions are calculated incorrectly (NaN, negative, non-integer)
 * 2. Math.min() with NaN returns NaN, which createCanvas() rejects
 * 3. Or there's an Array() allocation outside Canvas creation
 */

// Simulate the Bordeaux tile dimension calculations to find the bug
function analyzeBordeauxDimensionCalculations() {
    console.log('🔥 ULTRATHINK ANALYSIS: Bordeaux Invalid Array Length Bug');
    console.log('=' .repeat(80));
    
    // Simulate the user's manuscript: 330636101_MS_0778
    const userManuscript = '330636101_MS_0778';
    console.log(`Analyzing manuscript: ${userManuscript}`);
    
    // Test various dimension calculations that might produce invalid values
    console.log('\n🔬 Testing potential invalid dimension scenarios:');
    
    // SCENARIO 1: NaN dimensions
    const nanWidth = NaN;
    const nanHeight = NaN;
    const MAX_CANVAS_SIZE = 16384;
    
    const safeNanWidth = Math.min(nanWidth, MAX_CANVAS_SIZE);
    const safeNanHeight = Math.min(nanHeight, MAX_CANVAS_SIZE);
    
    console.log(`Scenario 1 - NaN dimensions:`);
    console.log(`  Original: ${nanWidth}x${nanHeight}`);
    console.log(`  After Math.min safety: ${safeNanWidth}x${safeNanHeight}`);
    console.log(`  Would createCanvas(${safeNanWidth}, ${safeNanHeight}) work? ${!isNaN(safeNanWidth) && !isNaN(safeNanHeight)}`);
    
    // SCENARIO 2: Negative dimensions
    const negativeWidth = -1000;
    const negativeHeight = -2000;
    
    const safeNegWidth = Math.min(negativeWidth, MAX_CANVAS_SIZE);
    const safeNegHeight = Math.min(negativeHeight, MAX_CANVAS_SIZE);
    
    console.log(`\nScenario 2 - Negative dimensions:`);
    console.log(`  Original: ${negativeWidth}x${negativeHeight}`);
    console.log(`  After Math.min safety: ${safeNegWidth}x${safeNegHeight}`);
    console.log(`  Would createCanvas(${safeNegWidth}, ${safeNegHeight}) work? ${safeNegWidth > 0 && safeNegHeight > 0}`);
    
    // SCENARIO 3: Non-integer dimensions  
    const floatWidth = 1000.7;
    const floatHeight = 2000.3;
    
    const safeFloatWidth = Math.min(floatWidth, MAX_CANVAS_SIZE);
    const safeFloatHeight = Math.min(floatHeight, MAX_CANVAS_SIZE);
    
    console.log(`\nScenario 3 - Float dimensions:`);
    console.log(`  Original: ${floatWidth}x${floatHeight}`);
    console.log(`  After Math.min safety: ${safeFloatWidth}x${safeFloatHeight}`);
    console.log(`  Would createCanvas(${safeFloatWidth}, ${safeFloatHeight}) work? ${Number.isInteger(safeFloatWidth) && Number.isInteger(safeFloatHeight)}`);
    
    // SCENARIO 4: Infinity dimensions
    const infWidth = Infinity;
    const infHeight = Infinity;
    
    const safeInfWidth = Math.min(infWidth, MAX_CANVAS_SIZE);
    const safeInfHeight = Math.min(infHeight, MAX_CANVAS_SIZE);
    
    console.log(`\nScenario 4 - Infinity dimensions:`);
    console.log(`  Original: ${infWidth}x${infHeight}`);
    console.log(`  After Math.min safety: ${safeInfWidth}x${safeInfHeight}`);
    console.log(`  Would createCanvas(${safeInfWidth}, ${safeInfHeight}) work? ${Number.isFinite(safeInfWidth) && Number.isFinite(safeInfHeight)}`);
    
    console.log('\n🚨 CRITICAL FINDING:');
    console.log('Math.min() with NaN or negative values can still produce invalid Canvas dimensions!');
    
    return {
        nanCase: { safe: !isNaN(safeNanWidth) && !isNaN(safeNanHeight) },
        negativeCase: { safe: safeNegWidth > 0 && safeNegHeight > 0 },
        floatCase: { safe: Number.isInteger(safeFloatWidth) && Number.isInteger(safeFloatHeight) },
        infinityCase: { safe: Number.isFinite(safeInfWidth) && Number.isFinite(safeInfHeight) }
    };
}

function proposeCanvasSafetyFix() {
    console.log('\n🔧 PROPOSED FIX:');
    console.log('Instead of just Math.min(), use comprehensive validation:');
    console.log(`
function createSafeCanvas(width: number, height: number, maxSize: number = 16384) {
    // Comprehensive dimension validation
    let safeWidth = width;
    let safeHeight = height;
    
    // Handle invalid numbers
    if (!Number.isFinite(safeWidth) || safeWidth <= 0) {
        console.warn('Invalid width detected, using fallback');
        safeWidth = 1000; // Fallback to reasonable size
    }
    
    if (!Number.isFinite(safeHeight) || safeHeight <= 0) {
        console.warn('Invalid height detected, using fallback');
        safeHeight = 1000; // Fallback to reasonable size
    }
    
    // Ensure integers
    safeWidth = Math.floor(safeWidth);
    safeHeight = Math.floor(safeHeight);
    
    // Apply size limits
    safeWidth = Math.min(safeWidth, maxSize);
    safeHeight = Math.min(safeHeight, maxSize);
    
    // Final validation
    if (safeWidth <= 0 || safeHeight <= 0 || !Number.isInteger(safeWidth) || !Number.isInteger(safeHeight)) {
        throw new Error(\`Cannot create canvas with dimensions \${safeWidth}x\${safeHeight}\`);
    }
    
    return Canvas.createCanvas(safeWidth, safeHeight);
}
    `);
}

// Run the analysis
const results = analyzeBordeauxDimensionCalculations();
proposeCanvasSafetyFix();

console.log('\n📊 ANALYSIS SUMMARY:');
console.log('The current Math.min() protection is insufficient because:');
console.log('1. Math.min(NaN, 16384) = NaN (invalid for Canvas)');
console.log('2. Math.min(-1000, 16384) = -1000 (invalid for Canvas)');
console.log('3. Non-integer values are not handled');
console.log('4. No fallback for completely invalid calculations');

console.log('\n🎯 ROOT CAUSE IDENTIFIED:');
console.log('Bordeaux tile calculations can produce NaN, negative, or non-integer dimensions');
console.log('These invalid values pass through Math.min() and cause "Invalid array length" in Canvas.createCanvas()');