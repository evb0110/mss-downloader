#!/usr/bin/env node

/**
 * Automatic TypeScript Type Error Fixer
 * Attempts to automatically fix common type errors
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    bold: '\x1b[1m'
};

class TypeFixer {
    constructor() {
        this.fixCount = 0;
        this.projectRoot = path.join(__dirname, '../..');
    }
    
    /**
     * Get TypeScript errors
     */
    getTypeErrors() {
        try {
            execSync('npx tsc --noEmit --pretty false', {
                encoding: 'utf8',
                cwd: this.projectRoot
            });
            return [];
        } catch (error) {
            const output = error.stdout || error.toString();
            return this.parseErrors(output);
        }
    }
    
    /**
     * Parse TypeScript error output
     */
    parseErrors(output) {
        const lines = output.split('\n');
        const errors = [];
        const errorPattern = /^(.+?)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s+(.+)$/;
        
        for (const line of lines) {
            const match = line.match(errorPattern);
            if (match) {
                const [, file, lineNum, column, code, message] = match;
                errors.push({
                    file: path.resolve(this.projectRoot, file),
                    line: parseInt(lineNum),
                    column: parseInt(column),
                    code,
                    message
                });
            }
        }
        
        return errors;
    }
    
    /**
     * Fix implicit any parameters
     */
    fixImplicitAny(error) {
        const { file, line, column, message } = error;
        
        // Extract parameter name from error message
        const paramMatch = message.match(/Parameter '(\w+)' implicitly has an 'any' type/);
        if (!paramMatch) return false;
        
        const paramName = paramMatch[1];
        const content = fs.readFileSync(file, 'utf8');
        const lines = content.split('\n');
        const targetLine = lines[line - 1];
        
        // Try to infer type from usage
        const inferredType = this.inferTypeFromUsage(lines, line, paramName);
        
        // Replace parameter with typed version
        const newLine = targetLine.replace(
            new RegExp(`(\\W)(${paramName})(\\W)`),
            `$1${paramName}: ${inferredType}$3`
        );
        
        lines[line - 1] = newLine;
        fs.writeFileSync(file, lines.join('\n'));
        
        console.log(`${colors.green}✅ Fixed implicit any: ${paramName}: ${inferredType}${colors.reset}`);
        this.fixCount++;
        return true;
    }
    
    /**
     * Fix missing imports/cannot find name
     */
    fixMissingImport(error) {
        const { file, message } = error;
        
        // Extract the missing name
        const nameMatch = message.match(/Cannot find name '(\w+)'/);
        if (!nameMatch) return false;
        
        const missingName = nameMatch[1];
        
        // Common imports map
        const commonImports = {
            'Buffer': "import { Buffer } from 'buffer';",
            'process': "import process from 'process';",
            'path': "import path from 'path';",
            'fs': "import fs from 'fs';",
            'URL': "import { URL } from 'url';",
            '__dirname': "import { dirname } from 'path';\nimport { fileURLToPath } from 'url';\nconst __dirname = dirname(fileURLToPath(import.meta.url));",
            'require': "import { createRequire } from 'module';\nconst require = createRequire(import.meta.url);"
        };
        
        if (commonImports[missingName]) {
            const content = fs.readFileSync(file, 'utf8');
            const importStatement = commonImports[missingName];
            
            // Add import at the top of the file
            const newContent = importStatement + '\n' + content;
            fs.writeFileSync(file, newContent);
            
            console.log(`${colors.green}✅ Added missing import for: ${missingName}${colors.reset}`);
            this.fixCount++;
            return true;
        }
        
        return false;
    }
    
    /**
     * Fix property does not exist errors
     */
    fixMissingProperty(error) {
        const { file, line, message } = error;
        
        // Extract property and type names
        const propMatch = message.match(/Property '(\w+)' does not exist on type '(.+?)'/);
        if (!propMatch) return false;
        
        const [, property, typeName] = propMatch;
        
        // Special case: add to interface or type
        if (this.addPropertyToType(file, typeName, property)) {
            console.log(`${colors.green}✅ Added property ${property} to type ${typeName}${colors.reset}`);
            this.fixCount++;
            return true;
        }
        
        return false;
    }
    
    /**
     * Fix possibly null/undefined
     */
    fixPossiblyNull(error) {
        const { file, line, message } = error;
        
        const content = fs.readFileSync(file, 'utf8');
        const lines = content.split('\n');
        const targetLine = lines[line - 1];
        
        // Add optional chaining
        const newLine = targetLine.replace(/(\w+)\.(\w+)/g, '$1?.$2');
        
        if (newLine !== targetLine) {
            lines[line - 1] = newLine;
            fs.writeFileSync(file, lines.join('\n'));
            
            console.log(`${colors.green}✅ Added optional chaining at line ${line}${colors.reset}`);
            this.fixCount++;
            return true;
        }
        
        return false;
    }
    
    /**
     * Fix method reference errors (like loadVatlibManifest)
     */
    fixMethodReference(error) {
        const { file, line, message } = error;
        
        // Check if it's a method that doesn't exist
        const methodMatch = message.match(/Property '(\w+)' does not exist|'(\w+)' is not a function/);
        if (!methodMatch) return false;
        
        const methodName = methodMatch[1] || methodMatch[2];
        
        // Special handling for loader methods
        if (methodName.startsWith('load') && methodName.endsWith('Manifest')) {
            const content = fs.readFileSync(file, 'utf8');
            const lines = content.split('\n');
            const targetLine = lines[line - 1];
            
            // Replace with sharedManifestAdapter call
            const libraryName = this.extractLibraryFromMethod(methodName);
            const newLine = targetLine.replace(
                new RegExp(`this\\.${methodName}\\(`),
                `this.sharedManifestAdapter.getManifestForLibrary('${libraryName}', `
            );
            
            if (newLine !== targetLine) {
                lines[line - 1] = newLine;
                fs.writeFileSync(file, lines.join('\n'));
                
                console.log(`${colors.green}✅ Fixed method reference: ${methodName} → sharedManifestAdapter${colors.reset}`);
                this.fixCount++;
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Infer type from variable usage
     */
    inferTypeFromUsage(lines, lineNum, varName) {
        // Look for usage patterns in nearby lines
        for (let i = lineNum; i < Math.min(lineNum + 20, lines.length); i++) {
            const line = lines[i];
            
            // Check for string operations
            if (line.includes(`${varName}.length`) || line.includes(`${varName}.charAt`)) {
                return 'string';
            }
            
            // Check for array operations
            if (line.includes(`${varName}.push`) || line.includes(`${varName}[`)) {
                return 'any[]';
            }
            
            // Check for number operations
            if (line.includes(`${varName} +`) || line.includes(`${varName} -`)) {
                return 'number';
            }
            
            // Check for boolean usage
            if (line.includes(`if (${varName})`) || line.includes(`!${varName}`)) {
                return 'boolean';
            }
        }
        
        // Default to any if can't infer
        return 'any';
    }
    
    /**
     * Add property to interface or type
     */
    addPropertyToType(file, typeName, property) {
        const content = fs.readFileSync(file, 'utf8');
        
        // Find interface or type declaration
        const interfaceRegex = new RegExp(`interface\\s+${typeName}\\s*{([^}]+)}`, 's');
        const typeRegex = new RegExp(`type\\s+${typeName}\\s*=\\s*{([^}]+)}`, 's');
        
        let match = content.match(interfaceRegex) || content.match(typeRegex);
        if (!match) return false;
        
        const [fullMatch, body] = match;
        
        // Add property with unknown type
        const newBody = body.trimEnd() + `\n  ${property}?: unknown;`;
        const newDeclaration = fullMatch.replace(body, newBody);
        
        const newContent = content.replace(fullMatch, newDeclaration);
        fs.writeFileSync(file, newContent);
        
        return true;
    }
    
    /**
     * Extract library name from method name
     */
    extractLibraryFromMethod(methodName) {
        // loadVatlibManifest -> vatlib
        // loadGallicaManifest -> gallica
        const cleaned = methodName.replace(/^load/, '').replace(/Manifest$/, '');
        return cleaned.toLowerCase();
    }
    
    /**
     * Run auto-fix
     */
    async run() {
        console.log(`${colors.blue}🔧 Starting automatic type fix...${colors.reset}\n`);
        
        let iteration = 0;
        const maxIterations = 10;
        
        while (iteration < maxIterations) {
            iteration++;
            console.log(`${colors.cyan}Iteration ${iteration}:${colors.reset}`);
            
            const errors = this.getTypeErrors();
            
            if (errors.length === 0) {
                console.log(`${colors.green}✅ No more type errors!${colors.reset}`);
                break;
            }
            
            console.log(`Found ${errors.length} errors to fix...\n`);
            
            let fixedInIteration = 0;
            
            for (const error of errors) {
                let fixed = false;
                
                // Try different fix strategies based on error code
                switch (error.code) {
                    case 'TS7006': // Implicit any
                    case 'TS7031':
                        fixed = this.fixImplicitAny(error);
                        break;
                        
                    case 'TS2304': // Cannot find name
                    case 'TS2552':
                        fixed = this.fixMissingImport(error);
                        break;
                        
                    case 'TS2339': // Property does not exist
                    case 'TS2551':
                        fixed = this.fixMissingProperty(error) || this.fixMethodReference(error);
                        break;
                        
                    case 'TS18047': // Possibly null
                    case 'TS18048':
                    case 'TS2532': // Possibly undefined
                        fixed = this.fixPossiblyNull(error);
                        break;
                }
                
                if (fixed) {
                    fixedInIteration++;
                }
            }
            
            if (fixedInIteration === 0) {
                console.log(`${colors.yellow}⚠️  No more auto-fixable errors${colors.reset}`);
                break;
            }
            
            console.log(`Fixed ${fixedInIteration} errors in iteration ${iteration}\n`);
        }
        
        // Final report
        console.log('\n' + '='.repeat(50));
        console.log(`${colors.bold}📊 Auto-fix Summary:${colors.reset}`);
        console.log(`Total fixes applied: ${this.fixCount}`);
        
        const remainingErrors = this.getTypeErrors();
        if (remainingErrors.length > 0) {
            console.log(`${colors.yellow}Remaining errors: ${remainingErrors.length}${colors.reset}`);
            console.log('\nThese errors require manual intervention:');
            
            // Group remaining errors by type
            const errorGroups = {};
            for (const error of remainingErrors) {
                if (!errorGroups[error.code]) {
                    errorGroups[error.code] = [];
                }
                errorGroups[error.code].push(error);
            }
            
            for (const [code, errors] of Object.entries(errorGroups)) {
                console.log(`\n${colors.cyan}${code}: ${errors.length} errors${colors.reset}`);
                console.log(`  Example: ${errors[0].file}:${errors[0].line}`);
                console.log(`  ${errors[0].message}`);
            }
            
            console.log(`\n${colors.blue}Run 'npm run typecheck:watch' to fix remaining errors manually${colors.reset}`);
        } else {
            console.log(`${colors.green}${colors.bold}✅ All type errors fixed!${colors.reset}`);
        }
    }
}

// Run the fixer
const fixer = new TypeFixer();
fixer.run().catch(error => {
    console.error(`${colors.red}Error during auto-fix:${colors.reset}`, error);
    process.exit(1);
});