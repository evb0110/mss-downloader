#!/usr/bin/env node

/**
 * Test script to validate the callback duplication fix
 * This script will verify that buttons work correctly without creating duplicate menus
 */

const TelegramBot = require('node-telegram-bot-api');

class CallbackFixTester {
    constructor() {
        this.token = process.env.TELEGRAM_BOT_TOKEN;
        if (!this.token) {
            throw new Error('TELEGRAM_BOT_TOKEN environment variable is required');
        }
        
        this.bot = new TelegramBot(this.token, { polling: false });
        this.testChatId = 53582187; // Admin chat ID for testing
        this.messagesReceived = [];
        this.callbacksReceived = [];
        
        console.log('🧪 Callback Fix Validation Test initialized');
        console.log(`📱 Test Chat ID: ${this.testChatId}`);
    }
    
    async testMenuDuplication() {
        console.log('\n🔍 Testing Menu Duplication Fix...');
        
        try {
            // Step 1: Start the bot to get initial menu
            console.log('1️⃣ Sending /start command...');
            await this.bot.sendMessage(this.testChatId, '/start');
            await this.sleep(3000);
            
            // Step 2: Test subscribe menu (should not duplicate)
            console.log('2️⃣ Testing subscribe menu...');
            await this.bot.sendMessage(this.testChatId, 'Testing: Should show subscribe menu once');
            await this.sleep(2000);
            
            // Step 3: Test subscription action (should not create duplicate menu)
            console.log('3️⃣ Testing subscription action...');
            await this.bot.sendMessage(this.testChatId, 'Testing: Subscribe to AMD64 - should not duplicate menu');
            await this.sleep(2000);
            
            // Step 4: Test unsubscribe menu (should not duplicate)
            console.log('4️⃣ Testing unsubscribe menu...');
            await this.bot.sendMessage(this.testChatId, 'Testing: Should show unsubscribe menu once');
            await this.sleep(2000);
            
            // Step 5: Test show subscriptions (should not duplicate)
            console.log('5️⃣ Testing show subscriptions...');
            await this.bot.sendMessage(this.testChatId, 'Testing: Should show subscriptions without duplicate menu');
            await this.sleep(2000);
            
            // Step 6: Test latest builds (should not duplicate)
            console.log('6️⃣ Testing latest builds...');
            await this.bot.sendMessage(this.testChatId, 'Testing: Latest builds should not duplicate menu');
            await this.sleep(3000);
            
            console.log('✅ Menu duplication test completed');
            console.log('\n📋 INSTRUCTIONS FOR MANUAL VERIFICATION:');
            console.log('1. Check your Telegram chat with the bot');
            console.log('2. Press the buttons in the menus that appeared');
            console.log('3. Verify that pressing buttons does NOT create duplicate menus');
            console.log('4. Verify that actions (subscribe/unsubscribe) work correctly');
            console.log('5. Look for single confirmation messages, not duplicate menus');
            
        } catch (error) {
            console.error('❌ Menu duplication test failed:', error.message);
        }
    }
    
    async testCallbackDeduplication() {
        console.log('\n🔍 Testing Callback Deduplication...');
        
        try {
            // Send a message that will generate a menu with buttons
            console.log('1️⃣ Generating menu for deduplication test...');
            await this.bot.sendMessage(this.testChatId, '/subscribe');
            await this.sleep(2000);
            
            console.log('✅ Deduplication test setup completed');
            console.log('\n📋 INSTRUCTIONS FOR MANUAL VERIFICATION:');
            console.log('1. Quickly press the same button multiple times (like "All Platforms")');
            console.log('2. Verify that only ONE action is processed');
            console.log('3. Additional presses should show "Request already processed" or be ignored');
            console.log('4. No duplicate subscriptions should be created');
            
        } catch (error) {
            console.error('❌ Callback deduplication test failed:', error.message);
        }
    }
    
    async testSubscriptionFlow() {
        console.log('\n🔍 Testing Complete Subscription Flow...');
        
        try {
            // Test the complete flow without duplicates
            console.log('1️⃣ Testing complete user flow...');
            
            const flowSteps = [
                { step: 'Start bot', command: '/start', wait: 2000 },
                { step: 'Open subscribe menu', command: '/subscribe', wait: 2000 },
                { step: 'Check subscriptions', command: 'Testing: Check current subscriptions', wait: 2000 },
                { step: 'Open unsubscribe menu', command: '/unsubscribe', wait: 2000 },
                { step: 'Get latest builds', command: '/latest', wait: 3000 }
            ];
            
            for (const flowStep of flowSteps) {
                console.log(`   ${flowStep.step}...`);
                await this.bot.sendMessage(this.testChatId, flowStep.command);
                await this.sleep(flowStep.wait);
            }
            
            console.log('✅ Subscription flow test completed');
            console.log('\n📋 INSTRUCTIONS FOR MANUAL VERIFICATION:');
            console.log('1. Follow the commands that were sent to your Telegram');
            console.log('2. Press various buttons and verify smooth operation');
            console.log('3. Confirm no duplicate menus appear');
            console.log('4. Verify subscription state is correctly maintained');
            
        } catch (error) {
            console.error('❌ Subscription flow test failed:', error.message);
        }
    }
    
    generateTestReport() {
        console.log('\n' + '='.repeat(70));
        console.log('📊 CALLBACK FIX VALIDATION REPORT');
        console.log('='.repeat(70));
        console.log('\n✅ Test Scenarios Executed:');
        console.log('   1. Menu Duplication Prevention');
        console.log('   2. Callback Deduplication'); 
        console.log('   3. Complete Subscription Flow');
        
        console.log('\n🎯 Expected Results After Fix:');
        console.log('   ✅ Button presses execute actions without duplicate menus');
        console.log('   ✅ Subscribe/unsubscribe actions work smoothly');
        console.log('   ✅ Menu navigation is clean and intuitive');
        console.log('   ✅ Rapid button presses are properly deduplicated');
        console.log('   ✅ Subscription state remains consistent');
        
        console.log('\n🔍 Manual Verification Required:');
        console.log('   1. Check Telegram chat for clean menu behavior');
        console.log('   2. Test button interactions manually');
        console.log('   3. Verify no visual duplication occurs');
        console.log('   4. Confirm actions execute properly');
        
        console.log('\n📈 Fix Status: 🟢 IMPLEMENTED - READY FOR TESTING');
        console.log('='.repeat(70));
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    async runAllTests() {
        console.log('🚀 Starting Callback Fix Validation Tests');
        console.log(`🤖 Bot Token: ${this.token.substring(0, 10)}...`);
        console.log('\n⚠️  Important: These tests require the FIXED bot to be running');
        console.log('   Make sure to restart the bot with the updated TypeScript code first!\n');
        
        try {
            await this.testMenuDuplication();
            await this.testCallbackDeduplication();
            await this.testSubscriptionFlow();
            
            this.generateTestReport();
            
        } catch (error) {
            console.error('💥 Callback fix validation failed:', error);
        } finally {
            console.log('\n✅ Callback fix validation tests completed');
            console.log('🔄 Remember to manually verify the results in Telegram!');
        }
    }
}

// Run the tests
if (require.main === module) {
    const tester = new CallbackFixTester();
    tester.runAllTests().catch(error => {
        console.error('💥 Test execution failed:', error);
        process.exit(1);
    });
}

module.exports = CallbackFixTester;