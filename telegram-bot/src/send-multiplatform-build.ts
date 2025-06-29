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

function extractUserFacingChangesFromVersionCommit(commitMessage: string): string[] {
  // Extract the description after "VERSION-X.X.X: "
  const versionMatch = commitMessage.match(/^VERSION-[^:]*:\s*(.+)/i);
  if (!versionMatch) return [];
  
  const description = versionMatch[1].trim();
  
  // Parse the description to extract user-facing benefits
  const changes: string[] = [];
  
  // Split by common separators and clean up
  const parts = description.split(/[,;-]/).map(part => part.trim()).filter(Boolean);
  
  for (const part of parts) {
    // Convert technical descriptions to user-facing language
    if (part.match(/fix.*internet.*culturale.*infinite.*loop/i)) {
      changes.push('Fixed Internet Culturale infinite download loops');
    } else if (part.match(/eliminate.*authentication.*error.*pages/i)) {
      changes.push('Improved authentication error handling');
    } else if (part.match(/improve.*download.*performance/i)) {
      changes.push('Enhanced download performance');
    } else if (part.match(/fix.*university.*graz.*timeout/i)) {
      changes.push('Fixed University of Graz loading timeouts');
    } else if (part.match(/rome.*bnc.*libroantico.*support/i)) {
      changes.push('Added Rome BNC libroantico collection support');
    } else if (part.match(/manuscripta.*hanging.*download/i)) {
      changes.push('Fixed Manuscripta.at hanging downloads');
    } else if (part.match(/e-manuscripta.*complete.*manuscript/i)) {
      changes.push('Fixed e-manuscripta.ch complete manuscript downloads');
    } else if (part.match(/fix.*europeana.*pagination/i)) {
      changes.push('Fixed Europeana complete manuscript downloads');
    } else if (part.match(/vienna.*manuscripta.*page.*range/i)) {
      changes.push('Fixed Vienna Manuscripta page-specific downloads');
    } else if (part.match(/morgan.*library.*quality/i)) {
      changes.push('Enhanced Morgan Library image quality');
    } else if (part.match(/add.*library.*support/i)) {
      const libraryMatch = part.match(/add\s+([^.]+?)\s+(?:library\s+)?support/i);
      if (libraryMatch) {
        changes.push(`Added ${libraryMatch[1]} library support`);
      }
    } else if (part.match(/fix.*library/i)) {
      const libraryMatch = part.match(/fix\s+([^.]+?)\s+library/i);
      if (libraryMatch) {
        changes.push(`Fixed ${libraryMatch[1]} library downloads`);
      }
    }
  }
  
  // If no specific patterns matched, try to extract general improvements
  if (changes.length === 0) {
    // Look for key action words and create generic improvements
    if (description.match(/fix|resolve|correct/i)) {
      changes.push('Bug fixes and stability improvements');
    } else if (description.match(/add|implement|support/i)) {
      changes.push('New features and library support');
    } else if (description.match(/improve|enhance|optimize/i)) {
      changes.push('Performance improvements');
    }
  }
  
  // Limit to 3 changes and remove duplicates
  return [...new Set(changes)].slice(0, 3);
}

function getChangelogFromCommits(version: string): string {
  try {
    // Get commits to analyze for this version
    const commits = execSync('git log --oneline -20 --pretty=format:"%s"', { encoding: 'utf8' }).trim().split('\n');
    
    // Find the most recent VERSION commit for the current version
    const currentVersionCommit = commits.find(commit => 
      commit.match(new RegExp(`^VERSION-${version.replace(/\./g, '\\.')}:`, 'i'))
    );
    
    if (currentVersionCommit) {
      // Extract user-facing changes from the VERSION commit
      const userFacingChanges = extractUserFacingChangesFromVersionCommit(currentVersionCommit);
      
      if (userFacingChanges.length > 0) {
        return `${bold("📝 What's New:")}\n${userFacingChanges.map(change => `✅ ${formatText(change)}`).join('\n')}`;
      }
    }
    
    // Fallback to generic message if no meaningful changes found
    return `${bold("📝 What's New:")}\n✅ Bug fixes and stability improvements`;
  } catch (error) {
    console.error('Error generating changelog:', error);
    return `${bold("📝 What's New:")}\n✅ Bug fixes and stability improvements`;
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
    
    const changelog = getChangelogFromCommits(version);
    
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
      `🚀 ${bold(`MSS Downloader v${version} Available!`)}`,
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