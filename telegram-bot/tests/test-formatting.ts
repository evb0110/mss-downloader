#!/usr/bin/env bun

// Test script to verify HTML formatting in Telegram messages
import MSSTelegramBot from '../src/multiplatform-bot.js';

// HTML formatting utilities (same as send-build.js)
function escapeHTML(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function bold(text: string): string {
    return `<b>${escapeHTML(text)}</b>`;
}

function formatText(text: string): string {
    return escapeHTML(text);
}

async function testFormatting(): Promise<void> {
    try {
        const testMessage = `
🚀 ${bold('MSS Downloader v1.0.77 Available!')}

📦 Version: v${formatText('1.0.77')}
💻 Platform: Windows AMD64
📁 File: ${formatText('MSS-Downloader-Setup-1.0.77.exe')}
📊 Size: 85.4 MB
📅 Built: ${formatText(new Date().toLocaleString())}

${bold('📝 What\'s New:')}
• Added Internet Culturale support for Italy's digital heritage platform
• Fixed API integration and OAI identifier handling
• Successfully tested with 10 Florence manuscript URLs

${bold('📥 Installation Instructions:')}
1. Download the file from GitHub release
2. If Windows shows SmartScreen warning:
   • Click "More info"
   • Click "Run anyway"
3. Follow the installer prompts

⚠️ SmartScreen Warning: This is normal for unsigned software. The app is safe to install.

📥 Download and install to get the latest features and fixes!
        `.trim();

        console.log('🧪 Testing HTML formatting...');
        console.log('\nMessage to send:');
        console.log('=' .repeat(50));
        console.log(testMessage);
        console.log('=' .repeat(50));

        const bot = new MSSTelegramBot();
        
        if (bot.subscribers.length === 0) {
            console.log('❌ No subscribers found. Add a subscriber first to test formatting.');
            console.log('💡 Start the bot with: bun run src/start-multiplatform-bot.ts');
            console.log('💡 Then send /start to the bot to subscribe.');
            process.exit(1);
        }

        console.log(`📤 Sending test message to ${bot.subscribers.length} subscriber(s)...`);
        
        // Send to first subscriber for testing
        const firstSubscriber = bot.subscribers[0];
        await bot.bot.sendMessage(firstSubscriber.chatId, testMessage, { parse_mode: 'HTML' });
        
        console.log('✅ Test message sent successfully!');
        console.log('📱 Check your Telegram to verify formatting:');
        console.log('   - Title should be bold: "MSS Downloader v1.0.77 Available!"');
        console.log('   - Section headers should be bold: "What\'s New:" and "Installation Instructions:"');
        console.log('   - Data should be plain text (version, file name, etc.)');
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Error testing formatting:', error);
        process.exit(1);
    }
}

if (process.argv.includes('--help')) {
    console.log(`
HTML Formatting Test for Telegram Bot

Usage:
  bun run test-formatting.ts     Test HTML formatting with sample message

Prerequisites:
  - TELEGRAM_BOT_TOKEN environment variable must be set
  - At least one subscriber must be registered

This script sends a test message to verify that HTML formatting works correctly.
    `);
    process.exit(0);
}

if (import.meta.main) {
    (async () => {
    await testFormatting();

    })().catch(console.error);
}

export { escapeHTML, bold, formatText, testFormatting };