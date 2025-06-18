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
        const releasePath = path.join(__dirname, '..', 'release');
        
        let buildFile = null;
        let buildPath = null;
        
        // Check release folder first
        if (fs.existsSync(releasePath)) {
            const files = fs.readdirSync(releasePath);
            const windowsBuilds = files.filter(file => 
                (file.includes('win') && file.includes('x64')) || 
                (file.includes('Setup') && file.includes(version)) ||
                (file.includes(version) && file.endsWith('.exe') && !file.includes('arm64'))
            ).sort((a, b) => {
                // Prefer Setup files over portable
                if (a.includes('Setup') && !b.includes('Setup')) return -1;
                if (!a.includes('Setup') && b.includes('Setup')) return 1;
                return 0;
            });
            
            if (windowsBuilds.length > 0) {
                buildFile = windowsBuilds[0];
                buildPath = releasePath;
            }
        }
        
        // Fallback to dist folder
        if (!buildFile && fs.existsSync(distPath)) {
            const files = fs.readdirSync(distPath);
            const windowsBuilds = files.filter(file => 
                file.includes('win') && 
                (file.endsWith('.exe') || file.endsWith('.zip') || file.endsWith('.msi'))
            );
            
            if (windowsBuilds.length > 0) {
                buildFile = windowsBuilds[0];
                buildPath = distPath;
            }
        }
        
        if (!buildFile) {
            console.error('❌ No Windows builds found. Run "npm run dist:win" first.');
            process.exit(1);
        }
        
        const windowsBuilds = [buildFile];
        
        console.log(`📦 Found Windows builds for v${version}:`);
        windowsBuilds.forEach(build => console.log(`  - ${build}`));
        
        const fullBuildFile = path.join(buildPath, buildFile);
        const stats = fs.statSync(fullBuildFile);
        const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
        
        const message = `
🚀 New MSS Downloader Build Available!

📦 Version: v${version}
💻 Platform: Windows AMD64
📁 File: ${buildFile}
📊 Size: ${fileSizeMB} MB
📅 Built: ${new Date().toLocaleString()}

Download and install to get the latest features and fixes!
        `.trim();
        
        const bot = new MSSTelegramBot();
        
        console.log('🤖 Sending build notification...');
        await bot.notifySubscribers(message, fullBuildFile);
        
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