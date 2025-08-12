#!/usr/bin/env bun

// Test script to validate TypeScript conversions without executing them
import * as fs from 'fs';
import * as path from 'path';

interface TestResult {
  file: string;
  success: boolean;
  error?: string;
}

const files = [
  'commit-linz-changes.ts',
  'final-commit.ts', 
  'simple-commit.ts',
  'sign-windows.ts',
  'esbuild.main.config.ts'
];

const results: TestResult[] = [];

console.log('Testing TypeScript file conversions...\n');

for (const file of files) {
  const filePath = path.join(process.cwd(), file);
  
  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error('File does not exist');
    }
    
    // Read and validate basic TypeScript syntax
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Basic validation checks
    const checks = [
      {
        name: 'Has proper imports',
        test: () => content.includes('import') && !content.includes('require(')
      },
      {
        name: 'Has TypeScript types',
        test: () => content.includes(': string') || content.includes(': boolean') || content.includes('interface')
      },
      {
        name: 'Has Bun shebang',
        test: () => content.startsWith('#!/usr/bin/env bun')
      },
      {
        name: 'No CommonJS requires',
        test: () => !content.includes('require(')
      }
    ];
    
    const failedChecks = checks.filter(check => !check.test());
    
    if (failedChecks.length > 0) {
      throw new Error(`Failed checks: ${failedChecks.map(c => c.name).join(', ')}`);
    }
    
    results.push({ file, success: true });
    console.log(`✅ ${file}: All checks passed`);
    
  } catch (error: any) {
    results.push({ file, success: false, error: error.message });
    console.log(`❌ ${file}: ${error.message}`);
  }
}

console.log('\n--- Summary ---');
const successful = results.filter(r => r.success);
const failed = results.filter(r => !r.success);

console.log(`✅ Successful conversions: ${successful.length}/${files.length}`);
if (failed.length > 0) {
  console.log(`❌ Failed conversions: ${failed.length}`);
  failed.forEach(f => console.log(`   - ${f.file}: ${f.error}`));
}

if (successful.length === files.length) {
  console.log('\n🎉 All TypeScript conversions validated successfully!');
  process.exit(0);
} else {
  process.exit(1);
}