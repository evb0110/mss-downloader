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
  private maxFileSize = 50 * 1024 * 1024; // 50MB Telegram limit

  async prepareFileForTelegram(filePath: string): Promise<FileResult> {
    if (!fs.existsSync(filePath)) {
      throw new Error('File not found');
    }
    
    const stats = fs.statSync(filePath);
    const fileName = path.basename(filePath);
    
    // If file is under the limit, return as direct
    if (stats.size <= this.maxFileSize) {
      return {
        type: 'direct',
        files: [{ path: filePath }]
      };
    }
    
    // For large files, provide GitHub Releases URL
    try {
      const packageJsonPath = path.join(__dirname, '..', '..', 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      const version = packageJson.version;
      
      const githubUrl = `https://github.com/evb0110/mss-downloader/releases/download/v${version}/${fileName}`;
      
      return {
        type: 'github_release',
        downloadUrl: githubUrl,
        fileName: fileName,
        fileSize: stats.size,
        version: version
      };
    } catch (error) {
      console.error('Failed to generate GitHub URL:', error);
      throw new Error(`File too large (${(stats.size / 1024 / 1024).toFixed(2)}MB) and cannot provide download URL`);
    }
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
  private readonly ADMIN_CHAT_ID = 53582187;
  private readonly isDevelopment: boolean;
  private processedCallbacks: Set<string> = new Set();
  private processedMessages: Set<string> = new Set();
  private static instance: MultiplatformMSSBot | null = null;
  private isShuttingDown: boolean = false;

  constructor() {
    this.token = process.env.TELEGRAM_BOT_TOKEN || '';
    if (!this.token) {
      throw new Error('TELEGRAM_BOT_TOKEN environment variable is required');
    }
    
    this.bot = new TelegramBot(this.token, { 
      polling: {
        interval: 2000, // Reduced from 300ms to 2000ms to prevent API rate limiting
        autoStart: true,
        params: {
          timeout: 30, // Increased from 10s to 30s for better reliability
          allowed_updates: ['message', 'callback_query'] // Only process relevant updates
        }
      }
    });
    
    MultiplatformMSSBot.instance = this;
    
    this.subscribersFile = path.join(__dirname, '..', 'subscribers.json');
    this.subscribers = this.loadSubscribers();
    this.fileHandler = new SimpleFileHandler();
    this.adminUsername = 'evb0110';
    this.isDevelopment = process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true';
    
    this.platforms = {
      'amd64': { name: 'Windows AMD64 (x64) - Default', emoji: '🖥️' },
      'arm64': { name: 'Windows ARM64', emoji: '💻' },
      'linux': { name: 'Linux AppImage', emoji: '🐧' },
      'mac': { name: 'macOS (Apple Silicon)', emoji: '🍎' }
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
  
  private isAdmin(chatId: number): boolean {
    return chatId === this.ADMIN_CHAT_ID;
  }

  private async notifyAdmin(message: string): Promise<void> {
    try {
      console.log(`Sending admin notification to chat ID: ${this.ADMIN_CHAT_ID}`);
      
      await this.bot.sendMessage(this.ADMIN_CHAT_ID, message, { parse_mode: 'HTML' });
      console.log('Admin notification sent successfully');
    } catch (error) {
      console.error('Error notifying admin:', error);
    }
  }
  
  private setupCommands(): void {
    this.bot.onText(/\/start/, (msg) => {
      const chatId = msg.chat.id;
      const welcomeMessage = [
        '🤖 MSS Downloader Build Bot',
        '',
        'This bot sends notifications when new builds are available for multiple platforms:',
        `${this.platforms.amd64.emoji} ${this.platforms.amd64.name}`,
        `${this.platforms.arm64.emoji} ${this.platforms.arm64.name}`,
        `${this.platforms.linux.emoji} ${this.platforms.linux.name}`,
        `${this.platforms.mac.emoji} ${this.platforms.mac.name}`,
        '',
        'You are automatically subscribed to receive notifications.',
        'Send /unsubscribe if you want to stop receiving notifications.'
      ].join('\n');
      
      this.bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'HTML' });
    });
    
    this.bot.onText(/\/subscribe/, (msg) => {
      const chatId = msg.chat.id;
      const user = msg.from!;
      // Auto-subscribe to all platforms
      this.handleSubscribe(chatId, user, 'all');
    });
    
    this.bot.onText(/\/unsubscribe/, (msg) => {
      const chatId = msg.chat.id;
      // Unsubscribe from all platforms
      this.handleUnsubscribe(chatId, 'all');
    });
    
    this.bot.onText(/\/latest/, (msg) => {
      const messageId = `${msg.chat.id}_${msg.message_id}_latest`;
      if (this.processedMessages.has(messageId)) {
        console.log(`⚠️  Skipping duplicate /latest command from ${msg.chat.id}`);
        return;
      }
      this.processedMessages.add(messageId);
      
      // Clean up old messages (keep only last 100)
      if (this.processedMessages.size > 100) {
        const oldMessages = Array.from(this.processedMessages).slice(0, 50);
        oldMessages.forEach(id => this.processedMessages.delete(id));
      }
      
      this.handleLatest(msg.chat.id);
    });
    
    this.bot.onText(/\/test_admin/, async (msg) => {
      const chatId = msg.chat.id;
      if (this.isAdmin(chatId)) {
        await this.notifyAdmin('🧪 <b>Test Notification</b>\n\nThis is a test message to verify admin notifications are working.');
        this.bot.sendMessage(chatId, 'Test notification sent!');
      } else {
        this.bot.sendMessage(chatId, '❌ This command is only available to administrators.');
      }
    });

    // Test notification command - ADMIN ONLY
    this.bot.onText(/\/test_notification/, async (msg) => {
      const chatId = msg.chat.id;
      if (!this.isAdmin(chatId)) {
        this.bot.sendMessage(chatId, '❌ Test commands are only available to administrators.');
        return;
      }
      
      console.log(`Admin testing notification system from ${chatId}`);
      const testMessage = '🧪 <b>Test Build Notification</b>\n\nThis is a test message to verify the notification system works correctly.\n\nOnly admin receives this message.';
      
      // Use test mode to only notify admin
      await this.notifySubscribers(testMessage, {}, true);
      this.bot.sendMessage(chatId, '✅ Test notification sent (admin only).');
    });

    // Add additional test commands - ADMIN ONLY  
    this.bot.onText(/\/test_(?!admin|notification)(.*)/, async (msg) => {
      const chatId = msg.chat.id;
      if (!this.isAdmin(chatId)) {
        this.bot.sendMessage(chatId, '❌ Test commands are only available to administrators.');
        return;
      }
      
      const testType = msg.text?.match(/\/test_(.+)/)?.[1];
      console.log(`Admin test command: /test_${testType} from ${chatId}`);
      this.bot.sendMessage(chatId, `🧪 Test command "/test_${testType}" received by admin.`);
    });
    
    this.bot.on('message', (msg) => {
      if (msg.text && !msg.text.startsWith('/')) {
        const chatId = msg.chat.id;
        this.bot.sendMessage(chatId, 'Use /subscribe to get notifications or /help for commands.', { parse_mode: 'HTML' });
      }
    });
    
    this.bot.on('callback_query', async (callbackQuery) => {
      try {
        const message = callbackQuery.message;
        const data = callbackQuery.data;
        const chatId = message!.chat.id;
        const callbackId = callbackQuery.id;
        
        // Create unique key for deduplication using callback ID (more reliable)
        const dedupeKey = `${chatId}_${data}_${callbackId}`;
        
        // Check if we've processed this exact callback already
        if (this.processedCallbacks.has(dedupeKey)) {
          console.log(`⚠️  Duplicate callback ignored: ${data} from ${chatId} (callback ID: ${callbackId})`);
          await this.bot.answerCallbackQuery(callbackId, { text: 'Request already processed' });
          return;
        }
        
        // Add to processed set with cleanup after 10 seconds (longer timeout for safety)
        this.processedCallbacks.add(dedupeKey);
        setTimeout(() => this.processedCallbacks.delete(dedupeKey), 10000);
        
        // REFRESH subscriber state before processing any callback to ensure consistency
        this.subscribers = this.loadSubscribers();
        
        await this.bot.answerCallbackQuery(callbackId);
        await this.handleCallback(chatId, data!, callbackQuery.from, message!.message_id);
        
      } catch (error) {
        console.error('Error processing callback query:', error);
        if (callbackQuery.id) {
          await this.bot.answerCallbackQuery(callbackQuery.id, { 
            text: 'Error processing request. Please try again.',
            show_alert: true 
          });
        }
      }
    });
  }
  
  private setupMenu(): void {
    const commands = [
      { command: 'start', description: 'Start the bot and show main menu' },
      { command: 'subscribe', description: 'Subscribe to build notifications' },
      { command: 'unsubscribe', description: 'Unsubscribe from notifications' },
      { command: 'latest', description: 'Download latest builds for all platforms' }
    ];

    // Add admin-only commands to the menu
    if (this.isDevelopment) {
      commands.push(
        { command: 'test_admin', description: '[ADMIN] Test admin notifications' },
        { command: 'test_notification', description: '[ADMIN] Test build notifications (admin only)' }
      );
    }

    this.bot.setMyCommands(commands).catch(error => {
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
          { text: `${this.platforms.mac.emoji} ${subscribedPlatforms.includes('mac') ? '✅' : ''} macOS`, 
            callback_data: 'subscribe_mac' }
        ],
        [
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
      `${this.platforms.mac.emoji} <b>${this.platforms.mac.name}</b>`,
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
    if (subscribedPlatforms.includes('mac')) {
      buttons.push({ text: `${this.platforms.mac.emoji} Unsubscribe macOS`, callback_data: 'unsubscribe_mac' });
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
  
  private async handleCallback(chatId: number, data: string, user: TelegramBot.User, messageId?: number): Promise<void> {
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
    
    if (data.startsWith('latest_platform_')) {
      const platform = data.replace('latest_platform_', '') as Platform;
      await this.handleLatestPlatform(chatId, platform);
      return;
    }
    
    if (data === 'latest_all_platforms') {
      await this.handleLatestPlatform(chatId, 'all');
      return;
    }
    
    if (data.startsWith('subscribe_')) {
      const platform = data.replace('subscribe_', '') as Platform | 'all';
      await this.handleSubscribe(chatId, user, platform, messageId);
      return;
    }
    
    if (data.startsWith('unsubscribe_')) {
      const platform = data.replace('unsubscribe_', '') as Platform | 'all';
      await this.handleUnsubscribe(chatId, platform, messageId);
      return;
    }
  }
  
  private async handleSubscribe(chatId: number, user: TelegramBot.User, platform: Platform | 'all', messageId?: number): Promise<void> {
    // REFRESH subscriber state from file before processing to ensure consistency
    this.subscribers = this.loadSubscribers();
    
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
      const allPlatforms = ['amd64', 'arm64', 'linux', 'mac'] as Platform[];
      const wasAlreadySubscribed = allPlatforms.every(p => subscriber.platforms.includes(p));
      
      if (wasAlreadySubscribed) {
        // ENHANCED: Show current subscription details for clarity
        const currentSubs = subscriber.platforms.map(p => `${this.platforms[p].emoji} ${this.platforms[p].name}`).join('\n');
        const enhancedMessage = [
          'ℹ️ You are already subscribed to all platforms.',
          '',
          '📊 Your current subscriptions:',
          currentSubs,
          '',
          `📅 Subscribed since: ${new Date(subscriber.subscribedAt).toLocaleDateString()}`
        ].join('\n');
        
        this.bot.sendMessage(chatId, enhancedMessage, { parse_mode: 'HTML' });
      } else {
        subscriber.platforms = allPlatforms;
        this.saveSubscribers();
        this.bot.sendMessage(chatId, '✅ Successfully subscribed to all platforms!', { parse_mode: 'HTML' });
        
        const adminMessage = [
          '🔔 <b>New Subscription - All Platforms</b>',
          '',
          `👤 User: @${username}`,
          `💬 Chat ID: ${chatId}`,
          '📱 Platforms: All (AMD64, ARM64, Linux, macOS)',
          `📅 ${new Date().toLocaleString()}`
        ].join('\n');
        
        await this.notifyAdmin(adminMessage);
      }
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
    
    /* Removed duplicate menu call - this was causing the menu duplication bug */
  }
  
  public static getInstance(): MultiplatformMSSBot {
    if (!MultiplatformMSSBot.instance) {
      console.log('🤖 Creating new bot instance...');
      MultiplatformMSSBot.instance = new MultiplatformMSSBot();
    } else {
      console.log('♻️  Reusing existing bot instance');
    }
    return MultiplatformMSSBot.instance;
  }
  
  public async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }
    
    this.isShuttingDown = true;
    console.log('🔄 Shutting down bot...');
    
    try {
      await this.bot.stopPolling();
      this.processedCallbacks.clear();
      MultiplatformMSSBot.instance = null;
      console.log('✅ Bot shutdown complete');
    } catch (error) {
      console.error('Error during bot shutdown:', error);
    }
  }
  
  private async handleUnsubscribe(chatId: number, platform: Platform | 'all', messageId?: number): Promise<void> {
    // REFRESH subscriber state from file before processing to ensure consistency
    this.subscribers = this.loadSubscribers();
    
    const subscriber = this.getSubscriber(chatId);
    
    if (!subscriber || !subscriber.platforms || subscriber.platforms.length === 0) {
      this.bot.sendMessage(chatId, 'ℹ️ You are not currently subscribed to any platforms.', { parse_mode: 'HTML' });
      /* Removed duplicate main menu call - this was causing menu duplication */
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
      
      /* Removed duplicate main menu call - this was causing menu duplication */
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
      /* Removed duplicate unsubscribe menu call - this was causing menu duplication */
    }
  }
  
  private showSubscriptions(chatId: number): void {
    // REFRESH subscriber state from file before showing to ensure accuracy
    this.subscribers = this.loadSubscribers();
    const subscriber = this.getSubscriber(chatId);
    
    if (!subscriber || !subscriber.platforms || subscriber.platforms.length === 0) {
      this.bot.sendMessage(chatId, 'ℹ️ You are not currently subscribed to any platforms.', { parse_mode: 'HTML' });
    } else {
      const subscriptionList = subscriber.platforms.map(p => `${this.platforms[p].emoji} ${this.platforms[p].name}`).join('\n');
      const messageText = [
        '📊 <b>Your Current Subscriptions:</b>',
        '',
        subscriptionList,
        '',
        `📅 Subscribed since: ${new Date(subscriber.subscribedAt).toLocaleDateString()}`,
        '',
        '💡 Use the buttons below to modify your subscriptions.'
      ].join('\n');
      
      this.bot.sendMessage(chatId, messageText, { parse_mode: 'HTML' });
    }
    
    /* Removed sendMainMenu call here - this was causing menu duplication after showing subscriptions */
  }
  
  private findLatestBuilds() {
    return BuildUtils.findLatestBuilds();
  }
  
  private async handleLatest(chatId: number): Promise<void> {
    console.log(`📦 Handling /latest command for chat ${chatId}`);
    const startTime = Date.now();
    const { version, builds } = this.findLatestBuilds();
    const buildTime = Date.now() - startTime;
    console.log(`📦 Build detection took ${buildTime}ms, found ${Object.keys(builds).length} builds for v${version}`);
    
    if (Object.keys(builds).length === 0) {
      const messageText = [
        `📦 Latest version: v${version}`,
        '',
        '❌ No build files found. Builds may be in progress.',
        '',
        'You\'ll be notified when new builds are available!'
      ].join('\n');
      
      this.bot.sendMessage(chatId, messageText, { parse_mode: 'HTML' });
      return;
    }
    
    const keyboard = {
      inline_keyboard: [
        ...Object.keys(builds).map(platform => ([{
          text: `${this.platforms[platform as Platform].emoji} ${this.platforms[platform as Platform].name}`,
          callback_data: `latest_platform_${platform}`
        }])),
        [{ text: '📥 All Platforms', callback_data: 'latest_all_platforms' }],
        [{ text: '🔙 Main Menu', callback_data: 'main_menu' }]
      ]
    };
    
    const messageText = [
      `📦 <b>Latest Builds: v${version}</b>`,
      '',
      'Choose a platform to download:'
    ].join('\n');
    
    try {
      await this.bot.sendMessage(chatId, messageText, {
        reply_markup: keyboard,
        parse_mode: 'HTML'
      });
      console.log(`✅ Successfully sent /latest menu to chat ${chatId}`);
    } catch (error) {
      console.error(`❌ Error sending /latest menu to chat ${chatId}:`, error);
      // Send a simple text message as fallback
      try {
        await this.bot.sendMessage(chatId, `📦 Latest Builds: v${version}\n\n❌ Menu display error. Use /help for alternatives.`);
      } catch (fallbackError) {
        console.error(`❌ Fallback message also failed:`, fallbackError);
      }
    }
  }
  
  private async handleLatestPlatform(chatId: number, platform: Platform | 'all'): Promise<void> {
    const { version, builds } = this.findLatestBuilds();
    
    if (Object.keys(builds).length === 0) {
      const messageText = [
        `📦 Latest version: v${version}`,
        '',
        '❌ No build files found. Builds may be in progress.',
        '',
        'You\'ll be notified when new builds are available!'
      ].join('\n');
      
      this.bot.sendMessage(chatId, messageText, { parse_mode: 'HTML' });
      return;
    }
    
    if (platform === 'all') {
      // Send all platform builds
      for (const [platformKey, build] of Object.entries(builds)) {
        const plt = platformKey as Platform;
        try {
          const messageText = [
            `📦 <b>Latest ${this.platforms[plt].name} Build: v${version}</b>`,
            '',
            `${this.platforms[plt].emoji} <b>${this.platforms[plt].name}</b>`,
            `📁 ${build.name}`,
            `📊 Size: ${build.size} MB`
          ].join('\n');
          
          const fileResult = await this.fileHandler.prepareFileForTelegram(build.file);
          await this.sendFileToSubscriber(chatId, messageText, fileResult);
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          console.error(`Error sending ${platformKey} build:`, error);
          await this.bot.sendMessage(chatId, `❌ Error preparing ${this.platforms[plt].name} build for delivery.`, { parse_mode: 'HTML' });
        }
      }
    } else {
      // Send specific platform build
      const build = builds[platform];
      if (!build) {
        this.bot.sendMessage(chatId, `❌ No ${this.platforms[platform].name} build found for v${version}.`, { parse_mode: 'HTML' });
        return;
      }
      
      try {
        const messageText = [
          `📦 <b>Latest ${this.platforms[platform].name} Build: v${version}</b>`,
          '',
          `${this.platforms[platform].emoji} <b>${this.platforms[platform].name}</b>`,
          `📁 ${build.name}`,
          `📊 Size: ${build.size} MB`
        ].join('\n');
        
        console.log(`🔄 Processing ${platform} build file: ${build.file}`);
        const fileResult = await this.fileHandler.prepareFileForTelegram(build.file);
        console.log(`📁 File result type: ${fileResult.type}, hasDownloadUrl: ${!!fileResult.downloadUrl}`);
        await this.sendFileToSubscriber(chatId, messageText, fileResult);
        console.log(`✅ Successfully sent ${platform} build to chat ${chatId}`);
      } catch (error) {
        console.error(`❌ Error sending ${platform} build:`, error);
        console.error(`❌ Error stack:`, error instanceof Error ? error.stack : 'No stack trace');
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await this.bot.sendMessage(chatId, `❌ Error preparing ${this.platforms[platform].name} build for delivery: ${errorMessage}`, { parse_mode: 'HTML' });
      }
    }
    
    this.fileHandler.cleanup();
  }
  
  async notifySubscribers(message: string, builds: Partial<Record<Platform, BuildInfo>> = {}, testMode: boolean = false): Promise<void> {
    if (this.subscribers.length === 0) {
      console.log('No subscribers to notify');
      return;
    }
    
    // In test mode, only notify admin
    const subscribersToNotify = testMode || this.isDevelopment 
      ? this.subscribers.filter(sub => sub.chatId === this.ADMIN_CHAT_ID)
      : this.subscribers;
    
    if (testMode) {
      console.log('🧪 TEST MODE: Only notifying admin user');
    }
    
    console.log(`Notifying ${subscribersToNotify.length} subscribers for platforms: ${Object.keys(builds).join(', ')}`);
    
    for (const subscriber of subscribersToNotify) {
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
                } else if (platform === 'mac') {
                  assetPattern = /\.dmg$/;
                } else {
                  continue; // Skip unknown platforms
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
    console.log(`Mode: ${this.isDevelopment ? '🧪 DEVELOPMENT (Test mode active)' : '🚀 PRODUCTION'}`);
    
    if (this.isDevelopment) {
      console.log('⚠️  In development mode, notifications will only be sent to admin (evb0110)');
    }
    
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