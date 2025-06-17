const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');

class MSSTelegramBot {
    constructor() {
        this.token = process.env.TELEGRAM_BOT_TOKEN;
        if (!this.token) {
            throw new Error('TELEGRAM_BOT_TOKEN environment variable is required');
        }
        
        this.bot = new TelegramBot(this.token, { polling: true });
        this.subscribersFile = path.join(__dirname, 'subscribers.json');
        this.subscribers = this.loadSubscribers();
        
        this.setupCommands();
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
            const welcomeMessage = `
🤖 Welcome to MSS Downloader Build Bot!

Available commands:
/subscribe - Subscribe to build notifications
/unsubscribe - Unsubscribe from notifications
/latest - Get information about the latest build
/status - Check your subscription status

This bot sends notifications when new Windows AMD64 builds are available.
            `.trim();
            
            this.bot.sendMessage(chatId, welcomeMessage);
        });
        
        this.bot.onText(/\/subscribe/, (msg) => {
            const chatId = msg.chat.id;
            const username = msg.from.username || msg.from.first_name || 'Unknown';
            
            if (!this.subscribers.find(sub => sub.chatId === chatId)) {
                this.subscribers.push({
                    chatId,
                    username,
                    subscribedAt: new Date().toISOString()
                });
                this.saveSubscribers();
                this.bot.sendMessage(chatId, '✅ Successfully subscribed to build notifications!');
            } else {
                this.bot.sendMessage(chatId, 'ℹ️ You are already subscribed to notifications.');
            }
        });
        
        this.bot.onText(/\/unsubscribe/, (msg) => {
            const chatId = msg.chat.id;
            const index = this.subscribers.findIndex(sub => sub.chatId === chatId);
            
            if (index !== -1) {
                this.subscribers.splice(index, 1);
                this.saveSubscribers();
                this.bot.sendMessage(chatId, '✅ Successfully unsubscribed from notifications.');
            } else {
                this.bot.sendMessage(chatId, 'ℹ️ You are not currently subscribed.');
            }
        });
        
        this.bot.onText(/\/status/, (msg) => {
            const chatId = msg.chat.id;
            const subscriber = this.subscribers.find(sub => sub.chatId === chatId);
            
            if (subscriber) {
                const subscribedDate = new Date(subscriber.subscribedAt).toLocaleDateString();
                this.bot.sendMessage(chatId, `✅ Subscribed since: ${subscribedDate}\n👥 Total subscribers: ${this.subscribers.length}`);
            } else {
                this.bot.sendMessage(chatId, '❌ Not subscribed. Use /subscribe to get notifications.');
            }
        });
        
        this.bot.onText(/\/latest/, (msg) => {
            const chatId = msg.chat.id;
            
            try {
                const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
                const version = packageJson.version;
                
                this.bot.sendMessage(chatId, `📦 Latest version: v${version}\n\nTo get notified about new builds, use /subscribe`);
            } catch (error) {
                this.bot.sendMessage(chatId, '❌ Could not retrieve version information.');
            }
        });
        
        this.bot.on('message', (msg) => {
            if (msg.text && !msg.text.startsWith('/')) {
                const chatId = msg.chat.id;
                this.bot.sendMessage(chatId, 'Use /start to see available commands.');
            }
        });
    }
    
    async notifySubscribers(message, file = null) {
        if (this.subscribers.length === 0) {
            console.log('No subscribers to notify');
            return;
        }
        
        console.log(`Notifying ${this.subscribers.length} subscribers...`);
        
        for (const subscriber of this.subscribers) {
            try {
                if (file && fs.existsSync(file)) {
                    const stats = fs.statSync(file);
                    const fileSizeMB = stats.size / (1024 * 1024);
                    
                    if (fileSizeMB <= 50) {
                        await this.bot.sendDocument(subscriber.chatId, file, {
                            caption: message
                        });
                    } else {
                        await this.bot.sendMessage(subscriber.chatId, 
                            `${message}\n\n⚠️ File too large for Telegram (${fileSizeMB.toFixed(2)}MB). Please download from releases page.`
                        );
                    }
                } else {
                    await this.bot.sendMessage(subscriber.chatId, message);
                }
                
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
                console.error(`Failed to notify subscriber ${subscriber.chatId}:`, error);
                
                if (error.response && error.response.body && error.response.body.error_code === 403) {
                    console.log(`Removing blocked subscriber: ${subscriber.chatId}`);
                    this.subscribers = this.subscribers.filter(sub => sub.chatId !== subscriber.chatId);
                    this.saveSubscribers();
                }
            }
        }
        
        console.log('Notification complete');
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