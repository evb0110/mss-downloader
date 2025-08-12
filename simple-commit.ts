#!/usr/bin/env bun

import { spawn, type ChildProcess } from 'child_process';
import * as path from 'path';

const projectDir: string = '/home/evb/WebstormProjects/mss-downloader';

interface SpawnOptions {
    cwd: string;
    stdio: string;
    [key: string]: any;
}

function runCommand(command: string, args: string[] = [], options: Partial<SpawnOptions> = {}): Promise<void> {
    return new Promise((resolve, reject) => {
        const child: ChildProcess = spawn(command, args, {
            cwd: projectDir,
            stdio: 'inherit',
            ...options
        });

        child.on('close', (code: number | null) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Command failed with exit code ${code}`));
            }
        });

        child.on('error', reject);
    });
}

async function main(): Promise<void> {
    console.log('Working in:', projectDir);
    
    try {
        console.log('\n1. Checking git status...');
        await runCommand('git', ['status']);

        console.log('\n2. Adding files...');
        const files: string[] = [
            'src/main/services/library-loaders/LinzLoader.ts',
            'src/main/services/library-loaders/index.ts',
            'src/shared/SharedManifestLoaders.js', 
            'src/main/services/EnhancedManuscriptDownloaderService.ts',
            'package.json'
        ];

        for (const file of files) {
            try {
                await runCommand('git', ['add', file]);
                console.log(`✓ Added ${file}`);
            } catch (error: any) {
                console.log(`! Could not add ${file}`);
            }
        }

        console.log('\n3. Checking staged files...');
        await runCommand('git', ['status', '--porcelain']);

        console.log('\n4. Committing...');
        const message: string = '🚀 v1.4.148: Added Oberösterreichische Landesbibliothek (Linz) support - Issue #25\n\n- New library: Full IIIF v2 support for Austrian State Library in Linz\n- Supports 500+ digitized manuscripts from medieval to modern periods\n- Maximum resolution downloads with automatic quality optimization\n- Tested with manuscripts 116, 254, 279, 1194 - all working perfectly\n\n🤖 Generated with [Claude Code](https://claude.ai/code)\n\nCo-Authored-By: Claude <noreply@anthropic.com>';
        
        await runCommand('git', ['commit', '-m', message]);
        console.log('✓ Committed successfully!');

        console.log('\n5. Pushing...');
        await runCommand('git', ['push']);
        console.log('✓ Pushed successfully!');

        console.log('\n6. Showing latest commit...');
        await runCommand('git', ['log', '--oneline', '-1']);

    } catch (error: any) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

main();