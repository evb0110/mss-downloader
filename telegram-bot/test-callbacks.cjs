#!/usr/bin/env node

const TelegramBot = require('node-telegram-bot-api');

/**
 * Interactive test for testing callback queries and menu functionality
 * This script will send commands and wait for user interaction
 */

class CallbackTester {
    constructor() {
        this.token = process.env.TELEGRAM_BOT_TOKEN;
        if (!this.token) {
            throw new Error('TELEGRAM_BOT_TOKEN environment variable is required');
        }
        
        this.bot = new TelegramBot(this.token, { polling: true });
        this.testChatId = process.env.TEST_CHAT_ID || 53582187;
        this.callbacksReceived = [];
        
        console.log(`🧪 Starting callback query test...`);
        console.log(`📱 Test Chat ID: ${this.testChatId}`);
        console.log('This will monitor for callback queries from button presses...\n');
        
        this.setupCallbackMonitoring();
    }
    
    setupCallbackMonitoring() {
        this.bot.on('callback_query', (callbackQuery) => {
            const data = callbackQuery.data;
            const user = callbackQuery.from;
            const chatId = callbackQuery.message.chat.id;
            
            console.log(`🔘 Callback received: "${data}" from @${user.username || user.first_name} (Chat: ${chatId})`);
            
            this.callbacksReceived.push({
                data,
                user: user.username || user.first_name,
                chatId,
                timestamp: new Date().toISOString()
            });
        });
        
        this.bot.on('message', (msg) => {
            if (msg.chat.id === this.testChatId) {
                console.log(`📨 Message: "${msg.text}" from @${msg.from.username || msg.from.first_name}`);
            }
        });
    }
    
    async sendTestCommand(command) {
        console.log(`\n🔧 Sending: ${command}`);
        try {
            await this.bot.sendMessage(this.testChatId, command);
            console.log('✅ Command sent. Check Telegram and press buttons to test callbacks...');
        } catch (error) {
            console.error(`❌ Failed to send ${command}:`, error.message);
        }
    }
    
    async runInteractiveTest() {
        console.log('🚀 Starting interactive callback test...\n');
        
        console.log('📋 Testing menu commands - Please interact with the buttons in Telegram:');
        
        await this.sendTestCommand('/start');
        await this.sleep(3000);
        
        await this.sendTestCommand('/subscribe');
        await this.sleep(3000);
        
        await this.sendTestCommand('/unsubscribe');
        await this.sleep(3000);
        
        await this.sendTestCommand('Hello bot!');
        await this.sleep(3000);
        
        console.log('\n⏳ Monitoring for 30 seconds. Please press buttons in Telegram...');
        
        await this.sleep(30000);
        
        console.log('\n📊 CALLBACK SUMMARY:');
        console.log(`Total callbacks received: ${this.callbacksReceived.length}`);
        
        if (this.callbacksReceived.length > 0) {
            console.log('\n🔘 Callbacks received:');
            this.callbacksReceived.forEach((cb, i) => {
                console.log(`${i + 1}. "${cb.data}" from ${cb.user} at ${new Date(cb.timestamp).toLocaleTimeString()}`);
            });
        } else {
            console.log('⚠️ No callbacks received. Try pressing buttons in Telegram.');
        }
        
        console.log('\n🏁 Interactive test completed!');
        process.exit(0);
    }
    
    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Run interactive test
if (require.main === module) {
    (async () => {
        try {
            const tester = new CallbackTester();
            await tester.runInteractiveTest();
        } catch (error) {
            console.error('❌ Interactive test failed:', error);
            process.exit(1);
        }
    })();
}

module.exports = CallbackTester;