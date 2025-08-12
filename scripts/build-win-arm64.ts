#!/usr/bin/env bun

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

console.log('🔧 Building Windows ARM64 with Sharp support...');

// Ensure the Sharp Windows ARM64 binary is available
const sharpWinArm64Path: string = path.join(__dirname, '..', 'node_modules', '@img', 'sharp-win32-arm64');

if (!fs.existsSync(sharpWinArm64Path)) {
    console.log('📦 Installing Sharp Windows ARM64 binary...');
    try {
        execSync('npm install @img/sharp-win32-arm64@0.34.2 --no-save', { 
            stdio: 'inherit',
            cwd: path.join(__dirname, '..')
        });
    } catch (error: any) {
        console.error('❌ Failed to install Sharp Windows ARM64 binary:', error.message);
    }
}

// Check if Sharp Windows ARM64 is now available
if (fs.existsSync(sharpWinArm64Path)) {
    console.log('✅ Sharp Windows ARM64 binary found');
} else {
    console.log('⚠️  Warning: Sharp Windows ARM64 binary not found, negative converter may not work');
}

// Build the application
console.log('🏗️  Building application...');
try {
    execSync('npm run build', { 
        stdio: 'inherit',
        cwd: path.join(__dirname, '..')
    });
    console.log('✅ Application built successfully');
} catch (error: any) {
    console.error('❌ Build failed:', error.message);
    process.exit(1);
}

// Package for Windows ARM64
console.log('📦 Packaging for Windows ARM64...');
try {
    execSync('npx electron-builder --win --arm64', { 
        stdio: 'inherit',
        cwd: path.join(__dirname, '..')
    });
    console.log('✅ Windows ARM64 package created successfully');
} catch (error: any) {
    console.error('❌ Packaging failed:', error.message);
    process.exit(1);
}

console.log('🎉 Windows ARM64 build completed!');