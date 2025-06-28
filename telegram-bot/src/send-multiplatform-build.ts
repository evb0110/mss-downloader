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

function getChangelogFromCommits(version: string): string {
  try {
    const commits = execSync('git log --oneline -15 --pretty=format:"%s"', { encoding: 'utf8' }).trim().split('\n');
    
    const technicalPatterns = [
      /^Bump version/i,
      /VERSION-.*:\s*Version bump$/i,
      /^\d+\.\d+\.\d+$/,
      /Generated with Claude Code/i,
      /Fix GitHub token/i,
      /Fix GitHub release/i,
      /Enable subscribers/i,
      /Add automated/i,
      /testing.*permissions/i,
      /Update.*artifact/i,
      /Fix.*formatting/i,
      /Fix.*workflow/i,
      /Fix.*CI/i,
      /Test.*formatting/i,
      /Fix.*SmartScreen/i,
      /Fix multiplatform GitHub releases/i,
      /Complete.*worktree.*merge/i,
      /Complete.*implementation$/i
    ];
    
    const userFacingPatterns = [
      /^VERSION-/i,
      /^Fix.*hanging/i,
      /^Fix.*Orleans/i,
      /^Fix.*Morgan/i,
      /^Fix.*library/i,
      /^Fix.*manifest/i,
      /^Fix.*subscription/i,
      /^Fix.*duplicate.*messages/i,
      /^Fix.*missing.*download.*links/i,
      /^Fix.*timeout/i,
      /^Fix.*InternetCulturale/i,
      /^Fix.*download/i,
      /^Fix.*bug/i,
      /^Fix.*critical/i,
      /^Add.*simultaneous.*download/i,
      /^Enhanced.*handling/i,
      /^Add.*support/i,
      /^Added.*support/i,
      /^Implement/i,
      /^Improve/i
    ];
    
    const changelogItems: string[] = [];
    const seenChanges = new Set<string>();
    
    commits
      .filter(commit => {
        // First check if it's a technical commit - exclude these even if they match user-facing patterns
        if (technicalPatterns.some(pattern => pattern.test(commit))) {
          return false;
        }
        // Include if it matches user-facing patterns
        if (userFacingPatterns.some(pattern => pattern.test(commit))) {
          return true;
        }
        // Skip if neither technical nor user-facing
        return false;
      })
      .forEach(commit => {
        if (changelogItems.length >= 3) return;
        
        let cleaned = commit
          .replace(/^WEB-\d+\s+/, '')
          .replace(/🤖.*Generated with.*$/, '')
          .replace(/\s+Update version.*$/, '')
          .trim();
        
        cleaned = extractUserFacingChange(cleaned);
        
        if (!seenChanges.has(cleaned.toLowerCase())) {
          seenChanges.add(cleaned.toLowerCase());
          changelogItems.push(`✅ ${formatText(cleaned)}`);
        }
      });
    
    if (changelogItems.length > 0) {
      return `${bold("📝 What's New:")}\n${changelogItems.join('\n')}`;
    } else {
      return getChangelogFromVersionHistory(version);
    }
  } catch (error) {
    console.error('Error generating changelog:', error);
    return getChangelogFromVersionHistory(version);
  }
}

    } else {
      // Fallback to version history from CLAUDE.md only if no relevant commits found
      return getChangelogFromVersionHistory(version);
    }
  } catch (error) {
    console.error('Error generating changelog:', error);
    // Always return a generic message on error to avoid empty changelog
    return `${bold("📝 What's New:")}
• Latest updates and improvements with multi-platform support`;
  }
}

function extractUserFacingChange(commitMessage: string): string {
  // Prioritize specific, user-friendly patterns
  
  // 1. VERSION- prefixed commits
  const versionMatch = commitMessage.match(/^VERSION-[^:]*(?::\s*(.+))?/i);
  if (versionMatch) {
    let description = versionMatch[1] ? versionMatch[1].trim() : '';
    if (!description) {
      const shortVersionMatch = commitMessage.match(/^VERSION-[\d.]+\s+(.+)/i);
      if (shortVersionMatch) {
        description = shortVersionMatch[1].trim();
      }
    }
    // Take the first sentence for conciseness
    const firstSentence = description.split('.')[0].trim();
    return firstSentence || 'Version update';
  }

  // 2. Fixes for specific libraries or common issues
  const specificFixes = {
    'InternetCulturale.*timeout': 'Fixed InternetCulturale download timeout for large manuscripts',
    'download.*timeout': 'Fixed download timeout issues for large manuscripts',
    'Morgan.*Library.*manifest': 'Fixed Morgan Library manifest loading',
    'FLORUS.*hanging': 'Fixed FLORUS hanging on calculating stage',
    'Orleans.*persistent.*hanging': 'Fixed Orleans library persistent hanging issue',
    'GitHub.*Actions.*Telegram': 'Fixed automated build notifications',
    'About.*dialog.*version': 'Fixed About dialog version display',
    'Telegram bot.*subscription': 'Fixed Telegram bot subscription issues',
    'duplicate.*messages': 'Fixed duplicate messages in Telegram bot',
    'missing.*download.*links': 'Fixed missing download links in Telegram bot',
    'infinite loop': 'Fixed infinite loop bug in downloads',
    'auto-split': 'Improved auto-splitting logic for large documents',
    'low quality': 'Improved image quality for downloads',
    'hanging': 'Fixed hanging issues in downloads',
    'error': 'Fixed various bugs and errors',
    'bug': 'Fixed various bugs and errors',
    'critical': 'Fixed critical issues'
  };

  for (const pattern in specificFixes) {
    if (commitMessage.match(new RegExp(pattern, 'i'))) {
      return specificFixes[pattern];
    }
  }

  // 3. General patterns for new features or enhancements
  const generalPatterns = {
    'Add.*simultaneous.*download': 'Added simultaneous download functionality',
    'Add(?:ed)?\s+([^:,]+?)\s+support': 'Added $1 support',
    'Implement(?:ed)?\s+([^:,]+?)(?:\s+by|\s+-|\s+and|$)': 'Implemented $1',
    'Enhanc(?:e|ed)\s+([^:,]+?)(?:\s+by|\s+-|\s+and|$)': 'Enhanced $1',
    'Improve(?:d)?\s+([^:,]+?)(?:\s+by|\s+-|\s+and|$)': 'Improved $1',
    'Refactor': 'Improved code structure and performance',
    'Update': 'Updated dependencies and internal tools'
  };

  for (const pattern in generalPatterns) {
    const match = commitMessage.match(new RegExp(pattern, 'i'));
    if (match) {
      return match[1] ? generalPatterns[pattern].replace('$1', match[1].trim()) : generalPatterns[pattern];
    }
  }

  // Fallback: Take the first sentence or a cleaned version of the commit message
  const firstSentence = commitMessage.split('.')[0].trim();
  if (firstSentence.length > 10) {
    return firstSentence;
  }

  // Clean up common prefixes/suffixes if no specific pattern matched
  let cleaned = commitMessage
    .replace(/^(feat|fix|chore|docs|style|refactor|perf|test)\s*(\([^)]+\))?:\s*/i, '') // Remove conventional commit prefixes
    .replace(/\[\w+\]\s*/, '') // Remove [TAG] prefixes
    .trim();

  // Ensure it starts with a capital letter if it's a sentence
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  return cleaned || 'Latest updates and improvements';
}

function getChangelogFromVersionHistory(version: string): string {
  try {
    const claudeContent = fs.readFileSync(path.join(__dirname, '..', '..', 'CLAUDE.md'), 'utf8');
    const versionHistoryMatch = claudeContent.match(/### Version History\n([\s\S]*?)(?=\n##|\n### |$)/);
    
    if (versionHistoryMatch) {
      const versionHistory = versionHistoryMatch[1];
      
      const recentVersions = versionHistory
        .split('\n')
        .filter(line => line.startsWith('- **v'))
        .map(line => {
          const versionMatch = line.match(/- \*\*v(\d+\.\d+\.\d+):\*\* (.+)/);
          if (versionMatch) {
            const version = versionMatch[1];
            const description = versionMatch[2];
            return { version, description };
          }
          return null;
        })
        .filter((item): item is { version: string; description: string } => item !== null)
        .reverse()
        .slice(0, 2)
        .map(item => `• ${item.description}`);
      
      if (recentVersions.length > 0) {
        return `${bold("📝 What's New:")}\n${recentVersions.join('\n')}`;
      }
    }
  } catch (error) {
    console.error('Error reading version history:', error);
  }
  
  return `${bold("📝 What's New:")}\n• Latest updates and improvements with multi-platform support`;
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