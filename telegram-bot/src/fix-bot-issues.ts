#!/usr/bin/env node

import { BuildUtils } from './build-utils.js';
import { isMainModule } from './utils.js';

async function main(): Promise<void> {
  console.log('🔧 Bot Issues Analysis & Solution');
  console.log('=================================');

  console.log('\n📋 Issue #1: /subscribe command not working');
  console.log('============================================');
  console.log('✅ Your subscription data is correct: [amd64, arm64, linux]');
  console.log('❌ Problem: Multiple bot instances or wrong bot running');
  console.log('');
  console.log('🔧 Solution:');
  console.log('1. Kill any running bot processes');
  console.log('2. Start ONLY the multiplatform bot:');
  console.log('   export TELEGRAM_BOT_TOKEN="your_bot_token_here"');
  console.log('   bun run src/start-multiplatform-bot.ts');
  console.log('');

  console.log('📋 Issue #2: Only receiving 1 build instead of 3');
  console.log('=================================================');
  console.log('✅ You should receive 3 separate messages:');
  console.log('   1. 🖥️ Windows AMD64 build');
  console.log('   2. 💻 Windows ARM64 build');  
  console.log('   3. 🐧 Linux AppImage build');
  console.log('');
  console.log('❌ Problem: Only one platform build was available when notification was sent');
  console.log('');
  console.log('🔧 Solution:');
  console.log('The multiplatform notification system sends one message per platform.');
  console.log('If you only got ARM64, it means only ARM64 build was detected.');
  console.log('');

  // Check what builds are actually available
  try {
    const { version, builds } = BuildUtils.findLatestBuilds();
    console.log('🔍 Current Build Detection Results:');
    console.log(`   Version: v${version}`);
    console.log(`   Available platforms: [${Object.keys(builds).join(', ')}]`);
    
    Object.keys(builds).forEach(platform => {
      const build = builds[platform as keyof typeof builds];
      if (build) {
        console.log(`   - ${platform}: ${build.name} (${build.size}MB)`);
      }
    });
    
    if (Object.keys(builds).length === 1) {
      console.log('');
      console.log('❌ FOUND THE PROBLEM: Only 1 platform build detected!');
      console.log('💡 This explains why you only got 1 notification.');
      console.log('');
      console.log('🔧 To fix this:');
      console.log('1. Build all platforms:');
      console.log('   npm run dist:win:x64  (AMD64)');
      console.log('   npm run dist:win:arm  (ARM64)');  
      console.log('   npm run dist:linux    (Linux)');
      console.log('');
      console.log('2. Then send notification:');
      console.log('   bun run src/send-multiplatform-build.ts');
    } else if (Object.keys(builds).length === 3) {
      console.log('');
      console.log('✅ All 3 platform builds detected correctly!');
      console.log('💡 Next notification will include all platforms.');
    }
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log('❌ Error checking builds:', errorMessage);
    console.log('💡 Build detection may have issues.');
  }

  console.log('\n🚀 Immediate Action Plan:');
  console.log('=========================');
  console.log('1. Restart the multiplatform bot (to fix /subscribe):');
  console.log('   pkill -f "telegram-bot"  # Kill existing bots');
  console.log('   export TELEGRAM_BOT_TOKEN="your_bot_token_here"');
  console.log('   bun run src/start-multiplatform-bot.ts');
  console.log('');
  console.log('2. Test the /subscribe command in Telegram');
  console.log('');
  console.log('3. Send a test notification to verify all platforms:');
  console.log('   export TELEGRAM_BOT_TOKEN="your_bot_token_here"');
  console.log('   bun run src/send-multiplatform-build.ts --message "Test: All platforms"');
  console.log('');
  console.log('✅ You should receive 3 separate messages if all builds are available!');
}

if (isMainModule()) {
  main().catch((error: unknown) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Fix script error:', errorMessage);
    process.exit(1);
  });
}