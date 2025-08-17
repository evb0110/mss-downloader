#!/usr/bin/env bun

/**
 * ULTRATHINK Comprehensive Codebase Analysis
 * Finding all hardcoded limits, timeouts, and inconsistencies
 */

import fs from 'fs';
import path from 'path';

interface Issue {
    file: string;
    line: number;
    type: 'hardcoded_limit' | 'timeout' | 'inconsistency' | 'bug';
    description: string;
    code: string;
    suggestedFix?: string;
}

class CodebaseAnalyzer {
    private issues: Issue[] = [];
    private srcPath = path.join(import.meta.dir, '../../src');
    
    async analyze() {
        console.log('🔍 ULTRATHINK COMPREHENSIVE CODEBASE ANALYSIS');
        console.log('=' .repeat(60));
        
        // 1. Find all hardcoded page limits
        await this.findHardcodedLimits();
        
        // 2. Find timeout inconsistencies
        await this.findTimeoutIssues();
        
        // 3. Find Rome-specific issues
        await this.analyzeRomeImplementation();
        
        // 4. Find loader inconsistencies
        await this.findLoaderInconsistencies();
        
        // Generate report
        this.generateReport();
    }
    
    async findHardcodedLimits() {
        console.log('\n📊 Searching for hardcoded page limits...');
        
        const patterns = [
            /for\s*\([^)]*\s*<=\s*(\d{2,})/g,  // for loops with hardcoded limits
            /maxPages\s*=\s*(\d+)/g,           // maxPages variables
            /maxTestPages\s*=\s*(\d+)/g,       // maxTestPages variables
            /\.slice\(0,\s*(\d{2,})\)/g,       // slice with hardcoded limits
            /Math\.min\([^,]+,\s*(\d{3,})\)/g, // Math.min with large numbers
            /default.*?(\d{2,})\s*pages/gi,    // default X pages
        ];
        
        await this.searchFiles(patterns, 'hardcoded_limit');
    }
    
    async findTimeoutIssues() {
        console.log('\n⏱️  Analyzing timeout configurations...');
        
        // Check which libraries have custom timeouts
        const timeoutFile = path.join(this.srcPath, 'shared/SharedManifestLoaders.ts');
        const content = fs.readFileSync(timeoutFile, 'utf-8');
        const lines = content.split('\n');
        
        // Find getTimeoutForUrl function
        const timeoutFuncStart = lines.findIndex(line => line.includes('getTimeoutForUrl'));
        if (timeoutFuncStart !== -1) {
            // Extract libraries with custom timeouts
            const customTimeouts = new Set<string>();
            for (let i = timeoutFuncStart; i < Math.min(timeoutFuncStart + 50, lines.length); i++) {
                const line = lines[i];
                if (line.includes('url.includes(')) {
                    const match = line.match(/url\.includes\(['"]([^'"]+)['"]\)/);
                    if (match) {
                        customTimeouts.add(match[1]);
                    }
                }
            }
            
            // Check if Rome has custom timeout
            if (!Array.from(customTimeouts).some(t => t.includes('roma') || t.includes('rome'))) {
                this.issues.push({
                    file: 'SharedManifestLoaders.ts',
                    line: timeoutFuncStart + 485,
                    type: 'timeout',
                    description: 'Rome library missing custom timeout configuration',
                    code: 'Default timeout: 30000ms',
                    suggestedFix: "Add: if (url.includes('digitale.bnc.roma.sbn.it')) return 90000;"
                });
            }
        }
    }
    
    async analyzeRomeImplementation() {
        console.log('\n🏛️  Analyzing Rome implementation issues...');
        
        const romeFiles = [
            'shared/SharedManifestLoaders.ts',
            'main/services/library-loaders/RomeLoader.ts'
        ];
        
        for (const file of romeFiles) {
            const filePath = path.join(this.srcPath, file);
            if (fs.existsSync(filePath)) {
                const content = fs.readFileSync(filePath, 'utf-8');
                const lines = content.split('\n');
                
                lines.forEach((line, index) => {
                    // Check for hardcoded 100 pages fallback
                    if (line.includes('defaulting to 100 pages')) {
                        this.issues.push({
                            file,
                            line: index + 1,
                            type: 'hardcoded_limit',
                            description: 'Rome defaults to only 100 pages if extraction fails',
                            code: line.trim(),
                            suggestedFix: 'Use binary search or progressive discovery instead of fixed limit'
                        });
                    }
                    
                    // Check for synchronous HTML fetch in manifest loader
                    if (file.includes('SharedManifestLoaders') && line.includes('await this.fetchWithRetry(url)') && line.includes('pageResponse')) {
                        this.issues.push({
                            file,
                            line: index + 1,
                            type: 'bug',
                            description: 'Rome fetches HTML synchronously in manifest loader causing timeout',
                            code: line.trim(),
                            suggestedFix: 'Move HTML fetching to RomeLoader or use faster page detection method'
                        });
                    }
                });
            }
        }
    }
    
    async findLoaderInconsistencies() {
        console.log('\n🔄 Finding loader inconsistencies...');
        
        const loaderPath = path.join(this.srcPath, 'main/services/library-loaders');
        const loaders = fs.readdirSync(loaderPath).filter(f => f.endsWith('Loader.ts'));
        
        const loaderPatterns: Map<string, string[]> = new Map();
        
        for (const loader of loaders) {
            const content = fs.readFileSync(path.join(loaderPath, loader), 'utf-8');
            const patterns: string[] = [];
            
            // Check what patterns each loader uses
            if (content.includes('binary search')) patterns.push('binary_search');
            if (content.includes('for (let page = 1; page <=')) patterns.push('sequential_scan');
            if (content.includes('exponential')) patterns.push('exponential_search');
            if (content.includes('quickScan')) patterns.push('quick_scan');
            if (/\d{3,}/.test(content)) patterns.push('hardcoded_limit');
            
            loaderPatterns.set(loader, patterns);
        }
        
        // Report inconsistencies
        console.log('\nLoader Discovery Methods:');
        for (const [loader, patterns] of loaderPatterns) {
            console.log(`  ${loader}: ${patterns.join(', ') || 'none'}`);
            
            if (patterns.includes('hardcoded_limit')) {
                this.issues.push({
                    file: `library-loaders/${loader}`,
                    line: 0,
                    type: 'inconsistency',
                    description: `${loader} uses hardcoded limits instead of dynamic discovery`,
                    code: 'Contains hardcoded page limits',
                    suggestedFix: 'Implement dynamic page discovery like binary search'
                });
            }
        }
    }
    
    async searchFiles(patterns: RegExp[], issueType: Issue['type']) {
        const files = this.getAllFiles(this.srcPath, ['.ts', '.js']);
        
        for (const file of files) {
            const content = fs.readFileSync(file, 'utf-8');
            const lines = content.split('\n');
            const relativePath = path.relative(this.srcPath, file);
            
            lines.forEach((line, index) => {
                for (const pattern of patterns) {
                    const matches = Array.from(line.matchAll(pattern));
                    for (const match of matches) {
                        const limit = match[1];
                        if (limit && parseInt(limit) >= 50) {
                            this.issues.push({
                                file: relativePath,
                                line: index + 1,
                                type: issueType,
                                description: `Hardcoded limit: ${limit}`,
                                code: line.trim().substring(0, 100)
                            });
                        }
                    }
                }
            });
        }
    }
    
    getAllFiles(dir: string, extensions: string[]): string[] {
        const files: string[] = [];
        
        const items = fs.readdirSync(dir);
        for (const item of items) {
            if (item === 'node_modules') continue;
            
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory()) {
                files.push(...this.getAllFiles(fullPath, extensions));
            } else if (extensions.some(ext => item.endsWith(ext))) {
                files.push(fullPath);
            }
        }
        
        return files;
    }
    
    generateReport() {
        console.log('\n' + '='.repeat(60));
        console.log('📋 ANALYSIS REPORT');
        console.log('='.repeat(60));
        
        // Group issues by type
        const byType = new Map<string, Issue[]>();
        for (const issue of this.issues) {
            if (!byType.has(issue.type)) {
                byType.set(issue.type, []);
            }
            byType.get(issue.type)!.push(issue);
        }
        
        console.log(`\nTotal Issues Found: ${this.issues.length}`);
        
        for (const [type, issues] of byType) {
            console.log(`\n${this.getTypeEmoji(type)} ${type.toUpperCase()} (${issues.length} issues):`);
            console.log('-'.repeat(50));
            
            // Show first 10 issues of each type
            const toShow = issues.slice(0, 10);
            for (const issue of toShow) {
                console.log(`📍 ${issue.file}:${issue.line}`);
                console.log(`   ${issue.description}`);
                if (issue.code) {
                    console.log(`   Code: ${issue.code.substring(0, 60)}...`);
                }
                if (issue.suggestedFix) {
                    console.log(`   ✅ Fix: ${issue.suggestedFix}`);
                }
                console.log();
            }
            
            if (issues.length > 10) {
                console.log(`   ... and ${issues.length - 10} more\n`);
            }
        }
        
        // Save full report
        const reportPath = path.join(import.meta.dir, 'analysis-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(this.issues, null, 2));
        console.log(`\n📄 Full report saved to: ${reportPath}`);
        
        // Priority fixes
        console.log('\n' + '='.repeat(60));
        console.log('🚨 PRIORITY FIXES NEEDED:');
        console.log('='.repeat(60));
        console.log('\n1. Add Rome to extended timeout list (currently times out)');
        console.log('2. Remove hardcoded page limits - use dynamic discovery');
        console.log('3. Don\'t fetch HTML in SharedManifestLoaders (causes timeout)');
        console.log('4. Standardize page discovery across all loaders');
        console.log('5. Add proper error recovery for slow servers');
    }
    
    getTypeEmoji(type: string): string {
        switch(type) {
            case 'hardcoded_limit': return '🔢';
            case 'timeout': return '⏱️';
            case 'inconsistency': return '🔄';
            case 'bug': return '🐛';
            default: return '❓';
        }
    }
}

// Run analysis
const analyzer = new CodebaseAnalyzer();
analyzer.analyze();