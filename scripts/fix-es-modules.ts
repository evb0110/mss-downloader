#!/usr/bin/env bun

import * as fs from 'fs';
import * as path from 'path';

interface BuildContext {
  appOutDir: string;
}

interface PackageJson {
  type?: string;
  [key: string]: any;
}

/**
 * Electron Builder afterPack hook to fix ES module issues
 * This script ensures all package.json files use CommonJS
 */
export default async function(context: BuildContext): Promise<void> {
  const { appOutDir } = context;
  console.log('🔧 Fixing ES module issues in:', appOutDir);
  
  // Find all package.json files in the output directory
  function findPackageJsonFiles(dir: string): string[] {
    const files: string[] = [];
    
    function searchDir(currentDir: string): void {
      try {
        const items = fs.readdirSync(currentDir, { withFileTypes: true });
        
        for (const item of items) {
          const fullPath: string = path.join(currentDir, item.name);
          
          if (item.isDirectory()) {
            searchDir(fullPath);
          } else if (item.name === 'package.json') {
            files.push(fullPath);
          }
        }
      } catch (error) {
        // Ignore permission errors
      }
    }
    
    searchDir(dir);
    return files;
  }
  
  const packageJsonFiles: string[] = findPackageJsonFiles(appOutDir);
  console.log(`📦 Found ${packageJsonFiles.length} package.json files`);
  
  for (const filePath of packageJsonFiles) {
    try {
      const content: string = fs.readFileSync(filePath, 'utf8');
      const packageData: PackageJson = JSON.parse(content);
      
      // Force CommonJS configuration
      if (packageData.type === 'module') {
        console.log(`🔄 Converting ${filePath} from ES module to CommonJS`);
        packageData.type = 'commonjs';
        fs.writeFileSync(filePath, JSON.stringify(packageData, null, 2));
      } else if (!packageData.type) {
        // Explicitly set CommonJS for safety
        packageData.type = 'commonjs';
        fs.writeFileSync(filePath, JSON.stringify(packageData, null, 2));
      }
    } catch (error: any) {
      console.warn(`⚠️  Could not process ${filePath}:`, error.message);
    }
  }
  
  console.log('✅ ES module fix completed');
}