#!/usr/bin/env node

// ⚠️ DEPRECATED: This script only supports AMD64 builds
// Use send-multiplatform-build.js for full platform support
console.warn('⚠️  WARNING: send-build.js is DEPRECATED');
console.warn('📱 Use send-multiplatform-build.js for multiplatform support');
console.warn('🔄 Redirecting to multiplatform script...\n');

const MSSTelegramBot = require('./bot');
const BuildUtils = require('./build-utils');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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
        
        // For this build, highlight the major recent improvements
        const recentImprovements = [
            "✅ Fixed right-click context menu to enable Cut/Copy/Paste functionality",
            "✅ Added LibraryOptimizationService for better download performance",
            "✅ Implemented dynamic download step size optimization",
            "✅ Added library-specific auto-split thresholds and concurrency limits",
            "✅ Enhanced timeout handling with progressive backoff"
        ];
        
        // Also look for user-facing library/feature commits
        const technicalPatterns = [
            /^Bump version/i,
            /Generated with Claude Code/i,
            /Fix GitHub Actions/i,
            /Fix Telegram/i,
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
            /Fix.*SmartScreen/i
        ];
        
        // Look for user-facing commits that mention features/fixes
        const userFacingPatterns = [
            /^VERSION-.*optimization/i,
            /^VERSION-.*LibraryOptimization/i,
            /Add.*support/i,
            /Added.*support/i,
            /Fixed.*hanging/i,
            /Fixed.*error/i,
            /Fixed.*issue/i,
            /Enhanced.*handling/i,
            /Implement.*progress/i,
            /Add.*library/i,
            /Fix.*download/i,
            /Enhanced.*cache/i,
            /Fixed.*loading/i,
            /Added.*progress/i,
            /Improve.*download/i,
            /Enhance.*manuscript/i,
            /support.*library/i,
            /add.*support.*library/i,
            /Fixed.*AbortError/i,
            /Fixed.*timeout/i,
            /Enhanced.*timeout/i,
            /Fixed.*403/i,
            /Fixed.*HTTP/i,
            /support.*IIIF/i,
            /Fixed.*right.?click/i,
            /Fix.*context.*menu/i,
            /Enhanced.*context.*menu/i,
            /Add.*copy.*paste/i,
            /Enable.*Cut.*Copy.*Paste/i
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
                if (changelogItems.length >= 3) return; // Max 3 items
                
                // Clean up commit message
                let cleaned = commit
                    .replace(/^WEB-\d+\s+/, '') // Remove ticket numbers
                    .replace(/🤖.*$/, '') // Remove Claude signature
                    .replace(/\s+Update version.*$/, '') // Remove version update mentions
                    .trim();
                
                // Extract the most relevant part for users
                cleaned = extractUserFacingChange(cleaned);
                
                // Avoid duplicates
                if (!seenChanges.has(cleaned.toLowerCase())) {
                    seenChanges.add(cleaned.toLowerCase());
                    changelogItems.push(`• ${formatText(cleaned)}`);
                }
            });
        
        // For recent versions (1.0.89+), show the major improvements we just made
        const versionParts = version.split('.');
        const versionNum = parseFloat(versionParts[0] + '.' + (versionParts[1] || '0') + (versionParts[2] || '0').padStart(2, '0'));
        if (versionNum >= 1.089) {
            // Show recent major improvements
            const improvements = recentImprovements.slice(0, 3); // Show top 3
            
            // Add any library/feature commits found
            if (changelogItems.length > 0) {
                improvements.push(...changelogItems.slice(0, 2));
            }
            
            return `${bold("📝 What's New:")}\n${improvements.join('\n')}`;
        }
        
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
    
    // If it mentions adding support for a specific library, extract that
    const libraryMatch = commitMessage.match(/Add(?:ed)?\s+([^:,]+?)\s+support/i);
    if (libraryMatch) {
        const libraryName = libraryMatch[1].trim();
        return `Added ${libraryName} support`;
    }
    
    // If it mentions multiple library support, extract that
    const multiLibraryMatch = commitMessage.match(/Add(?:ed)?\s+([^:]+?library|libraries)/i);
    if (multiLibraryMatch) {
        return `Added new manuscript library support`;
    }
    
    // If it mentions fixing a hanging issue, that's important
    const hangingMatch = commitMessage.match(/Fix(?:ed)?\s+([^:]+?)\s+hanging/i);
    if (hangingMatch) {
        return `Fixed ${hangingMatch[1]} hanging issue`;
    }
    
    // If it mentions fixing HTTP/403/timeout errors, extract that
    const errorMatch = commitMessage.match(/Fix(?:ed)?\s+([^:]+?)\s+(403|HTTP|timeout|error)/i);
    if (errorMatch) {
        return `Fixed ${errorMatch[1]} ${errorMatch[2]} issues`;
    }
    
    // If it mentions fixing right-click or context menu issues
    const contextMenuMatch = commitMessage.match(/Fix(?:ed)?\s+([^:]*?)\s*(right.?click|context.*menu)/i);
    if (contextMenuMatch) {
        return `Fixed right-click context menu functionality`;
    }
    
    // If it mentions adding copy/paste functionality
    const copyPasteMatch = commitMessage.match(/(Add|Enable).*copy.*paste/i);
    if (copyPasteMatch) {
        return `Added copy/paste functionality to context menu`;
    }
    
    // If it mentions improving download functionality
    const downloadMatch = commitMessage.match(/Improve(?:d)?\s+download\s+functionality/i);
    if (downloadMatch) {
        return `Improved download functionality`;
    }
    
    // If it mentions enhancing manuscript downloader
    const manuscriptMatch = commitMessage.match(/Enhance(?:d)?\s+manuscript\s+downloader/i);
    if (manuscriptMatch) {
        return `Enhanced manuscript downloader`;
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
    
    // General implementation pattern  
    const implementMatch = commitMessage.match(/Implement(?:ed)?\s+([^:,]+?)(?:\s+by|\s+-|\s+and|$)/i);
    if (implementMatch) {
        return `Implemented ${implementMatch[1]}`;
    }
    
    // Take the first meaningful part before colon
    const beforeColon = commitMessage.split(':')[0].trim();
    if (beforeColon.length > 10) {
        return beforeColon;
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
    
    return `${bold("📝 What's New:")}\n• Latest updates and improvements`;
}

async function sendBuild() {
    try {
        // Use the new BuildUtils for reliable build detection
        const buildResult = BuildUtils.findSinglePlatformBuild('amd64');
        
        if (!buildResult.buildFile) {
            console.error('❌ No Windows AMD64 builds found. Run "npm run dist:win:x64" first.');
            process.exit(1);
        }
        
        const buildFile = buildResult.buildFileName;
        const buildPath = path.dirname(buildResult.buildFile);
        const actualVersion = buildResult.version;
        
        const windowsBuilds = [buildFile];
        
        console.log(`📦 Found Windows builds for v${actualVersion}:`);
        windowsBuilds.forEach(build => console.log(`  - ${build}`));
        
        const fullBuildFile = path.join(buildPath, buildFile);
        const stats = fs.statSync(fullBuildFile);
        const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
        
        // Get changelog from recent commits
        const changelog = getChangelogFromCommits(actualVersion);
        
        const message = `
🚀 ${bold(`MSS Downloader v${actualVersion} Available!`)}

📦 Version: v${formatText(actualVersion)}
💻 Platform: Windows AMD64
📁 File: ${formatText(buildFile)}
📊 Size: ${fileSizeMB} MB
📅 Built: ${formatText(new Date().toLocaleString())}

${changelog}

${bold("📥 Installation Instructions:")}
1. Download the file from GitHub release
2. Run the installer (digitally signed and safe)
3. Follow the installer prompts

💡 ${bold("Note:")} The app is digitally signed for security. Windows should install without warnings.

📥 Download and install to get the latest features and fixes!
        `.trim();
        
        const bot = new MSSTelegramBot();
        
        console.log('🤖 Sending build notification...');
        
        // Override the bot's file handler to add URL validation
        const originalNotifySubscribers = bot.notifySubscribers.bind(bot);
        bot.notifySubscribers = async function(message, file) {
            // Call original with validation wrapper
            const originalSendFileToSubscriber = bot.sendFileToSubscriber.bind(bot);
            bot.sendFileToSubscriber = async function(chatId, message, fileResult) {
                // Validate GitHub release URLs before sending
                if (fileResult.type === 'github_release' && fileResult.downloadUrl) {
                    const validation = BuildUtils.validateDownloadUrl(fileResult.downloadUrl);
                    if (!validation.valid) {
                        console.error(`❌ URL validation failed: ${validation.reason}`);
                        console.error(`❌ Invalid URL: ${fileResult.downloadUrl}`);
                        throw new Error(`URL validation failed: ${validation.reason}`);
                    }
                    console.log(`✅ URL validation passed: v${validation.version} - ${validation.filename}`);
                }
                return originalSendFileToSubscriber(chatId, message, fileResult);
            };
            
            return originalNotifySubscribers(message, file);
        };
        
        await bot.notifySubscribers(message, fullBuildFile);
        
        console.log('✅ Build notification sent successfully!');
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Error sending build:', error);
        process.exit(1);
    }
}

function showHelp() {
    console.log(`
MSS Downloader Build Sender

Usage:
  node send-build.js                 Send latest build to subscribers
  node send-build.js --help          Show this help
  node send-build.js --message "msg" Send custom message (no file)

Prerequisites:
  - TELEGRAM_BOT_TOKEN environment variable must be set
  - Run "npm run dist" to create Windows builds
  - At least one subscriber must be registered

Examples:
  export TELEGRAM_BOT_TOKEN="your_bot_token_here"
  npm run dist
  node telegram-bot/send-build.js
    `);
}

async function sendMessage(customMessage) {
    try {
        const bot = new MSSTelegramBot();
        await bot.notifySubscribers(customMessage);
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
    sendBuild();
}