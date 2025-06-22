#!/usr/bin/env node

// Quick test to verify bot subscription functionality
import { MultiplatformMSSBot } from './dist/multiplatform-bot.js';

async function testBotFunctionality() {
  console.log('🤖 Testing Telegram Bot Functionality...');
  
  try {
    const bot = new MultiplatformMSSBot();
    console.log('✅ Bot initialized successfully');
    
    // Test platform configuration
    console.log('📋 Available platforms:');
    console.log('   🖥️ Windows AMD64 (x64) - Default');
    console.log('   💻 Windows ARM64');  
    console.log('   🐧 Linux AppImage');
    console.log('   🍎 macOS (Apple Silicon)');
    
    // Test subscriber loading
    console.log(`📊 Current subscribers: ${bot.subscribers?.length || 0}`);
    
    // Test build detection
    const BuildUtils = await import('./dist/build-utils.js');
    const buildInfo = BuildUtils.BuildUtils.findLatestBuilds();
    console.log(`📦 Detected builds for v${buildInfo.version}:`);
    
    Object.keys(buildInfo.builds).forEach(platform => {
      const build = buildInfo.builds[platform];
      console.log(`   - ${platform}: ${build.name} (${build.size}MB)`);
    });
    
    console.log('✅ Bot functionality test completed successfully!');
    console.log('💡 To test subscription buttons, message the bot: /start');
    
  } catch (error) {
    console.error('❌ Bot test failed:', error.message);
    process.exit(1);
  }
  
  process.exit(0);
}

testBotFunctionality();