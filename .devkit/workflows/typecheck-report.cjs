#!/usr/bin/env node

/**
 * TypeScript Type Check Report Generator
 * Runs tsc and generates a detailed report of type errors
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPORT_DIR = path.join(__dirname, '../reports');
const REPORT_FILE = path.join(REPORT_DIR, 'typecheck-report.json');
const SUMMARY_FILE = path.join(REPORT_DIR, 'typecheck-summary.md');

// Color codes for terminal output
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    gray: '\x1b[90m',
    bold: '\x1b[1m'
};

function runTypeCheck() {
    try {
        // Run tsc and capture output
        const output = execSync('npx tsc --noEmit --pretty false 2>&1', {
            encoding: 'utf8',
            cwd: path.join(__dirname, '../..')
        });
        
        return { success: true, output };
    } catch (error) {
        // tsc returns non-zero exit code when there are errors
        return { success: false, output: error.stdout || error.toString() };
    }
}

function parseTypeScriptErrors(output) {
    const lines = output.split('\n');
    const errors = [];
    const errorPattern = /^(.+?)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s+(.+)$/;
    
    for (const line of lines) {
        const match = line.match(errorPattern);
        if (match) {
            const [, file, line, column, code, message] = match;
            errors.push({
                file: path.relative(process.cwd(), file),
                line: parseInt(line),
                column: parseInt(column),
                code,
                message,
                severity: 'error'
            });
        }
    }
    
    return errors;
}

function categorizeErrors(errors) {
    const categories = {
        implicitAny: [],
        possiblyNull: [],
        possiblyUndefined: [],
        propertyDoesNotExist: [],
        cannotFind: [],
        typeAssignment: [],
        argumentCount: [],
        unusedVariable: [],
        other: []
    };
    
    for (const error of errors) {
        if (error.code === 'TS7006' || error.code === 'TS7031') {
            categories.implicitAny.push(error);
        } else if (error.code === 'TS18047' || error.code === 'TS18048') {
            categories.possiblyNull.push(error);
        } else if (error.code === 'TS2532') {
            categories.possiblyUndefined.push(error);
        } else if (error.code === 'TS2339' || error.code === 'TS2551') {
            categories.propertyDoesNotExist.push(error);
        } else if (error.code === 'TS2304' || error.code === 'TS2552') {
            categories.cannotFind.push(error);
        } else if (error.code === 'TS2322' || error.code === 'TS2345') {
            categories.typeAssignment.push(error);
        } else if (error.code === 'TS2554' || error.code === 'TS2555') {
            categories.argumentCount.push(error);
        } else if (error.code === 'TS6133' || error.code === 'TS6196') {
            categories.unusedVariable.push(error);
        } else {
            categories.other.push(error);
        }
    }
    
    return categories;
}

function generateReport(errors) {
    const categories = categorizeErrors(errors);
    const timestamp = new Date().toISOString();
    
    // Count errors by file
    const errorsByFile = {};
    for (const error of errors) {
        if (!errorsByFile[error.file]) {
            errorsByFile[error.file] = [];
        }
        errorsByFile[error.file].push(error);
    }
    
    // Find most problematic files
    const fileStats = Object.entries(errorsByFile)
        .map(([file, errors]) => ({ file, count: errors.length }))
        .sort((a, b) => b.count - a.count);
    
    const report = {
        timestamp,
        totalErrors: errors.length,
        categories: Object.fromEntries(
            Object.entries(categories).map(([name, errors]) => [name, {
                count: errors.length,
                percentage: ((errors.length / errors.length) * 100).toFixed(1) + '%',
                errors: errors.slice(0, 5) // First 5 examples
            }])
        ),
        topProblematicFiles: fileStats.slice(0, 10),
        allErrors: errors
    };
    
    return report;
}

function generateMarkdownSummary(report) {
    const { timestamp, totalErrors, categories, topProblematicFiles } = report;
    
    let md = `# TypeScript Type Check Report\n\n`;
    md += `**Generated:** ${new Date(timestamp).toLocaleString()}\n\n`;
    
    if (totalErrors === 0) {
        md += `## ✅ No Type Errors!\n\n`;
        md += `The codebase is fully type-safe.\n`;
        return md;
    }
    
    md += `## 📊 Summary\n\n`;
    md += `**Total Errors:** ${totalErrors}\n\n`;
    
    md += `### Error Categories\n\n`;
    md += `| Category | Count | Percentage | Description |\n`;
    md += `|----------|-------|------------|-------------|\n`;
    
    const categoryDescriptions = {
        implicitAny: 'Parameters or variables with implicit any type',
        possiblyNull: 'Values that might be null or undefined',
        possiblyUndefined: 'Objects that might be undefined',
        propertyDoesNotExist: 'Properties that don\'t exist on types',
        cannotFind: 'Cannot find name (missing imports/declarations)',
        typeAssignment: 'Type assignment/compatibility errors',
        argumentCount: 'Wrong number of arguments',
        unusedVariable: 'Unused variables or parameters',
        other: 'Other TypeScript errors'
    };
    
    for (const [name, data] of Object.entries(categories)) {
        if (data.count > 0) {
            md += `| ${name} | ${data.count} | ${data.percentage} | ${categoryDescriptions[name]} |\n`;
        }
    }
    
    md += `\n### Top Problematic Files\n\n`;
    md += `| File | Error Count |\n`;
    md += `|------|-------------|\n`;
    
    for (const { file, count } of topProblematicFiles) {
        md += `| ${file} | ${count} |\n`;
    }
    
    md += `\n## 🔧 How to Fix\n\n`;
    md += `1. **Run interactive fix:** \`npm run typefix\`\n`;
    md += `2. **Check specific file:** \`npx tsc --noEmit src/path/to/file.ts\`\n`;
    md += `3. **Watch mode:** \`npm run typecheck:watch\`\n`;
    
    md += `\n## 📝 Common Fixes\n\n`;
    
    if (categories.implicitAny.count > 0) {
        md += `### Implicit Any\n`;
        md += `Add explicit types to parameters:\n`;
        md += `\`\`\`typescript\n`;
        md += `// Before\nfunction foo(param) { }\n\n`;
        md += `// After\nfunction foo(param: string) { }\n`;
        md += `\`\`\`\n\n`;
    }
    
    if (categories.possiblyNull.count > 0) {
        md += `### Possibly Null/Undefined\n`;
        md += `Add null checks:\n`;
        md += `\`\`\`typescript\n`;
        md += `// Before\nconst value = obj.property;\n\n`;
        md += `// After\nconst value = obj?.property;\n`;
        md += `\`\`\`\n\n`;
    }
    
    if (categories.propertyDoesNotExist.count > 0) {
        md += `### Property Does Not Exist\n`;
        md += `Fix typos or add type declarations:\n`;
        md += `\`\`\`typescript\n`;
        md += `// Add missing property to interface\ninterface MyType {\n  existingProp: string;\n  newProp?: string; // Add this\n}\n`;
        md += `\`\`\`\n\n`;
    }
    
    return md;
}

function printColoredSummary(report) {
    const { totalErrors, categories } = report;
    
    console.log('\n' + colors.bold + '📊 TypeScript Type Check Summary' + colors.reset);
    console.log('=' .repeat(50));
    
    if (totalErrors === 0) {
        console.log(colors.green + colors.bold + '\n✅ No type errors found! Code is type-safe.\n' + colors.reset);
        return;
    }
    
    console.log(colors.red + `\n❌ Found ${totalErrors} type errors\n` + colors.reset);
    
    console.log(colors.cyan + 'Error Categories:' + colors.reset);
    for (const [name, data] of Object.entries(categories)) {
        if (data.count > 0) {
            const bar = '█'.repeat(Math.ceil(data.count / 5));
            const color = data.count > 20 ? colors.red : data.count > 10 ? colors.yellow : colors.green;
            console.log(`  ${color}${name.padEnd(20)} ${bar} ${data.count}${colors.reset}`);
        }
    }
    
    console.log('\n' + colors.yellow + 'Top Issues:' + colors.reset);
    const topIssues = Object.entries(categories)
        .filter(([, data]) => data.count > 0)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 3);
    
    for (const [name, data] of topIssues) {
        console.log(`  • ${name}: ${data.count} errors`);
        if (data.errors[0]) {
            console.log(colors.gray + `    Example: ${data.errors[0].file}:${data.errors[0].line}` + colors.reset);
            console.log(colors.gray + `    ${data.errors[0].message.substring(0, 60)}...` + colors.reset);
        }
    }
    
    console.log('\n' + colors.blue + 'Quick Actions:' + colors.reset);
    console.log('  • View full report: ' + colors.cyan + 'cat .devkit/reports/typecheck-summary.md' + colors.reset);
    console.log('  • Fix automatically: ' + colors.cyan + 'npm run typefix' + colors.reset);
    console.log('  • Watch mode: ' + colors.cyan + 'npm run typecheck:watch' + colors.reset);
    console.log();
}

async function main() {
    console.log(colors.blue + '🔍 Running TypeScript type check...' + colors.reset);
    
    // Ensure report directory exists
    if (!fs.existsSync(REPORT_DIR)) {
        fs.mkdirSync(REPORT_DIR, { recursive: true });
    }
    
    // Run type check
    const { success, output } = runTypeCheck();
    
    // Parse errors
    const errors = parseTypeScriptErrors(output);
    
    // Generate report
    const report = generateReport(errors);
    
    // Save JSON report
    fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));
    
    // Generate and save markdown summary
    const markdown = generateMarkdownSummary(report);
    fs.writeFileSync(SUMMARY_FILE, markdown);
    
    // Print colored summary to console
    printColoredSummary(report);
    
    // Exit with appropriate code
    process.exit(success ? 0 : 1);
}

main().catch(error => {
    console.error(colors.red + 'Error running type check report:' + colors.reset, error);
    process.exit(1);
});