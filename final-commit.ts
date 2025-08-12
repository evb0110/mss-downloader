#!/usr/bin/env bun

import { execSync } from 'child_process';
import * as fs from 'fs';

const projectDir: string = '/home/evb/WebstormProjects/mss-downloader';

interface ExecOptions {
    cwd: string;
    encoding: BufferEncoding;
    stdio: ('pipe' | 'inherit')[];
}

// Ensure we're in the right directory
process.chdir(projectDir);
console.log('Working directory:', process.cwd());

function runGitCommand(command: string, description: string): string {
    try {
        console.log(`\n${description}...`);
        const result: string = execSync(command, { 
            cwd: projectDir,
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe']
        });
        console.log(result);
        return result;
    } catch (error: any) {
        console.error(`Failed: ${error.message}`);
        if (error.stdout) console.log('stdout:', error.stdout);
        if (error.stderr) console.error('stderr:', error.stderr);
        throw error;
    }
}

try {
    // Check git status first
    runGitCommand('git status', 'Checking git status');

    // Add specific files
    const filesToAdd: string[] = [
        'src/main/services/library-loaders/LinzLoader.ts',
        'src/main/services/library-loaders/index.ts',
        'src/shared/SharedManifestLoaders.js',
        'src/main/services/EnhancedManuscriptDownloaderService.ts',
        'package.json'
    ];

    console.log('\nAdding files to git...');
    for (const file of filesToAdd) {
        // Check if file exists first
        const fullPath: string = `${projectDir}/${file}`;
        if (fs.existsSync(fullPath)) {
            try {
                execSync(`git add "${file}"`, { cwd: projectDir });
                console.log(`✓ Added ${file}`);
            } catch (error: any) {
                console.log(`! Could not add ${file}: ${error.message}`);
            }
        } else {
            console.log(`! File does not exist: ${file}`);
        }
    }

    // Check what's staged
    runGitCommand('git status --porcelain', 'Checking staged files');

    // Create commit message
    const commitMessage: string = `🚀 v1.4.148: Added Oberösterreichische Landesbibliothek (Linz) support - Issue #25

- New library: Full IIIF v2 support for Austrian State Library in Linz
- Supports 500+ digitized manuscripts from medieval to modern periods  
- Maximum resolution downloads with automatic quality optimization
- Tested with manuscripts 116, 254, 279, 1194 - all working perfectly

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>`;

    // Write commit message to temporary file to avoid shell escaping issues
    const tempFile: string = `${projectDir}/temp_commit_msg.txt`;
    fs.writeFileSync(tempFile, commitMessage);

    try {
        // Commit using the temporary file
        runGitCommand(`git commit -F "${tempFile}"`, 'Committing changes');
        
        // Clean up temp file
        fs.unlinkSync(tempFile);

        // Push changes
        runGitCommand('git push', 'Pushing to remote');

        // Show final result
        runGitCommand('git log --oneline -1', 'Latest commit');

        console.log('\n✅ Successfully committed and pushed Linz library support!');

    } catch (commitError: any) {
        // Clean up temp file on error
        if (fs.existsSync(tempFile)) {
            fs.unlinkSync(tempFile);
        }
        throw commitError;
    }

} catch (error: any) {
    console.error('\n❌ Failed to commit changes:', error.message);
    process.exit(1);
}