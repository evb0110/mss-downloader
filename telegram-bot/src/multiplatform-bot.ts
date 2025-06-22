import TelegramBot from 'node-telegram-bot-api';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { BuildUtils } from './build-utils.js';
import type { 
  Subscriber, 
  Platform, 
  PlatformInfo, 
  BuildInfo, 
  FileResult 
} from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface TelegramFileHandler {
  prepareFileForTelegram(filePath: string): Promise<FileResult>;
  cleanup(): void;
}

class SimpleFileHandler implements TelegramFileHandler {
  async prepareFileForTelegram(filePath: string): Promise<FileResult> {
    return {
      type: 'direct',
      files: [{ path: filePath }]
    };
  }
  
  cleanup(): void {
    // Cleanup logic here
  }
}

export class MultiplatformMSSBot {
  private bot: TelegramBot;
  private token: string;
  private subscribersFile: string;
  private subscribers: Subscriber[];
  private fileHandler: TelegramFileHandler;
  private adminUsername: string;
  private platforms: Record<Platform, PlatformInfo>;

  constructor() {
    this.token = process.env.TELEGRAM_BOT_TOKEN || '';
    if (!this.token) {
      throw new Error('TELEGRAM_BOT_TOKEN environment variable is required');
    }
    
    this.bot = new TelegramBot(this.token, { 
      polling: {
        interval: 300,
        autoStart: true,
        params: {
          timeout: 10
        }
      }
    });
    
    this.subscribersFile = path.join(__dirname, '..', 'subscribers.json');
    this.subscribers = this.loadSubscribers();
    this.fileHandler = new SimpleFileHandler();
    this.adminUsername = 'evb0110';
    
    this.platforms = {
      'amd64': { name: 'Windows AMD64 (x64)', emoji: '🖥️' },
      'arm64': { name: 'Windows ARM64', emoji: '💻' },
      'linux': { name: 'Linux AppImage', emoji: '🐧' }
    };
    
    this.setupCommands();
    this.setupMenu();
  }
  
  private loadSubscribers(): Subscriber[] {
    try {
      if (fs.existsSync(this.subscribersFile)) {
        const data = fs.readFileSync(this.subscribersFile, 'utf8');
        const subscribers = JSON.parse(data) as Subscriber[];
        
        return subscribers.map(sub => {
          if (!sub.platforms) {
            sub.platforms = ['amd64'];
          }
          return sub;
        });
      }
    } catch (error) {
      console.error('Error loading subscribers:', error);
    }
    return [];
  }
  
  private saveSubscribers(): void {
    try {
      fs.writeFileSync(this.subscribersFile, JSON.stringify(this.subscribers, null, 2));
    } catch (error) {
      console.error('Error saving subscribers:', error);
    }
  }
  
  private getSubscriber(chatId: number): Subscriber | undefined {
    return this.subscribers.find(sub => sub.chatId === chatId);
  }
  
  private async notifyAdmin(message: string): Promise<void> {
    try {
      const adminChatId = 53582187;
      console.log(`Sending admin notification to chat ID: ${adminChatId}`);
      
      await this.bot.sendMessage(adminChatId, message, { parse_mode: 'HTML' });
      console.log('Admin notification sent successfully');
    } catch (error) {
      console.error('Error notifying admin:', error);
    }
  }
  
  private setupCommands(): void {
    this.bot.onText(/\/start/, (msg) => {
      const chatId = msg.chat.id;
      const welcomeMessage = [
        '🤖 Welcome to MSS Downloader Build Bot!',
        '',
        'This bot sends notifications when new builds are available for multiple platforms:',
        `${this.platforms.amd64.emoji} ${this.platforms.amd64.name}`,
        `${this.platforms.arm64.emoji} ${this.platforms.arm64.name}`,
        `${this.platforms.linux.emoji} ${this.platforms.linux.name}`,
        '',
        'Use the menu buttons below to manage your subscriptions:'
      ].join('\n');
      
      this.sendMainMenu(chatId, welcomeMessage);
    });
    
    this.bot.onText(/\/subscribe/, (msg) => {
      this.showSubscribeMenu(msg.chat.id);
    });
    
    this.bot.onText(/\/unsubscribe/, (msg) => {
      this.showUnsubscribeMenu(msg.chat.id);
    });
    
    this.bot.onText(/\/latest/, (msg) => {
      this.handleLatest(msg.chat.id);
    });
    
    this.bot.onText(/\/test_admin/, async (msg) => {
      const chatId = msg.chat.id;
      if (chatId === 53582187) {
        await this.notifyAdmin('🧪 <b>Test Notification</b>\n\nThis is a test message to verify admin notifications are working.');
        this.bot.sendMessage(chatId, 'Test notification sent!');
      }
    });
    
    this.bot.on('message', (msg) => {
      if (msg.text && !msg.text.startsWith('/')) {
        const chatId = msg.chat.id;
        this.sendMainMenu(chatId, 'Choose an option:');
      }
    });
    
    this.bot.on('callback_query', async (callbackQuery) => {
      if (!callbackQuery.message) return;
      
      const message = callbackQuery.message;
      const data = callbackQuery.data || '';
      const chatId = message.chat.id;
      
      this.bot.answerCallbackQuery(callbackQuery.id);
      await this.handleCallback(chatId, data, callbackQuery.from);
    });
  }
  
  private setupMenu(): void {
    this.bot.setMyCommands([
      { command: 'start', description: 'Start the bot and show main menu' },
      { command: 'subscribe', description: 'Subscribe to build notifications' },
      { command: 'unsubscribe', description: 'Unsubscribe from notifications' },
      { command: 'latest', description: 'Download latest builds for all platforms' }
    ]).catch(error => {
      console.error('Error setting bot commands:', error);
    });
  }
  
  private sendMainMenu(chatId: number, message: string): void {
    const subscriber = this.getSubscriber(chatId);
    const hasSubscriptions = subscriber && subscriber.platforms && subscriber.platforms.length > 0;
    
    const keyboard = {
      inline_keyboard: [
        [
          { text: '🔔 Subscribe', callback_data: 'subscribe_menu' },
          { text: hasSubscriptions ? '🔕 Unsubscribe' : '❌ Not Subscribed', callback_data: 'unsubscribe_menu' }
        ],
        [
          { text: '📥 Latest Builds', callback_data: 'latest_all' },
          { text: '📊 My Subscriptions', callback_data: 'show_subscriptions' }
        ]
      ]
    };
    
    this.bot.sendMessage(chatId, message, {
      reply_markup: keyboard,
      parse_mode: 'HTML'
    });
  }
  
  private showSubscribeMenu(chatId: number): void {
    const subscriber = this.getSubscriber(chatId);
    const subscribedPlatforms = subscriber ? subscriber.platforms || [] : [];
    
    const keyboard = {
      inline_keyboard: [
        [
          { text: `${this.platforms.amd64.emoji} ${subscribedPlatforms.includes('amd64') ? '✅' : ''} AMD64`, 
            callback_data: 'subscribe_amd64' },
          { text: `${this.platforms.arm64.emoji} ${subscribedPlatforms.includes('arm64') ? '✅' : ''} ARM64`, 
            callback_data: 'subscribe_arm64' }
        ],
        [
          { text: `${this.platforms.linux.emoji} ${subscribedPlatforms.includes('linux') ? '✅' : ''} Linux`, 
            callback_data: 'subscribe_linux' },
          { text: '🌟 All Platforms', callback_data: 'subscribe_all' }
        ],
        [
          { text: '🔙 Back to Main Menu', callback_data: 'main_menu' }
        ]
      ]
    };
    
    const messageText = [
      '🔔 <b>Subscribe to Build Notifications</b>',
      '',
      'Select which platforms you want to receive notifications for:',
      '',
      `${this.platforms.amd64.emoji} <b>${this.platforms.amd64.name}</b>`,
      `${this.platforms.arm64.emoji} <b>${this.platforms.arm64.name}</b>`,
      `${this.platforms.linux.emoji} <b>${this.platforms.linux.name}</b>`,
      '',
      '✅ = Currently subscribed'
    ].join('\n');
    
    this.bot.sendMessage(chatId, messageText, {
      reply_markup: keyboard,
      parse_mode: 'HTML'
    });
  }
  
  private showUnsubscribeMenu(chatId: number): void {
    const subscriber = this.getSubscriber(chatId);
    const subscribedPlatforms = subscriber ? subscriber.platforms || [] : [];
    
    if (subscribedPlatforms.length === 0) {
      this.bot.sendMessage(chatId, 'ℹ️ You are not currently subscribed to any platforms.', { parse_mode: 'HTML' });
      this.sendMainMenu(chatId, 'What would you like to do?');
      return;
    }
    
    const buttons = [];
    if (subscribedPlatforms.includes('amd64')) {
      buttons.push({ text: `${this.platforms.amd64.emoji} Unsubscribe AMD64`, callback_data: 'unsubscribe_amd64' });
    }
    if (subscribedPlatforms.includes('arm64')) {
      buttons.push({ text: `${this.platforms.arm64.emoji} Unsubscribe ARM64`, callback_data: 'unsubscribe_arm64' });
    }
    if (subscribedPlatforms.includes('linux')) {
      buttons.push({ text: `${this.platforms.linux.emoji} Unsubscribe Linux`, callback_data: 'unsubscribe_linux' });
    }
    
    const keyboard = {
      inline_keyboard: [
        ...buttons.map(btn => [btn]),
        [
          { text: '🚫 Unsubscribe All', callback_data: 'unsubscribe_all' },
          { text: '🔙 Back to Main Menu', callback_data: 'main_menu' }
        ]
      ]
    };
    
    const messageText = [
      '🔕 <b>Unsubscribe from Notifications</b>',
      '',
      'You are currently subscribed to:',
      ...subscribedPlatforms.map(p => `${this.platforms[p].emoji} ${this.platforms[p].name}`),
      '',
      'Select what to unsubscribe from:'
    ].join('\n');
    
    this.bot.sendMessage(chatId, messageText, {
      reply_markup: keyboard,
      parse_mode: 'HTML'
    });
  }
  
  private async handleCallback(chatId: number, data: string, user: TelegramBot.User): Promise<void> {
    if (data === 'main_menu') {
      this.sendMainMenu(chatId, 'Main Menu:');
      return;
    }
    
    if (data === 'subscribe_menu') {
      this.showSubscribeMenu(chatId);
      return;
    }
    
    if (data === 'unsubscribe_menu') {
      this.showUnsubscribeMenu(chatId);
      return;
    }
    
    if (data === 'latest_all') {
      this.handleLatest(chatId);
      return;
    }
    
    if (data === 'show_subscriptions') {
      this.showSubscriptions(chatId);
      return;
    }
    
    if (data.startsWith('subscribe_')) {
      const platform = data.replace('subscribe_', '') as Platform | 'all';
      await this.handleSubscribe(chatId, user, platform);
      return;
    }
    
    if (data.startsWith('unsubscribe_')) {
      const platform = data.replace('unsubscribe_', '') as Platform | 'all';
      await this.handleUnsubscribe(chatId, platform);
      return;
    }
  }
  
  private async handleSubscribe(chatId: number, user: TelegramBot.User, platform: Platform | 'all'): Promise<void> {
    const username = user.username || user.first_name || 'Unknown';
    let subscriber = this.getSubscriber(chatId);
    
    if (!subscriber) {
      subscriber = {
        chatId,
        username,
        subscribedAt: new Date().toISOString(),
        platforms: []
      };
      this.subscribers.push(subscriber);
    }
    
    if (platform === 'all') {
      subscriber.platforms = ['amd64', 'arm64', 'linux'];
      this.saveSubscribers();
      this.bot.sendMessage(chatId, '✅ Successfully subscribed to all platforms!', { parse_mode: 'HTML' });
      
      const adminMessage = [
        '🔔 <b>New Subscription - All Platforms</b>',
        '',
        `👤 User: @${username}`,
        `💬 Chat ID: ${chatId}`,
        '📱 Platforms: All (AMD64, ARM64, Linux)',
        `📅 ${new Date().toLocaleString()}`
      ].join('\n');
      
      await this.notifyAdmin(adminMessage);
    } else if (this.platforms[platform as Platform]) {
      const platformKey = platform as Platform;
      if (!subscriber.platforms.includes(platformKey)) {
        subscriber.platforms.push(platformKey);
        this.saveSubscribers();
        this.bot.sendMessage(chatId, `✅ Successfully subscribed to ${this.platforms[platformKey].emoji} ${this.platforms[platformKey].name}!`, { parse_mode: 'HTML' });
        
        const adminMessage = [
          '🔔 <b>New Subscription</b>',
          '',
          `👤 User: @${username}`,
          `💬 Chat ID: ${chatId}`,
          `📱 Platform: ${this.platforms[platformKey].emoji} ${this.platforms[platformKey].name}`,
          `📅 ${new Date().toLocaleString()}`
        ].join('\n');
        
        await this.notifyAdmin(adminMessage);
      } else {
        this.bot.sendMessage(chatId, `ℹ️ You are already subscribed to ${this.platforms[platformKey].name}.`, { parse_mode: 'HTML' });
      }
    }
    
    this.showSubscribeMenu(chatId);
  }
  
  private async handleUnsubscribe(chatId: number, platform: Platform | 'all'): Promise<void> {
    const subscriber = this.getSubscriber(chatId);
    
    if (!subscriber || !subscriber.platforms || subscriber.platforms.length === 0) {
      this.bot.sendMessage(chatId, 'ℹ️ You are not currently subscribed to any platforms.', { parse_mode: 'HTML' });
      this.sendMainMenu(chatId, 'What would you like to do?');
      return;
    }
    
    if (platform === 'all') {
      subscriber.platforms = [];
      this.saveSubscribers();
      this.bot.sendMessage(chatId, '✅ Successfully unsubscribed from all platforms.', { parse_mode: 'HTML' });
      
      const adminMessage = [
        '🔕 <b>Unsubscription - All Platforms</b>',
        '',
        `👤 User: @${subscriber.username}`,
        `💬 Chat ID: ${chatId}`,
        '📱 Unsubscribed from: All platforms',
        `📅 ${new Date().toLocaleString()}`
      ].join('\n');
      
      await this.notifyAdmin(adminMessage);
      
      this.sendMainMenu(chatId, 'What would you like to do next?');
    } else if (this.platforms[platform as Platform]) {
      const platformKey = platform as Platform;
      const index = subscriber.platforms.indexOf(platformKey);
      if (index !== -1) {
        subscriber.platforms.splice(index, 1);
        this.saveSubscribers();
        this.bot.sendMessage(chatId, `✅ Successfully unsubscribed from ${this.platforms[platformKey].emoji} ${this.platforms[platformKey].name}.`, { parse_mode: 'HTML' });
        
        const adminMessage = [
          '🔕 <b>Unsubscription</b>',
          '',
          `👤 User: @${subscriber.username}`,
          `💬 Chat ID: ${chatId}`,
          `📱 Unsubscribed from: ${this.platforms[platformKey].emoji} ${this.platforms[platformKey].name}`,
          `📅 ${new Date().toLocaleString()}`
        ].join('\n');
        
        await this.notifyAdmin(adminMessage);
      } else {
        this.bot.sendMessage(chatId, `ℹ️ You are not subscribed to ${this.platforms[platformKey].name}.`, { parse_mode: 'HTML' });
      }
      this.showUnsubscribeMenu(chatId);
    }
  }
  
  private showSubscriptions(chatId: number): void {
    const subscriber = this.getSubscriber(chatId);
    
    if (!subscriber || !subscriber.platforms || subscriber.platforms.length === 0) {
      this.bot.sendMessage(chatId, 'ℹ️ You are not currently subscribed to any platforms.', { parse_mode: 'HTML' });
    } else {
      const subscriptionList = subscriber.platforms.map(p => `${this.platforms[p].emoji} ${this.platforms[p].name}`).join('\n');
      const messageText = [
        '📊 <b>Your Subscriptions:</b>',
        '',
        subscriptionList,
        '',
        `Subscribed since: ${new Date(subscriber.subscribedAt).toLocaleDateString()}`
      ].join('\n');
      
      this.bot.sendMessage(chatId, messageText, { parse_mode: 'HTML' });
    }
    
    this.sendMainMenu(chatId, 'What would you like to do next?');
  }
  
  private findLatestBuilds() {
    return BuildUtils.findLatestBuilds();
  }
  
  private async handleLatest(chatId: number): Promise<void> {
    const { version, builds } = this.findLatestBuilds();
    const subscriber = this.getSubscriber(chatId);
    
    if (Object.keys(builds).length === 0) {
      const messageText = [
        `📦 Latest version: v${version}`,
        '',
        '❌ No build files found. Builds may be in progress.',
        '',
        subscriber ? 'You\'ll be notified when new builds are available!' : 'Subscribe to get notified about new builds!'
      ].join('\n');
      
      this.bot.sendMessage(chatId, messageText, { parse_mode: 'HTML' });
      this.sendMainMenu(chatId, 'What would you like to do?');
      return;
    }
    
    try {
      const messageParts = [`📦 <b>Latest Builds: v${version}</b>`, ''];
      
      for (const [platform, build] of Object.entries(builds)) {
        const platformKey = platform as Platform;
        messageParts.push(
          `${this.platforms[platformKey].emoji} <b>${this.platforms[platformKey].name}</b>`,
          `📁 ${build.name}`,
          `📊 Size: ${build.size} MB`,
          ''
        );
      }
      
      messageParts.push(subscriber ? 'Files will be sent to you shortly...' : 'Subscribe to get automatic notifications of new builds!');
      
      await this.bot.sendMessage(chatId, messageParts.join('\n'), { parse_mode: 'HTML' });
      
      // Send files
      for (const [platform, build] of Object.entries(builds)) {
        const platformKey = platform as Platform;
        try {
          const fileResult = await this.fileHandler.prepareFileForTelegram(build.file);
          await this.sendFileToSubscriber(chatId, `${this.platforms[platformKey].emoji} ${this.platforms[platformKey].name}:`, fileResult);
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          console.error(`Error sending ${platform} build:`, error);
          await this.bot.sendMessage(chatId, `❌ Error preparing ${this.platforms[platformKey].name} build for delivery.`, { parse_mode: 'HTML' });
        }
      }
      
      this.fileHandler.cleanup();
      this.sendMainMenu(chatId, 'Anything else?');
      
    } catch (error) {
      console.error('Error in handleLatest:', error);
      this.bot.sendMessage(chatId, '❌ Error retrieving latest builds.', { parse_mode: 'HTML' });
      this.sendMainMenu(chatId, 'Try again:');
    }
  }
  
  async notifySubscribers(message: string, builds: Partial<Record<Platform, BuildInfo>> = {}): Promise<void> {
    if (this.subscribers.length === 0) {
      console.log('No subscribers to notify');
      return;
    }
    
    console.log(`Notifying subscribers for platforms: ${Object.keys(builds).join(', ')}`);
    
    for (const subscriber of this.subscribers) {
      try {
        console.log(`Notifying ${subscriber.username} (${subscriber.chatId})`);
        
        // Build enhanced message with download links (NO separate messages!)
        const subscribedBuilds = (subscriber.platforms || [])
          .filter(platform => builds[platform])
          .map(platform => ({ platform, build: builds[platform]! }));
        
        let enhancedMessage = message;
        
        if (subscribedBuilds.length > 0) {
          enhancedMessage += '\n\n📥 <b>Direct Downloads:</b>';
          
          // Try to get direct download URLs from GitHub releases API
          try {
            const response = await fetch('https://api.github.com/repos/evb0110/mss-downloader/releases/latest');
            const release = await response.json();
            
            let foundAnyDownloads = false;
            
            for (const { platform } of subscribedBuilds) {
              const platformName = `${this.platforms[platform].emoji} ${this.platforms[platform].name}`;
              
              // Find the matching asset for this platform
              let downloadUrl: string | null = null;
              
              if (release.assets) {
                let assetPattern: RegExp;
                if (platform === 'amd64') {
                  assetPattern = /Setup.*x64.*\.exe$/;
                } else if (platform === 'arm64') {
                  assetPattern = /Setup.*arm64.*\.exe$/;
                } else if (platform === 'linux') {
                  assetPattern = /\.AppImage$/;
                }
                
                const asset = release.assets.find((asset: any) => assetPattern.test(asset.name));
                if (asset) {
                  downloadUrl = asset.browser_download_url;
                }
              }
              
              // Only show platforms that have actual download links
              if (downloadUrl) {
                enhancedMessage += `\n🔗 <a href="${downloadUrl}">${platformName}</a>`;
                foundAnyDownloads = true;
              }
            }
            
            // If no downloads found, fall back to releases page
            if (!foundAnyDownloads) {
              enhancedMessage += `\n🔗 <a href="https://github.com/evb0110/mss-downloader/releases/latest">Download from GitHub Releases</a>`;
            }
          } catch (error) {
            console.error('Failed to fetch GitHub release info:', error);
            // Fallback to generic releases page
            enhancedMessage += `\n🔗 <a href="https://github.com/evb0110/mss-downloader/releases/latest">Download from GitHub Releases</a>`;
          }
        }
        
        // Send ONLY the enhanced main message (no additional messages!)
        await this.bot.sendMessage(subscriber.chatId, enhancedMessage, { 
          parse_mode: 'HTML',
          disable_web_page_preview: false 
        });
        
      } catch (error: any) {
        console.error(`Failed to notify subscriber ${subscriber.chatId}:`, error);
        
        if (error.response && error.response.body && error.response.body.error_code === 403) {
          console.log(`Removing blocked subscriber: ${subscriber.chatId}`);
          this.subscribers = this.subscribers.filter(sub => sub.chatId !== subscriber.chatId);
          this.saveSubscribers();
        }
      }
    }
    
    this.fileHandler.cleanup();
    console.log('Notification complete');
  }
  
  private async sendFileToSubscriber(chatId: number, message: string, fileResult: FileResult, platform?: Platform): Promise<void> {
    let fullMessage = message;
    
    if (fileResult.type === 'github_release' && fileResult.downloadUrl) {
      const combinedMessage = message ? 
        `${message}\n\n🔗 Direct Download:\n${fileResult.downloadUrl}` :
        `🔗 Direct Download:\n${fileResult.downloadUrl}`;
      
      await this.bot.sendMessage(chatId, combinedMessage, { parse_mode: 'HTML' });
      return;
    }
    
    if (fileResult.type === 'cloud') {
      if (message) {
        await this.bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
      }
      if (fileResult.instructions) {
        await this.bot.sendMessage(chatId, fileResult.instructions, { parse_mode: 'HTML' });
      }
      return;
    }
    
    if (fileResult.instructions) {
      fullMessage += `\n\n${fileResult.instructions}`;
    }
    
    // Only send message if there's content to send
    if (fullMessage.trim()) {
      await this.bot.sendMessage(chatId, fullMessage, { parse_mode: 'HTML' });
    }
    
    if (fileResult.files && fileResult.files.length > 0) {
      for (const fileInfo of fileResult.files) {
        // Create caption with platform info if provided
        const caption = platform ? 
          `${this.platforms[platform].emoji} ${this.platforms[platform].name}` : 
          undefined;
        
        await this.bot.sendDocument(chatId, fileInfo.path, {
          caption: caption,
          parse_mode: 'HTML'
        });
        
        if (fileResult.files.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
    }
  }
  
  start(): void {
    console.log('MSS Downloader Multiplatform Telegram Bot started');
    console.log(`Subscribers loaded: ${this.subscribers.length}`);
    
    this.bot.on('error', (error) => {
      console.error('Bot error:', error);
    });
    
    this.bot.on('polling_error', (error) => {
      console.error('Polling error:', error);
    });
    
    this.bot.on('message', (msg) => {
      console.log(`📨 Message from ${msg.from?.username || msg.from?.first_name}: ${msg.text}`);
    });
    
    console.log('🤖 Multiplatform bot is running and listening for messages...');
  }
}