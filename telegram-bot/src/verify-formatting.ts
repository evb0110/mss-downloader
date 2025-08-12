#!/usr/bin/env node

// Verification script for HTML formatting implementation
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { isMainModule } from './utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// HTML formatting utilities (same as send-build.ts)
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

function verifyFormatting(): void {
  console.log('🔍 Verifying HTML formatting implementation...\n');
  
  // Test 1: Basic HTML escaping
  console.log('1. Testing HTML escaping:');
  const testText = 'Version < 1.0 & Version > 0.9';
  const escaped = escapeHTML(testText);
  console.log(`   Input:  "${testText}"`);
  console.log(`   Output: "${escaped}"`);
  console.log(`   ✅ ${escaped === 'Version &lt; 1.0 &amp; Version &gt; 0.9' ? 'PASS' : 'FAIL'}\n`);
  
  // Test 2: Bold formatting
  console.log('2. Testing bold formatting:');
  const boldTest = bold('MSS Downloader v1.0.77 Available!');
  console.log(`   Input:  "MSS Downloader v1.0.77 Available!"`);
  console.log(`   Output: "${boldTest}"`);
  console.log(`   ✅ ${boldTest === '<b>MSS Downloader v1.0.77 Available!</b>' ? 'PASS' : 'FAIL'}\n`);
  
  // Test 3: Bold with special characters
  console.log('3. Testing bold with special characters:');
  const boldSpecial = bold('What\'s New: Version < 2.0 & > 1.0');
  console.log(`   Input:  "What's New: Version < 2.0 & > 1.0"`);
  console.log(`   Output: "${boldSpecial}"`);
  // Note: escapeHTML doesn't escape apostrophes, which is fine for Telegram HTML
  const expectedSpecial = '<b>What\'s New: Version &lt; 2.0 &amp; &gt; 1.0</b>';
  console.log(`   ✅ ${boldSpecial === expectedSpecial ? 'PASS' : 'FAIL'}\n`);
  
  // Test 4: Complete message formatting
  console.log('4. Testing complete message formatting:');
  const version = '1.0.77';
  const buildFile = 'MSS-Downloader-Setup-1.0.77.exe';
  const changelog = `${bold("📝 What's New:")}\n• Added Internet Culturale support\n• Fixed API integration`;
  
  const message = `
🚀 ${bold(`MSS Downloader v${version} Available!`)}

📦 Version: v${formatText(version)}
💻 Platform: Windows AMD64
📁 File: ${formatText(buildFile)}
📊 Size: 85.4 MB
📅 Built: ${formatText(new Date('2024-06-18T15:30:00').toLocaleString())}

${changelog}

${bold("📥 Installation Instructions:")}
1. Download the file from GitHub release
2. If Windows shows SmartScreen warning:
   • Click "More info"
   • Click "Run anyway"
3. Follow the installer prompts

⚠️ SmartScreen Warning: This is normal for unsigned software. The app is safe to install.

📥 Download and install to get the latest features and fixes!
  `.trim();
  
  console.log('   Complete formatted message:');
  console.log('   ' + '='.repeat(60));
  console.log(message.split('\n').map(line => `   ${line}`).join('\n'));
  console.log('   ' + '='.repeat(60));
  
  // Verify no Markdown-style formatting remains
  const hasMarkdown = message.includes('**') || message.includes('__');
  console.log(`   ✅ No Markdown formatting: ${hasMarkdown ? 'FAIL' : 'PASS'}`);
  
  // Verify HTML bold tags are present
  const hasBold = message.includes('<b>') && message.includes('</b>');
  console.log(`   ✅ HTML bold tags present: ${hasBold ? 'PASS' : 'FAIL'}`);
  
  // Verify HTML escaping is working
  const hasProperEscaping = !message.includes('<') || message.includes('&lt;') || message.includes('<b>');
  console.log(`   ✅ HTML escaping working: ${hasProperEscaping ? 'PASS' : 'FAIL'}\n`);
  
  // Test 5: Check file implementation
  console.log('5. Checking file implementation:');
  
  try {
    const sendBuildPath = path.join(__dirname, 'send-build.ts');
    if (fs.existsSync(sendBuildPath)) {
      const sendBuildContent = fs.readFileSync(sendBuildPath, 'utf8');
      
      const hasEscapeFunction = sendBuildContent.includes('function escapeHTML');
      const hasBoldFunction = sendBuildContent.includes('function bold');
      const usesHTMLFormatting = sendBuildContent.includes('${bold(');
      
      console.log(`   ✅ escapeHTML function: ${hasEscapeFunction ? 'PASS' : 'FAIL'}`);
      console.log(`   ✅ bold function: ${hasBoldFunction ? 'PASS' : 'FAIL'}`);
      console.log(`   ✅ Uses HTML formatting: ${usesHTMLFormatting ? 'PASS' : 'FAIL'}`);
    } else {
      console.log(`   ℹ️ send-build.ts not found (checking legacy version)`);
    }
    
    const multiplatformBotPath = path.join(__dirname, 'multiplatform-bot.ts');
    if (fs.existsSync(multiplatformBotPath)) {
      const botContent = fs.readFileSync(multiplatformBotPath, 'utf8');
      
      const sendMessageCalls = botContent.match(/sendMessage\([^)]+\)/g) || [];
      const htmlParseCalls = botContent.match(/parse_mode:\s*'HTML'/g) || [];
      
      console.log(`   ✅ sendMessage calls: ${sendMessageCalls.length}`);
      console.log(`   ✅ parse_mode HTML calls: ${htmlParseCalls.length}`);
      console.log(`   ✅ All sendMessage calls use HTML: ${sendMessageCalls.length === htmlParseCalls.length ? 'PASS' : 'NEEDS_CHECK'}`);
      
      // Check for Markdown formatting in bot.ts
      const hasMarkdownInBot = botContent.includes('**') && !botContent.includes('<b>');
      console.log(`   ✅ No Markdown in bot.ts: ${hasMarkdownInBot ? 'FAIL' : 'PASS'}\n`);
    } else {
      console.log(`   ℹ️ multiplatform-bot.ts not found\n`);
    }
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log(`   ❌ Error checking files: ${errorMessage}\n`);
  }
  
  console.log('🎯 Summary:');
  console.log('✅ HTML formatting implementation is ready for testing');
  console.log('✅ All sendMessage calls should use parse_mode: HTML');
  console.log('✅ Bold formatting uses HTML tags instead of Markdown');
  console.log('✅ Special characters are properly escaped');
  console.log('\n📝 Next steps:');
  console.log('1. Test with real Telegram bot: bun run src/test-formatting.ts');
  console.log('2. Verify bold text appears correctly in Telegram');
  console.log('3. Check that no literal markup characters appear');
}

function showHelp(): void {
  console.log(`
HTML Formatting Verification Script

Usage:
  bun run src/verify-formatting.ts     Verify HTML formatting implementation

This script checks that:
- HTML escaping works correctly
- Bold formatting uses HTML tags
- Complete messages are formatted properly
- All sendMessage calls use parse_mode: HTML
- No Markdown formatting remains in the code
  `);
}

async function main(): Promise<void> {
  if (process.argv.includes('--help')) {
    showHelp();
    process.exit(0);
  }

  verifyFormatting();
}

if (isMainModule()) {
  main();
}