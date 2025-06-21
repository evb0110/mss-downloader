#!/usr/bin/env node

// Simple test to validate subscription logic
const fs = require('fs');
const path = require('path');

// Load the current subscribers
const subscribersFile = path.join(__dirname, '..', 'subscribers.json');
const subscribers = JSON.parse(fs.readFileSync(subscribersFile, 'utf8'));

console.log('📋 Current Subscribers:');
console.log('======================');

subscribers.forEach((sub, index) => {
    console.log(`${index + 1}. User: @${sub.username} (${sub.chatId})`);
    console.log(`   Subscribed: ${new Date(sub.subscribedAt).toLocaleString()}`);
    console.log(`   Platforms: ${sub.platforms ? sub.platforms.join(', ') : 'None'}`);
    
    if (sub.platforms) {
        console.log(`   Platform Details:`);
        if (sub.platforms.includes('amd64')) console.log(`     🖥️  Windows AMD64`);
        if (sub.platforms.includes('arm64')) console.log(`     💻 Windows ARM64`);
        if (sub.platforms.includes('linux')) console.log(`     🐧 Linux AppImage`);
    }
    console.log('');
});

// Test the notification logic
console.log('🧪 Testing notification logic:');
console.log('===============================');

const builds = {
    'amd64': { name: 'Windows-AMD64.exe', size: '45MB' },
    'arm64': { name: 'Windows-ARM64.exe', size: '43MB' },
    'linux': { name: 'Linux.AppImage', size: '48MB' }
};

subscribers.forEach(sub => {
    console.log(`\nFor user @${sub.username}:`);
    if (!sub.platforms || sub.platforms.length === 0) {
        console.log('  ❌ No subscriptions - would not receive notifications');
        return;
    }
    
    console.log(`  📨 Would receive notifications for:`);
    sub.platforms.forEach(platform => {
        if (builds[platform]) {
            console.log(`     ✅ ${platform}: ${builds[platform].name} (${builds[platform].size})`);
        } else {
            console.log(`     ❌ ${platform}: No build found`);
        }
    });
});

console.log('\n🔧 Recommendations:');
console.log('====================');

// Check for users with no platforms
const usersWithoutPlatforms = subscribers.filter(sub => !sub.platforms || sub.platforms.length === 0);
if (usersWithoutPlatforms.length > 0) {
    console.log('❌ Users without platform subscriptions:');
    usersWithoutPlatforms.forEach(sub => {
        console.log(`   - @${sub.username} (${sub.chatId})`);
    });
    console.log('   These users will not receive any notifications!');
}

// Check for platform coverage
const allPlatforms = ['amd64', 'arm64', 'linux'];
const subscribedPlatforms = new Set();
subscribers.forEach(sub => {
    if (sub.platforms) {
        sub.platforms.forEach(platform => subscribedPlatforms.add(platform));
    }
});

console.log('\n📊 Platform Coverage:');
allPlatforms.forEach(platform => {
    const hasSubscribers = subscribedPlatforms.has(platform);
    const count = subscribers.filter(sub => sub.platforms && sub.platforms.includes(platform)).length;
    console.log(`   ${platform}: ${hasSubscribers ? '✅' : '❌'} ${count} subscriber(s)`);
});