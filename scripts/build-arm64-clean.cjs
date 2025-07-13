#!/usr/bin/env node

/**
 * ARM64 build script that removes Canvas dependency to avoid cross-compilation issues
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🏗️ Building ARM64 version without Canvas dependency...');

// Create backup of package.json
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const backupPath = path.join(__dirname, '..', 'package.json.backup');

try {
  // Backup original package.json
  fs.copyFileSync(packageJsonPath, backupPath);
  console.log('📦 Created package.json backup');
  
  // Read and modify package.json to remove Canvas
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  
  // Remove canvas from optionalDependencies
  if (packageJson.optionalDependencies && packageJson.optionalDependencies.canvas) {
    delete packageJson.optionalDependencies.canvas;
    console.log('🗑️ Removed Canvas from optionalDependencies');
  }
  
  // Write modified package.json
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  console.log('✅ Updated package.json for ARM64 build');
  
  // Run the ARM64 build
  console.log('🚀 Starting ARM64 build...');
  execSync('npm run build && electron-builder --win --arm64', { 
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  });
  
  console.log('✅ ARM64 build completed successfully!');
  
} catch (error) {
  console.error('❌ ARM64 build failed:', error.message);
  process.exit(1);
} finally {
  // Restore original package.json
  if (fs.existsSync(backupPath)) {
    fs.copyFileSync(backupPath, packageJsonPath);
    fs.unlinkSync(backupPath);
    console.log('🔄 Restored original package.json');
  }
}