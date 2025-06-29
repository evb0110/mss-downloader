#!/usr/bin/env node

/**
 * Test script to trigger real Telegram bot changelog generation for evb0110 only
 * This tests the new comprehensive changelog generation system with actual git commits
 */

const path = require('path');
const { execSync } = require('child_process');

// Import the updated send-multiplatform-build functionality
async function testRealChangelogForEvb0110() {
  try {
    console.log('🧪 Testing REAL Telegram bot changelog generation for evb0110 only...');
    console.log('This will use the actual git commit for the current version\n');
    
    // Set environment variables to ensure test mode
    process.env.NODE_ENV = 'development';
    process.env.DEBUG = 'true';
    
    // Get current directory and run the multiplatform build sender
    const currentDir = process.cwd();
    console.log(`📂 Current directory: ${currentDir}`);
    
    // Change to telegram-bot directory and run the TypeScript version
    const telegramBotDir = path.join(__dirname, '..', '..', 'telegram-bot');
    console.log(`📁 Telegram bot directory: ${telegramBotDir}`);
    
    process.chdir(telegramBotDir);
    
    console.log('🔧 Running npm run build to compile TypeScript...');
    execSync('npm run build', { stdio: 'inherit' });
    
    console.log('📤 Running send-multiplatform-build in development mode (evb0110 only)...');
    console.log('This will use the actual changelog generation logic we just fixed\n');
    
    // Run the actual send-multiplatform-build script
    // In development mode (NODE_ENV=development), it only notifies admin (evb0110)
    execSync('node dist/send-multiplatform-build.js', { 
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_ENV: 'development',
        DEBUG: 'true'
      }
    });
    
    console.log('\n✅ Real changelog test completed!');
    console.log('📱 Check your Telegram for the new semantic changelog format');
    console.log('📊 This used the actual git commit parsing and library mappings');
    
    // Restore original directory
    process.chdir(currentDir);
    
  } catch (error) {
    console.error('❌ Error testing real changelog:', error);
    console.error('\nNote: Make sure TELEGRAM_BOT_TOKEN is set in your environment');
    process.exit(1);
  }
}

// Run the test
testRealChangelogForEvb0110();