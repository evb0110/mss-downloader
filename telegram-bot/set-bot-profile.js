#!/usr/bin/env node

const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');

async function setBotProfilePicture() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
        console.error('❌ TELEGRAM_BOT_TOKEN environment variable is required');
        process.exit(1);
    }
    
    const bot = new TelegramBot(token);
    const profileImagePath = path.join(__dirname, 'abba-ababus-profile.jpg');
    
    if (!fs.existsSync(profileImagePath)) {
        console.error('❌ Profile image not found:', profileImagePath);
        process.exit(1);
    }
    
    try {
        console.log('🖼️ Setting bot profile picture...');
        
        // Set the bot's profile photo using raw API call
        const FormData = require('form-data');
        const form = new FormData();
        form.append('photo', fs.createReadStream(profileImagePath));
        
        const response = await bot._request('setMyProfilePhoto', { 
            form: form 
        });
        
        console.log('✅ Bot profile picture updated successfully!');
        console.log('🖼️ Image: Abba Ababus medieval manuscript illumination');
        console.log('📝 Description: Medieval monk from manuscript, perfect for MSS Downloader bot');
        
    } catch (error) {
        console.error('❌ Error setting profile picture:', error.message);
        process.exit(1);
    }
}

setBotProfilePicture();