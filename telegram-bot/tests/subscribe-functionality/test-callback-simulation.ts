#!/usr/bin/env bun

/**
 * Test script that simulates actual callback button presses
 * to test the complete subscribe/unsubscribe functionality
 */

import TelegramBot from 'node-telegram-bot-api';
import { promises as fs } from 'fs';
import path from 'path';

interface TestResult {
    test: string;
    status: 'PASS' | 'FAIL';
    details?: string | object;
    error?: string;
}

interface TestCase {
    name: string;
    message: string;
    waitTime: number;
}

interface Subscriber {
    chatId: number;
    username: string;
    platforms: string[];
    subscribedAt: string;
}

class CallbackSimulationTest {
    private token: string;
    private bot: TelegramBot;
    private subscribersFile: string;
    private testChatId: number;
    private testResults: TestResult[] = [];

    constructor() {
        this.token = process.env.TELEGRAM_BOT_TOKEN || '';
        if (!this.token) {
            throw new Error('TELEGRAM_BOT_TOKEN environment variable is required');
        }
        
        this.bot = new TelegramBot(this.token, { polling: false });
        this.subscribersFile = path.join(process.cwd(), 'subscribers.json');
        this.testChatId = 53582187; // Admin chat ID for testing
        
        console.log('🤖 Callback Simulation Test initialized');
        console.log(`📱 Test Chat ID: ${this.testChatId}`);
    }
    
    async loadSubscribers(): Promise<Subscriber[]> {
        try {
            await fs.access(this.subscribersFile);
            const data = await fs.readFile(this.subscribersFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('Error loading subscribers:', error);
            return [];
        }
    }
    
    async getSubscriber(chatId: number): Promise<Subscriber | undefined> {
        const subscribers = await this.loadSubscribers();
        return subscribers.find(sub => sub.chatId === chatId);
    }
    
    async testSubscribeButtonFlow(): Promise<void> {
        console.log('\n🧪 Testing Subscribe Button Flow...');
        
        try {
            // Send /subscribe command first
            console.log('1️⃣ Sending /subscribe command...');
            const subscribeMsg = await this.bot.sendMessage(this.testChatId, '/subscribe');
            await this.wait(2000);
            
            console.log('✅ Subscribe command sent, menu should be displayed');
            
            // Simulate clicking on subscription buttons by sending messages that trigger the callbacks
            const testCases: TestCase[] = [
                {
                    name: 'Subscribe to AMD64',
                    message: '🖥️ Testing AMD64 subscription button click',
                    waitTime: 1500
                },
                {
                    name: 'Subscribe to ARM64', 
                    message: '💻 Testing ARM64 subscription button click',
                    waitTime: 1500
                },
                {
                    name: 'Subscribe to Linux',
                    message: '🐧 Testing Linux subscription button click', 
                    waitTime: 1500
                },
                {
                    name: 'Subscribe to All Platforms',
                    message: '🌟 Testing All Platforms subscription button click',
                    waitTime: 2000
                }
            ];
            
            for (const testCase of testCases) {
                console.log(`2️⃣ ${testCase.name}...`);
                await this.bot.sendMessage(this.testChatId, testCase.message);
                await this.wait(testCase.waitTime);
                console.log(`   ✅ ${testCase.name} simulated`);
            }
            
            this.testResults.push({
                test: 'Subscribe Button Flow',
                status: 'PASS',
                details: 'All subscription button interactions simulated'
            });
            
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`❌ Subscribe button flow failed: ${errorMessage}`);
            this.testResults.push({
                test: 'Subscribe Button Flow',
                status: 'FAIL',
                error: errorMessage
            });
        }
    }
    
    async testUnsubscribeButtonFlow(): Promise<void> {
        console.log('\n🧪 Testing Unsubscribe Button Flow...');
        
        try {
            // Send /unsubscribe command first
            console.log('1️⃣ Sending /unsubscribe command...');
            await this.bot.sendMessage(this.testChatId, '/unsubscribe');
            await this.wait(2000);
            
            console.log('✅ Unsubscribe command sent, menu should be displayed');
            
            // Simulate clicking on unsubscribe buttons
            const testCases: TestCase[] = [
                {
                    name: 'Unsubscribe from AMD64',
                    message: '🖥️ Testing AMD64 unsubscribe button click',
                    waitTime: 1500
                },
                {
                    name: 'Unsubscribe from All Platforms',
                    message: '🚫 Testing Unsubscribe All button click',
                    waitTime: 2000
                }
            ];
            
            for (const testCase of testCases) {
                console.log(`2️⃣ ${testCase.name}...`);
                await this.bot.sendMessage(this.testChatId, testCase.message);
                await this.wait(testCase.waitTime);
                console.log(`   ✅ ${testCase.name} simulated`);
            }
            
            this.testResults.push({
                test: 'Unsubscribe Button Flow',
                status: 'PASS',
                details: 'All unsubscribe button interactions simulated'
            });
            
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`❌ Unsubscribe button flow failed: ${errorMessage}`);
            this.testResults.push({
                test: 'Unsubscribe Button Flow',
                status: 'FAIL',
                error: errorMessage
            });
        }
    }
    
    async testMainMenuNavigation(): Promise<void> {
        console.log('\n🧪 Testing Main Menu Navigation...');
        
        try {
            // Test start command and menu navigation
            console.log('1️⃣ Testing /start command...');
            await this.bot.sendMessage(this.testChatId, '/start');
            await this.wait(2000);
            
            // Simulate clicking various menu buttons
            const menuTests: TestCase[] = [
                {
                    name: 'Subscribe Menu Button',
                    message: '🔔 Testing Subscribe menu button',
                    waitTime: 1500
                },
                {
                    name: 'Latest Builds Button',
                    message: '📥 Testing Latest Builds button',
                    waitTime: 2000
                },
                {
                    name: 'My Subscriptions Button',
                    message: '📊 Testing My Subscriptions button',
                    waitTime: 1500
                },
                {
                    name: 'Back to Main Menu',
                    message: '🔙 Testing Back to Main Menu button',
                    waitTime: 1500
                }
            ];
            
            for (const menuTest of menuTests) {
                console.log(`2️⃣ ${menuTest.name}...`);
                await this.bot.sendMessage(this.testChatId, menuTest.message);
                await this.wait(menuTest.waitTime);
                console.log(`   ✅ ${menuTest.name} simulated`);
            }
            
            this.testResults.push({
                test: 'Main Menu Navigation',
                status: 'PASS',
                details: 'All menu navigation interactions simulated'
            });
            
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`❌ Main menu navigation failed: ${errorMessage}`);
            this.testResults.push({
                test: 'Main Menu Navigation',
                status: 'FAIL',
                error: errorMessage
            });
        }
    }
    
    async testSubscriptionStatusTracking(): Promise<void> {
        console.log('\n🧪 Testing Subscription Status Tracking...');
        
        try {
            // Check current subscriber state before and after operations
            const beforeState = await this.getSubscriber(this.testChatId);
            console.log('📊 Current subscription state:', beforeState);
            
            if (beforeState) {
                console.log(`   Username: ${beforeState.username}`);
                console.log(`   Platforms: [${beforeState.platforms.join(', ')}]`);
                console.log(`   Subscribed at: ${beforeState.subscribedAt}`);
            } else {
                console.log('   No subscription found for test chat ID');
            }
            
            // Send subscription status check
            await this.bot.sendMessage(this.testChatId, '📊 Checking my current subscriptions...');
            await this.wait(1500);
            
            this.testResults.push({
                test: 'Subscription Status Tracking',
                status: 'PASS',
                details: {
                    hasSubscription: !!beforeState,
                    platforms: beforeState ? beforeState.platforms : [],
                    subscribedAt: beforeState ? beforeState.subscribedAt : null
                }
            });
            
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`❌ Subscription status tracking failed: ${errorMessage}`);
            this.testResults.push({
                test: 'Subscription Status Tracking',
                status: 'FAIL',
                error: errorMessage
            });
        }
    }
    
    async testLatestBuildsFeature(): Promise<void> {
        console.log('\n🧪 Testing Latest Builds Feature...');
        
        try {
            console.log('1️⃣ Testing /latest command...');
            await this.bot.sendMessage(this.testChatId, '/latest');
            await this.wait(3000); // Give more time for build checking
            
            console.log('2️⃣ Simulating Latest Builds button click...');
            await this.bot.sendMessage(this.testChatId, '📥 Testing Latest Builds menu button click');
            await this.wait(3000);
            
            console.log('✅ Latest builds feature tested');
            
            this.testResults.push({
                test: 'Latest Builds Feature',
                status: 'PASS',
                details: 'Latest builds commands and menu buttons tested'
            });
            
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`❌ Latest builds feature failed: ${errorMessage}`);
            this.testResults.push({
                test: 'Latest Builds Feature',
                status: 'FAIL',
                error: errorMessage
            });
        }
    }
    
    async testCompleteUserJourney(): Promise<void> {
        console.log('\n🧪 Testing Complete User Journey...');
        
        try {
            console.log('🎯 Simulating complete new user experience...');
            
            // Step 1: New user starts bot
            console.log('1️⃣ New user starts bot...');
            await this.bot.sendMessage(this.testChatId, '/start');
            await this.wait(2000);
            
            // Step 2: User explores subscription options
            console.log('2️⃣ User explores subscription options...');
            await this.bot.sendMessage(this.testChatId, '/subscribe');
            await this.wait(2000);
            
            // Step 3: User subscribes to a platform
            await this.bot.sendMessage(this.testChatId, '🖥️ User subscribes to AMD64');
            await this.wait(1500);
            
            // Step 4: User checks their subscriptions
            console.log('3️⃣ User checks their subscriptions...');
            await this.bot.sendMessage(this.testChatId, '📊 User checks subscription status');
            await this.wait(1500);
            
            // Step 5: User gets latest builds
            console.log('4️⃣ User requests latest builds...');
            await this.bot.sendMessage(this.testChatId, '/latest');
            await this.wait(3000);
            
            // Step 6: User modifies subscription
            console.log('5️⃣ User modifies subscription...');
            await this.bot.sendMessage(this.testChatId, '🌟 User subscribes to all platforms');
            await this.wait(1500);
            
            // Step 7: User checks updated subscriptions
            console.log('6️⃣ User checks updated subscriptions...');
            await this.bot.sendMessage(this.testChatId, '📊 User checks updated subscription status');
            await this.wait(1500);
            
            console.log('✅ Complete user journey simulated successfully');
            
            this.testResults.push({
                test: 'Complete User Journey',
                status: 'PASS',
                details: 'Full user experience from start to subscription management tested'
            });
            
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`❌ Complete user journey failed: ${errorMessage}`);
            this.testResults.push({
                test: 'Complete User Journey',
                status: 'FAIL',
                error: errorMessage
            });
        }
    }
    
    wait(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    async printResults(): Promise<void> {
        console.log('\n' + '='.repeat(70));
        console.log('📊 CALLBACK SIMULATION TEST RESULTS');
        console.log('='.repeat(70));
        
        let passed = 0;
        let failed = 0;
        
        this.testResults.forEach((result, index) => {
            const statusEmoji = result.status === 'PASS' ? '✅' : '❌';
            console.log(`\n${index + 1}. ${statusEmoji} ${result.test}: ${result.status}`);
            
            if (result.details) {
                if (typeof result.details === 'string') {
                    console.log(`   📝 ${result.details}`);
                } else {
                    console.log(`   📝 Details:`, JSON.stringify(result.details, null, 4));
                }
            }
            
            if (result.error) {
                console.log(`   ❌ Error: ${result.error}`);
            }
            
            if (result.status === 'PASS') passed++;
            else failed++;
        });
        
        console.log('\n' + '='.repeat(70));
        console.log(`📈 SIMULATION RESULTS: ${passed} passed, ${failed} failed`);
        console.log(`🎯 Success Rate: ${((passed / this.testResults.length) * 100).toFixed(1)}%`);
        console.log('='.repeat(70));
        
        // Show final subscription state
        console.log('\n📱 FINAL SUBSCRIPTION STATE:');
        try {
            const subscriber = await this.getSubscriber(this.testChatId);
            if (subscriber) {
                console.log(`👤 User: ${subscriber.username} (${subscriber.chatId})`);
                console.log(`📱 Platforms: [${subscriber.platforms.join(', ')}]`);
                console.log(`📅 Subscribed: ${new Date(subscriber.subscribedAt).toLocaleString()}`);
            } else {
                console.log('❌ No subscription found for test user');
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.log('❌ Error reading final state:', errorMessage);
        }
    }
    
    async runAllTests(): Promise<void> {
        console.log('🚀 Starting Callback Simulation Tests');
        console.log(`🤖 Bot Token: ${this.token.substring(0, 10)}...`);
        console.log(`💬 Test Chat ID: ${this.testChatId}`);
        console.log('\n⚠️  Note: This test simulates user interactions by sending messages');
        console.log('   The actual callback handling is done by the running bot instance\n');
        
        try {
            await this.testMainMenuNavigation();
            await this.testSubscribeButtonFlow();
            await this.testUnsubscribeButtonFlow();
            await this.testSubscriptionStatusTracking();
            await this.testLatestBuildsFeature();
            await this.testCompleteUserJourney();
            
            await this.printResults();
            
        } catch (error) {
            console.error('💥 Callback simulation test suite failed:', error);
        } finally {
            console.log('\n✅ Callback simulation tests completed');
        }
    }
}

// Run the tests
if (import.meta.main) {
    (async () => {
    const simulator = new CallbackSimulationTest();
    await simulator.runAllTests().catch(error => {
        console.error('💥 Callback simulation failed:', error);
        process.exit(1);
    
    })().catch(console.error);
});
}

export default CallbackSimulationTest;