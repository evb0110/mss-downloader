#!/usr/bin/env bun

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

interface BuildContext {
  appOutDir: string;
}

interface PackageJson {
  type?: string;
  [key: string]: any;
}

/**
 * CRITICAL: Fix ES module issues inside ASAR files
 * This script extracts ASAR, fixes all package.json files, and repacks
 */
export default async function(context: BuildContext): Promise<void> {
  const { appOutDir } = context;
  console.log('🔧 Fixing ES modules inside ASAR files:', appOutDir);
  
  try {
    // Find all ASAR files
    const asarFiles: string[] = findAsarFiles(appOutDir);
    console.log(`📦 Found ${asarFiles.length} ASAR files to process`);
    
    for (const asarPath of asarFiles) {
      await processAsarFile(asarPath);
    }
    
    console.log('✅ All ASAR files processed successfully');
  } catch (error: any) {
    console.error('❌ ASAR processing failed:', error.message);
    throw error;
  }
}

function findAsarFiles(dir: string): string[] {
  const asarFiles: string[] = [];
  
  function searchDir(currentDir: string): void {
    try {
      const items = fs.readdirSync(currentDir, { withFileTypes: true });
      
      for (const item of items) {
        const fullPath: string = path.join(currentDir, item.name);
        
        if (item.isDirectory()) {
          searchDir(fullPath);
        } else if (item.name.endsWith('.asar')) {
          asarFiles.push(fullPath);
        }
      }
    } catch (error) {
      // Ignore permission errors
    }
  }
  
  searchDir(dir);
  return asarFiles;
}

async function processAsarFile(asarPath: string): Promise<void> {
  console.log(`🔄 Processing ASAR: ${asarPath}`);
  
  const asarDir: string = path.dirname(asarPath);
  const asarName: string = path.basename(asarPath, '.asar');
  const extractDir: string = path.join(asarDir, `${asarName}_extracted`);
  const backupPath: string = `${asarPath}.backup`;
  
  try {
    // Create backup
    fs.copyFileSync(asarPath, backupPath);
    
    // Extract ASAR
    execSync(`npx asar extract "${asarPath}" "${extractDir}"`, { stdio: 'pipe' });
    
    // Fix all package.json and JavaScript files
    const fixedCount: number = fixPackageJsonFiles(extractDir);
    console.log(`📝 Fixed ${fixedCount} files (package.json and .js files)`);
    
    if (fixedCount > 0) {
      // Repack ASAR
      execSync(`npx asar pack "${extractDir}" "${asarPath}"`, { stdio: 'pipe' });
      console.log(`✅ Repacked ASAR: ${asarPath}`);
    }
    
    // Cleanup
    fs.rmSync(extractDir, { recursive: true, force: true });
    fs.unlinkSync(backupPath);
    
  } catch (error: any) {
    console.error(`❌ Failed to process ${asarPath}:`, error.message);
    
    // Restore backup
    if (fs.existsSync(backupPath)) {
      fs.copyFileSync(backupPath, asarPath);
      fs.unlinkSync(backupPath);
    }
    
    // Cleanup
    if (fs.existsSync(extractDir)) {
      fs.rmSync(extractDir, { recursive: true, force: true });
    }
    
    throw error;
  }
}

function fixPackageJsonFiles(dir: string): number {
  let fixedCount: number = 0;
  
  function processDir(currentDir: string): void {
    try {
      const items = fs.readdirSync(currentDir, { withFileTypes: true });
      
      for (const item of items) {
        const fullPath: string = path.join(currentDir, item.name);
        
        if (item.isDirectory()) {
          processDir(fullPath);
        } else if (item.name === 'package.json') {
          if (fixPackageJson(fullPath)) {
            fixedCount++;
          }
        } else if (item.name.endsWith('.js')) {
          if (fixJavaScriptFile(fullPath)) {
            fixedCount++;
          }
        }
      }
    } catch (error) {
      // Ignore permission errors
    }
  }
  
  processDir(dir);
  return fixedCount;
}

function fixPackageJson(filePath: string): boolean {
  try {
    const content: string = fs.readFileSync(filePath, 'utf8');
    const packageData: PackageJson = JSON.parse(content);
    
    if (packageData.type === 'module') {
      console.log(`🔄 Converting ${filePath} from ES module to CommonJS`);
      packageData.type = 'commonjs';
      fs.writeFileSync(filePath, JSON.stringify(packageData, null, 2));
      return true;
    }
    
    return false;
  } catch (error: any) {
    console.warn(`⚠️ Could not process ${filePath}:`, error.message);
    return false;
  }
}

function fixJavaScriptFile(filePath: string): boolean {
  try {
    const content: string = fs.readFileSync(filePath, 'utf8');
    let modified: boolean = false;
    let newContent: string = content;
    
    // Convert ES module imports to CommonJS requires
    // Handle various import patterns including node: imports
    const patterns: RegExp[] = [
      // import process from 'node:process';
      /import\s+(\w+)\s+from\s+['"`]node:(\w+)['"`];?/g,
      // import { something } from 'node:module';
      /import\s+\{([^}]+)\}\s+from\s+['"`]node:(\w+)['"`];?/g,
      // import * as name from 'module';
      /import\s+\*\s+as\s+(\w+)\s+from\s+['"`]([^'"`]+)['"`];?/g,
      // import name from 'module';
      /import\s+(\w+)\s+from\s+['"`]([^'"`]+)['"`];?/g,
      // import { named } from 'module';
      /import\s+\{([^}]+)\}\s+from\s+['"`]([^'"`]+)['"`];?/g,
      // import 'module';
      /import\s+['"`]([^'"`]+)['"`];?/g
    ];
    
    // Apply each pattern sequentially
    patterns.forEach((pattern, index) => {
      newContent = newContent.replace(pattern, (...args: string[]) => {
        modified = true;
        const match: string = args[0];
        
        if (index === 0) {
          // import process from 'node:process';
          const [, varName, moduleName] = args;
          return `const ${varName} = require('${moduleName}');`;
        } else if (index === 1) {
          // import { something } from 'node:module';
          const [, namedImports, moduleName] = args;
          const named: string[] = namedImports.split(',').map(n => n.trim()).filter(n => n);
          return `const { ${named.join(', ')} } = require('${moduleName}');`;
        } else if (index === 2) {
          // import * as name from 'module';
          const [, varName, modulePath] = args;
          return `const ${varName} = require('${modulePath}');`;
        } else if (index === 3) {
          // import name from 'module';
          const [, varName, modulePath] = args;
          return `const ${varName} = require('${modulePath}');`;
        } else if (index === 4) {
          // import { named } from 'module';
          const [, namedImports, modulePath] = args;
          const named: string[] = namedImports.split(',').map(n => n.trim()).filter(n => n);
          return `const { ${named.join(', ')} } = require('${modulePath}');`;
        } else if (index === 5) {
          // import 'module';
          const [, modulePath] = args;
          return `require('${modulePath}');`;
        }
        
        return match;
      });
    });
    
    // Convert ES module exports to CommonJS
    newContent = newContent.replace(/export\s+default\s+/g, 'module.exports = ');
    newContent = newContent.replace(/export\s+\{([^}]+)\}/g, (match: string, exports: string) => {
      modified = true;
      const exportList: string[] = exports.split(',').map(e => e.trim()).filter(e => e);
      return exportList.map(exp => `module.exports.${exp} = ${exp};`).join('\n');
    });
    newContent = newContent.replace(/export\s+(?:const|let|var|function|class)\s+(\w+)/g, (match: string, name: string) => {
      modified = true;
      return match.replace('export ', '') + `\nmodule.exports.${name} = ${name};`;
    });
    
    if (modified) {
      console.log(`🔧 Converting ES module syntax in ${filePath}`);
      fs.writeFileSync(filePath, newContent, 'utf8');
      return true;
    }
    
    return false;
  } catch (error: any) {
    console.warn(`⚠️ Could not process JS file ${filePath}:`, error.message);
    return false;
  }
}