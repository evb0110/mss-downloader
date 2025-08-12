#!/usr/bin/env node

/**
 * Fix Bun-specific references in converted TypeScript files
 */

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

console.log('🔧 Fixing Bun-specific references...\n');

let fixed = 0;

for (const file of convertedFiles) {
    const relativePath = path.relative(process.cwd(), file);
    
    try {
        let content = fs.readFileSync(file, 'utf8');
        const originalContent = content;
        
        // Fix the main execution check
        content = content.replace(
            /if \(import\.meta\.main \|\| Bun\.main === import\.meta\.path\)/g,
            'if (import.meta.main)'
        );
        
        // Fix await at top-level in main blocks
        const mainBlockPattern = /if \(import\.meta\.main\) \{[\s\S]*?\}/g;
        content = content.replace(mainBlockPattern, (match) => {
            // Wrap top-level awaits in an async IIFE
            if (match.includes('await ') && !match.includes('(async () => {')) {
                return match.replace(
                    /if \(import\.meta\.main\) \{([\s\S]*?)\}/,
                    `if (import.meta.main) {
    (async () => {$1
    })().catch(console.error);
}`
                );
            }
            return match;
        });
        
        if (content !== originalContent) {
            fs.writeFileSync(file, content);
            console.log(`✅ ${relativePath}: Fixed Bun references`);
            fixed++;
        } else {
            console.log(`➖ ${relativePath}: No changes needed`);
        }
        
    } catch (error) {
        console.log(`❌ ${relativePath}: ${error.message}`);
    }
}

console.log(`\n🔧 Fixed ${fixed} files`);
console.log('✅ All Bun-specific references updated for standard TypeScript');