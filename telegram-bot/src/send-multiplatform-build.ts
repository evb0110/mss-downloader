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
const LIBRARY_MAPPINGS: Record<string, string> = {
  'internet culturale': 'Internet Culturale (Italian Cultural Heritage)',
  'internet-culturale': 'Internet Culturale (Italian Cultural Heritage)',
  'internetculturale': 'Internet Culturale (Italian Cultural Heritage)',
  'university of graz': 'University of Graz (Austria)',
  'graz': 'University of Graz (Austria)',
  'rome bnc': 'Rome National Central Library (Italy)',
  'rome-bnc': 'Rome National Central Library (Italy)',
  'manuscripta.at': 'Manuscripta.at (Austria)',
  'manuscripta at': 'Manuscripta.at (Austria)',
  'e-manuscripta': 'e-manuscripta.ch (Switzerland)',
  'e-manuscripta.ch': 'e-manuscripta.ch (Switzerland)',
  'europeana': 'Europeana (European Digital Library)',
  'vienna manuscripta': 'Vienna Manuscripta (Austria)',
  'morgan library': 'Morgan Library & Museum (New York)',
  'themorgan': 'Morgan Library & Museum (New York)',
  'gallica': 'Gallica (French National Library)',
  'vatican': 'Vatican Apostolic Library',
  'british library': 'British Library (UK)',
  'cambridge': 'Cambridge University Library (UK)',
  'stanford': 'Stanford Libraries (USA)',
  'parker': 'Parker Library (Cambridge, UK)',
  'trinity': 'Trinity College Library (Dublin)',
  'cudl': 'Cambridge Digital Library (UK)',
  'orleans': 'Orléans Library (France)',
  'florence': 'Florence Libraries (Italy)',
  'heidelberg': 'Heidelberg University Library (Germany)',
  'rbme': 'Real Biblioteca del Monasterio de El Escorial (Spain)',
  'cologne': 'University of Cologne Library (Germany)',
  'verona': 'Verona Biblioteca (Italy)',
  'modena': 'Modena State Archive (Italy)',
  'vallicelliana': 'Vallicelliana Library (Rome, Italy)',
  'monte cassino': 'Monte Cassino Abbey (Italy)',
  'czech digital': 'Czech Digital Library',
  'sweden manuscripta': 'Manuscripta.se (Sweden)',
  'bdl': 'Bavarian State Library (Germany)',
  'florus': 'FLORUS (Lyon, France)',
  'nypl': 'New York Public Library (USA)',
  'mira': 'MIRA (Germany)',
  'isos': 'ISOS (Irish Script on Screen)',
  'bm lyon': 'Municipal Library of Lyon (France)'
};

function extractUserFacingChangesFromVersionCommit(commitMessage: string): string[] {
  // Extract the description after "VERSION-X.X.X: "
  const versionMatch = commitMessage.match(/^VERSION-[^:]*:\s*(.+)/i);
  if (!versionMatch) return [];
  
  const description = versionMatch[1].trim();
  const changes: string[] = [];
  
  // Semantic parsing approach: extract meaningful components
  const semanticData = parseSemanticComponents(description);
  
  // Convert semantic components to user-facing benefits
  for (const component of semanticData) {
    const userBenefit = translateToUserBenefit(component);
    if (userBenefit && !changes.includes(userBenefit)) {
      changes.push(userBenefit);
    }
  }
  
  // If no semantic parsing succeeded, fallback to intelligent pattern matching
  if (changes.length === 0) {
    const fallbackChanges = extractWithIntelligentPatterns(description);
    changes.push(...fallbackChanges);
  }
  
  // Remove duplicates and limit to 3 most important changes
  return [...new Set(changes)].slice(0, 3);
}

interface SemanticComponent {
  action: 'fix' | 'add' | 'implement' | 'improve' | 'enhance' | 'eliminate' | 'resolve';
  target: string;
  library?: string;
  issueType?: 'timeout' | 'infinite_loop' | 'hanging' | 'authentication' | 'performance' | 'quality' | 'pagination' | 'monitoring';
  context?: string;
}

function parseSemanticComponents(description: string): SemanticComponent[] {
  const components: SemanticComponent[] = [];
  
  // Split by common separators and analyze each part
  const parts = description.split(/[,;-]|and\s+(?=\w)/i).map(part => part.trim()).filter(Boolean);
  
  for (const part of parts) {
    const component = parseIndividualComponent(part);
    if (component) {
      components.push(component);
    }
  }
  
  return components;
}

function parseIndividualComponent(text: string): SemanticComponent | null {
  const lowerText = text.toLowerCase();
  
  // Extract action
  let action: SemanticComponent['action'] | null = null;
  if (lowerText.match(/^(fix|fixed|fixing)/)) action = 'fix';
  else if (lowerText.match(/^(add|added|adding)/)) action = 'add';
  else if (lowerText.match(/^(implement|implementing|implemented)/)) action = 'implement';
  else if (lowerText.match(/^(improve|improved|improving|enhance|enhanced|enhancing)/)) action = 'improve';
  else if (lowerText.match(/^(eliminate|eliminated|eliminating)/)) action = 'eliminate';
  else if (lowerText.match(/^(resolve|resolved|resolving)/)) action = 'resolve';
  
  if (!action) return null;
  
  // Extract library name
  let library: string | undefined;
  for (const [key, fullName] of Object.entries(LIBRARY_MAPPINGS)) {
    if (lowerText.includes(key.toLowerCase())) {
      library = fullName;
      break;
    }
  }
  
  // Extract issue type
  let issueType: SemanticComponent['issueType'] | undefined;
  if (lowerText.includes('timeout')) issueType = 'timeout';
  else if (lowerText.includes('infinite loop') || lowerText.includes('infinite-loop')) issueType = 'infinite_loop';
  else if (lowerText.includes('hanging') || lowerText.includes('hung')) issueType = 'hanging';
  else if (lowerText.includes('authentication') || lowerText.includes('auth')) issueType = 'authentication';
  else if (lowerText.includes('performance') || lowerText.includes('speed')) issueType = 'performance';
  else if (lowerText.includes('quality') || lowerText.includes('resolution')) issueType = 'quality';
  else if (lowerText.includes('pagination') || lowerText.includes('page')) issueType = 'pagination';
  else if (lowerText.includes('monitoring') || lowerText.includes('progress')) issueType = 'monitoring';
  
  return {
    action,
    target: text,
    library,
    issueType,
    context: text
  };
}

function translateToUserBenefit(component: SemanticComponent): string | null {
  const { action, library, issueType } = component;
  
  // Library-specific fixes
  if (library && (action === 'fix' || action === 'resolve')) {
    if (issueType === 'timeout') {
      return `Fixed ${library} loading timeouts for large manuscripts`;
    } else if (issueType === 'infinite_loop') {
      return `Fixed ${library} infinite download loops`;
    } else if (issueType === 'hanging') {
      return `Fixed ${library} hanging downloads`;
    } else if (issueType === 'authentication') {
      return `Improved ${library} authentication handling`;
    } else if (issueType === 'pagination') {
      return `Fixed ${library} complete manuscript downloads`;
    } else {
      return `Fixed ${library} download issues`;
    }
  }
  
  // Library additions
  if (library && action === 'add') {
    return `Added ${library} manuscript collection support`;
  }
  
  // General improvements
  if (action === 'implement') {
    if (component.target.includes('intelligent') && component.target.includes('progress')) {
      return 'Improved download reliability with real-time progress tracking';
    } else if (component.target.includes('monitoring')) {
      return 'Enhanced download progress monitoring';
    } else if (component.target.includes('timeout')) {
      return 'Improved timeout detection and handling';
    }
  }
  
  if (action === 'improve' || action === 'enhance') {
    if (issueType === 'performance') {
      return 'Enhanced download performance';
    } else if (issueType === 'quality') {
      return 'Improved image quality and resolution';
    } else if (issueType === 'monitoring') {
      return 'Better download progress tracking';
    }
  }
  
  if (action === 'eliminate') {
    if (issueType === 'authentication') {
      return 'Improved authentication error handling';
    }
  }
  
  return null;
}

function extractWithIntelligentPatterns(description: string): string[] {
  const changes: string[] = [];
  const lowerDesc = description.toLowerCase();
  
  // Specific technical implementations that benefit users
  if (lowerDesc.includes('intelligent') && (lowerDesc.includes('progress') || lowerDesc.includes('monitoring'))) {
    changes.push('Improved download reliability with real-time progress tracking');
  } else if (lowerDesc.includes('timeout') && lowerDesc.includes('detection')) {
    changes.push('Enhanced timeout detection and handling');
  } else if (lowerDesc.includes('authentication') && lowerDesc.includes('error')) {
    changes.push('Improved authentication error handling');
  } else if (lowerDesc.includes('download') && lowerDesc.includes('performance')) {
    changes.push('Enhanced download performance');
  }
  
  // Fallback only if nothing else matched
  if (changes.length === 0) {
    if (lowerDesc.includes('fix') || lowerDesc.includes('resolve')) {
      changes.push('Library download improvements');
    } else if (lowerDesc.includes('add') || lowerDesc.includes('implement')) {
      changes.push('New functionality and features');
    } else if (lowerDesc.includes('improve') || lowerDesc.includes('enhance')) {
      changes.push('Performance and reliability improvements');
    }
  }
  
  return changes;
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
    
    // Use package.json version for changelog generation, not build version
    const packageJsonPath = path.join(__dirname, '..', '..', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const actualVersion = packageJson.version;
    
    console.log(`📝 Generating changelog for actual version v${actualVersion} (build version: v${version})`);
    const changelog = getChangelogFromCommits(actualVersion);
    
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