const commitMessage = 'VERSION-1.3.55: Fix University of Graz timeouts, add Rome BNC libroantico support, resolve Manuscripta.at hanging downloads, and fix e-manuscripta.ch complete manuscript detection';

console.log('Testing regex patterns:');

// Test the main regex
const versionMatch1 = commitMessage.match(/^VERSION-[^:]*(?::\\s*(.+))?/i);
console.log('Regex 1 result:', versionMatch1);

// Test simpler regex
const versionMatch2 = commitMessage.match(/^VERSION-[^:]*:\\s*(.+)/i);
console.log('Regex 2 result:', versionMatch2);

// Test even simpler
const versionMatch3 = commitMessage.match(/^VERSION-[\\d.]+:\\s*(.+)/i);
console.log('Regex 3 result:', versionMatch3);

// Check what's after the colon
const colonIndex = commitMessage.indexOf(':');
console.log('Colon index:', colonIndex);
console.log('After colon:', JSON.stringify(commitMessage.substring(colonIndex + 1)));
console.log('After colon trimmed:', JSON.stringify(commitMessage.substring(colonIndex + 1).trim()));