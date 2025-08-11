#!/usr/bin/env bun

/**
 * Comprehensive test for all library loaders to ensure no missing methods
 */

import * as fs from 'fs';
import * as path from 'path';

async function testAllLoaders() {
    console.log('🔍 Testing all library loaders for missing methods...\n');
    
    const loadersDir = path.join(process.cwd(), '../../src/main/services/library-loaders');
    const files = fs.readdirSync(loadersDir);
    
    const loaderFiles = files.filter(f => f.endsWith('Loader.ts') && f !== 'GenericIiifLoader.ts');
    
    console.log(`Found ${loaderFiles.length} loader files to check:\n`);
    
    let issuesFound = false;
    const issues: string[] = [];
    
    for (const file of loaderFiles) {
        const filePath = path.join(loadersDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        
        // Find all method calls with 'this.'
        const methodCalls = new Set<string>();
        const callRegex = /this\.(\w+)\(/g;
        let match;
        
        while ((match = callRegex.exec(content)) !== null) {
            const methodName = match[1];
            // Skip constructor and super calls
            if (methodName !== 'constructor' && methodName !== 'super') {
                methodCalls.add(methodName);
            }
        }
        
        // Find all method definitions in the class
        const definedMethods = new Set<string>();
        
        // Match regular methods
        const methodRegex = /(?:async\s+)?(?:private\s+|protected\s+|public\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*{/g;
        while ((match = methodRegex.exec(content)) !== null) {
            definedMethods.add(match[1]);
        }
        
        // Match arrow function properties
        const arrowRegex = /(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/g;
        while ((match = arrowRegex.exec(content)) !== null) {
            definedMethods.add(match[1]);
        }
        
        // Check for undefined methods
        const undefinedMethods = Array.from(methodCalls).filter(m => !definedMethods.has(m));
        
        // Filter out methods that might be inherited from BaseLibraryLoader
        const inheritedMethods = ['createManifest', 'deps'];
        const reallyUndefined = undefinedMethods.filter(m => {
            // Check if it's accessing deps properties
            if (content.includes(`this.deps.${m}`)) return false;
            // Check if it's an inherited method
            if (inheritedMethods.includes(m)) return false;
            // Check if it's defined in parent class (for methods from BaseLibraryLoader)
            if (content.includes('extends BaseLibraryLoader')) {
                const baseLoaderMethods = ['loadManifest', 'getLibraryName', 'createManifest'];
                if (baseLoaderMethods.includes(m)) return false;
            }
            return true;
        });
        
        if (reallyUndefined.length > 0) {
            console.log(`❌ ${file}:`);
            for (const method of reallyUndefined) {
                const lineNum = getLineNumber(content, `this.${method}(`);
                console.log(`   - Method '${method}' called at line ${lineNum} but not defined`);
                issues.push(`${file}:${lineNum} - ${method}`);
            }
            issuesFound = true;
        } else {
            console.log(`✅ ${file}: All methods properly defined`);
        }
    }
    
    return { issuesFound, issues };
}

function getLineNumber(content: string, searchStr: string): number {
    const index = content.indexOf(searchStr);
    if (index === -1) return 0;
    return content.substring(0, index).split('\n').length;
}

async function checkEnhancedService() {
    console.log('\n🔍 Checking EnhancedManuscriptDownloaderService for orphaned calls...\n');
    
    const filePath = path.join(process.cwd(), '../../src/main/services/EnhancedManuscriptDownloaderService.ts');
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Check for any remaining BNE-specific methods that shouldn't be there
    const bneSpecificMethods = ['robustBneDiscovery', 'fetchBneWithHttps'];
    
    for (const method of bneSpecificMethods) {
        if (content.includes(`private async ${method}`)) {
            console.log(`❌ Found ${method} still defined in EnhancedManuscriptDownloaderService`);
            return false;
        }
        if (content.includes(`this.${method}(`)) {
            console.log(`❌ Found call to ${method} in EnhancedManuscriptDownloaderService`);
            return false;
        }
    }
    
    console.log('✅ EnhancedManuscriptDownloaderService is clean');
    return true;
}

async function main() {
    console.log('🚀 Comprehensive Loader Validation');
    console.log('==================================\n');
    
    const { issuesFound, issues } = await testAllLoaders();
    const serviceClean = await checkEnhancedService();
    
    console.log('\n==================================');
    if (!issuesFound && serviceClean) {
        console.log('✅ All loaders validated successfully!');
        console.log('   No missing method issues found.');
    } else {
        console.log('❌ Validation found issues!');
        if (issues.length > 0) {
            console.log('\nIssues found:');
            issues.forEach(issue => console.log(`  - ${issue}`));
        }
        process.exit(1);
    }
}

main().catch(console.error);