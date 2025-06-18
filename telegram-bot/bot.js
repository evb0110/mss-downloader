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
                return JSON.parse(data);
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
        const isSubscribed = this.subscribers.find(sub => sub.chatId === chatId);
        
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
            reply_markup: keyboard
        });
    }
    
    handleSubscribe(chatId, user) {
        const username = user.username || user.first_name || 'Unknown';
        
        if (!this.subscribers.find(sub => sub.chatId === chatId)) {
            this.subscribers.push({
                chatId,
                username,
                subscribedAt: new Date().toISOString()
            });
            this.saveSubscribers();
            
            this.bot.sendMessage(chatId, '✅ Successfully subscribed to build notifications!');
            this.sendMainMenu(chatId, 'What would you like to do next?');
        } else {
            this.bot.sendMessage(chatId, 'ℹ️ You are already subscribed to notifications.');
            this.sendMainMenu(chatId, 'What would you like to do next?');
        }
    }
    
    handleUnsubscribe(chatId) {
        const index = this.subscribers.findIndex(sub => sub.chatId === chatId);
        
        if (index !== -1) {
            this.subscribers.splice(index, 1);
            this.saveSubscribers();
            
            this.bot.sendMessage(chatId, '✅ Successfully unsubscribed from notifications.');
            this.sendMainMenu(chatId, 'What would you like to do next?');
        } else {
            this.bot.sendMessage(chatId, 'ℹ️ You are not currently subscribed.');
            this.sendMainMenu(chatId, 'What would you like to do next?');
        }
    }
    
    handleLatest(chatId) {
        try {
            const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
            const version = packageJson.version;
            
            const distPath = path.join(__dirname, '..', 'dist');
            const releasePath = path.join(__dirname, '..', 'release');
            
            // Check both dist and release folders for Windows builds
            let buildFile = null;
            let buildFileName = null;
            
            for (const folder of [releasePath, distPath]) {
                if (fs.existsSync(folder)) {
                    const files = fs.readdirSync(folder);
                    const windowsBuilds = files.filter(file => 
                        file.includes('win') && 
                        (file.endsWith('.exe') || file.endsWith('.zip') || file.endsWith('.msi'))
                    );
                    
                    if (windowsBuilds.length > 0) {
                        buildFile = path.join(folder, windowsBuilds[0]);
                        buildFileName = windowsBuilds[0];
                        break;
                    }
                }
            }
            
            const subscriber = this.subscribers.find(sub => sub.chatId === chatId);
            
            if (buildFile && fs.existsSync(buildFile)) {
                const stats = fs.statSync(buildFile);
                const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
                const buildDate = stats.mtime.toLocaleDateString();
                
                const message = `📦 Latest Build: v${version}
💻 Platform: Windows AMD64
📁 File: ${buildFileName}
📊 Size: ${fileSizeMB} MB
📅 Built: ${buildDate}

${subscriber ? 'Sending build file...' : 'Subscribe to get automatic notifications of new builds!'}`;
                
                // Use file handler to prepare file for delivery
                this.bot.sendMessage(chatId, message)
                    .then(async () => {
                        try {
                            const fileResult = await this.fileHandler.prepareFileForTelegram(buildFile);
                            await this.sendFileToSubscriber(chatId, '', fileResult);
                            this.sendMainMenu(chatId, 'Anything else?');
                        } catch (error) {
                            console.error('Error sending latest build:', error);
                            this.bot.sendMessage(chatId, '❌ Error preparing build file for delivery.');
                            this.sendMainMenu(chatId, 'Try again or subscribe for notifications:');
                        } finally {
                            this.fileHandler.cleanup();
                        }
                    })
                    .catch(error => {
                        console.error('Error sending latest build message:', error);
                        this.bot.sendMessage(chatId, '❌ Error sending build information.');
                        this.sendMainMenu(chatId, 'Try again:');
                    });
            } else {
                this.bot.sendMessage(chatId, 
                    `📦 Latest version: v${version}\n\n❌ No build file found. Run 'npm run dist:win' to create Windows build.\n\n${subscriber ? 'You\'ll be notified of new builds!' : 'Subscribe to get notified about new builds!'}`
                );
                this.sendMainMenu(chatId, 'What would you like to do?');
            }
        } catch (error) {
            console.error('Error in handleLatest:', error);
            this.bot.sendMessage(chatId, '❌ Could not retrieve latest build information.');
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
                    await this.bot.sendMessage(subscriber.chatId, message);
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
            
            await this.bot.sendMessage(chatId, combinedMessage);
            return;
        }
        
        // Handle cloud upload (temporary)
        if (fileResult.type === 'cloud') {
            if (message) {
                await this.bot.sendMessage(chatId, message);
            }
            await this.bot.sendMessage(chatId, fileResult.instructions);
            return;
        }
        
        // Handle other types with instructions
        if (fileResult.instructions) {
            fullMessage += `\n\n${fileResult.instructions}`;
        }
        
        // Add type-specific info
        if (fileResult.type === 'compressed_exe') {
            fullMessage += `\n\n🎯 **Single Working EXE File**`;
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
        await this.bot.sendMessage(chatId, fullMessage);
        
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