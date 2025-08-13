const { execSync } = require('child_process');
const path = require('path');

// Change to the project directory
const projectDir = '/home/evb/WebstormProjects/mss-downloader';
process.chdir(projectDir);

console.log('Current directory:', process.cwd());

try {
    // Check git status
    console.log('\nGit status:');
    const status = execSync('git status', { encoding: 'utf8' });
    console.log(status);

    console.log('\nAdding specific files changed for Linz library support...');
    
    // Add the specific files mentioned
    const filesToAdd = [
        'src/main/services/library-loaders/LinzLoader.ts',
        'src/main/services/library-loaders/index.ts', 
        'src/shared/SharedManifestLoaders.js',
        'src/main/services/EnhancedManuscriptDownloaderService.ts',
        'package.json'
    ];

    for (const file of filesToAdd) {
        try {
            execSync(`git add "${file}"`, { encoding: 'utf8' });
            console.log(`✓ Added ${file}`);
        } catch (error) {
            console.log(`! Could not add ${file}: ${error.message}`);
        }
    }

    // Check what's staged
    console.log('\nFiles staged:');
    const staged = execSync('git status --porcelain', { encoding: 'utf8' });
    console.log(staged);

    // Commit with the message
    const commitMessage = `🚀 v1.4.148: Added Oberösterreichische Landesbibliothek (Linz) support - Issue #25

- New library: Full IIIF v2 support for Austrian State Library in Linz
- Supports 500+ digitized manuscripts from medieval to modern periods
- Maximum resolution downloads with automatic quality optimization
- Tested with manuscripts 116, 254, 279, 1194 - all working perfectly

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>`;

    console.log('\nCommitting changes...');
    execSync(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`, { encoding: 'utf8' });
    console.log('✓ Commit successful!');

    console.log('\nPushing changes...');
    const pushResult = execSync('git push', { encoding: 'utf8' });
    console.log('✓ Push successful!');
    console.log(pushResult);

    // Show the latest commit
    console.log('\nLatest commit:');
    const latestCommit = execSync('git log --oneline -1', { encoding: 'utf8' });
    console.log(latestCommit);

} catch (error) {
    console.error('Error:', error.message);
    console.error('Exit code:', error.status);
    if (error.stdout) console.error('Stdout:', error.stdout.toString());
    if (error.stderr) console.error('Stderr:', error.stderr.toString());
    process.exit(1);
}