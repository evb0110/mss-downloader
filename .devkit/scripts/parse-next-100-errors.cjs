const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Get all lint errors (ignoring exit code)
let lintOutput;
try {
  lintOutput = execSync('npm run lint 2>&1', { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }).toString();
} catch (e) {
  // Lint returns exit code 1 when there are errors, but we still get the output
  lintOutput = e.stdout ? e.stdout.toString() : '';
}

// Parse errors
const errors = [];
let currentFile = null;

lintOutput.split('\n').forEach(line => {
  // Match file paths
  if (line.startsWith('/home/evb/WebstormProjects/mss-downloader/')) {
    currentFile = line.trim();
  }
  // Match error/warning lines
  else if (currentFile && /^\s+\d+:\d+/.test(line)) {
    const match = line.match(/^\s+(\d+):(\d+)\s+(error|warning)\s+(.+?)\s+(@.+|[a-z-/]+)$/);
    if (match) {
      errors.push({
        file: currentFile.replace('/home/evb/WebstormProjects/mss-downloader/', ''),
        line: parseInt(match[1]),
        column: parseInt(match[2]),
        type: match[3],
        message: match[4],
        rule: match[5]
      });
    }
  }
});

// Skip first 107 (already fixed) and take next 100
const startIndex = 0; // Start from current errors since previous ones are fixed
const next100 = errors.slice(startIndex, startIndex + 100);

console.log(`Total errors found: ${errors.length}`);
console.log(`Processing errors ${startIndex + 1}-${startIndex + next100.length}\n`);

// Divide into 4 groups
const groupSize = Math.ceil(next100.length / 4);
const groups = [];
for (let i = 0; i < 4; i++) {
  groups.push(next100.slice(i * groupSize, (i + 1) * groupSize));
}

// Group by error type
const errorTypes = {};
next100.forEach(err => {
  const key = err.rule;
  if (!errorTypes[key]) {
    errorTypes[key] = [];
  }
  errorTypes[key].push(err);
});

console.log('Error types distribution:');
Object.entries(errorTypes).forEach(([rule, errs]) => {
  console.log(`  ${rule}: ${errs.length} occurrences`);
});

// Save groups to files
groups.forEach((group, index) => {
  const agentFile = path.join('.devkit', 'scripts', `agent-${index + 1}-next-errors.json`);
  fs.writeFileSync(agentFile, JSON.stringify(group, null, 2));
  console.log(`\nAgent ${index + 1}: ${group.length} errors saved to ${agentFile}`);
  
  // Show files this agent will work on
  const files = [...new Set(group.map(e => e.file))];
  console.log(`  Files: ${files.join(', ')}`);
});

// Save full list for reference
fs.writeFileSync('.devkit/scripts/next-100-errors.json', JSON.stringify(next100, null, 2));