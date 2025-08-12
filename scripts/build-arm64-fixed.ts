#!/usr/bin/env bun

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface PackageJson {
  dependencies?: { [key: string]: string };
  type?: string;
  [key: string]: any;
}

console.log('🔧 Building Windows ARM64 with ES module fix...');

try {
  // Read current package.json
  const packagePath: string = path.join(__dirname, '../package.json');
  const packageContent: string = fs.readFileSync(packagePath, 'utf8');
  const packageJson: PackageJson = JSON.parse(packageContent);
  
  // Create a backup
  fs.writeFileSync(packagePath + '.backup', packageContent);
  
  // Ensure Sharp is included in dependencies
  if (!packageJson.dependencies) {
    packageJson.dependencies = {};
  }
  
  if (!packageJson.dependencies.sharp) {
    packageJson.dependencies.sharp = '^0.34.2';
    console.log('📦 Added Sharp to dependencies');
  }
  
  // Ensure CommonJS configuration is explicit
  packageJson.type = undefined; // Remove any ES module config
  
  // Write modified package.json
  fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
  
  // Build the application
  console.log('🏗️  Building application...');
  execSync('npm run build', { stdio: 'inherit' });
  
  // Build ARM64 distribution
  console.log('📦 Building ARM64 distribution with ES module fix...');
  execSync('npx electron-builder --win --arm64', { stdio: 'inherit' });
  
  console.log('✅ ARM64 build completed with ES module fix!');
  
} catch (error: any) {
  console.error('❌ Build failed:', error.message);
} finally {
  // Restore original package.json
  const packagePath: string = path.join(__dirname, '../package.json');
  const backupPath: string = packagePath + '.backup';
  
  if (fs.existsSync(backupPath)) {
    fs.copyFileSync(backupPath, packagePath);
    fs.unlinkSync(backupPath);
    console.log('🔄 Restored original package.json');
  }
}