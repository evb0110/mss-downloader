#!/usr/bin/env node

/**
 * Simulate the Telegram bot changelog message with the new comprehensive system
 * Shows exactly what evb0110 would receive in Telegram
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Import the comprehensive changelog logic from our updated file
const LIBRARY_MAPPINGS = {
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

function extractUserFacingChangesFromVersionCommit(commitMessage) {
  const versionMatch = commitMessage.match(/^VERSION-[^:]*:\s*(.+)/i);
  if (!versionMatch) return [];
  
  const description = versionMatch[1].trim();
  const changes = [];
  
  const semanticData = parseSemanticComponents(description);
  
  for (const component of semanticData) {
    const userBenefit = translateToUserBenefit(component);
    if (userBenefit && !changes.includes(userBenefit)) {
      changes.push(userBenefit);
    }
  }
  
  if (changes.length === 0) {
    const fallbackChanges = extractWithIntelligentPatterns(description);
    changes.push(...fallbackChanges);
  }
  
  return [...new Set(changes)].slice(0, 3);
}

function parseSemanticComponents(description) {
  const components = [];
  const parts = description.split(/[,;-]|and\s+(?=\w)/i).map(part => part.trim()).filter(Boolean);
  
  for (const part of parts) {
    const component = parseIndividualComponent(part);
    if (component) {
      components.push(component);
    }
  }
  
  return components;
}

function parseIndividualComponent(text) {
  const lowerText = text.toLowerCase();
  
  let action = null;
  if (lowerText.match(/^(fix|fixed|fixing)/)) action = 'fix';
  else if (lowerText.match(/^(add|added|adding)/)) action = 'add';
  else if (lowerText.match(/^(implement|implementing|implemented)/)) action = 'implement';
  else if (lowerText.match(/^(improve|improved|improving|enhance|enhanced|enhancing)/)) action = 'improve';
  else if (lowerText.match(/^(eliminate|eliminated|eliminating)/)) action = 'eliminate';
  else if (lowerText.match(/^(resolve|resolved|resolving)/)) action = 'resolve';
  
  if (!action) return null;
  
  let library;
  for (const [key, fullName] of Object.entries(LIBRARY_MAPPINGS)) {
    if (lowerText.includes(key.toLowerCase())) {
      library = fullName;
      break;
    }
  }
  
  let issueType;
  if (lowerText.includes('timeout')) issueType = 'timeout';
  else if (lowerText.includes('infinite loop') || lowerText.includes('infinite-loop')) issueType = 'infinite_loop';
  else if (lowerText.includes('hanging') || lowerText.includes('hung')) issueType = 'hanging';
  else if (lowerText.includes('authentication') || lowerText.includes('auth')) issueType = 'authentication';
  else if (lowerText.includes('performance') || lowerText.includes('speed')) issueType = 'performance';
  else if (lowerText.includes('quality') || lowerText.includes('resolution')) issueType = 'quality';
  else if (lowerText.includes('pagination') || lowerText.includes('page')) issueType = 'pagination';
  else if (lowerText.includes('monitoring') || lowerText.includes('progress')) issueType = 'monitoring';
  
  return { action, target: text, library, issueType, context: text };
}

function translateToUserBenefit(component) {
  const { action, library, issueType } = component;
  
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
  
  if (library && action === 'add') {
    return `Added ${library} manuscript collection support`;
  }
  
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

function extractWithIntelligentPatterns(description) {
  const changes = [];
  const lowerDesc = description.toLowerCase();
  
  if (lowerDesc.includes('intelligent') && (lowerDesc.includes('progress') || lowerDesc.includes('monitoring'))) {
    changes.push('Improved download reliability with real-time progress tracking');
  } else if (lowerDesc.includes('timeout') && lowerDesc.includes('detection')) {
    changes.push('Enhanced timeout detection and handling');
  } else if (lowerDesc.includes('authentication') && lowerDesc.includes('error')) {
    changes.push('Improved authentication error handling');
  } else if (lowerDesc.includes('download') && lowerDesc.includes('performance')) {
    changes.push('Enhanced download performance');
  }
  
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

function generateChangelogFromCommits(version) {
  try {
    const commits = execSync('git log --oneline -20 --pretty=format:"%s"', { encoding: 'utf8' }).trim().split('\n');
    
    const currentVersionCommit = commits.find(commit => 
      commit.match(new RegExp(`^VERSION-${version.replace(/\./g, '\\.')}:`, 'i'))
    );
    
    if (currentVersionCommit) {
      const userFacingChanges = extractUserFacingChangesFromVersionCommit(currentVersionCommit);
      
      if (userFacingChanges.length > 0) {
        return userFacingChanges.map(change => `✅ ${change}`);
      }
    }
    
    return ['✅ Bug fixes and stability improvements'];
  } catch (error) {
    console.error('Error generating changelog:', error);
    return ['✅ Bug fixes and stability improvements'];
  }
}

function simulateChangelogMessage() {
  console.log('🧪 SIMULATING TELEGRAM BOT MESSAGE FOR EVB0110');
  console.log('=============================================\n');
  
  // Get current version
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const version = packageJson.version;
  
  // Generate changelog using our new system
  const changelogEntries = generateChangelogFromCommits(version);
  
  // Create the message as it would appear in Telegram
  const telegramMessage = [
    `🚀 <b>MSS Downloader v${version} Available!</b>`,
    '',
    '<b>📝 What\'s New:</b>',
    ...changelogEntries,
    '',
    '<b>💻 Available Platforms:</b>',
    '🖥️ Windows AMD64 (Default): 82.92MB',
    '💻 Windows ARM64: 88.87MB', 
    '🐧 Linux AppImage: 85.48MB',
    '🍎 macOS (Apple Silicon): 92.36MB',
    '',
    `📅 Built: ${new Date().toLocaleString()}`,
    '',
    '📥 Download and install to get the latest features and fixes!',
    '',
    '<b>📥 Direct Downloads:</b>',
    '🔗 🖥️ Windows AMD64 (x64) - Default (https://github.com/evb0110/mss-downloader/releases/download/v' + version + '/Abba.Ababus.MSS.Downloader.Setup.' + version + '-x64.exe)',
    '🔗 💻 Windows ARM64 (https://github.com/evb0110/mss-downloader/releases/download/v' + version + '/Abba.Ababus.MSS.Downloader.Setup.' + version + '-arm64.exe)',
    '🔗 🐧 Linux AppImage (https://github.com/evb0110/mss-downloader/releases/download/v' + version + '/Abba.Ababus.MSS.Downloader.' + version + '.AppImage)',
    '🔗 🍎 macOS (Apple Silicon) (https://github.com/evb0110/mss-downloader/releases/download/v' + version + '/Abba.Ababus.MSS.Downloader.' + version + '-arm64.dmg)'
  ].join('\n');
  
  console.log('MESSAGE CONTENT (as HTML for Telegram):');
  console.log('=====================================');
  console.log(telegramMessage);
  console.log('\n=====================================');
  
  console.log('\nMESSAGE PREVIEW (rendered):');
  console.log('==========================');
  // Remove HTML tags for preview
  const previewMessage = telegramMessage.replace(/<[^>]*>/g, '');
  console.log(previewMessage);
  
  console.log('\n✅ This is what evb0110 would receive in Telegram');
  console.log('📱 The message uses our new comprehensive changelog generation');
  console.log('🎯 Specific library benefits instead of generic descriptions');
  
  console.log('\n📊 CHANGELOG ANALYSIS:');
  console.log('======================');
  if (changelogEntries.length > 1) {
    console.log('✅ Multiple specific changes identified');
  } else if (changelogEntries[0] !== '✅ Bug fixes and stability improvements') {
    console.log('✅ Specific user-facing benefit identified');
  } else {
    console.log('⚠️  Fallback to generic description (no specific patterns matched)');
  }
  
  changelogEntries.forEach((entry, index) => {
    console.log(`   ${index + 1}. ${entry}`);
  });
}

// Run the simulation
simulateChangelogMessage();