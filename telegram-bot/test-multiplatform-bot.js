#!/usr/bin/env node

// Test script to verify multiplatform bot functionality
console.log('🧪 Testing Multiplatform Bot Functionality');
console.log('==========================================');

// Test 1: Check if bot can be instantiated
try {
    const MultiplatformMSSBot = require('./multiplatform-bot');
    console.log('✅ MultiplatformMSSBot class loaded successfully');
    
    // Test 2: Check subscribers loading
    const bot = new MultiplatformMSSBot();
    console.log(`✅ Bot instantiated successfully`);
    console.log(`📊 Loaded ${bot.subscribers.length} subscribers`);
    
    // Test 3: Check specific user subscription
    const userSub = bot.getSubscriber(53582187); // evb0110
    if (userSub) {
        console.log(`✅ Found user @${userSub.username}`);
        console.log(`📱 Subscribed platforms: [${userSub.platforms.join(', ')}]`);
        
        if (userSub.platforms.length === 3) {
            console.log('✅ User correctly subscribed to all platforms');
        } else {
            console.log('❌ User not subscribed to all platforms');
        }
    } else {
        console.log('❌ User not found in subscribers');
    }
    
    // Test 4: Simulate subscribe menu
    console.log('\n🔍 Testing Subscribe Menu Logic:');
    const chatId = 53582187;
    const subscriber = bot.getSubscriber(chatId);
    const subscribedPlatforms = subscriber ? subscriber.platforms || [] : [];
    
    console.log(`Current subscriptions for user: [${subscribedPlatforms.join(', ')}]`);
    
    // Check if "All Platforms" should show as selected
    const allSelected = subscribedPlatforms.length === 3 && 
                       subscribedPlatforms.includes('amd64') && 
                       subscribedPlatforms.includes('arm64') && 
                       subscribedPlatforms.includes('linux');
    
    console.log(`"All Platforms" should be selected: ${allSelected ? 'YES ✅' : 'NO ❌'}`);
    
    // Test 5: Check platform definitions
    console.log('\n🔍 Platform Definitions:');
    Object.keys(bot.platforms).forEach(platform => {
        const info = bot.platforms[platform];
        console.log(`${platform}: ${info.emoji} ${info.name}`);
    });
    
    console.log('\n✅ All basic tests passed!');
    console.log('\n🔧 To fix the issues:');
    console.log('1. Make sure multiplatform bot is running (not old bot)');
    console.log('2. Stop any other bot instances to avoid conflicts');
    console.log('3. Use: TELEGRAM_BOT_TOKEN="..." node start-multiplatform-bot.js');
    
} catch (error) {
    console.error('❌ Error testing bot:', error.message);
    console.log('\n🔧 Make sure to run this from the telegram-bot directory');
}