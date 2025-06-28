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
    const commits = execSync('git log --oneline -5 --pretty=format:"%s"', { encoding: 'utf8' }).trim().split('\n');
    
    // Find the most recent VERSION commit for the current version
    const currentVersionCommit = commits.find(commit => 
      commit.match(new RegExp(`^VERSION-${version.replace(/\./g, '\\.')}:`, 'i'))
    );
    
    if (currentVersionCommit) {
      // Extract the change description from this specific version commit
      const cleaned = extractUserFacingChange(currentVersionCommit);
      
      // Only show meaningful changes, skip generic internal improvements
      if (!cleaned.match(/^Internal improvements|^Version bump|^Stability fixes$/i)) {
        return `${bold("📝 What's New:")}\n✅ ${formatText(cleaned)}`;
      }
    }
    
    // Fallback: Look for recent meaningful changes (last 3 commits only)
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
      /Complete.*implementation$/i,
      /Implement.*comprehensive.*process.*management/i
    ];
    
    const meaningfulCommits = commits
      .slice(0, 3)  // Only look at last 3 commits
      .filter(commit => {
        // Skip technical commits
        if (technicalPatterns.some(pattern => pattern.test(commit))) {
          return false;
        }
        // Include VERSION commits or obvious fixes
        return commit.match(/^VERSION-|^Fix.*library|^Fix.*UI|^Add.*support|^Improve/i);
      })
      .slice(0, 1)  // Take only the first meaningful commit
      .map(commit => extractUserFacingChange(commit))
      .filter(change => !change.match(/^Internal improvements|^Version bump|^Stability fixes$/i));
    
    if (meaningfulCommits.length > 0) {
      return `${bold("📝 What's New:")}\n✅ ${formatText(meaningfulCommits[0])}`;
    }
    
    return getChangelogFromVersionHistory(version);
  } catch (error) {
    console.error('Error generating changelog:', error);
    return getChangelogFromVersionHistory(version);
  }
}

function extractUserFacingChange(commitMessage: string): string {
  // Handle VERSION- prefixed commits
  const versionMatch = commitMessage.match(/^VERSION-[^:]*(?::\s*(.+))?/i);
  if (versionMatch) {
    let description = versionMatch[1] ? versionMatch[1].trim() : '';
    
    if (!description) {
      const shortVersionMatch = commitMessage.match(/^VERSION-[\d.]+\s+(.+)/i);
      if (shortVersionMatch) {
        description = shortVersionMatch[1].trim();
      }
    }
    
    // Extract user-facing changes from VERSION commit descriptions
    if (description) {
      // Fix Vienna Manuscripta page range detection for specific page URLs
      if (description.match(/Fix.*Vienna.*Manuscripta.*page.*range/i)) {
        return 'Fixed Vienna Manuscripta page downloads - Page-specific URLs now work correctly';
      }
      
      // Fix critical library and UI issues
      if (description.match(/Fix.*critical.*library.*UI/i)) {
        return 'Fixed multiple critical library issues and improved UI responsiveness';
      }
      
      // Implement comprehensive process management system
      if (description.match(/Implement.*comprehensive.*process.*management/i)) {
        return 'Internal improvements and stability fixes';
      }
      
      // Generic library fixes
      if (description.match(/Fix.*library/i)) {
        const libraryMatch = description.match(/Fix\s+([^,]+?)\s+(?:library|downloads?|issues?)/i);
        if (libraryMatch) {
          return `Fixed ${libraryMatch[1]} library downloads`;
        }
        return 'Fixed library download issues';
      }
      
      // UI improvements
      if (description.match(/Fix.*UI|Improve.*UI|Enhanced?.*UI/i)) {
        return 'Improved user interface and controls';
      }
      
      // Quality improvements
      if (description.match(/quality|resolution|image/i)) {
        return 'Improved download quality and image resolution';
      }
      
      // Split up long descriptions into first meaningful part
      const firstSentence = description.split(/[.;-]/)[0].trim();
      if (firstSentence.length > 20) {
        return firstSentence;
      }
      
      return description;
    }
    
    // If no description after colon, return generic message for VERSION commits
    return 'Internal improvements and stability fixes';
  } else {
    // Handle non-VERSION commits directly
    let description = commitMessage;
    
    // Extract first sentence and clean it up
    const firstSentence = description.split('.')[0].trim();
    if (firstSentence.length > 10) {
      description = firstSentence;
    }
    
    // Add specific patterns for InternetCulturale timeout fix
    if (description.match(/Fix.*InternetCulturale.*timeout/i)) {
      return 'Fixed InternetCulturale download timeout for large manuscripts';
    }
    if (description.match(/Fix.*download.*timeout/i)) {
      return 'Fixed download timeout issues for large manuscripts';
    }
    
    // Clean up other specific patterns
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
  
  // Handle non-VERSION commits (this part shouldn't be reached now due to new structure)
  if (commitMessage.match(/Fix.*Orleans.*hanging/i)) {
    return 'Fixed Orleans library hanging on calculation stage';
  }
  
  if (commitMessage.match(/Fix.*Telegram.*bot.*subscription/i)) {
    return 'Fixed Telegram bot subscription issues';
  }
  
  const specificLibraryMatch = commitMessage.match(/Fix(?:ed)?\s+(Morgan\s+Library|themorgan\.org|Gallica|Vatican|CUDL|ISOS|MIRA|Trinity|Cambridge|Orleans|Manuscripta|Stanford|Parker|FLORUS|BM\s+Lyon)[^:]*(?::\s*(.+))?/i);
  if (specificLibraryMatch?.[1]) {
    const libraryName = specificLibraryMatch![1];
    const description = specificLibraryMatch![2] || 'issues';
    return `Fixed ${libraryName} ${description}`;
  }
  
  const hangingMatch = commitMessage.match(/Fix(?:ed)?\s+([^:]+?)\s+hanging/i);
  if (hangingMatch?.[1]) {
    return `Fixed ${hangingMatch![1]} hanging issue`;
  }
  
  const libraryMatch = commitMessage.match(/Add(?:ed)?\s+([^:,]+?)\s+support/i);
  if (libraryMatch?.[1]) {
    const libraryName = libraryMatch![1].trim();
    return `Added ${libraryName} support`;
  }
  
  const fixMatch = commitMessage.match(/Fix(?:ed)?\s+([^:,]+?)(?:\s+by|\s+-|\s+and|$)/i);
  if (fixMatch?.[1]) {
    return `Fixed ${fixMatch![1]}`;
  }
  
  const enhanceMatch = commitMessage.match(/Enhanc(?:e|ed)\s+([^:,]+?)(?:\s+by|\s+-|\s+and|$)/i);
  if (enhanceMatch?.[1]) {
    return `Enhanced ${enhanceMatch![1]}`;
  }
  
  const colIndex = commitMessage.indexOf(':');
  if (colIndex > 10) {
    return commitMessage.substring(0, colIndex).trim();
  }
  
  return commitMessage.trim();
}

function getChangelogFromVersionHistory(version: string): string {
  // Try to extract meaningful changes from git logs using a more aggressive approach
  try {
    const commits = execSync('git log --oneline -10 --pretty=format:"%s"', { encoding: 'utf8' }).trim().split('\n');
    
    // Look for any library mentions or specific fixes, even in technical commits
    const meaningfulChanges = commits
      .filter(commit => {
        // Look for library names, fix patterns, or improvements
        return commit.match(/(?:Fix|Fixed|Add|Added|Improve|Enhanced|Support).*(?:library|Library|downloads?|manuscript|Manuscripta|Vienna|Morgan|Europeana|NYPL|quality|UI|page|range)/i) ||
               commit.match(/VERSION-[^:]*:\s*(?!Version bump|Internal|Implement\s+comprehensive\s+process)/i);
      })
      .slice(0, 2)
      .map(commit => {
        // Extract meaningful part from commit message
        let change = commit.replace(/^VERSION-[^:]*:\s*/i, '').trim();
        
        // Apply specific transformations for user-facing language
        if (change.match(/Fix.*Vienna.*Manuscripta.*page.*range/i)) {
          return '✅ Fixed Vienna Manuscripta page downloads - Page-specific URLs now work correctly';
        }
        if (change.match(/Fix.*Europeana.*manifest.*displayName/i)) {
          return '✅ Fixed Europeana library downloads';
        }
        if (change.match(/Fix.*Morgan.*Library.*quality/i)) {
          return '✅ Enhanced Morgan Library image quality (5x improvement)';
        }
        if (change.match(/Fix.*critical.*library.*UI/i)) {
          return '✅ Fixed multiple critical library issues and improved UI responsiveness';
        }
        if (change.match(/Improve.*UI.*controls.*responsiveness/i)) {
          return '✅ Improved download controls responsiveness';
        }
        
        // Generic cleanup for other patterns
        change = change.replace(/^(Fix|Fixed|Add|Added|Improve|Enhanced)\s+/i, '');
        if (change.length > 60) {
          change = change.split(/[.;-]/)[0].trim();
        }
        
        return `✅ ${change.charAt(0).toUpperCase() + change.slice(1)}`;
      });
    
    if (meaningfulChanges.length > 0) {
      return `${bold("📝 What's New:")}\n${meaningfulChanges.join('\n')}`;
    }
  } catch (error) {
    console.error('Error reading git commits for changelog:', error);
  }
  
  // Try to read from CLAUDE.md version history as backup
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
        .map(item => `✅ ${item.description}`);
      
      if (recentVersions.length > 0) {
        return `${bold("📝 What's New:")}\n${recentVersions.join('\n')}`;
      }
    }
  } catch (error) {
    console.error('Error reading version history:', error);
  }
  
  // Last resort fallback - but at least make it more specific
  return `${bold("📝 What's New:")}\n✅ Bug fixes and stability improvements`;
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