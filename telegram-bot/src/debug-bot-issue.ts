#!/usr/bin/env node

// Debug the specific issues reported by the user
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Subscriber } from './types.js';
import { isMainModule } from './utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface Build {
  name: string;
  file: string;
  size: string;
}

async function main(): Promise<void> {
  console.log('🔍 Debugging Bot Issues');
  console.log('========================');

  // 1. Check current subscriber state
  const subscribersFile = path.join(__dirname, '..', 'subscribers.json');
  
  if (!fs.existsSync(subscribersFile)) {
    console.log('❌ subscribers.json not found!');
    return;
  }

  const subscribers: Subscriber[] = JSON.parse(fs.readFileSync(subscribersFile, 'utf8'));

  console.log('\n📋 Current Subscriber Data:');
  subscribers.forEach((sub, index) => {
    console.log(`${index + 1}. @${sub.username} (${sub.chatId})`);
    console.log(`   Platforms: [${sub.platforms ? sub.platforms.join(', ') : 'None'}]`);
    console.log(`   Expected to receive: ${sub.platforms ? sub.platforms.length : 0} separate messages`);
  });

  // 2. Simulate notification behavior
  console.log('\n🔔 Notification Simulation:');
  console.log('============================');

  const builds: Record<string, Build> = {
    'amd64': { 
      name: 'Setup-AMD64.exe', 
      file: '/path/to/amd64.exe',
      size: '45MB' 
    },
    'arm64': { 
      name: 'Setup-ARM64.exe', 
      file: '/path/to/arm64.exe', 
      size: '43MB' 
    },
    'linux': { 
      name: 'App.AppImage', 
      file: '/path/to/linux.AppImage', 
      size: '48MB' 
    }
  };

  const userSubscriber = subscribers.find(sub => sub.chatId === 53582187); // evb0110
  if (userSubscriber) {
    console.log(`\nFor user @${userSubscriber.username}:`);
    console.log(`Subscribed to: [${userSubscriber.platforms.join(', ')}]`);
    
    console.log('\nMessages that should be sent:');
    userSubscriber.platforms.forEach((platform, index) => {
      if (builds[platform]) {
        console.log(`  ${index + 1}. Platform: ${platform}`);
        console.log(`     File: ${builds[platform].name}`);
        console.log(`     Message: "🎯 Windows ARM64" (for example)`);
        console.log(`     Download link: GitHub release URL`);
        console.log('');
      }
    });
    
    console.log(`📊 Total messages expected: ${userSubscriber.platforms.length}`);
    console.log('📊 You should receive ALL 3 messages (AMD64, ARM64, Linux)');
  }

  // 3. Check multiplatform bot command handling
  console.log('\n🤖 Bot Command Analysis:');
  console.log('=========================');

  console.log('Commands that should work:');
  console.log('• /subscribe → showSubscribeMenu()');
  console.log('• /unsubscribe → showUnsubscribeMenu()'); 
  console.log('• /latest → handleLatest()');
  console.log('• /start → sendMainMenu()');

  console.log('\nMenu buttons that should work:');
  console.log('• "🔔 Subscribe" → subscribe_menu callback');
  console.log('• "🌟 All Platforms" → subscribe_all callback');
  console.log('• Individual platform buttons → subscribe_[platform] callback');

  // 4. Issues and solutions
  console.log('\n❌ Issues Identified:');
  console.log('======================');

  console.log('1. Subscribe command not working:');
  console.log('   - Check if multiplatform bot is running (not old bot)');
  console.log('   - Check TELEGRAM_BOT_TOKEN environment variable');
  console.log('   - Check bot polling/webhook conflicts');

  console.log('\n2. Only receiving one platform instead of all:');
  console.log('   - Multiplatform bot sends separate messages per platform');
  console.log('   - You should get 3 messages: AMD64, ARM64, Linux');
  console.log('   - If only getting 1, check build detection logic');

  console.log('\n🔧 Next Steps:');
  console.log('==============');
  console.log('1. Restart the multiplatform bot:');
  console.log('   export TELEGRAM_BOT_TOKEN="your_token"');
  console.log('   bun run src/start-multiplatform-bot.ts');
  console.log('');
  console.log('2. Test the /subscribe command');
  console.log('');  
  console.log('3. Send a test notification:');
  console.log('   bun run src/send-multiplatform-build.ts --message "Test notification"');
  console.log('');
  console.log('4. Check logs for any errors during notification sending');
}

if (isMainModule()) {
  main().catch((error: unknown) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Debug script error:', errorMessage);
    process.exit(1);
  });
}