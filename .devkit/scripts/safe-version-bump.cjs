#!/usr/bin/env node
/**
 * Safe Version Bump Script - Prevents catastrophic build failures
 * Implements lessons learned from v1.4.262 GlobalDziCache disaster
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function exec(command, description) {
    console.log(`🔧 ${description}`);
    try {
        const result = execSync(command, { encoding: 'utf8', stdio: 'inherit' });
        return result;
    } catch (error) {
        console.error(`❌ Failed: ${description}`);
        console.error(`Command: ${command}`);
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
}

function execSilent(command) {
    try {
        return execSync(command, { encoding: 'utf8' }).trim();
    } catch (error) {
        return '';
    }
}

function main() {
    const args = process.argv.slice(2);
    const bumpType = args[0] || 'bump'; // 'bump' or 'bump-all'
    const versionType = args[1] || 'patch'; // 'patch', 'minor', 'major'
    
    console.log('🚀 SAFE VERSION BUMP PROCESS');
    console.log('============================');
    console.log(`Mode: ${bumpType}`);
    console.log(`Version type: ${versionType}`);
    console.log('');

    // 1. Safety check first
    console.log('🔍 Running safety check...');
    exec('.devkit/scripts/version-bump-safety-check.sh', 'Safety check');
    console.log('');

    // 2. Show current status
    console.log('📋 Current repository status:');
    exec('git status --porcelain', 'Git status');
    console.log('');

    // 3. File staging based on bump type
    if (bumpType === 'bump-all') {
        console.log('📁 BUMP ALL: Staging ALL files (modifications + untracked)');
        exec('git add -A', 'Stage all files');
        
        // Show what untracked files were added
        const untrackedFiles = execSilent('git diff --cached --name-only --diff-filter=A');
        if (untrackedFiles) {
            console.log('📂 Untracked files being included:');
            console.log(untrackedFiles);
            console.log('');
        }
    } else {
        console.log('📁 BUMP: Staging tracked modifications only');
        exec('git add -u', 'Stage tracked modifications');
    }

    // 4. Quality gates with ALL staged files
    console.log('🔬 Running quality gates with staged files...');
    exec('npm run precommit', 'Type safety and precommit checks');
    
    // 5. Build verification with ALL staged files
    console.log('🏗️ Build verification with staged files...');
    exec('npm run build', 'Build verification');
    
    // 6. Get current version
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const currentVersion = packageJson.version;
    console.log(`📦 Current version: ${currentVersion}`);
    
    // 7. Bump version in package.json
    exec(`npm version ${versionType} --no-git-tag-version`, `Bump version (${versionType})`);
    
    // 8. Read new version
    const updatedPackageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const newVersion = updatedPackageJson.version;
    console.log(`📦 New version: ${newVersion}`);
    
    // 9. Stage the updated package.json
    exec('git add package.json', 'Stage updated package.json');
    
    // 10. Prepare commit message
    const stagedFiles = execSilent('git diff --cached --name-only').split('\n').filter(f => f);
    const untrackedFiles = execSilent('git diff --cached --name-only --diff-filter=A').split('\n').filter(f => f);
    
    let commitMessage = `🚀 v${newVersion}: Version bump with safety checks\n\n`;
    commitMessage += `Files included:\n`;
    commitMessage += stagedFiles.map(f => `- ${f}`).join('\n') + '\n\n';
    
    if (untrackedFiles.length > 0) {
        commitMessage += `Untracked files added (prevents build failures):\n`;
        commitMessage += untrackedFiles.map(f => `- ${f}`).join('\n') + '\n\n';
    }
    
    commitMessage += `🤖 Generated with [Claude Code](https://claude.ai/code)\n\n`;
    commitMessage += `Co-Authored-By: Claude <noreply@anthropic.com>`;
    
    // 11. Commit
    console.log('💾 Creating commit...');
    const commitFile = path.join(__dirname, 'temp-commit-message.txt');
    fs.writeFileSync(commitFile, commitMessage);
    exec(`git commit -F "${commitFile}"`, 'Commit changes');
    fs.unlinkSync(commitFile);
    
    // 12. Push immediately
    console.log('📤 Pushing to remote...');
    exec('git push origin main', 'Push to GitHub');
    
    // 13. Monitor build status
    console.log('👀 Monitoring GitHub Actions build...');
    setTimeout(() => {
        try {
            const runStatus = execSilent('gh run list --limit 1 --json status,conclusion,displayTitle');
            const runs = JSON.parse(runStatus);
            if (runs.length > 0) {
                const latestRun = runs[0];
                console.log(`🔍 Latest build: ${latestRun.displayTitle}`);
                console.log(`📊 Status: ${latestRun.status}`);
                if (latestRun.conclusion) {
                    console.log(`🎯 Result: ${latestRun.conclusion}`);
                    if (latestRun.conclusion === 'success') {
                        console.log('✅ BUILD SUCCESS - Version bump completed successfully!');
                    } else {
                        console.log('❌ BUILD FAILED - Check GitHub Actions for errors');
                        console.log('🔧 Use: gh run list --limit 5 to see recent runs');
                    }
                } else {
                    console.log('⏳ Build still running...');
                }
            }
        } catch (error) {
            console.log('⚠️ Could not check build status automatically');
            console.log('🔧 Use: gh run list --limit 1 to check manually');
        }
    }, 5000);
    
    console.log('');
    console.log('🎉 VERSION BUMP COMPLETED');
    console.log(`Version: ${currentVersion} → ${newVersion}`);
    console.log('Monitor: gh run list --limit 1');
    console.log('');
}

if (require.main === module) {
    main();
}