const TelegramBot = require('node-telegram-bot-api');
const BuildUtils = require('./build-utils');
const fs = require('fs');
const path = require('path');
const TelegramFileHandler = require('./file-handler');

class MultiplatformMSSBot {
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
        this.adminUsername = 'evb0110'; // Admin to notify about subscriptions
        
        this.platforms = {
            'amd64': { name: 'Windows AMD64 (x64)', emoji: '🖥️' },
            'arm64': { name: 'Windows ARM64', emoji: '💻' },
            'linux': { name: 'Linux AppImage', emoji: '🐧' },
            'mac': { name: 'macOS (Apple Silicon)', emoji: '🍎' }
        };
        
        this.setupCommands();
        this.setupMenu();
    }
    
    loadSubscribers() {
        try {
            if (fs.existsSync(this.subscribersFile)) {
                const data = fs.readFileSync(this.subscribersFile, 'utf8');
                const subscribers = JSON.parse(data);
                
                // Migrate old format to new format
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
    
    saveSubscribers() {
        try {
            fs.writeFileSync(this.subscribersFile, JSON.stringify(this.subscribers, null, 2));
        } catch (error) {
            console.error('Error saving subscribers:', error);
        }
    }
    
    getSubscriber(chatId) {
        return this.subscribers.find(sub => sub.chatId === chatId);
    }
    
    async notifyAdmin(message) {
        try {
            // Hardcode admin chat ID for reliability
            const adminChatId = 53582187; // evb0110's chat ID
            console.log(`Sending admin notification to chat ID: ${adminChatId}`);
            
            await this.bot.sendMessage(adminChatId, message, { parse_mode: 'HTML' });
            console.log('Admin notification sent successfully');
        } catch (error) {
            console.error('Error notifying admin:', error);
        }
    }
    
    setupCommands() {
        this.bot.onText(/\/start/, (msg) => {
            const chatId = msg.chat.id;
            const welcomeMessage = `🤖 Welcome to MSS Downloader Build Bot!

This bot sends notifications when new builds are available for multiple platforms:
${this.platforms.amd64.emoji} ${this.platforms.amd64.name}
${this.platforms.arm64.emoji} ${this.platforms.arm64.name}  
${this.platforms.linux.emoji} ${this.platforms.linux.name}

Use the menu buttons below to manage your subscriptions:`;
            
            this.sendMainMenu(chatId, welcomeMessage);
        });
        
        this.bot.onText(/\/subscribe/, (msg) => {
            this.showSubscribeMenu(msg.chat.id);
        });
        
        this.bot.onText(/\/unsubscribe/, (msg) => {
            this.showUnsubscribeMenu(msg.chat.id);
        });
        
        this.bot.onText(/\/latest/, (msg) => {
            this.handleLatest(msg.chat.id);
        });
        
        this.bot.onText(/\/test_admin/, async (msg) => {
            const chatId = msg.chat.id;
            if (chatId === 53582187) { // Only allow admin to use this command
                await this.notifyAdmin('🧪 <b>Test Notification</b>\n\nThis is a test message to verify admin notifications are working.');
                this.bot.sendMessage(chatId, 'Test notification sent!');
            }
        });
        
        this.bot.on('message', (msg) => {
            if (msg.text && !msg.text.startsWith('/')) {
                const chatId = msg.chat.id;
                this.sendMainMenu(chatId, 'Choose an option:');
            }
        });
        
        this.bot.on('callback_query', async (callbackQuery) => {
            const message = callbackQuery.message;
            const data = callbackQuery.data;
            const chatId = message.chat.id;
            
            this.bot.answerCallbackQuery(callbackQuery.id);
            await this.handleCallback(chatId, data, callbackQuery.from);
        });
    }
    
    setupMenu() {
        this.bot.setMyCommands([
            { command: 'start', description: 'Start the bot and show main menu' },
            { command: 'subscribe', description: 'Subscribe to build notifications' },
            { command: 'unsubscribe', description: 'Unsubscribe from notifications' },
            { command: 'latest', description: 'Download latest builds for all platforms' }
        ]).catch(error => {
            console.error('Error setting bot commands:', error);
        });
    }
    
    sendMainMenu(chatId, message) {
        const subscriber = this.getSubscriber(chatId);
        const hasSubscriptions = subscriber && subscriber.platforms && subscriber.platforms.length > 0;
        
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '🔔 Subscribe', callback_data: 'subscribe_menu' },
                    { text: hasSubscriptions ? '🔕 Unsubscribe' : '❌ Not Subscribed', callback_data: 'unsubscribe_menu' }
                ],
                [
                    { text: '📥 Latest Builds', callback_data: 'latest_all' },
                    { text: '📊 My Subscriptions', callback_data: 'show_subscriptions' }
                ]
            ]
        };
        
        this.bot.sendMessage(chatId, message, {
            reply_markup: keyboard,
            parse_mode: 'HTML'
        });
    }
    
    showSubscribeMenu(chatId) {
        const subscriber = this.getSubscriber(chatId);
        const subscribedPlatforms = subscriber ? subscriber.platforms || [] : [];
        
        const keyboard = {
            inline_keyboard: [
                [
                    { text: `${this.platforms.amd64.emoji} ${subscribedPlatforms.includes('amd64') ? '✅' : ''} AMD64`, 
                      callback_data: 'subscribe_amd64' },
                    { text: `${this.platforms.arm64.emoji} ${subscribedPlatforms.includes('arm64') ? '✅' : ''} ARM64`, 
                      callback_data: 'subscribe_arm64' }
                ],
                [
                    { text: `${this.platforms.linux.emoji} ${subscribedPlatforms.includes('linux') ? '✅' : ''} Linux`, 
                      callback_data: 'subscribe_linux' },
                    { text: `${this.platforms.mac.emoji} ${subscribedPlatforms.includes('mac') ? '✅' : ''} macOS`, 
                      callback_data: 'subscribe_mac' }
                ],
                [
                    { text: '🌟 All Platforms', callback_data: 'subscribe_all' }
                ],
                [
                    { text: '🔙 Back to Main Menu', callback_data: 'main_menu' }
                ]
            ]
        };
        
        this.bot.sendMessage(chatId, 
            `🔔 <b>Subscribe to Build Notifications</b>\n\nSelect which platforms you want to receive notifications for:\n\n${this.platforms.amd64.emoji} <b>${this.platforms.amd64.name}</b>\n${this.platforms.arm64.emoji} <b>${this.platforms.arm64.name}</b>\n${this.platforms.linux.emoji} <b>${this.platforms.linux.name}</b>\n${this.platforms.mac.emoji} <b>${this.platforms.mac.name}</b>\n\n✅ = Currently subscribed`, 
            {
                reply_markup: keyboard,
                parse_mode: 'HTML'
            }
        );
    }
    
    showUnsubscribeMenu(chatId) {
        const subscriber = this.getSubscriber(chatId);
        const subscribedPlatforms = subscriber ? subscriber.platforms || [] : [];
        
        if (subscribedPlatforms.length === 0) {
            this.bot.sendMessage(chatId, 'ℹ️ You are not currently subscribed to any platforms.', { parse_mode: 'HTML' });
            this.sendMainMenu(chatId, 'What would you like to do?');
            return;
        }
        
        const buttons = [];
        if (subscribedPlatforms.includes('amd64')) {
            buttons.push({ text: `${this.platforms.amd64.emoji} Unsubscribe AMD64`, callback_data: 'unsubscribe_amd64' });
        }
        if (subscribedPlatforms.includes('arm64')) {
            buttons.push({ text: `${this.platforms.arm64.emoji} Unsubscribe ARM64`, callback_data: 'unsubscribe_arm64' });
        }
        if (subscribedPlatforms.includes('linux')) {
            buttons.push({ text: `${this.platforms.linux.emoji} Unsubscribe Linux`, callback_data: 'unsubscribe_linux' });
        }
        
        const keyboard = {
            inline_keyboard: [
                ...buttons.map(btn => [btn]),
                [
                    { text: '🚫 Unsubscribe All', callback_data: 'unsubscribe_all' },
                    { text: '🔙 Back to Main Menu', callback_data: 'main_menu' }
                ]
            ]
        };
        
        this.bot.sendMessage(chatId, 
            `🔕 <b>Unsubscribe from Notifications</b>\n\nYou are currently subscribed to:\n${subscribedPlatforms.map(p => `${this.platforms[p].emoji} ${this.platforms[p].name}`).join('\n')}\n\nSelect what to unsubscribe from:`, 
            {
                reply_markup: keyboard,
                parse_mode: 'HTML'
            }
        );
    }
    
    async handleCallback(chatId, data, user) {
        if (data === 'main_menu') {
            this.sendMainMenu(chatId, 'Main Menu:');
            return;
        }
        
        if (data === 'subscribe_menu') {
            this.showSubscribeMenu(chatId);
            return;
        }
        
        if (data === 'unsubscribe_menu') {
            this.showUnsubscribeMenu(chatId);
            return;
        }
        
        if (data === 'latest_all') {
            this.handleLatest(chatId);
            return;
        }
        
        if (data === 'show_subscriptions') {
            this.showSubscriptions(chatId);
            return;
        }
        
        if (data.startsWith('subscribe_')) {
            const platform = data.replace('subscribe_', '');
            await this.handleSubscribe(chatId, user, platform);
            return;
        }
        
        if (data.startsWith('unsubscribe_')) {
            const platform = data.replace('unsubscribe_', '');
            await this.handleUnsubscribe(chatId, platform);
            return;
        }
    }
    
    async handleSubscribe(chatId, user, platform) {
        const username = user.username || user.first_name || 'Unknown';
        let subscriber = this.getSubscriber(chatId);
        
        if (!subscriber) {
            subscriber = {
                chatId,
                username,
                subscribedAt: new Date().toISOString(),
                platforms: []
            };
            this.subscribers.push(subscriber);
        }
        
        if (platform === 'all') {
            subscriber.platforms = ['amd64', 'arm64', 'linux', 'mac'];
            this.saveSubscribers();
            this.bot.sendMessage(chatId, '✅ Successfully subscribed to all platforms!', { parse_mode: 'HTML' });
            
            // Notify admin
            await this.notifyAdmin(`🔔 <b>New Subscription - All Platforms</b>\n\n👤 User: @${username}\n💬 Chat ID: ${chatId}\n📱 Platforms: All (AMD64, ARM64, Linux)\n📅 ${new Date().toLocaleString()}`);
        } else if (this.platforms[platform]) {
            if (!subscriber.platforms.includes(platform)) {
                subscriber.platforms.push(platform);
                this.saveSubscribers();
                this.bot.sendMessage(chatId, `✅ Successfully subscribed to ${this.platforms[platform].emoji} ${this.platforms[platform].name}!`, { parse_mode: 'HTML' });
                
                // Notify admin
                await this.notifyAdmin(`🔔 <b>New Subscription</b>\n\n👤 User: @${username}\n💬 Chat ID: ${chatId}\n📱 Platform: ${this.platforms[platform].emoji} ${this.platforms[platform].name}\n📅 ${new Date().toLocaleString()}`);
            } else {
                this.bot.sendMessage(chatId, `ℹ️ You are already subscribed to ${this.platforms[platform].name}.`, { parse_mode: 'HTML' });
            }
        }
        
        this.showSubscribeMenu(chatId);
    }
    
    async handleUnsubscribe(chatId, platform) {
        let subscriber = this.getSubscriber(chatId);
        
        if (!subscriber || !subscriber.platforms || subscriber.platforms.length === 0) {
            this.bot.sendMessage(chatId, 'ℹ️ You are not currently subscribed to any platforms.', { parse_mode: 'HTML' });
            this.sendMainMenu(chatId, 'What would you like to do?');
            return;
        }
        
        if (platform === 'all') {
            subscriber.platforms = [];
            this.saveSubscribers();
            this.bot.sendMessage(chatId, '✅ Successfully unsubscribed from all platforms.', { parse_mode: 'HTML' });
            
            // Notify admin
            await this.notifyAdmin(`🔕 <b>Unsubscription - All Platforms</b>\n\n👤 User: @${subscriber.username}\n💬 Chat ID: ${chatId}\n📱 Unsubscribed from: All platforms\n📅 ${new Date().toLocaleString()}`);
            
            this.sendMainMenu(chatId, 'What would you like to do next?');
        } else if (this.platforms[platform]) {
            const index = subscriber.platforms.indexOf(platform);
            if (index !== -1) {
                subscriber.platforms.splice(index, 1);
                this.saveSubscribers();
                this.bot.sendMessage(chatId, `✅ Successfully unsubscribed from ${this.platforms[platform].emoji} ${this.platforms[platform].name}.`, { parse_mode: 'HTML' });
                
                // Notify admin
                await this.notifyAdmin(`🔕 <b>Unsubscription</b>\n\n👤 User: @${subscriber.username}\n💬 Chat ID: ${chatId}\n📱 Unsubscribed from: ${this.platforms[platform].emoji} ${this.platforms[platform].name}\n📅 ${new Date().toLocaleString()}`);
            } else {
                this.bot.sendMessage(chatId, `ℹ️ You are not subscribed to ${this.platforms[platform].name}.`, { parse_mode: 'HTML' });
            }
            this.showUnsubscribeMenu(chatId);
        }
    }
    
    showSubscriptions(chatId) {
        const subscriber = this.getSubscriber(chatId);
        
        if (!subscriber || !subscriber.platforms || subscriber.platforms.length === 0) {
            this.bot.sendMessage(chatId, 'ℹ️ You are not currently subscribed to any platforms.', { parse_mode: 'HTML' });
        } else {
            const subscriptionList = subscriber.platforms.map(p => `${this.platforms[p].emoji} ${this.platforms[p].name}`).join('\n');
            this.bot.sendMessage(chatId, `📊 <b>Your Subscriptions:</b>\n\n${subscriptionList}\n\nSubscribed since: ${new Date(subscriber.subscribedAt).toLocaleDateString()}`, { parse_mode: 'HTML' });
        }
        
        this.sendMainMenu(chatId, 'What would you like to do next?');
    }
    
    findLatestBuilds() {
        // Use the new BuildUtils for reliable build detection
        return BuildUtils.findLatestBuilds();
    }
    
    async handleLatest(chatId) {
        const { version, builds } = this.findLatestBuilds();
        const subscriber = this.getSubscriber(chatId);
        
        if (Object.keys(builds).length === 0) {
            this.bot.sendMessage(chatId, 
                `📦 Latest version: v${version}\n\n❌ No build files found. Builds may be in progress.\n\n${subscriber ? 'You\'ll be notified when new builds are available!' : 'Subscribe to get notified about new builds!'}`,
                { parse_mode: 'HTML' }
            );
            this.sendMainMenu(chatId, 'What would you like to do?');
            return;
        }
        
        try {
            // Try to get existing GitHub releases for each platform
            const GitHubReleasesManager = require('./github-releases');
            const githubManager = new GitHubReleasesManager();
            
            let message = `📦 <b>Latest Builds: v${version}</b>\n\n`;
            const releaseLinks = [];
            
            for (const [platform, build] of Object.entries(builds)) {
                message += `${this.platforms[platform].emoji} <b>${this.platforms[platform].name}</b>\n`;
                message += `📁 ${build.name}\n`;
                message += `📊 Size: ${build.size} MB\n\n`;
                
                // Try to get GitHub release link
                try {
                    const existingRelease = await githubManager.getExistingRelease(version);
                    if (existingRelease) {
                        releaseLinks.push({
                            platform,
                            name: this.platforms[platform].name,
                            emoji: this.platforms[platform].emoji,
                            url: existingRelease.downloadUrl
                        });
                    }
                } catch (error) {
                    console.log(`No GitHub release found for ${platform}: ${error.message}`);
                }
            }
            
            if (releaseLinks.length > 0) {
                message += `🔗 <b>Direct Downloads:</b>\n`;
                releaseLinks.forEach(link => {
                    message += `${link.emoji} <a href="${link.url}">${link.name}</a>\n`;
                });
                message += `\n💡 Click the links above to download directly from GitHub\n`;
                message += `✅ Permanent links - no expiration!`;
                
                await this.bot.sendMessage(chatId, message, { 
                    parse_mode: 'HTML',
                    disable_web_page_preview: true 
                });
            } else {
                message += `${subscriber ? 'GitHub releases not available, trying alternative delivery...' : 'Subscribe to get automatic notifications of new builds!'}`;
                
                await this.bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
                
                // Fall back to file delivery if GitHub releases aren't available
                for (const [platform, build] of Object.entries(builds)) {
                    try {
                        const fileResult = await this.fileHandler.prepareFileForTelegram(build.file);
                        await this.sendFileToSubscriber(chatId, `${this.platforms[platform].emoji} ${this.platforms[platform].name}:`, fileResult);
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    } catch (error) {
                        console.error(`Error sending ${platform} build:`, error);
                        await this.bot.sendMessage(chatId, `❌ Error preparing ${this.platforms[platform].name} build for delivery.`, { parse_mode: 'HTML' });
                    }
                }
                
                this.fileHandler.cleanup();
            }
            
            this.sendMainMenu(chatId, 'Anything else?');
            
        } catch (error) {
            console.error('Error in handleLatest:', error);
            this.bot.sendMessage(chatId, '❌ Error retrieving latest builds.', { parse_mode: 'HTML' });
            this.sendMainMenu(chatId, 'Try again:');
        }
    }
    
    async notifySubscribers(message, builds = {}) {
        if (this.subscribers.length === 0) {
            console.log('No subscribers to notify');
            return;
        }
        
        console.log(`Notifying subscribers for platforms: ${Object.keys(builds).join(', ')}`);
        
        for (const subscriber of this.subscribers) {
            for (const platform of subscriber.platforms || []) {
                if (builds[platform]) {
                    try {
                        console.log(`Notifying ${subscriber.username} (${subscriber.chatId}) for ${platform}`);
                        
                        const platformMessage = `${message}\n\n🎯 <b>${this.platforms[platform].emoji} ${this.platforms[platform].name}</b>`;
                        
                        const fileResult = await this.fileHandler.prepareFileForTelegram(builds[platform].file);
                        await this.sendFileToSubscriber(subscriber.chatId, platformMessage, fileResult);
                        
                        await new Promise(resolve => setTimeout(resolve, 1000)); // Delay between notifications
                    } catch (error) {
                        console.error(`Failed to notify subscriber ${subscriber.chatId} for ${platform}:`, error);
                        
                        if (error.response && error.response.body && error.response.body.error_code === 403) {
                            console.log(`Removing blocked subscriber: ${subscriber.chatId}`);
                            this.subscribers = this.subscribers.filter(sub => sub.chatId !== subscriber.chatId);
                            this.saveSubscribers();
                        }
                    }
                }
            }
        }
        
        this.fileHandler.cleanup();
        console.log('Notification complete');
    }
    
    async sendFileToSubscriber(chatId, message, fileResult) {
        // Use the same file sending logic from the original bot
        let fullMessage = message;
        
        if (fileResult.type === 'github_release') {
            const combinedMessage = message ? 
                `${message}\n\n🔗 Direct Download:\n${fileResult.downloadUrl}` :
                `🔗 Direct Download:\n${fileResult.downloadUrl}`;
            
            await this.bot.sendMessage(chatId, combinedMessage, { parse_mode: 'HTML' });
            return;
        }
        
        if (fileResult.type === 'cloud') {
            if (message) {
                await this.bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
            }
            await this.bot.sendMessage(chatId, fileResult.instructions, { parse_mode: 'HTML' });
            return;
        }
        
        if (fileResult.instructions) {
            fullMessage += `\n\n${fileResult.instructions}`;
        }
        
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
        
        await this.bot.sendMessage(chatId, fullMessage, { parse_mode: 'HTML' });
        
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
                
                if (fileResult.files.length > 1) {
                    await new Promise(resolve => setTimeout(resolve, 300));
                }
            }
        }
    }
    
    start() {
        console.log('MSS Downloader Multiplatform Telegram Bot started');
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
        
        console.log('🤖 Multiplatform bot is running and listening for messages...');
    }
}

module.exports = MultiplatformMSSBot;

if (require.main === module) {
    try {
        const bot = new MultiplatformMSSBot();
        bot.start();
    } catch (error) {
        console.error('Failed to start bot:', error);
        process.exit(1);
    }
}