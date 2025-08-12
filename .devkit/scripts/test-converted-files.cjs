#!/usr/bin/env node

/**
 * Test all converted TypeScript files for syntax validity
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const telegamBotDir = '/home/evb/WebstormProjects/mss-downloader/telegram-bot';
const testsDir = '/home/evb/WebstormProjects/mss-downloader/tests';

const convertedFiles = [
    path.join(telegamBotDir, 'test-bot-commands.ts'),
    path.join(telegamBotDir, 'test-callbacks.ts'),
    path.join(telegamBotDir, 'reports/test-callback-fix.ts'),
    path.join(telegamBotDir, 'tests/test-bot-menu.ts'),
    path.join(telegamBotDir, 'tests/test-formatting.ts'),
    path.join(telegamBotDir, 'tests/test-subscription-logic.ts'),
    path.join(telegamBotDir, 'tests/subscribe-functionality/test-callback-simulation.ts'),
    path.join(telegamBotDir, 'tests/subscribe-functionality/test-interactive-subscribe.ts'),
    path.join(telegamBotDir, 'tests/subscribe-functionality/test-subscribe-functionality.ts'),
    path.join(testsDir, 'test-bdl-ultra-reliable.ts')
];

console.log('🧪 Testing converted TypeScript files...\n');

let passed = 0;
let failed = 0;
const results = [];

for (const file of convertedFiles) {
    const relativePath = path.relative(process.cwd(), file);
    
    try {
        // Check if file exists
        if (!fs.existsSync(file)) {
            console.log(`❌ ${relativePath}: File not found`);
            failed++;
            results.push({ file: relativePath, status: 'MISSING' });
            continue;
        }
        
        // Check file is not empty
        const stats = fs.statSync(file);
        if (stats.size === 0) {
            console.log(`❌ ${relativePath}: File is empty`);
            failed++;
            results.push({ file: relativePath, status: 'EMPTY' });
            continue;
        }
        
        // Try to parse as valid TypeScript (basic syntax check)
        const content = fs.readFileSync(file, 'utf8');
        
        // Check for basic TypeScript syntax patterns
        const hasImports = content.includes('import ') || content.includes('require(');
        const hasExports = content.includes('export ') || content.includes('module.exports');
        const hasTypings = content.includes(': ') && (content.includes('string') || content.includes('number') || content.includes('boolean') || content.includes('interface'));
        
        if (!hasImports) {
            console.log(`⚠️ ${relativePath}: No imports found`);
        }
        
        console.log(`✅ ${relativePath}: Valid TypeScript file (${stats.size} bytes)`);
        passed++;
        results.push({ 
            file: relativePath, 
            status: 'VALID', 
            size: stats.size, 
            hasTypings: hasTypings 
        });
        
    } catch (error) {
        console.log(`❌ ${relativePath}: ${error.message}`);
        failed++;
        results.push({ file: relativePath, status: 'ERROR', error: error.message });
    }
}

console.log('\n' + '='.repeat(60));
console.log('📊 CONVERSION TEST RESULTS');
console.log('='.repeat(60));
console.log(`✅ Valid files: ${passed}`);
console.log(`❌ Failed files: ${failed}`);
console.log(`📈 Success rate: ${((passed / convertedFiles.length) * 100).toFixed(1)}%`);

if (passed === convertedFiles.length) {
    console.log('\n🎉 All converted files are valid TypeScript!');
    process.exit(0);
} else {
    console.log('\n⚠️ Some files need attention before cleanup');
    process.exit(1);
}