#!/usr/bin/env node

// Test bot menu functionality without actually running Telegram
const MultiplatformMSSBot = require('./multiplatform-bot');

class BotMenuTester {
    constructor() {
        // Create a mock bot that doesn't actually connect to Telegram
        this.platforms = {
            'amd64': { name: 'Windows AMD64 (x64)', emoji: '🖥️' },
            'arm64': { name: 'Windows ARM64', emoji: '💻' },
            'linux': { name: 'Linux AppImage', emoji: '🐧' }
        };
        
        // Load subscribers directly
        const fs = require('fs');
        const path = require('path');
        this.subscribersFile = path.join(__dirname, 'subscribers.json');
        this.subscribers = this.loadSubscribers();
    }
    
    loadSubscribers() {
        const fs = require('fs');
        try {
            if (fs.existsSync(this.subscribersFile)) {
                const data = fs.readFileSync(this.subscribersFile, 'utf8');
                const subscribers = JSON.parse(data);
                
                // Apply the same migration logic as the real bot
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
    
    // Test the subscription menu logic
    testSubscribeMenu(chatId) {
        const subscriber = this.getSubscriber(chatId);
        const subscribedPlatforms = subscriber ? subscriber.platforms || [] : [];
        
        console.log(`\n🔍 Testing Subscribe Menu for User ${chatId}:`);
        console.log(`   Current subscriptions: ${subscribedPlatforms.join(', ') || 'None'}`);
        
        // Simulate menu options
        const menuOptions = [
            { 
                text: `${this.platforms.amd64.emoji} ${subscribedPlatforms.includes('amd64') ? '✅' : ''} AMD64`,
                callback_data: 'subscribe_amd64',
                current: subscribedPlatforms.includes('amd64')
            },
            { 
                text: `${this.platforms.arm64.emoji} ${subscribedPlatforms.includes('arm64') ? '✅' : ''} ARM64`,
                callback_data: 'subscribe_arm64', 
                current: subscribedPlatforms.includes('arm64')
            },
            { 
                text: `${this.platforms.linux.emoji} ${subscribedPlatforms.includes('linux') ? '✅' : ''} Linux`,
                callback_data: 'subscribe_linux',
                current: subscribedPlatforms.includes('linux')
            },
            { 
                text: '🌟 All Platforms', 
                callback_data: 'subscribe_all',
                current: subscribedPlatforms.length === 3
            }
        ];
        
        console.log(`   Menu options:`);
        menuOptions.forEach((option, index) => {
            const status = option.current ? '✅ SUBSCRIBED' : '⚪ NOT SUBSCRIBED';
            console.log(`     ${index + 1}. ${option.text} (${option.callback_data}) - ${status}`);
        });
        
        return menuOptions;
    }
    
    // Test subscription logic
    testSubscribe(chatId, platform) {
        console.log(`\n🔧 Testing Subscribe: ${platform} for user ${chatId}`);
        
        let subscriber = this.getSubscriber(chatId);
        if (!subscriber) {
            console.log(`   ❌ Subscriber not found`);
            return false;
        }
        
        if (platform === 'all') {
            const oldPlatforms = [...(subscriber.platforms || [])];
            subscriber.platforms = ['amd64', 'arm64', 'linux'];
            console.log(`   ✅ Subscribed to all platforms`);
            console.log(`   📝 Changed from [${oldPlatforms.join(', ')}] to [${subscriber.platforms.join(', ')}]`);
            return true;
        } else if (this.platforms[platform]) {
            if (!subscriber.platforms.includes(platform)) {
                const oldPlatforms = [...subscriber.platforms];
                subscriber.platforms.push(platform);
                console.log(`   ✅ Added subscription to ${this.platforms[platform].name}`);
                console.log(`   📝 Changed from [${oldPlatforms.join(', ')}] to [${subscriber.platforms.join(', ')}]`);
                return true;
            } else {
                console.log(`   ℹ️ Already subscribed to ${this.platforms[platform].name}`);
                return false;
            }
        } else {
            console.log(`   ❌ Unknown platform: ${platform}`);
            return false;
        }
    }
    
    // Test unsubscribe logic
    testUnsubscribe(chatId, platform) {
        console.log(`\n🔧 Testing Unsubscribe: ${platform} for user ${chatId}`);
        
        let subscriber = this.getSubscriber(chatId);
        if (!subscriber || !subscriber.platforms || subscriber.platforms.length === 0) {
            console.log(`   ℹ️ User not subscribed to any platforms`);
            return false;
        }
        
        if (platform === 'all') {
            const oldPlatforms = [...subscriber.platforms];
            subscriber.platforms = [];
            console.log(`   ✅ Unsubscribed from all platforms`);
            console.log(`   📝 Changed from [${oldPlatforms.join(', ')}] to []`);
            return true;
        } else if (this.platforms[platform]) {
            const index = subscriber.platforms.indexOf(platform);
            if (index !== -1) {
                const oldPlatforms = [...subscriber.platforms];
                subscriber.platforms.splice(index, 1);
                console.log(`   ✅ Removed subscription to ${this.platforms[platform].name}`);
                console.log(`   📝 Changed from [${oldPlatforms.join(', ')}] to [${subscriber.platforms.join(', ')}]`);
                return true;
            } else {
                console.log(`   ℹ️ Not subscribed to ${this.platforms[platform].name}`);
                return false;
            }
        } else {
            console.log(`   ❌ Unknown platform: ${platform}`);
            return false;
        }
    }
    
    runTests() {
        console.log('🧪 Bot Menu Functionality Tests');
        console.log('================================');
        
        // Test all current subscribers
        this.subscribers.forEach(subscriber => {
            console.log(`\n👤 Testing User: @${subscriber.username} (${subscriber.chatId})`);
            
            // Test current menu state
            this.testSubscribeMenu(subscriber.chatId);
            
            // Test various subscription scenarios
            console.log(`\n📋 Testing subscription scenarios:`);
            
            // Create a copy for testing
            const originalPlatforms = [...(subscriber.platforms || [])];
            
            // Test subscribing to a new platform (if not already subscribed to all)
            if (subscriber.platforms.length < 3) {
                const availablePlatforms = ['amd64', 'arm64', 'linux'].filter(p => !subscriber.platforms.includes(p));
                if (availablePlatforms.length > 0) {
                    this.testSubscribe(subscriber.chatId, availablePlatforms[0]);
                }
            }
            
            // Test subscribing to all
            this.testSubscribe(subscriber.chatId, 'all');
            
            // Test unsubscribing from a platform
            if (subscriber.platforms.length > 0) {
                this.testUnsubscribe(subscriber.chatId, subscriber.platforms[0]);
            }
            
            // Restore original state
            subscriber.platforms = originalPlatforms;
            console.log(`   🔄 Restored original subscriptions: [${originalPlatforms.join(', ')}]`);
        });
        
        console.log('\n✅ All tests completed!');
    }
}

// Run the tests
const tester = new BotMenuTester();
tester.runTests();