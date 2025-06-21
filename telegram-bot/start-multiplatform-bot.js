#!/usr/bin/env node

const MultiplatformMSSBot = require('./multiplatform-bot');

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
} catch (error) {
    console.error('❌ Failed to start multiplatform bot:', error.message);
    console.log('');
    console.log('Make sure TELEGRAM_BOT_TOKEN environment variable is set:');
    console.log('export TELEGRAM_BOT_TOKEN="your_bot_token_here"');
    console.log('node start-multiplatform-bot.js');
    process.exit(1);
}