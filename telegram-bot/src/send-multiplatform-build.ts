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
      /Complete.*worktree.*merge/i
    ];
    
    const userFacingPatterns = [
      /^VERSION-/i,
      /Fix.*hanging/i,
      /Fix.*Orleans/i,
      /Fix.*Morgan/i,
      /Fix.*library/i,
      /Fix.*manifest/i,
      /Fix.*subscription/i,
      /Fix.*duplicate.*messages/i,
      /Fix.*missing.*download.*links/i,
      /Add.*simultaneous.*download/i,
      /Enhanced.*handling/i,
      /support.*library/i,
      /Added.*support/i
    ];
    
    const changelogItems: string[] = [];
    const seenChanges = new Set<string>();
    
    commits
      .filter(commit => {
        // User-facing patterns take precedence - include if user-facing regardless of technical
        if (userFacingPatterns.some(pattern => pattern.test(commit))) {
          return true;
        }
        // Skip if technical but not user-facing
        if (technicalPatterns.some(pattern => pattern.test(commit))) {
          return false;
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

function extractUserFacingChange(commitMessage: string): string {
  const versionMatch = commitMessage.match(/^VERSION-[^:]*(?::\s*(.+))?/i);
  if (versionMatch) {
    let description = versionMatch[1] ? versionMatch[1].trim() : '';
    
    if (!description) {
      const shortVersionMatch = commitMessage.match(/^VERSION-[\d.]+\s+(.+)/i);
      if (shortVersionMatch) {
        description = shortVersionMatch[1].trim();
      }
    }
    
    const firstSentence = description.split('.')[0].trim();
    if (firstSentence.length > 20) {
      description = firstSentence;
    }
    
    // Clean up specific patterns
    if (description.match(/Add.*simultaneous.*download/i)) {
      return 'Added simultaneous download functionality';
    }
    if (description.match(/Fix.*About.*dialog.*version/i)) {
      return 'Fixed About dialog version display and improved process management';
    }
    if (description.match(/Update.*About.*dialog.*version/i)) {
      return 'Fixed About dialog version display and improved process management';
    }
    if (description.match(/Fix.*Morgan.*Library.*manifest/i)) {
      return 'Fixed Morgan Library manifest loading for themorgan.org manuscripts';
    }
    if (description.match(/Fix.*FLORUS.*hanging/i)) {
      return 'Fixed FLORUS hanging on calculating stage';
    }
    if (description.match(/Fix.*Orleans.*persistent.*hanging/i)) {
      return 'Fixed Orleans library persistent hanging issue with batch processing';
    }
    if (description.match(/Fix.*GitHub.*Actions.*Telegram/i)) {
      return 'Fixed automated build notifications to work with TypeScript bot';
    }
    if (description.match(/Complete.*Stanford.*Parker.*Graz/i)) {
      return 'Completed Stanford Parker and Graz library support verification';
    }
    
    return description;
  }
  
  // Handle non-VERSION commits
  if (commitMessage.match(/Fix.*Orleans.*hanging/i)) {
    return 'Fixed Orleans library hanging on calculation stage';
  }
  
  if (commitMessage.match(/Fix.*Telegram.*bot.*subscription/i)) {
    return 'Fixed Telegram bot subscription issues';
  }
  
  const specificLibraryMatch = commitMessage.match(/Fix(?:ed)?\s+(Morgan\s+Library|themorgan\.org|Gallica|Vatican|CUDL|ISOS|MIRA|Trinity|Cambridge|Orleans|Manuscripta|Stanford|Parker|FLORUS|BM\s+Lyon)[^:]*(?::\s*(.+))?/i);
  if (specificLibraryMatch) {
    const libraryName = specificLibraryMatch[1];
    const description = specificLibraryMatch[2] || 'issues';
    return `Fixed ${libraryName} ${description}`;
  }
  
  const hangingMatch = commitMessage.match(/Fix(?:ed)?\s+([^:]+?)\s+hanging/i);
  if (hangingMatch) {
    return `Fixed ${hangingMatch[1]} hanging issue`;
  }
  
  const libraryMatch = commitMessage.match(/Add(?:ed)?\s+([^:,]+?)\s+support/i);
  if (libraryMatch) {
    const libraryName = libraryMatch[1].trim();
    return `Added ${libraryName} support`;
  }
  
  const fixMatch = commitMessage.match(/Fix(?:ed)?\s+([^:,]+?)(?:\s+by|\s+-|\s+and|$)/i);
  if (fixMatch) {
    return `Fixed ${fixMatch[1]}`;
  }
  
  const enhanceMatch = commitMessage.match(/Enhanc(?:e|ed)\s+([^:,]+?)(?:\s+by|\s+-|\s+and|$)/i);
  if (enhanceMatch) {
    return `Enhanced ${enhanceMatch[1]}`;
  }
  
  const colIndex = commitMessage.indexOf(':');
  if (colIndex > 10) {
    return commitMessage.substring(0, colIndex).trim();
  }
  
  return commitMessage.trim();
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

function findAllBuilds() {
  return BuildUtils.findLatestBuilds();
}

async function sendMultiplatformBuild(): Promise<void> {
  try {
    const { version, builds } = findAllBuilds();
    
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
        'amd64': '🖥️ Windows AMD64',
        'arm64': '💻 Windows ARM64',
        'linux': '🐧 Linux AppImage'
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
    
    const bot = new MultiplatformMSSBot();
    
    console.log('🤖 Sending multiplatform build notification...');
    await bot.notifySubscribers(message, builds);
    
    console.log('✅ Multiplatform build notification sent successfully!');
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
    const bot = new MultiplatformMSSBot();
    // This is a simplified version - we'd need to expose subscribers or create a method
    console.log('✅ Custom message functionality needs to be implemented!');
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