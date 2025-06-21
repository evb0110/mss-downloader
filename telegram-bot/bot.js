// ⚠️ DEPRECATED: This bot only supports AMD64 builds
// Use multiplatform-bot.js for full platform support

const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');
const TelegramFileHandler = require('./file-handler');

class MSSTelegramBot {
    constructor() {
        this.token = process.env.TELEGRAM_BOT_TOKEN;
        if (!this.token) {
            throw new Error('TELEGRAM_BOT_TOKEN environment variable is required');
        }
        
        this.bot = new TelegramBot(this.token, { 
            polling: {
                interval: 300,
                autoStart: true,
                params: {
                    timeout: 10
                }
            }
        });
        this.subscribersFile = path.join(__dirname, 'subscribers.json');
        this.subscribers = this.loadSubscribers();
        this.fileHandler = new TelegramFileHandler();
        
        this.setupCommands();
        this.setupMenu();
    }
    
    loadSubscribers() {
        try {
            if (fs.existsSync(this.subscribersFile)) {
                const data = fs.readFileSync(this.subscribersFile, 'utf8');
                const subscribers = JSON.parse(data);
                
                // Migrate old format to new format for compatibility
                return subscribers.map(sub => {
                    if (!sub.platforms) {
                        sub.platforms = ['amd64']; // Default to AMD64 for backward compatibility
                    }
                    return sub;
                });
            }
        } catch (error) {
            console.error('Error loading subscribers:', error);
        }
        return [];
    }
    
    getSubscriber(chatId) {
        return this.subscribers.find(sub => sub.chatId === chatId);
    }
    
    saveSubscribers() {
        try {
            fs.writeFileSync(this.subscribersFile, JSON.stringify(this.subscribers, null, 2));
        } catch (error) {
            console.error('Error saving subscribers:', error);
        }
    }
    
    setupCommands() {
        this.bot.onText(/\/start/, (msg) => {
            const chatId = msg.chat.id;
            const welcomeMessage = `🤖 Welcome to MSS Downloader Build Bot!

This bot sends notifications when new Windows AMD64 builds are available.

Use the menu buttons below to interact with the bot:`;
            
            this.sendMainMenu(chatId, welcomeMessage);
        });
        
        this.bot.onText(/\/subscribe/, (msg) => {
            this.handleSubscribe(msg.chat.id, msg.from);
        });
        
        this.bot.onText(/\/unsubscribe/, (msg) => {
            this.handleUnsubscribe(msg.chat.id);
        });
        
        
        this.bot.onText(/\/latest/, (msg) => {
            this.handleLatest(msg.chat.id);
        });
        
        this.bot.on('message', (msg) => {
            if (msg.text && !msg.text.startsWith('/')) {
                const chatId = msg.chat.id;
                this.sendMainMenu(chatId, 'Choose an option:');
            }
        });
        
        this.bot.on('callback_query', (callbackQuery) => {
            const message = callbackQuery.message;
            const data = callbackQuery.data;
            const chatId = message.chat.id;
            
            this.bot.answerCallbackQuery(callbackQuery.id);
            
            switch (data) {
                case 'subscribe':
                    this.handleSubscribe(chatId, callbackQuery.from);
                    break;
                case 'unsubscribe':
                    this.handleUnsubscribe(chatId);
                    break;
                case 'latest':
                    this.handleLatest(chatId);
                    break;
            }
        });
    }
    
    setupMenu() {
        this.bot.setMyCommands([
            { command: 'start', description: 'Start the bot and show main menu' },
            { command: 'subscribe', description: 'Subscribe to build notifications' },
            { command: 'unsubscribe', description: 'Unsubscribe from notifications' },
            { command: 'latest', description: 'Download latest Windows build' }
        ]).catch(error => {
            console.error('Error setting bot commands:', error);
        });
    }
    
    sendMainMenu(chatId, message) {
        const subscriber = this.getSubscriber(chatId);
        const isSubscribed = subscriber && subscriber.platforms && subscriber.platforms.length > 0;
        
        const keyboard = {
            inline_keyboard: [
                [
                    { text: isSubscribed ? '🔕 Unsubscribe' : '🔔 Subscribe', 
                      callback_data: isSubscribed ? 'unsubscribe' : 'subscribe' },
                    { text: '📥 Latest Build', callback_data: 'latest' }
                ]
            ]
        };
        
        this.bot.sendMessage(chatId, message, {
            reply_markup: keyboard,
            parse_mode: 'HTML'
        });
    }
    
    handleSubscribe(chatId, user) {
        const username = user.username || user.first_name || 'Unknown';
        let subscriber = this.getSubscriber(chatId);
        
        if (!subscriber) {
            subscriber = {
                chatId,
                username,
                subscribedAt: new Date().toISOString(),
                platforms: ['amd64'] // Default to AMD64 for old bot compatibility
            };
            this.subscribers.push(subscriber);
            this.saveSubscribers();
            
            this.bot.sendMessage(chatId, '✅ Successfully subscribed to Windows AMD64 build notifications!', { parse_mode: 'HTML' });
            this.sendMainMenu(chatId, 'What would you like to do next?');
        } else if (!subscriber.platforms || subscriber.platforms.length === 0) {
            subscriber.platforms = ['amd64'];
            this.saveSubscribers();
            
            this.bot.sendMessage(chatId, '✅ Successfully subscribed to Windows AMD64 build notifications!', { parse_mode: 'HTML' });
            this.sendMainMenu(chatId, 'What would you like to do next?');
        } else {
            this.bot.sendMessage(chatId, 'ℹ️ You are already subscribed to notifications.', { parse_mode: 'HTML' });
            this.sendMainMenu(chatId, 'What would you like to do next?');
        }
    }
    
    handleUnsubscribe(chatId) {
        let subscriber = this.getSubscriber(chatId);
        
        if (subscriber && subscriber.platforms && subscriber.platforms.length > 0) {
            subscriber.platforms = []; // Clear all platform subscriptions
            this.saveSubscribers();
            
            this.bot.sendMessage(chatId, '✅ Successfully unsubscribed from all notifications.', { parse_mode: 'HTML' });
            this.sendMainMenu(chatId, 'What would you like to do next?');
        } else {
            this.bot.sendMessage(chatId, 'ℹ️ You are not currently subscribed.', { parse_mode: 'HTML' });
            this.sendMainMenu(chatId, 'What would you like to do next?');
        }
    }
    
    async handleLatest(chatId) {
        try {
            // Use BuildUtils for reliable build detection
            const BuildUtils = require('./build-utils');
            const buildResult = BuildUtils.findSinglePlatformBuild('amd64');
            
            const subscriber = this.getSubscriber(chatId);
            
            if (!buildResult.buildFile) {
                this.bot.sendMessage(chatId, 
                    `📦 Latest version: v${buildResult.version}\n\n❌ No build files found. Builds may be in progress.\n\n${subscriber ? 'You\'ll be notified when new builds are available!' : 'Subscribe to get notified about new builds!'}`,
                    { parse_mode: 'HTML' }
                );
                this.sendMainMenu(chatId, 'What would you like to do?');
                return;
            }
            
            // Try to get GitHub release link first
            try {
                const GitHubReleasesManager = require('./github-releases');
                const githubManager = new GitHubReleasesManager();
                const existingRelease = await githubManager.getExistingRelease(buildResult.version);
                
                if (existingRelease) {
                    const message = `📦 <b>Latest Build: v${buildResult.version}</b>

💻 Platform: Windows AMD64
📁 File: ${existingRelease.fileName}
📊 Size: ${(existingRelease.size / 1024 / 1024).toFixed(2)} MB
📅 Built: ${new Date(existingRelease.publishedAt).toLocaleDateString()}

🔗 <b>Direct Download:</b>
${existingRelease.downloadUrl}

💡 <b>Installation Instructions:</b>
1. Click the link above to download
2. Run the installer (digitally signed and safe)
3. Follow the installer prompts

✅ <b>Permanent Link</b> - No expiration!`;

                    await this.bot.sendMessage(chatId, message, { 
                        parse_mode: 'HTML',
                        disable_web_page_preview: true 
                    });
                    this.sendMainMenu(chatId, 'Anything else?');
                    return;
                }
            } catch (error) {
                console.log('GitHub release not available, trying file delivery...');
            }
            
            // Fall back to file delivery
            const stats = fs.statSync(buildResult.buildFile);
            const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
            const buildDate = stats.mtime.toLocaleDateString();
            
            const message = `📦 Latest Build: v${buildResult.version}
💻 Platform: Windows AMD64
📁 File: ${buildResult.buildFileName}
📊 Size: ${fileSizeMB} MB
📅 Built: ${buildDate}

${subscriber ? 'Sending build file...' : 'Subscribe to get automatic notifications of new builds!'}`;
            
            // Use file handler to prepare file for delivery
            this.bot.sendMessage(chatId, message, { parse_mode: 'HTML' })
                .then(async () => {
                    try {
                        const fileResult = await this.fileHandler.prepareFileForTelegram(buildResult.buildFile);
                        await this.sendFileToSubscriber(chatId, '', fileResult);
                        this.sendMainMenu(chatId, 'Anything else?');
                    } catch (error) {
                        console.error('Error sending latest build:', error);
                        this.bot.sendMessage(chatId, '❌ Error preparing build file for delivery.', { parse_mode: 'HTML' });
                        this.sendMainMenu(chatId, 'Try again or subscribe for notifications:');
                    } finally {
                        this.fileHandler.cleanup();
                    }
                })
                .catch(error => {
                    console.error('Error sending latest build message:', error);
                    this.bot.sendMessage(chatId, '❌ Error sending build information.', { parse_mode: 'HTML' });
                    this.sendMainMenu(chatId, 'Try again:');
                });
        } catch (error) {
            console.error('Error in handleLatest:', error);
            this.bot.sendMessage(chatId, '❌ Could not retrieve latest build information.', { parse_mode: 'HTML' });
            this.sendMainMenu(chatId, 'Try again:');
        }
    }
    
    async notifySubscribers(message, file = null) {
        if (this.subscribers.length === 0) {
            console.log('No subscribers to notify');
            return;
        }
        
        console.log(`Notifying ${this.subscribers.length} subscribers...`);
        
        let fileResult = null;
        if (file && fs.existsSync(file)) {
            try {
                console.log('Preparing file for Telegram delivery...');
                fileResult = await this.fileHandler.prepareFileForTelegram(file);
                console.log(`File preparation result: ${fileResult.type}`);
            } catch (error) {
                console.error('Error preparing file:', error);
                console.log('Cannot deliver single EXE file - aborting notification');
                return;
            }
        }
        
        for (const subscriber of this.subscribers) {
            try {
                if (fileResult) {
                    await this.sendFileToSubscriber(subscriber.chatId, message, fileResult);
                } else {
                    await this.bot.sendMessage(subscriber.chatId, message, { parse_mode: 'HTML' });
                }
                
                await new Promise(resolve => setTimeout(resolve, 500)); // Longer delay for file uploads
            } catch (error) {
                console.error(`Failed to notify subscriber ${subscriber.chatId}:`, error);
                
                if (error.response && error.response.body && error.response.body.error_code === 403) {
                    console.log(`Removing blocked subscriber: ${subscriber.chatId}`);
                    this.subscribers = this.subscribers.filter(sub => sub.chatId !== subscriber.chatId);
                    this.saveSubscribers();
                }
            }
        }
        
        // Cleanup temporary files
        if (fileResult) {
            this.fileHandler.cleanup();
        }
        
        console.log('Notification complete');
    }
    
    async sendFileToSubscriber(chatId, message, fileResult) {
        let fullMessage = message;
        
        // Handle GitHub Release (best experience - permanent)
        if (fileResult.type === 'github_release') {
            // Combine the message with the download link and instructions
            const combinedMessage = message ? 
                `${message}\n\n🔗 Direct Download:\n${fileResult.downloadUrl}` :
                `🔗 Direct Download:\n${fileResult.downloadUrl}`;
            
            await this.bot.sendMessage(chatId, combinedMessage, { parse_mode: 'HTML' });
            return;
        }
        
        // Handle cloud upload (temporary)
        if (fileResult.type === 'cloud') {
            if (message) {
                await this.bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
            }
            await this.bot.sendMessage(chatId, fileResult.instructions, { parse_mode: 'HTML' });
            return;
        }
        
        // Handle other types with instructions
        if (fileResult.instructions) {
            fullMessage += `\n\n${fileResult.instructions}`;
        }
        
        // Add type-specific info
        if (fileResult.type === 'compressed_exe') {
            fullMessage += `\n\n🎯 <b>Single Working EXE File</b>`;
            fullMessage += `\n🗜️ Compressed with ${fileResult.method}`;
            fullMessage += `\n📊 ${(fileResult.originalSize / 1024 / 1024).toFixed(2)}MB → ${(fileResult.totalSize / 1024 / 1024).toFixed(2)}MB (${fileResult.compressionRatio}% smaller)`;
        }
        
        if (fileResult.type === 'binary_split') {
            fullMessage += `\n\n📦 Original file: ${fileResult.originalFile}`;
            fullMessage += `\n📊 Total size: ${(fileResult.totalSize / 1024 / 1024).toFixed(2)}MB`;
            fullMessage += `\n🔧 Files to download: ${fileResult.files.length}`;
        }
        
        if (fileResult.type === 'compressed') {
            const compressionRatio = ((1 - fileResult.totalSize / fileResult.originalSize) * 100).toFixed(1);
            fullMessage += `\n\n🗜️ Compressed from ${(fileResult.originalSize / 1024 / 1024).toFixed(2)}MB to ${(fileResult.totalSize / 1024 / 1024).toFixed(2)}MB (${compressionRatio}% reduction)`;
        }
        
        // Send the message first
        await this.bot.sendMessage(chatId, fullMessage, { parse_mode: 'HTML' });
        
        // Then send file(s) if they exist
        if (fileResult.files && fileResult.files.length > 0) {
            for (const fileInfo of fileResult.files) {
                if (fileResult.type === 'binary_split') {
                    const caption = fileInfo.part === 'script' 
                        ? '🔧 Combination Script' 
                        : `📦 Part ${fileInfo.part} of ${fileInfo.totalParts}`;
                    
                    await this.bot.sendDocument(chatId, fileInfo.path, {
                        caption: caption
                    });
                } else if (fileResult.type === 'split') {
                    await this.bot.sendDocument(chatId, fileInfo.path, {
                        caption: `Part ${fileInfo.part} of ${fileInfo.totalParts}`
                    });
                } else {
                    await this.bot.sendDocument(chatId, fileInfo.path);
                }
                
                // Small delay between files
                if (fileResult.files.length > 1) {
                    await new Promise(resolve => setTimeout(resolve, 300));
                }
            }
        }
    }
    
    start() {
        console.log('MSS Downloader Telegram Bot started');
        console.log(`Subscribers loaded: ${this.subscribers.length}`);
        
        this.bot.on('error', (error) => {
            console.error('Bot error:', error);
        });
        
        this.bot.on('polling_error', (error) => {
            console.error('Polling error:', error);
        });
        
        this.bot.on('message', (msg) => {
            console.log(`📨 Message from ${msg.from.username || msg.from.first_name}: ${msg.text}`);
        });
        
        console.log('🤖 Bot is running and listening for messages...');
    }
}

module.exports = MSSTelegramBot;

if (require.main === module) {
    try {
        const bot = new MSSTelegramBot();
        bot.start();
    } catch (error) {
        console.error('Failed to start bot:', error);
        process.exit(1);
    }
}