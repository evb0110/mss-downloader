#!/usr/bin/env bun

import * as fs from 'fs';
import * as path from 'path';

interface BuildContext {
  appOutDir: string;
  electronPlatformName: string;
  arch: string;
}

interface PackageJson {
  type?: string;
  [key: string]: any;
}

/**
 * CRITICAL: Fix ES module issues in Windows ARM64 builds
 * This script fixes both ASAR and unpacked dependencies
 */
export default async function(context: BuildContext): Promise<void> {
  const { appOutDir, electronPlatformName, arch } = context;
  console.log(`🔧 Fixing dependencies for ${electronPlatformName}-${arch}:`, appOutDir);
  
  try {
    // Check if ASAR is disabled (no .asar files)
    const asarFiles: string[] = findAsarFiles(appOutDir);
    
    if (asarFiles.length === 0) {
      // ASAR is disabled, fix files directly in the app directory
      const appPath: string = path.join(appOutDir, 'resources', 'app');
      if (fs.existsSync(appPath)) {
        console.log('📁 Fixing unpacked app directory (ASAR disabled)');
        const fixedCount: number = fixAllFiles(appPath);
        console.log(`✅ Fixed ${fixedCount} files in unpacked directory`);
        
        // CRITICAL: Fix renderer ES modules for ARM64 compatibility
        if (arch === 'arm64' && electronPlatformName === 'win32') {
          const rendererPath: string = path.join(appPath, 'dist', 'renderer');
          if (fs.existsSync(rendererPath)) {
            console.log('🎨 Converting renderer ES modules for ARM64 compatibility');
            const rendererFixed: number = fixRendererESModules(rendererPath);
            console.log(`🎨 Fixed ${rendererFixed} renderer files for ARM64`);
          }
        }
      } else {
        console.log('⚠️ App directory not found:', appPath);
      }
    } else {
      // ASAR is enabled, process ASAR files
      console.log(`📦 Found ${asarFiles.length} ASAR files to process`);
      
      for (const asarPath of asarFiles) {
        await processAsarFile(asarPath);
      }
      
      console.log('✅ All ASAR files processed successfully');
    }
  } catch (error: any) {
    console.error('❌ Dependency fixing failed:', error.message);
    throw error;
  }
}

function fixAllFiles(dir: string): number {
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
        } else if (item.name.endsWith('.js') || item.name.endsWith('.mjs')) {
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
  
  const { execSync } = await import('child_process');
  const asarDir: string = path.dirname(asarPath);
  const asarName: string = path.basename(asarPath, '.asar');
  const extractDir: string = path.join(asarDir, `${asarName}_extracted`);
  const backupPath: string = `${asarPath}.backup`;
  
  try {
    // Create backup
    fs.copyFileSync(asarPath, backupPath);
    
    // Extract ASAR
    execSync(`npx asar extract "${asarPath}" "${extractDir}"`, { stdio: 'pipe' });
    
    // Fix all files
    const fixedCount: number = fixAllFiles(extractDir);
    console.log(`📝 Fixed ${fixedCount} files`);
    
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

function fixRendererESModules(rendererDir: string): number {
  let rendererFilesFixed: number = 0;
  
  function processRendererDir(dir: string): void {
    try {
      const items = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const item of items) {
        const fullPath: string = path.join(dir, item.name);
        
        if (item.isDirectory()) {
          processRendererDir(fullPath);
        } else if (item.name.endsWith('.js')) {
          if (fixRendererJavaScriptFile(fullPath)) {
            rendererFilesFixed++;
          }
        }
      }
    } catch (error) {
      // Ignore permission errors
    }
  }
  
  processRendererDir(rendererDir);
  return rendererFilesFixed;
}

function fixRendererJavaScriptFile(filePath: string): boolean {
  try {
    const content: string = fs.readFileSync(filePath, 'utf8');
    
    // Check for ES module patterns in Vite-built files
    const hasESModules: boolean = content.includes('import{') || 
                        content.includes('from"') || 
                        content.includes('from\'') ||
                        /import\s*\{[^}]*\}\s*from\s*["']/.test(content) ||
                        /export\s*\{[^}]*\}/.test(content);
    
    if (hasESModules) {
      // For Vite-built files, wrap in CommonJS-compatible IIFE
      const wrappedContent: string = `(function() {
  // ES Module compatibility wrapper for Windows ARM64
  try {
    ${content}
  } catch (e) {
    console.warn('ES Module compatibility issue:', e.message);
  }
})();`;
      
      fs.writeFileSync(filePath, wrappedContent, 'utf8');
      console.log(`🎨 Wrapped renderer ES module: ${path.basename(filePath)}`);
      return true;
    }
    
    return false;
  } catch (error: any) {
    console.warn(`⚠️ Could not process renderer file ${filePath}:`, error.message);
    return false;
  }
}

function fixJavaScriptFile(filePath: string): boolean {
  try {
    const content: string = fs.readFileSync(filePath, 'utf8');
    let modified: boolean = false;
    let newContent: string = content;
    
    // CRITICAL: Check for problematic ES syntax that causes ARM64 errors
    const hasESModules: boolean = /(?:^|\n)\s*(?:export\s|import\s|import\{|import\(|export\{|export\s+\{|export\s+default|export\s+\*|import\.meta)/.test(content);
    const hasArrowDefaults: boolean = /=\s*\([^)]*=\s*[^)]*\)\s*=>/m.test(content); // Arrow function defaults
    const hasSpreadSyntax: boolean = /\.\.\./.test(content); // Spread syntax
    const hasDestructuring: boolean = /\{\s*[^}]*\s*\}\s*=/.test(content); // Destructuring assignments
    
    // Convert ES module imports to CommonJS requires
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
    
    // CRITICAL: Fix problematic arrow function default parameters for ARM64
    if (hasArrowDefaults) {
      // Convert arrow functions with default params to regular functions
      newContent = newContent.replace(
        /(\w+)\s*=\s*\(([^)]*=\s*[^,)]+[^)]*)\)\s*=>\s*\{/g,
        function(match: string, funcName: string, params: string): string {
          modified = true;
          return `${funcName} = function(${params}) {`;
        }
      );
      
      // Convert simple arrow functions
      newContent = newContent.replace(
        /(\w+)\s*=\s*\(([^)]*)\)\s*=>\s*\{/g,
        function(match: string, funcName: string, params: string): string {
          modified = true;
          return `${funcName} = function(${params}) {`;
        }
      );
    }
    
    // CRITICAL: Handle spread syntax that causes ARM64 issues
    if (hasSpreadSyntax) {
      // Convert array spread to safer Array.from or concat
      newContent = newContent.replace(
        /\[\.\.\.(\w+)\]/g,
        function(match: string, varName: string): string {
          modified = true;
          return `Array.prototype.slice.call(${varName})`;
        }
      );
    }
    
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