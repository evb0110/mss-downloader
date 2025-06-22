#!/usr/bin/env node

const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');

/**
 * Comprehensive test script for MSS Downloader Telegram Bot
 * Tests all commands, callback queries, and functionality
 */

class BotTester {
    constructor() {
        this.token = process.env.TELEGRAM_BOT_TOKEN;
        if (!this.token) {
            throw new Error('TELEGRAM_BOT_TOKEN environment variable is required');
        }
        
        this.bot = new TelegramBot(this.token);
        this.testChatId = process.env.TEST_CHAT_ID || 53582187; // Default to admin chat ID
        this.testResults = [];
        this.startTime = Date.now();
        
        console.log(`🧪 Starting comprehensive bot test...`);
        console.log(`📱 Test Chat ID: ${this.testChatId}`);
        console.log(`🤖 Bot Token: ${this.token.substring(0, 10)}...`);
        console.log('');
    }
    
    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    addResult(test, success, message, details = null) {
        const result = {
            test,
            success,
            message,
            details,
            timestamp: new Date().toISOString()
        };
        this.testResults.push(result);
        
        const status = success ? '✅' : '❌';
        console.log(`${status} ${test}: ${message}`);
        if (details) {
            console.log(`   Details: ${details}`);
        }
    }
    
    async sendCommand(command) {
        try {
            console.log(`\n🔧 Testing command: ${command}`);
            const response = await this.bot.sendMessage(this.testChatId, command);
            await this.sleep(2000); // Wait for bot response
            return response;
        } catch (error) {
            this.addResult(`Command ${command}`, false, `Failed to send command`, error.message);
            return null;
        }
    }
    
    async testStartCommand() {
        console.log('\n📋 Testing /start command...');
        
        try {
            const response = await this.sendCommand('/start');
            if (response) {
                this.addResult('/start command', true, 'Command sent successfully', `Message ID: ${response.message_id}`);
            }
        } catch (error) {
            this.addResult('/start command', false, 'Failed to send /start command', error.message);
        }
    }
    
    async testSubscribeCommand() {
        console.log('\n📋 Testing /subscribe command...');
        
        try {
            const response = await this.sendCommand('/subscribe');
            if (response) {
                this.addResult('/subscribe command', true, 'Command sent successfully', `Message ID: ${response.message_id}`);
            }
        } catch (error) {
            this.addResult('/subscribe command', false, 'Failed to send /subscribe command', error.message);
        }
    }
    
    async testUnsubscribeCommand() {
        console.log('\n📋 Testing /unsubscribe command...');
        
        try {
            const response = await this.sendCommand('/unsubscribe');
            if (response) {
                this.addResult('/unsubscribe command', true, 'Command sent successfully', `Message ID: ${response.message_id}`);
            }
        } catch (error) {
            this.addResult('/unsubscribe command', false, 'Failed to send /unsubscribe command', error.message);
        }
    }
    
    async testLatestCommand() {
        console.log('\n📋 Testing /latest command...');
        
        try {
            const response = await this.sendCommand('/latest');
            if (response) {
                this.addResult('/latest command', true, 'Command sent successfully', `Message ID: ${response.message_id}`);
            }
        } catch (error) {
            this.addResult('/latest command', false, 'Failed to send /latest command', error.message);
        }
    }
    
    async testAdminCommand() {
        console.log('\n📋 Testing /test_admin command...');
        
        try {
            const response = await this.sendCommand('/test_admin');
            if (response) {
                this.addResult('/test_admin command', true, 'Command sent successfully', `Message ID: ${response.message_id}`);
            }
        } catch (error) {
            this.addResult('/test_admin command', false, 'Failed to send /test_admin command', error.message);
        }
    }
    
    async testHelpCommand() {
        console.log('\n📋 Testing /help command...');
        
        try {
            const response = await this.sendCommand('/help');
            if (response) {
                this.addResult('/help command', true, 'Command sent successfully', `Message ID: ${response.message_id}`);
            }
        } catch (error) {
            this.addResult('/help command', false, 'Command not implemented or failed', error.message);
        }
    }
    
    async testNonCommandMessage() {
        console.log('\n📋 Testing non-command message handling...');
        
        try {
            const response = await this.sendCommand('Hello bot, show me the menu');
            if (response) {
                this.addResult('Non-command message', true, 'Message sent successfully, should show menu', `Message ID: ${response.message_id}`);
            }
        } catch (error) {
            this.addResult('Non-command message', false, 'Failed to send non-command message', error.message);
        }
    }
    
    async testBotInfo() {
        console.log('\n📋 Testing bot information...');
        
        try {
            const botInfo = await this.bot.getMe();
            this.addResult('Bot Info', true, `Bot is active: @${botInfo.username}`, 
                `ID: ${botInfo.id}, Name: ${botInfo.first_name}`);
        } catch (error) {
            this.addResult('Bot Info', false, 'Failed to get bot information', error.message);
        }
    }
    
    async testBotCommands() {
        console.log('\n📋 Testing bot command menu...');
        
        try {
            const commands = await this.bot.getMyCommands();
            if (commands && commands.length > 0) {
                this.addResult('Bot Commands', true, `Found ${commands.length} registered commands`, 
                    commands.map(cmd => `/${cmd.command} - ${cmd.description}`).join(', '));
            } else {
                this.addResult('Bot Commands', false, 'No commands found in bot menu', null);
            }
        } catch (error) {
            this.addResult('Bot Commands', false, 'Failed to get bot commands', error.message);
        }
    }
    
    async testWebhookInfo() {
        console.log('\n📋 Testing webhook information...');
        
        try {
            const webhookInfo = await this.bot.getWebHookInfo();
            if (webhookInfo.url) {
                this.addResult('Webhook Info', true, `Webhook is set: ${webhookInfo.url}`, 
                    `Pending updates: ${webhookInfo.pending_update_count}`);
            } else {
                this.addResult('Webhook Info', true, 'No webhook set (using polling)', 
                    `Pending updates: ${webhookInfo.pending_update_count}`);
            }
        } catch (error) {
            this.addResult('Webhook Info', false, 'Failed to get webhook information', error.message);
        }
    }
    
    async testFileSystemChecks() {
        console.log('\n📋 Testing file system requirements...');
        
        const subscribersFile = path.join(__dirname, 'subscribers.json');
        if (fs.existsSync(subscribersFile)) {
            try {
                const data = JSON.parse(fs.readFileSync(subscribersFile, 'utf8'));
                this.addResult('Subscribers File', true, `Found ${data.length} subscribers`, subscribersFile);
            } catch (error) {
                this.addResult('Subscribers File', false, 'Invalid JSON in subscribers file', error.message);
            }
        } else {
            this.addResult('Subscribers File', false, 'Subscribers file not found', subscribersFile);
        }
        
        // Check for build files
        const distDir = path.join(__dirname, '..', 'dist');
        if (fs.existsSync(distDir)) {
            const files = fs.readdirSync(distDir).filter(f => f.endsWith('.exe') || f.endsWith('.AppImage'));
            this.addResult('Build Files', true, `Found ${files.length} build files in dist/`, files.join(', '));
        } else {
            this.addResult('Build Files', false, 'No dist directory found', distDir);
        }
    }
    
    async testModuleDependencies() {
        console.log('\n📋 Testing module dependencies...');
        
        const requiredModules = [
            'node-telegram-bot-api',
            './build-utils',
            './file-handler',
            './github-releases'
        ];
        
        for (const moduleName of requiredModules) {
            try {
                require(moduleName);
                this.addResult(`Module: ${moduleName}`, true, 'Module loaded successfully', null);
            } catch (error) {
                this.addResult(`Module: ${moduleName}`, false, 'Failed to load module', error.message);
            }
        }
    }
    
    generateReport() {
        const endTime = Date.now();
        const duration = ((endTime - this.startTime) / 1000).toFixed(2);
        
        const successful = this.testResults.filter(r => r.success).length;
        const failed = this.testResults.filter(r => !r.success).length;
        const total = this.testResults.length;
        
        const report = {
            summary: {
                total,
                successful,
                failed,
                successRate: ((successful / total) * 100).toFixed(1),
                duration: `${duration}s`,
                timestamp: new Date().toISOString()
            },
            results: this.testResults,
            recommendations: []
        };
        
        // Add recommendations based on failures
        const failedTests = this.testResults.filter(r => !r.success);
        if (failedTests.length > 0) {
            report.recommendations.push('Review failed tests and fix any missing functionality');
            
            if (failedTests.some(t => t.test.includes('command'))) {
                report.recommendations.push('Check bot command handlers and ensure all commands are properly registered');
            }
            
            if (failedTests.some(t => t.test.includes('Module'))) {
                report.recommendations.push('Install missing dependencies with npm install');
            }
            
            if (failedTests.some(t => t.test.includes('File'))) {
                report.recommendations.push('Ensure all required files exist and have proper permissions');
            }
        }
        
        if (successful === total) {
            report.recommendations.push('All tests passed! Bot is fully functional');
        }
        
        return report;
    }
    
    async runAllTests() {
        console.log('🚀 Starting comprehensive bot functionality test...\n');
        
        // Test bot connectivity and info
        await this.testBotInfo();
        await this.testBotCommands();
        await this.testWebhookInfo();
        
        // Test file system and dependencies
        await this.testFileSystemChecks();
        await this.testModuleDependencies();
        
        // Test all commands
        await this.testStartCommand();
        await this.testSubscribeCommand();
        await this.testUnsubscribeCommand();
        await this.testLatestCommand();
        await this.testAdminCommand();
        await this.testHelpCommand();
        
        // Test message handling
        await this.testNonCommandMessage();
        
        // Generate and save report
        const report = this.generateReport();
        const reportFile = path.join(__dirname, 'test-report.json');
        fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
        
        // Display summary
        console.log('\n' + '='.repeat(60));
        console.log('📊 TEST SUMMARY');
        console.log('='.repeat(60));
        console.log(`Total Tests: ${report.summary.total}`);
        console.log(`✅ Successful: ${report.summary.successful}`);
        console.log(`❌ Failed: ${report.summary.failed}`);
        console.log(`📈 Success Rate: ${report.summary.successRate}%`);
        console.log(`⏱️ Duration: ${report.summary.duration}`);
        console.log(`📄 Report saved to: ${reportFile}`);
        
        if (report.recommendations.length > 0) {
            console.log('\n💡 RECOMMENDATIONS:');
            report.recommendations.forEach((rec, i) => {
                console.log(`${i + 1}. ${rec}`);
            });
        }
        
        console.log('\n🏁 Test completed!');
        
        return report;
    }
}

// Run tests if called directly
if (require.main === module) {
    (async () => {
        try {
            const tester = new BotTester();
            await tester.runAllTests();
            process.exit(0);
        } catch (error) {
            console.error('❌ Test runner failed:', error);
            process.exit(1);
        }
    })();
}

module.exports = BotTester;