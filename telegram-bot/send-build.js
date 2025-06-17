#!/usr/bin/env node

const MSSTelegramBot = require('./bot');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function sendBuild() {
    try {
        const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
        const version = packageJson.version;
        
        const distPath = path.join(__dirname, '..', 'dist');
        
        if (!fs.existsSync(distPath)) {
            console.error('❌ dist/ folder not found. Run "npm run dist" first.');
            process.exit(1);
        }
        
        const files = fs.readdirSync(distPath);
        const windowsBuilds = files.filter(file => 
            file.includes('win') && 
            (file.endsWith('.exe') || file.endsWith('.zip') || file.endsWith('.msi'))
        );
        
        if (windowsBuilds.length === 0) {
            console.error('❌ No Windows builds found in dist/ folder.');
            process.exit(1);
        }
        
        console.log(`📦 Found Windows builds for v${version}:`);
        windowsBuilds.forEach(build => console.log(`  - ${build}`));
        
        const buildFile = path.join(distPath, windowsBuilds[0]);
        const stats = fs.statSync(buildFile);
        const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
        
        const message = `
🚀 New MSS Downloader Build Available!

📦 Version: v${version}
💻 Platform: Windows AMD64
📁 File: ${windowsBuilds[0]}
📊 Size: ${fileSizeMB} MB
📅 Built: ${new Date().toLocaleString()}

Download and install to get the latest features and fixes!
        `.trim();
        
        const bot = new MSSTelegramBot();
        
        console.log('🤖 Sending build notification...');
        await bot.notifySubscribers(message, buildFile);
        
        console.log('✅ Build notification sent successfully!');
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Error sending build:', error);
        process.exit(1);
    }
}

function showHelp() {
    console.log(`
MSS Downloader Build Sender

Usage:
  node send-build.js                 Send latest build to subscribers
  node send-build.js --help          Show this help
  node send-build.js --message "msg" Send custom message (no file)

Prerequisites:
  - TELEGRAM_BOT_TOKEN environment variable must be set
  - Run "npm run dist" to create Windows builds
  - At least one subscriber must be registered

Examples:
  export TELEGRAM_BOT_TOKEN="your_bot_token_here"
  npm run dist
  node telegram-bot/send-build.js
    `);
}

async function sendMessage(customMessage) {
    try {
        const bot = new MSSTelegramBot();
        await bot.notifySubscribers(customMessage);
        console.log('✅ Custom message sent successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error sending message:', error);
        process.exit(1);
    }
}

const args = process.argv.slice(2);

if (args.includes('--help')) {
    showHelp();
    process.exit(0);
}

const messageIndex = args.indexOf('--message');
if (messageIndex !== -1 && args[messageIndex + 1]) {
    sendMessage(args[messageIndex + 1]);
} else {
    sendBuild();
}