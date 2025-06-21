#!/usr/bin/env node

import { MultiplatformMSSBot } from './dist/multiplatform-bot.js';
import { BuildUtils } from './dist/build-utils.js';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// HTML formatting utilities for Telegram
function escapeHTML(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function bold(text) {
    return `<b>${escapeHTML(text)}</b>`;
}

function formatText(text) {
    return escapeHTML(text);
}

function getChangelogFromCommits(version) {
    try {
        // Get recent commits since last version
        const commits = execSync('git log --oneline -15 --pretty=format:"%s"', { encoding: 'utf8' }).trim().split('\n');
        
        // Technical commits to skip
        const technicalPatterns = [
            /^Bump version/i,
            /Generated with Claude Code/i,
            /Fix GitHub Actions/i,
            /Fix Telegram.*bot/i, // Skip Telegram bot commits - subscription issues handled separately
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
        
        // Look for user-facing commits
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
        
        const changelogItems = [];
        const seenChanges = new Set();
        
        commits
            .filter(commit => {
                // Skip technical commits
                if (technicalPatterns.some(pattern => pattern.test(commit))) {
                    return false;
                }
                // Only include commits that look user-facing
                return userFacingPatterns.some(pattern => pattern.test(commit));
            })
            .forEach(commit => {
                if (changelogItems.length >= 3) return; // Max 3 items from commits
                
                // Clean up commit message
                let cleaned = commit
                    .replace(/^WEB-\d+\s+/, '') // Remove ticket numbers
                    .replace(/🤖.*Generated with.*$/, '') // Remove Claude signature
                    .replace(/\s+Update version.*$/, '') // Remove version update mentions
                    .trim();
                
                // Extract the most relevant part for users
                cleaned = extractUserFacingChange(cleaned);
                
                // Avoid duplicates
                if (!seenChanges.has(cleaned.toLowerCase())) {
                    seenChanges.add(cleaned.toLowerCase());
                    changelogItems.push(`✅ ${formatText(cleaned)}`);
                }
            });
        
        if (changelogItems.length > 0) {
            return `${bold("📝 What's New:")}\n${changelogItems.join('\n')}`;
        } else {
            // Fallback to version history from CLAUDE.md
            return getChangelogFromVersionHistory(version);
        }
    } catch (error) {
        console.error('Error generating changelog:', error.message);
        return getChangelogFromVersionHistory(version);
    }
}

function extractUserFacingChange(commitMessage) {
    // Extract the most important part of the commit for users
    
    // If it's a VERSION commit, extract the meaningful part
    const versionMatch = commitMessage.match(/^VERSION-[^:]*(?::\s*(.+))?/i);
    if (versionMatch) {
        let description = versionMatch[1] ? versionMatch[1].trim() : '';
        
        // If no description after colon, extract from the whole commit
        if (!description) {
            // Handle commits like "VERSION-1.2.4 Complete Stanford Parker..."
            const shortVersionMatch = commitMessage.match(/^VERSION-[\d.]+\s+(.+)/i);
            if (shortVersionMatch) {
                description = shortVersionMatch[1].trim();
            }
        }
        
        // Extract the first sentence or main feature described
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
        if (description.match(/Complete.*Stanford.*Parker.*Graz/i)) {
            return 'Completed Stanford Parker and Graz library support verification';
        }
        
        return description;
    }
    
    // Handle non-VERSION commits
    
    // Fix Orleans hanging
    if (commitMessage.match(/Fix.*Orleans.*hanging/i)) {
        return 'Fixed Orleans library hanging on calculation stage';
    }
    
    // Fix Telegram bot subscription issues
    if (commitMessage.match(/Fix.*Telegram.*bot.*subscription/i)) {
        return 'Fixed Telegram bot subscription issues';
    }
    
    // If it mentions fixing a specific library like Morgan
    const specificLibraryMatch = commitMessage.match(/Fix(?:ed)?\s+(Morgan\s+Library|themorgan\.org|Gallica|Vatican|CUDL|ISOS|MIRA|Trinity|Cambridge|Orleans|Manuscripta|Stanford|Parker|FLORUS|BM\s+Lyon)[^:]*(?::\s*(.+))?/i);
    if (specificLibraryMatch) {
        const libraryName = specificLibraryMatch[1];
        const description = specificLibraryMatch[2] || 'issues';
        return `Fixed ${libraryName} ${description}`;
    }
    
    // If it mentions fixing a hanging issue, that's important
    const hangingMatch = commitMessage.match(/Fix(?:ed)?\s+([^:]+?)\s+hanging/i);
    if (hangingMatch) {
        return `Fixed ${hangingMatch[1]} hanging issue`;
    }
    
    // If it mentions adding support for a specific library, extract that
    const libraryMatch = commitMessage.match(/Add(?:ed)?\s+([^:,]+?)\s+support/i);
    if (libraryMatch) {
        const libraryName = libraryMatch[1].trim();
        return `Added ${libraryName} support`;
    }
    
    // General fix pattern
    const fixMatch = commitMessage.match(/Fix(?:ed)?\s+([^:,]+?)(?:\s+by|\s+-|\s+and|$)/i);
    if (fixMatch) {
        return `Fixed ${fixMatch[1]}`;
    }
    
    // General enhancement pattern
    const enhanceMatch = commitMessage.match(/Enhanc(?:e|ed)\s+([^:,]+?)(?:\s+by|\s+-|\s+and|$)/i);
    if (enhanceMatch) {
        return `Enhanced ${enhanceMatch[1]}`;
    }
    
    // Take the first meaningful part before colon
    const colIndex = commitMessage.indexOf(':');
    if (colIndex > 10) {
        return commitMessage.substring(0, colIndex).trim();
    }
    
    return commitMessage.trim();
}

function getChangelogFromVersionHistory(version) {
    // Fallback to extract relevant changes from CLAUDE.md version history
    try {
        const claudeContent = fs.readFileSync(path.join(__dirname, '..', 'CLAUDE.md'), 'utf8');
        const versionHistoryMatch = claudeContent.match(/### Version History\n([\s\S]*?)(?=\n##|\n### |$)/);
        
        if (versionHistoryMatch) {
            const versionHistory = versionHistoryMatch[1];
            
            // Get the most recent meaningful versions from version history
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
                .filter(item => item)
                .reverse() // Reverse to get most recent first
                .slice(0, 2) // Take 2 most recent
                .map(item => `• ${item.description}`);
            
            if (recentVersions.length > 0) {
                return `${bold("📝 What's New:")}\n${recentVersions.join('\n')}`;
            }
        }
    } catch (error) {
        console.error('Error reading version history:', error.message);
    }
    
    return `${bold("📝 What's New:")}\n• Latest updates and improvements with multi-platform support`;
}

function findAllBuilds() {
    // Use the new BuildUtils for reliable build detection
    return BuildUtils.findLatestBuilds();
}

async function sendMultiplatformBuild() {
    try {
        const { version, builds } = findAllBuilds();
        
        if (Object.keys(builds).length === 0) {
            console.error('❌ No builds found for version', version);
            process.exit(1);
        }
        
        console.log(`📦 Found builds for v${version}:`);
        Object.keys(builds).forEach(platform => {
            console.log(`  - ${platform}: ${builds[platform].name} (${builds[platform].size}MB)`);
        });
        
        // Get changelog from recent commits
        const changelog = getChangelogFromCommits(version);
        
        const platformSummary = Object.keys(builds).map(platform => {
            const platformNames = {
                'amd64': '🖥️ Windows AMD64',
                'arm64': '💻 Windows ARM64',
                'linux': '🐧 Linux AppImage'
            };
            return `${platformNames[platform]}: ${builds[platform].size}MB`;
        }).join('\n');
        
        const message = `
🚀 ${bold(`MSS Downloader v${version} Available!`)}

${changelog}

💻 ${bold("Available Platforms:")}
${platformSummary}

📅 Built: ${formatText(new Date().toLocaleString())}

📥 Download and install to get the latest features and fixes!
        `.trim();
        
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

function showHelp() {
    console.log(`
MSS Downloader Multiplatform Build Sender

Usage:
  node send-multiplatform-build.js            Send latest builds to subscribers
  node send-multiplatform-build.js --help     Show this help
  node send-multiplatform-build.js --message "msg" Send custom message (no files)

Prerequisites:
  - TELEGRAM_BOT_TOKEN environment variable must be set
  - Run build commands to create platform builds:
    * npm run dist:win:x64  (Windows AMD64)
    * npm run dist:win:arm  (Windows ARM64) 
    * npm run dist:linux    (Linux AppImage)
  - At least one subscriber must be registered

Examples:
  export TELEGRAM_BOT_TOKEN="your_bot_token_here"
  npm run dist:win:x64 && npm run dist:win:arm && npm run dist:linux
  node telegram-bot/send-multiplatform-build.js
    `);
}

async function sendMessage(customMessage) {
    try {
        const bot = new MultiplatformMSSBot();
        // Send to all subscribers regardless of platform preference for custom messages
        for (const subscriber of bot.subscribers) {
            await bot.bot.sendMessage(subscriber.chatId, customMessage, { parse_mode: 'HTML' });
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        console.log('✅ Custom message sent successfully!');
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