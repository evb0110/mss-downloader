// Quick validation script to test the Morgan Library fix
const fs = require('fs');
const path = require('path');

console.log('=== Morgan Library Fix Validation ===\n');

// Check if the fix is applied
const filePath = path.join(__dirname, '../../src/main/services/EnhancedManuscriptDownloaderService.ts');
const fileContent = fs.readFileSync(filePath, 'utf8');

// Find the lines around where imagesByPriority should be declared
const lines = fileContent.split('\n');
let foundDeclaration = false;
let declarationLine = -1;
let usageLine = -1;

// Find where imagesByPriority is declared
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('const imagesByPriority: { [key: number]: string[] } = {')) {
        declarationLine = i + 1;
        console.log(`✓ Found imagesByPriority declaration at line ${declarationLine}`);
        
        // Check if it's inside an if/else block by looking at surrounding code
        let inIfBlock = false;
        let inElseBlock = false;
        
        // Look backwards for if/else
        for (let j = i - 1; j >= Math.max(0, i - 20); j--) {
            if (lines[j].includes('} else {')) {
                inElseBlock = true;
                console.log(`  ⚠️  Declaration is inside an else block at line ${j + 1}`);
                break;
            } else if (lines[j].includes('if (morganUrl.includes(\'ica.themorgan.org\')) {')) {
                inIfBlock = true;
                console.log(`  ⚠️  Declaration is inside an if block at line ${j + 1}`);
                break;
            } else if (lines[j].includes('const pageLinks: string[] = [];')) {
                console.log(`  ✓ Declaration is at the correct outer scope (after pageLinks declaration)`);
                foundDeclaration = true;
                break;
            }
        }
        
        if (inElseBlock || inIfBlock) {
            console.log('  ❌ PROBLEM: imagesByPriority is still inside a conditional block!');
        }
    }
    
    // Find where it's used in logging
    if (lines[i].includes('console.log(`  - Priority 0 (ZIF ultra-high res): ${imagesByPriority[0].length} images`);')) {
        usageLine = i + 1;
        console.log(`\n✓ Found imagesByPriority usage in logging at line ${usageLine}`);
    }
}

// Verify the fix
if (declarationLine > 0 && usageLine > 0) {
    if (foundDeclaration) {
        console.log('\n✅ FIX VERIFIED: imagesByPriority is declared at the outer scope');
        console.log('   This prevents the ReferenceError when logging priority distribution');
    } else {
        console.log('\n❌ FIX NOT APPLIED: imagesByPriority is still inside a conditional block');
        console.log('   This will cause ReferenceError when the else block is not executed');
    }
} else {
    console.log('\n⚠️  Could not verify fix - unable to find expected code patterns');
}

// Show the fix summary
console.log('\n📝 Fix Summary:');
console.log('- Issue: imagesByPriority was declared inside the else block but used outside it');
console.log('- Solution: Moved the declaration to the outer scope before the if/else block');
console.log('- Result: Variable is now accessible for logging regardless of which branch executes');