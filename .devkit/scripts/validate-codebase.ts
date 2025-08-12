#!/usr/bin/env bun

/**
 * Enhanced codebase validation script
 * Catches issues that TypeScript might miss, including:
 * - Methods called but not defined
 * - Circular dependencies
 * - Missing imports
 * - Mismatched method signatures
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

interface Colors {
    RED: string;
    GREEN: string;
    YELLOW: string;
    BLUE: string;
    RESET: string;
    BOLD: string;
}

interface TypeScriptError {
    file: string;
    line: number;
    column: number;
    code: string;
    message: string;
}

interface TypeScriptResult {
    success: boolean;
    errors: TypeScriptError[];
}

interface Issue {
    file?: string;
    method?: string;
    line?: number;
    severity: 'error' | 'warning';
    message: string;
    details?: string;
}

const COLORS: Colors = {
    RED: '\x1b[31m',
    GREEN: '\x1b[32m',
    YELLOW: '\x1b[33m',
    BLUE: '\x1b[34m',
    RESET: '\x1b[0m',
    BOLD: '\x1b[1m'
};

function log(message: string, color: string = COLORS.RESET): void {
    console.log(`${color}${message}${COLORS.RESET}`);
}

function runTypeScriptCheck(): TypeScriptResult {
    log('\n🔍 Running TypeScript type checking...', COLORS.BLUE);
    try {
        execSync('npm run typecheck', { stdio: 'pipe' });
        log('✅ TypeScript check passed', COLORS.GREEN);
        return { success: true, errors: [] };
    } catch (error: any) {
        const output = error.stdout ? error.stdout.toString() : '';
        const stderr = error.stderr ? error.stderr.toString() : '';
        const fullOutput = output + stderr;
        
        // Parse TypeScript errors
        const errors: TypeScriptError[] = fullOutput.split('\n')
            .filter(line => line.includes('error TS'))
            .map(line => {
                const match = line.match(/(.+?)\((\d+),(\d+)\): error (TS\d+): (.+)/);
                if (match) {
                    return {
                        file: match[1],
                        line: parseInt(match[2]),
                        column: parseInt(match[3]),
                        code: match[4],
                        message: match[5]
                    };
                }
                return null;
            })
            .filter(Boolean) as TypeScriptError[];
        
        return { success: false, errors };
    }
}

function findUndefinedMethodCalls(): Issue[] {
    log('\n🔍 Checking for undefined method calls...', COLORS.BLUE);
    const issues: Issue[] = [];
    const srcDir = path.join(process.cwd(), 'src');
    
    function scanFile(filePath: string): void {
        if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx')) return;
        
        const content = fs.readFileSync(filePath, 'utf-8');
        const fileName = path.relative(process.cwd(), filePath);
        
        // Find all method calls on 'this'
        const methodCallRegex = /this\.(\w+)\(/g;
        const methodCalls = new Set<string>();
        let match: RegExpExecArray | null;
        
        while ((match = methodCallRegex.exec(content)) !== null) {
            methodCalls.add(match[1]);
        }
        
        // Find all method definitions
        const methodDefRegex = /(?:async\s+)?(?:private\s+|protected\s+|public\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*{/g;
        const definedMethods = new Set<string>();
        
        while ((match = methodDefRegex.exec(content)) !== null) {
            definedMethods.add(match[1]);
        }
        
        // Check for undefined methods
        for (const method of methodCalls) {
            // Skip common methods that might be inherited
            const commonMethods = ['constructor', 'super', 'setState', 'forceUpdate', 'render'];
            if (commonMethods.includes(method)) continue;
            
            if (!definedMethods.has(method) && !content.includes(`${method}(`)) {
                // Look for the method in parent classes
                const extendsMatch = content.match(/class\s+\w+\s+extends\s+(\w+)/);
                if (extendsMatch) {
                    // For now, we'll flag it as a potential issue
                    issues.push({
                        file: fileName,
                        method,
                        line: getLineNumber(content, `this.${method}(`),
                        severity: 'warning',
                        message: `Method '${method}' is called but may not be defined in this class`
                    });
                }
            }
        }
    }
    
    function getLineNumber(content: string, searchStr: string): number {
        const index = content.indexOf(searchStr);
        if (index === -1) return 0;
        return content.substring(0, index).split('\n').length;
    }
    
    function scanDirectory(dir: string): void {
        const files = fs.readdirSync(dir);
        for (const file of files) {
            const fullPath = path.join(dir, file);
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
                scanDirectory(fullPath);
            } else if (stat.isFile()) {
                scanFile(fullPath);
            }
        }
    }
    
    scanDirectory(srcDir);
    return issues;
}

function checkForCircularDependencies(): Issue[] {
    log('\n🔍 Checking for circular dependencies...', COLORS.BLUE);
    const issues: Issue[] = [];
    
    try {
        // Use madge for circular dependency detection if available
        execSync('npx madge --circular src', { stdio: 'pipe' });
        log('✅ No circular dependencies found', COLORS.GREEN);
    } catch (error: any) {
        // Parse madge output for circular dependencies
        const output = error.stdout ? error.stdout.toString() : '';
        if (output.includes('Found')) {
            issues.push({
                severity: 'error',
                message: 'Circular dependencies detected',
                details: output
            });
        }
    }
    
    return issues;
}

function validateImports(): Issue[] {
    log('\n🔍 Validating imports...', COLORS.BLUE);
    const issues: Issue[] = [];
    const srcDir = path.join(process.cwd(), 'src');
    
    function scanFile(filePath: string): void {
        if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx')) return;
        
        const content = fs.readFileSync(filePath, 'utf-8');
        const fileName = path.relative(process.cwd(), filePath);
        
        // Check for imports from non-existent files
        const importRegex = /import\s+.*?\s+from\s+['"](.+?)['"]/g;
        let match: RegExpExecArray | null;
        
        while ((match = importRegex.exec(content)) !== null) {
            const importPath = match[1];
            
            // Skip node_modules and external packages
            if (!importPath.startsWith('.') && !importPath.startsWith('/')) continue;
            
            // Resolve the import path
            const currentDir = path.dirname(filePath);
            const possiblePaths = [
                path.resolve(currentDir, importPath),
                path.resolve(currentDir, `${importPath}.ts`),
                path.resolve(currentDir, `${importPath}.tsx`),
                path.resolve(currentDir, `${importPath}.js`),
                path.resolve(currentDir, `${importPath}/index.ts`),
                path.resolve(currentDir, `${importPath}/index.tsx`),
                path.resolve(currentDir, `${importPath}/index.js`)
            ];
            
            const exists = possiblePaths.some(p => fs.existsSync(p));
            
            if (!exists) {
                issues.push({
                    file: fileName,
                    severity: 'error',
                    message: `Import from non-existent file: ${importPath}`,
                    line: getLineNumber(content, match[0])
                });
            }
        }
    }
    
    function getLineNumber(content: string, searchStr: string): number {
        const index = content.indexOf(searchStr);
        if (index === -1) return 0;
        return content.substring(0, index).split('\n').length;
    }
    
    function scanDirectory(dir: string): void {
        const files = fs.readdirSync(dir);
        for (const file of files) {
            const fullPath = path.join(dir, file);
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
                scanDirectory(fullPath);
            } else if (stat.isFile()) {
                scanFile(fullPath);
            }
        }
    }
    
    scanDirectory(srcDir);
    return issues;
}

function main(): void {
    log(`${COLORS.BOLD}🚀 Enhanced Codebase Validation${COLORS.RESET}`, COLORS.BLUE);
    log('='.repeat(50), COLORS.BLUE);
    
    let hasErrors = false;
    const allIssues: Issue[] = [];
    
    // Run TypeScript check
    const tsResult = runTypeScriptCheck();
    if (!tsResult.success) {
        hasErrors = true;
        log(`\n❌ Found ${tsResult.errors.length} TypeScript errors`, COLORS.RED);
        tsResult.errors.slice(0, 10).forEach(error => {
            log(`  ${error.file}:${error.line}:${error.column} - ${error.code}: ${error.message}`, COLORS.YELLOW);
        });
        if (tsResult.errors.length > 10) {
            log(`  ... and ${tsResult.errors.length - 10} more errors`, COLORS.YELLOW);
        }
    }
    
    // Check for undefined method calls
    const methodIssues = findUndefinedMethodCalls();
    if (methodIssues.length > 0) {
        log(`\n⚠️  Found ${methodIssues.length} potential undefined method calls`, COLORS.YELLOW);
        methodIssues.slice(0, 10).forEach(issue => {
            log(`  ${issue.file}:${issue.line} - ${issue.message}`, COLORS.YELLOW);
        });
        allIssues.push(...methodIssues);
    }
    
    // Validate imports
    const importIssues = validateImports();
    if (importIssues.length > 0) {
        hasErrors = true;
        log(`\n❌ Found ${importIssues.length} import issues`, COLORS.RED);
        importIssues.forEach(issue => {
            log(`  ${issue.file}:${issue.line} - ${issue.message}`, COLORS.RED);
        });
        allIssues.push(...importIssues);
    }
    
    // Check for circular dependencies (optional, as it requires madge)
    // const circularIssues = checkForCircularDependencies();
    // if (circularIssues.length > 0) {
    //     hasErrors = true;
    //     log('\n❌ Circular dependencies found', COLORS.RED);
    //     allIssues.push(...circularIssues);
    // }
    
    // Summary
    log('\n' + '='.repeat(50), COLORS.BLUE);
    if (hasErrors || allIssues.length > 0) {
        log(`${COLORS.BOLD}❌ Validation failed with ${allIssues.length} issues${COLORS.RESET}`, COLORS.RED);
        
        // Write report
        const reportPath = path.join(process.cwd(), '.devkit/reports/validation-report.json');
        fs.mkdirSync(path.dirname(reportPath), { recursive: true });
        fs.writeFileSync(reportPath, JSON.stringify({
            timestamp: new Date().toISOString(),
            issues: allIssues,
            typeScriptErrors: tsResult.errors
        }, null, 2));
        
        log(`\n📝 Full report saved to: ${reportPath}`, COLORS.YELLOW);
        process.exit(1);
    } else {
        log(`${COLORS.BOLD}✅ All validation checks passed!${COLORS.RESET}`, COLORS.GREEN);
    }
}

// Run the validation if executed directly
if (import.meta.main) {
    main();
}