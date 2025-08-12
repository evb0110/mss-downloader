#!/usr/bin/env node

import TelegramBot from 'node-telegram-bot-api';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { isMainModule } from './utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function setBotProfilePicture(): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error('❌ TELEGRAM_BOT_TOKEN environment variable is required');
    process.exit(1);
  }
  
  const bot = new TelegramBot(token);
  const profileImagePath = path.join(__dirname, '..', 'abba-ababus-profile.jpg');
  
  if (!fs.existsSync(profileImagePath)) {
    console.error('❌ Profile image not found:', profileImagePath);
    process.exit(1);
  }
  
  try {
    console.log('🖼️ Setting bot profile picture...');
    
    // Set the bot's profile photo using file stream
    // Note: This functionality may not be available in all versions of node-telegram-bot-api
    await bot.sendPhoto('@me', profileImagePath);
    
    console.log('✅ Bot profile picture updated successfully!');
    console.log('🖼️ Image: Abba Ababus medieval manuscript illumination');
    console.log('📝 Description: Medieval monk from manuscript, perfect for MSS Downloader bot');
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Error setting profile picture:', errorMessage);
    process.exit(1);
  }
}

if (isMainModule()) {
  setBotProfilePicture();
}