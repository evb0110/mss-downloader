#!/usr/bin/env node

import { MultiplatformMSSBot } from './multiplatform-bot.js';
import { isMainModule } from './utils.js';

async function main(): Promise<void> {
  console.log('🚀 Starting MSS Downloader Multiplatform Bot...');
  console.log('');
  console.log('Features:');
  console.log('🖥️  Windows AMD64 (x64) support');
  console.log('💻 Windows ARM64 support');
  console.log('🐧 Linux AppImage support');
  console.log('📱 Hierarchical menu system');
  console.log('🔔 Platform-specific subscriptions');
  console.log('');

  try {
    const bot = new MultiplatformMSSBot();
    bot.start();
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n👋 Shutting down bot gracefully...');
      process.exit(0);
    });
    
    process.on('SIGTERM', () => {
      console.log('\n👋 Received SIGTERM, shutting down bot...');
      process.exit(0);
    });
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Failed to start multiplatform bot:', errorMessage);
    console.log('');
    console.log('Make sure TELEGRAM_BOT_TOKEN environment variable is set:');
    console.log('export TELEGRAM_BOT_TOKEN="your_bot_token_here"');
    console.log('bun run start-multiplatform-bot.ts');
    process.exit(1);
  }
}

if (isMainModule()) {
  main();
}