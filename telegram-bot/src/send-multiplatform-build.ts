#!/usr/bin/env node

import { MultiplatformMSSBot } from './multiplatform-bot.js';
import { BuildUtils } from './build-utils.js';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import type { Platform, BuildInfo } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function escapeHTML(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function bold(text: string): string {
  return `<b>${escapeHTML(text)}</b>`;
}

function formatText(text: string): string {
  return escapeHTML(text);
}

// Library name mappings with geographic context
// Simplified changelog generation - reads from package.json instead of parsing commits

function getChangelogFromPackageJson(): string {
  try {
    const packageJsonPath = path.join(__dirname, '..', '..', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    if (packageJson.changelog && Array.isArray(packageJson.changelog) && packageJson.changelog.length > 0) {
      return `${bold("📝 What's New:")}\n${packageJson.changelog.map((change: string) => `✅ ${formatText(change)}`).join('\n')}`;
    }
    
    // Fallback to generic message if no changelog found
    return `${bold("📝 What's New:")}\n✅ Library download improvements`;
  } catch (error) {
    console.error('Error reading changelog from package.json:', error);
    return `${bold("📝 What's New:")}\n✅ Library download improvements`;
  }
}




async function findAllBuilds() {
  // If running in GitHub Actions, try to get builds from GitHub releases instead of local files
  if (process.env.GITHUB_ACTIONS) {
    try {
      const packageJsonPath = path.join(__dirname, '..', '..', 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      const version = packageJson.version;
      
      console.log(`🔍 Running in GitHub Actions, checking GitHub releases for v${version}...`);
      
      // Add retry logic with delays to wait for GitHub API to reflect the newly uploaded assets
      const maxRetries = 5;
      const retryDelay = 10000; // 10 seconds
      let lastError = null;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`📡 Attempt ${attempt}/${maxRetries} to fetch GitHub release...`);
          
          const response = await fetch('https://api.github.com/repos/evb0110/mss-downloader/releases/latest');
          const release = await response.json();
          
          if (release.tag_name === `v${version}` && release.assets && release.assets.length > 0) {
            console.log(`✅ Found GitHub release v${version} with ${release.assets.length} assets`);
            
            const builds: Partial<Record<Platform, BuildInfo>> = {};
            
            for (const asset of release.assets) {
              const name = asset.name;
              const size = parseFloat((asset.size / (1024 * 1024)).toFixed(2));
              
              if (name.includes('x64') && name.endsWith('.exe')) {
                builds.amd64 = { file: asset.browser_download_url, name, size };
                console.log(`  - Found AMD64: ${name} (${size}MB)`);
              } else if (name.includes('arm64') && name.endsWith('.exe')) {
                builds.arm64 = { file: asset.browser_download_url, name, size };
                console.log(`  - Found ARM64: ${name} (${size}MB)`);
              } else if (name.endsWith('.AppImage')) {
                builds.linux = { file: asset.browser_download_url, name, size };
                console.log(`  - Found Linux: ${name} (${size}MB)`);
              } else if (name.endsWith('.dmg') || name.endsWith('.pkg')) {
                builds.mac = { file: asset.browser_download_url, name, size };
                console.log(`  - Found macOS: ${name} (${size}MB)`);
              }
            }
            
            // Only return builds if we found at least one platform
            if (Object.keys(builds).length > 0) {
              console.log(`✅ Successfully found ${Object.keys(builds).length} platform builds`);
              return { version, builds };
            } else {
              console.log(`⚠️ GitHub release v${version} exists but no platform builds found in assets`);
            }
          } else {
            console.log(`⚠️ GitHub release not ready yet. Expected v${version}, found ${release.tag_name}, assets: ${release.assets?.length || 0}`);
          }
        } catch (error) {
          lastError = error;
          console.error(`❌ Attempt ${attempt} failed:`, error);
        }
        
        // Wait before retrying (except on last attempt)
        if (attempt < maxRetries) {
          console.log(`⏳ Waiting ${retryDelay/1000} seconds before retry...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
      
      console.error(`❌ All ${maxRetries} attempts failed. Last error:`, lastError);
    } catch (error) {
      console.error('⚠️ Failed to fetch from GitHub API, falling back to local files:', error);
    }
  }
  
  // Fallback to local file search
  return BuildUtils.findLatestBuilds();
}

async function sendMultiplatformBuild(): Promise<void> {
  try {
    const { version, builds } = await findAllBuilds();
    
    if (Object.keys(builds).length === 0) {
      console.error('❌ No builds found for version', version);
      process.exit(1);
    }
    
    console.log(`📦 Found builds for v${version}:`);
    Object.entries(builds).forEach(([platform, build]) => {
      console.log(`  - ${platform}: ${build.name} (${build.size}MB)`);
    });
    
    // Use package.json version for changelog generation, not build version
    const packageJsonPath = path.join(__dirname, '..', '..', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const actualVersion = packageJson.version;
    
    console.log(`📝 Generating changelog for actual version v${actualVersion} (build version: v${version})`);
    const changelog = getChangelogFromPackageJson();
    
    const platformSummary = Object.entries(builds).map(([platform, build]) => {
      const platformNames = {
        'amd64': '🖥️ Windows AMD64 (Default)',
        'arm64': '💻 Windows ARM64',
        'linux': '🐧 Linux AppImage',
        'mac': '🍎 macOS (Apple Silicon)'
      };
      return `${platformNames[platform as Platform]}: ${build.size}MB`;
    }).join('\n');
    
    const messageLines = [
      `🚀 ${bold(`MSS Downloader v${actualVersion} Available!`)}`,
      '',
      changelog,
      '',
      `💻 ${bold("Available Platforms:")}`,
      platformSummary,
      '',
      `📅 Built: ${formatText(new Date().toLocaleString())}`,
      '',
      '📥 Download and install to get the latest features and fixes!'
    ];
    
    const message = messageLines.join('\n');
    
    const bot = MultiplatformMSSBot.getInstance();
    
    console.log('🤖 Sending multiplatform build notification...');
    await bot.notifySubscribers(message, builds);
    
    console.log('✅ Multiplatform build notification sent successfully!');
    
    // Clean shutdown to prevent lingering processes
    await bot.shutdown();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error sending multiplatform build:', error);
    process.exit(1);
  }
}

function showHelp(): void {
  const helpText = [
    'MSS Downloader Multiplatform Build Sender',
    '',
    'Usage:',
    '  node send-multiplatform-build.js            Send latest builds to subscribers',
    '  node send-multiplatform-build.js --help     Show this help',
    '  node send-multiplatform-build.js --message "msg" Send custom message (no files)',
    '',
    'Prerequisites:',
    '  - TELEGRAM_BOT_TOKEN environment variable must be set',
    '  - Run build commands to create platform builds:',
    '    * npm run dist:win:x64  (Windows AMD64)',
    '    * npm run dist:win:arm  (Windows ARM64)',
    '    * npm run dist:linux    (Linux AppImage)',
    '  - At least one subscriber must be registered',
    '',
    'Examples:',
    '  export TELEGRAM_BOT_TOKEN="your_bot_token_here"',
    '  npm run dist:win:x64 && npm run dist:win:arm && npm run dist:linux',
    '  node telegram-bot/send-multiplatform-build.js'
  ].join('\n');
  
  console.log(helpText);
}

async function sendMessage(customMessage: string): Promise<void> {
  try {
    const bot = MultiplatformMSSBot.getInstance();
    // This is a simplified version - we'd need to expose subscribers or create a method
    console.log('✅ Custom message functionality needs to be implemented!');
    await bot.shutdown();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error sending message:', error);
    process.exit(1);
  }
}

const args = process.argv.slice(2);

if (args.includes('--help')) {
  showHelp();
  process.exit(0);
}

const messageIndex = args.indexOf('--message');
if (messageIndex !== -1 && args[messageIndex + 1]) {
  sendMessage(args[messageIndex + 1]);
} else {
  sendMultiplatformBuild();
}