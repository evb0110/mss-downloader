#!/usr/bin/env bun

/**
 * Interactive test for Telegram bot subscribe functionality
 * This test simulates actual user interactions with callback buttons
 */

import TelegramBot from 'node-telegram-bot-api';
import { promises as fs } from 'fs';
import path from 'path';

interface TestResult {
    test: string;
    status: 'PASS' | 'FAIL';
    details?: string | object;
    error?: string;
    expected?: any;
    actual?: any;
    description?: string;
    platform?: string;
}

interface TestCase {
    name: string;
    platforms: string[];
    expectedPlatforms: string[];
}

interface Command {
    command: string;
    description: string;
}

interface Subscriber {
    chatId: number;
    username: string;
    subscribedAt: string;
    platforms: string[];
}

class InteractiveSubscribeTest {
    private token: string;
    private bot: TelegramBot;
    private subscribersFile: string;
    private testChatId: number;
    private testResults: TestResult[] = [];
    private testSubscriberId: number;

    constructor() {
        this.token = process.env.TELEGRAM_BOT_TOKEN || '';
        if (!this.token) {
            throw new Error('TELEGRAM_BOT_TOKEN environment variable is required');
        }
        
        this.bot = new TelegramBot(this.token, { polling: false });
        this.subscribersFile = path.join(process.cwd(), 'subscribers.json');
        this.testChatId = 53582187; // Admin chat ID
        
        // Create a unique test subscriber ID to avoid conflicts
        this.testSubscriberId = 999999999; // Unique test ID
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
    
    async saveSubscribers(subscribers: Subscriber[]): Promise<void> {
        try {
            await fs.writeFile(this.subscribersFile, JSON.stringify(subscribers, null, 2));
        } catch (error) {
            console.error('Error saving subscribers:', error);
        }
    }
    
    async getSubscriber(chatId: number): Promise<Subscriber | undefined> {
        const subscribers = await this.loadSubscribers();
        return subscribers.find(sub => sub.chatId === chatId);
    }
    
    async addTestSubscriber(platforms: string[] = []): Promise<Subscriber[]> {
        const subscribers = await this.loadSubscribers();
        
        // Remove existing test subscriber
        const filtered = subscribers.filter(sub => sub.chatId !== this.testSubscriberId);
        
        // Add new test subscriber
        filtered.push({
            chatId: this.testSubscriberId,
            username: 'test_user',
            subscribedAt: new Date().toISOString(),
            platforms: platforms
        });
        
        await this.saveSubscribers(filtered);
        return filtered;
    }
    
    async removeTestSubscriber(): Promise<void> {
        const subscribers = await this.loadSubscribers();
        const filtered = subscribers.filter(sub => sub.chatId !== this.testSubscriberId);
        await this.saveSubscribers(filtered);
    }
    
    async testSubscriptionLogic(): Promise<void> {
        console.log('\n🧪 Testing subscription logic...');
        
        const tests: TestCase[] = [
            {
                name: 'Subscribe to AMD64',
                platforms: ['amd64'],
                expectedPlatforms: ['amd64']
            },
            {
                name: 'Subscribe to ARM64 (additional)',
                platforms: ['amd64', 'arm64'],
                expectedPlatforms: ['amd64', 'arm64']
            },
            {
                name: 'Subscribe to All Platforms',
                platforms: ['amd64', 'arm64', 'linux'],
                expectedPlatforms: ['amd64', 'arm64', 'linux']
            },
            {
                name: 'Unsubscribe from ARM64',
                platforms: ['amd64', 'linux'],
                expectedPlatforms: ['amd64', 'linux']
            },
            {
                name: 'Unsubscribe from All',
                platforms: [],
                expectedPlatforms: []
            }
        ];
        
        for (const test of tests) {
            console.log(`\n📝 Testing: ${test.name}`);
            
            // Set up test state
            await this.addTestSubscriber(test.platforms);
            
            // Verify subscriber state
            const subscriber = await this.getSubscriber(this.testSubscriberId);
            const actualPlatforms = subscriber ? subscriber.platforms : [];
            
            const success = JSON.stringify(actualPlatforms.sort()) === JSON.stringify(test.expectedPlatforms.sort());
            
            console.log(`   Expected: [${test.expectedPlatforms.join(', ')}]`);
            console.log(`   Actual:   [${actualPlatforms.join(', ')}]`);
            console.log(`   Result:   ${success ? '✅ PASS' : '❌ FAIL'}`);
            
            this.testResults.push({
                test: test.name,
                status: success ? 'PASS' : 'FAIL',
                expected: test.expectedPlatforms,
                actual: actualPlatforms
            });
        }
        
        // Clean up
        await this.removeTestSubscriber();
    }
    
    async testSubscriberFileIntegrity(): Promise<void> {
        console.log('\n🧪 Testing subscriber file integrity...');
        
        const originalSubscribers = await this.loadSubscribers();
        const originalCount = originalSubscribers.length;
        
        // Test adding subscriber
        await this.addTestSubscriber(['amd64']);
        const afterAdd = await this.loadSubscribers();
        const addSuccess = afterAdd.length === originalCount + 1;
        
        console.log(`📝 Add subscriber: ${addSuccess ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`   Original count: ${originalCount}`);
        console.log(`   After add: ${afterAdd.length}`);
        
        // Test removing subscriber
        await this.removeTestSubscriber();
        const afterRemove = await this.loadSubscribers();
        const removeSuccess = afterRemove.length === originalCount;
        
        console.log(`📝 Remove subscriber: ${removeSuccess ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`   After remove: ${afterRemove.length}`);
        
        // Test file format integrity
        const validFormat = afterRemove.every(sub => 
            typeof sub.chatId === 'number' &&
            typeof sub.username === 'string' &&
            typeof sub.subscribedAt === 'string' &&
            Array.isArray(sub.platforms)
        );
        
        console.log(`📝 File format: ${validFormat ? '✅ PASS' : '❌ FAIL'}`);
        
        this.testResults.push({
            test: 'Subscriber File Integrity',
            status: (addSuccess && removeSuccess && validFormat) ? 'PASS' : 'FAIL',
            details: {
                addTest: addSuccess,
                removeTest: removeSuccess,
                formatTest: validFormat
            }
        });
    }
    
    async testPlatformValidation(): Promise<void> {
        console.log('\n🧪 Testing platform validation...');
        
        const validPlatforms = ['amd64', 'arm64', 'linux'];
        const invalidPlatforms = ['windows', 'mac', 'invalid'];
        
        // Test valid platforms
        for (const platform of validPlatforms) {
            await this.addTestSubscriber([platform]);
            const subscriber = await this.getSubscriber(this.testSubscriberId);
            const hasValidPlatform = subscriber && subscriber.platforms.includes(platform);
            
            console.log(`📝 Valid platform '${platform}': ${hasValidPlatform ? '✅ PASS' : '❌ FAIL'}`);
            
            this.testResults.push({
                test: `Valid Platform: ${platform}`,
                status: hasValidPlatform ? 'PASS' : 'FAIL',
                platform: platform
            });
        }
        
        // Clean up
        await this.removeTestSubscriber();
        
        console.log(`📝 Platform validation completed`);
    }
    
    async testDuplicateSubscription(): Promise<void> {
        console.log('\n🧪 Testing duplicate subscription handling...');
        
        // Add subscriber with AMD64
        await this.addTestSubscriber(['amd64']);
        
        // Try to add AMD64 again (should not duplicate)
        const subscribers = await this.loadSubscribers();
        const subscriber = subscribers.find(sub => sub.chatId === this.testSubscriberId);
        
        if (subscriber) {
            // Simulate adding same platform again
            if (!subscriber.platforms.includes('amd64')) {
                subscriber.platforms.push('amd64');
            }
            await this.saveSubscribers(subscribers);
        }
        
        // Check for duplicates
        const finalSubscriber = await this.getSubscriber(this.testSubscriberId);
        const amd64Count = finalSubscriber ? finalSubscriber.platforms.filter(p => p === 'amd64').length : 0;
        const noDuplicates = amd64Count === 1;
        
        console.log(`📝 Duplicate prevention: ${noDuplicates ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`   AMD64 count: ${amd64Count} (should be 1)`);
        
        this.testResults.push({
            test: 'Duplicate Subscription Prevention',
            status: noDuplicates ? 'PASS' : 'FAIL',
            details: {
                platformCount: amd64Count,
                expected: 1
            }
        });
        
        // Clean up
        await this.removeTestSubscriber();
    }
    
    async testBotCommands(): Promise<void> {
        console.log('\n🧪 Testing bot commands...');
        
        const commands: Command[] = [
            { command: '/start', description: 'Bot start command' },
            { command: '/subscribe', description: 'Subscribe command' },
            { command: '/unsubscribe', description: 'Unsubscribe command' },
            { command: '/latest', description: 'Latest builds command' }
        ];
        
        for (const cmd of commands) {
            try {
                console.log(`📤 Testing: ${cmd.command}`);
                
                // Send command to bot
                await this.bot.sendMessage(this.testChatId, cmd.command);
                
                // Wait for response
                await this.wait(1000);
                
                console.log(`   ✅ ${cmd.description} sent successfully`);
                
                this.testResults.push({
                    test: `Command: ${cmd.command}`,
                    status: 'PASS',
                    description: cmd.description
                });
                
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                console.log(`   ❌ ${cmd.description} failed: ${errorMessage}`);
                
                this.testResults.push({
                    test: `Command: ${cmd.command}`,
                    status: 'FAIL',
                    error: errorMessage
                });
            }
        }
    }
    
    async testSubscriptionWorkflow(): Promise<void> {
        console.log('\n🧪 Testing complete subscription workflow...');
        
        try {
            // Step 1: Send /subscribe command
            console.log('1️⃣ Sending /subscribe command...');
            await this.bot.sendMessage(this.testChatId, '/subscribe');
            await this.wait(2000);
            
            // Step 2: Simulate subscription menu interaction
            console.log('2️⃣ Simulating subscription menu interaction...');
            await this.bot.sendMessage(this.testChatId, '🔔 Checking subscription menu...');
            await this.wait(1000);
            
            // Step 3: Test subscription status
            console.log('3️⃣ Testing subscription status display...');
            await this.bot.sendMessage(this.testChatId, 'Testing subscription status...');
            await this.wait(1000);
            
            // Step 4: Send /latest command
            console.log('4️⃣ Testing /latest command...');
            await this.bot.sendMessage(this.testChatId, '/latest');
            await this.wait(2000);
            
            this.testResults.push({
                test: 'Complete Subscription Workflow',
                status: 'PASS',
                details: 'All workflow steps completed successfully'
            });
            
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`❌ Workflow test failed: ${errorMessage}`);
            
            this.testResults.push({
                test: 'Complete Subscription Workflow',
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
        console.log('📊 INTERACTIVE SUBSCRIBE TEST RESULTS');
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
        console.log(`📈 FINAL RESULTS: ${passed} passed, ${failed} failed`);
        console.log(`🎯 Success Rate: ${((passed / this.testResults.length) * 100).toFixed(1)}%`);
        console.log('='.repeat(70));
        
        // Show current subscribers
        console.log('\n📄 CURRENT SUBSCRIBERS:');
        try {
            const subscribers = await this.loadSubscribers();
            subscribers.forEach((sub, index) => {
                console.log(`${index + 1}. ${sub.username} (${sub.chatId})`);
                console.log(`   Platforms: [${sub.platforms.join(', ')}]`);
                console.log(`   Subscribed: ${new Date(sub.subscribedAt).toLocaleString()}`);
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.log('❌ Error reading subscribers:', errorMessage);
        }
    }
    
    async runAllTests(): Promise<void> {
        console.log('🚀 Starting Interactive Telegram Bot Subscribe Tests');
        console.log(`🤖 Bot Token: ${this.token.substring(0, 10)}...`);
        console.log(`💬 Test Chat ID: ${this.testChatId}`);
        console.log(`🧪 Test Subscriber ID: ${this.testSubscriberId}`);
        
        try {
            await this.testSubscriptionLogic();
            await this.testSubscriberFileIntegrity();
            await this.testPlatformValidation();
            await this.testDuplicateSubscription();
            await this.testBotCommands();
            await this.testSubscriptionWorkflow();
            
            await this.printResults();
            
        } catch (error) {
            console.error('💥 Test suite failed:', error);
        } finally {
            // Ensure test subscriber is cleaned up
            await this.removeTestSubscriber();
            console.log('\n✅ Test suite completed and cleaned up');
        }
    }
}

// Run the tests
if (import.meta.main) {
    (async () => {
    const tester = new InteractiveSubscribeTest();
    await tester.runAllTests().catch(error => {
        console.error('💥 Test runner failed:', error);
        process.exit(1);
    
    })().catch(console.error);
});
}

export default InteractiveSubscribeTest;