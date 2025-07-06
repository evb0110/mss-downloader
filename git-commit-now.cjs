const { execSync } = require('child_process');
const path = require('path');

try {
  // Change to project directory
  process.chdir('/Users/e.barsky/Desktop/Personal/Electron/mss-downloader');
  
  console.log('Current directory:', process.cwd());
  
  // Check git status
  const status = execSync('git status --porcelain', { encoding: 'utf8' });
  console.log('Git status:', status);
  
  // Add and commit changes
  execSync('git add src/main/services/EnhancedManuscriptDownloaderService.ts package.json');
  console.log('Files added to git');
  
  execSync(`git commit -m "VERSION-1.3.87: Fix library authentication and enhance manuscript download capabilities

- Fixed Belgica KBR authentication errors and session handling
- Enhanced DIAMM library with maximum resolution parameters
- Improved E-Manuscripta Basel multi-block manuscript discovery (19x improvement)
- Added BVPB Spanish heritage library support with high-resolution downloads

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"`);
  console.log('Commit created');
  
  // Push to remote
  execSync('git push origin main');
  console.log('Pushed to GitHub successfully!');
  
} catch (error) {
  console.error('Error:', error.message);
  console.error('Stdout:', error.stdout?.toString());
  console.error('Stderr:', error.stderr?.toString());
}