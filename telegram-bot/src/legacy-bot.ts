// Legacy bot interface for backward compatibility with send-build.ts
// ⚠️ DEPRECATED: Use MultiplatformMSSBot instead

import TelegramBot from 'node-telegram-bot-api';
import fs from 'fs';
import path from 'path';
import { TelegramFileHandler } from './telegram-file-handler.js';
import type { Subscriber, FileResult } from './types.js';

export class MSSTelegramBot {
  private token: string;
  private bot: TelegramBot;
  private subscribersFile: string;
  private subscribers: Subscriber[];
  private fileHandler: TelegramFileHandler;

  constructor() {
    this.token = process.env.TELEGRAM_BOT_TOKEN!;
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
    this.fileHandler = new TelegramFileHandler();
    
    this.setupCommands();
    this.setupMenu();
  }
  
  private loadSubscribers(): Subscriber[] {
    try {
      if (fs.existsSync(this.subscribersFile)) {
        const data = fs.readFileSync(this.subscribersFile, 'utf8');
        const subscribers = JSON.parse(data);
        
        // Migrate old format to new format for compatibility
        return subscribers.map((sub: any) => {
          if (!sub.platforms) {
            sub.platforms = ['amd64']; // Default to AMD64 for backward compatibility
          }
          return sub as Subscriber;
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

  private setupCommands(): void {
    this.bot.onText(/\/start/, (msg) => {
      const chatId = msg.chat.id;
      this.sendWelcomeMessage(chatId);
    });

    this.bot.onText(/\/subscribe/, (msg) => {
      const chatId = msg.chat.id;
      this.subscribe(chatId, msg.from?.username || 'Unknown User');
    });

    this.bot.onText(/\/unsubscribe/, (msg) => {
      const chatId = msg.chat.id;
      this.unsubscribe(chatId);
    });

    this.bot.onText(/\/status/, (msg) => {
      const chatId = msg.chat.id;
      this.sendStatus(chatId);
    });
  }

  private setupMenu(): void {
    // Legacy menu setup - simplified for compatibility
  }

  private async sendWelcomeMessage(chatId: number): Promise<void> {
    const message = `
🚀 Welcome to MSS Downloader Bot!

This bot will notify you when new builds are available.

Commands:
/subscribe - Subscribe to build notifications (AMD64 only)
/unsubscribe - Unsubscribe from notifications  
/status - Check your subscription status

⚠️ Note: This is the legacy bot for AMD64 builds only.
For full multiplatform support, use the new multiplatform bot.
    `.trim();

    try {
      await this.bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
    } catch (error) {
      console.error('Error sending welcome message:', error);
    }
  }

  private async subscribe(chatId: number, username: string): Promise<void> {
    const existingIndex = this.subscribers.findIndex(sub => sub.chatId === chatId);
    
    if (existingIndex !== -1) {
      await this.bot.sendMessage(chatId, '✅ You are already subscribed to build notifications!');
      return;
    }

    const subscriber: Subscriber = {
      chatId,
      username,
      subscribedAt: new Date().toISOString(),
      platforms: ['amd64'] // Legacy bot only supports AMD64
    };

    this.subscribers.push(subscriber);
    this.saveSubscribers();

    await this.bot.sendMessage(chatId, '🎉 Successfully subscribed to build notifications!\n\nYou will receive notifications for Windows AMD64 builds.');
  }

  private async unsubscribe(chatId: number): Promise<void> {
    const initialLength = this.subscribers.length;
    this.subscribers = this.subscribers.filter(sub => sub.chatId !== chatId);
    
    if (this.subscribers.length < initialLength) {
      this.saveSubscribers();
      await this.bot.sendMessage(chatId, '👋 Successfully unsubscribed from build notifications.');
    } else {
      await this.bot.sendMessage(chatId, '❌ You are not currently subscribed.');
    }
  }

  private async sendStatus(chatId: number): Promise<void> {
    const subscriber = this.subscribers.find(sub => sub.chatId === chatId);
    
    if (subscriber) {
      await this.bot.sendMessage(chatId, `✅ You are subscribed to build notifications.\n\nPlatforms: AMD64\nSubscribed: ${new Date(subscriber.subscribedAt).toLocaleString()}`);
    } else {
      await this.bot.sendMessage(chatId, '❌ You are not currently subscribed.\n\nUse /subscribe to receive build notifications.');
    }
  }

  public async notifySubscribers(message: string, file?: string): Promise<void> {
    if (this.subscribers.length === 0) {
      console.log('📭 No subscribers to notify');
      return;
    }

    console.log(`📤 Notifying ${this.subscribers.length} subscribers...`);

    for (const subscriber of this.subscribers) {
      try {
        if (file) {
          const fileResult = await this.fileHandler.prepareFileForTelegram(file);
          await this.sendFileToSubscriber(subscriber.chatId, message, fileResult);
        } else {
          await this.bot.sendMessage(subscriber.chatId, message, { parse_mode: 'HTML' });
        }
        
        console.log(`✅ Notified ${subscriber.username} (${subscriber.chatId})`);
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`❌ Failed to notify ${subscriber.username}:`, error);
      }
    }
  }

  public async sendFileToSubscriber(chatId: number, message: string, fileResult: FileResult): Promise<void> {
    try {
      await this.bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
      
      if (fileResult.type === 'github_release' && fileResult.downloadUrl) {
        const downloadMessage = `📥 Download: ${fileResult.downloadUrl}`;
        await this.bot.sendMessage(chatId, downloadMessage);
      } else if (fileResult.files && fileResult.files.length > 0) {
        // Handle file uploads
        for (const fileInfo of fileResult.files) {
          if (fs.existsSync(fileInfo.path)) {
            await this.bot.sendDocument(chatId, fileInfo.path);
          }
        }
      }
    } catch (error) {
      console.error(`Error sending file to subscriber ${chatId}:`, error);
      throw error;
    }
  }

  public start(): void {
    console.log('🤖 Legacy MSS Telegram Bot started (AMD64 only)');
    console.log(`📊 ${this.subscribers.length} subscribers loaded`);
  }
}