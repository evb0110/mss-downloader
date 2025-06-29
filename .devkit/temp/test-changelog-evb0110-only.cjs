#!/usr/bin/env node

/**
 * Test script to trigger Telegram bot changelog generation for evb0110 only
 * This tests the new comprehensive changelog generation system
 */

const path = require('path');
const { MultiplatformMSSBot } = require('../../telegram-bot/src/multiplatform-bot.js');

async function testChangelogForEvb0110Only() {
  try {
    console.log('🧪 Testing Telegram bot changelog generation for evb0110 only...');
    
    // Get the bot instance
    const bot = MultiplatformMSSBot.getInstance();
    
    // Get the current package.json version to test with
    const fs = require('fs');
    const packagePath = path.join(__dirname, '..', '..', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const currentVersion = packageJson.version;
    
    console.log(`📦 Testing with current version: v${currentVersion}`);
    
    // Create a test message that would normally be sent to all subscribers
    const testMessage = [
      `🚀 <b>MSS Downloader v${currentVersion} Available!</b>`,
      '',
      '📝 <b>What\'s New:</b>',
      '✅ Improved download reliability with real-time progress tracking',
      '✅ Enhanced timeout detection and handling', 
      '✅ Better download progress tracking',
      '',
      '💻 <b>Available Platforms:</b>',
      '🖥️ Windows AMD64 (Default): 82.92MB',
      '💻 Windows ARM64: 88.87MB',
      '🐧 Linux AppImage: 85.48MB',
      '🍎 macOS (Apple Silicon): 92.36MB',
      '',
      `📅 Built: ${new Date().toLocaleString()}`,
      '',
      '📥 Download and install to get the latest features and fixes!',
      '',
      '🧪 <b>TEST MODE:</b> This message was sent only to evb0110 for testing the new changelog system.'
    ].join('\n');

    // Mock builds object (simplified for testing)
    const mockBuilds = {
      amd64: { file: '#', name: 'test-amd64.exe', size: 82.92 },
      arm64: { file: '#', name: 'test-arm64.exe', size: 88.87 },
      linux: { file: '#', name: 'test-linux.AppImage', size: 85.48 },
      mac: { file: '#', name: 'test-mac.dmg', size: 92.36 }
    };
    
    console.log('📤 Sending test message to evb0110 only (testMode: true)...');
    
    // Call notifySubscribers with testMode=true to only send to evb0110
    await bot.notifySubscribers(testMessage, mockBuilds, true);
    
    console.log('✅ Test message sent successfully!');
    console.log('📱 Check your Telegram for the new changelog format');
    
    // Clean shutdown
    await bot.shutdown();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error testing changelog:', error);
    process.exit(1);
  }
}

// Run the test
testChangelogForEvb0110Only();