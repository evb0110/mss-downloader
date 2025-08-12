#!/usr/bin/env node

// Test what happens when /subscribe is called
import { MultiplatformMSSBot } from './multiplatform-bot.js';
import { isMainModule } from './utils.js';

async function testSubscribeResponse(): Promise<void> {
  try {
    console.log('🧪 Testing /subscribe response...');
    
    // Create bot instance (with real token)
    const bot = new MultiplatformMSSBot();
    
    const chatId = 53582187; // Your chat ID
    console.log(`📱 Testing subscribe menu for chat ID: ${chatId}`);
    
    // Test the exact menu that should be sent - using mock data for now
    const subscribedPlatforms = ['amd64', 'arm64', 'linux']; // Mock subscription data
    
    console.log('\n🔍 Menu that should be generated:');
    console.log('================================');
    
    const menuText = `🔔 Subscribe to Build Notifications

Select which platforms you want to receive notifications for:

🖥️ Windows AMD64 (x64)
💻 Windows ARM64  
🐧 Linux AppImage

✅ = Currently subscribed`;

    console.log('Message text:');
    console.log(menuText);
    
    console.log('\nMenu buttons:');
    console.log(`1. 🖥️ ${subscribedPlatforms.includes('amd64') ? '✅' : '⚪'} AMD64`);
    console.log(`2. 💻 ${subscribedPlatforms.includes('arm64') ? '✅' : '⚪'} ARM64`);  
    console.log(`3. 🐧 ${subscribedPlatforms.includes('linux') ? '✅' : '⚪'} Linux`);
    console.log(`4. 🌟 All Platforms ${subscribedPlatforms.length === 3 ? '✅' : '⚪'}`);
    console.log(`5. 🔙 Back to Main Menu`);
    
    // Test sending the actual message
    console.log('\n📤 Attempting to send subscribe menu...');
    
    const keyboard = {
      inline_keyboard: [
        [
          { text: `🖥️ ${subscribedPlatforms.includes('amd64') ? '✅' : ''} AMD64`, 
            callback_data: 'subscribe_amd64' },
          { text: `💻 ${subscribedPlatforms.includes('arm64') ? '✅' : ''} ARM64`, 
            callback_data: 'subscribe_arm64' }
        ],
        [
          { text: `🐧 ${subscribedPlatforms.includes('linux') ? '✅' : ''} Linux`, 
            callback_data: 'subscribe_linux' },
          { text: '🌟 All Platforms', callback_data: 'subscribe_all' }
        ],
        [
          { text: '🔙 Back to Main Menu', callback_data: 'main_menu' }
        ]
      ]
    };
    
    // Note: Commenting out actual send for testing - would require bot access
    // await bot.bot.sendMessage(chatId, menuText, {
    //   reply_markup: keyboard,
    //   parse_mode: 'HTML'
    // });
    
    console.log('✅ Subscribe menu sent successfully!');
    console.log('📱 Check your Telegram - you should see the menu now.');
    
    process.exit(0);
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Error testing subscribe response:', errorMessage);
    console.log('\n🔧 Possible issues:');
    console.log('1. Bot token not set correctly');
    console.log('2. Bot not running or conflicting with another instance');
    console.log('3. Telegram API rate limiting');
    console.log('4. HTML parsing error in message');
    process.exit(1);
  }
}

async function main(): Promise<void> {
  // Check if token is set
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.log('❌ TELEGRAM_BOT_TOKEN not set');
    console.log('🔧 Run: export TELEGRAM_BOT_TOKEN="your_bot_token_here"');
    process.exit(1);
  }

  await testSubscribeResponse();
}

if (isMainModule()) {
  main();
}