#!/usr/bin/env node

import { MultiplatformMSSBot } from './multiplatform-bot.js';

async function main(): Promise<void> {
  try {
    console.log('🤖 Starting MSS Downloader Telegram Bot (TypeScript)...');
    
    const bot = new MultiplatformMSSBot();
    bot.start();
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\\n👋 Shutting down bot gracefully...');
      process.exit(0);
    });
    
    process.on('SIGTERM', () => {
      console.log('\\n👋 Received SIGTERM, shutting down bot...');
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Failed to start bot:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}