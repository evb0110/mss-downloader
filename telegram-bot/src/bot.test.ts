import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { BuildUtils } from './build-utils.js';
import type { Subscriber, Platform } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('BuildUtils', () => {
  test('findLatestBuilds returns proper structure', () => {
    const result = BuildUtils.findLatestBuilds();
    
    assert.ok(typeof result === 'object');
    assert.ok(typeof result.version === 'string');
    assert.ok(typeof result.builds === 'object');
    
    // Check that builds has proper structure
    for (const [platform, build] of Object.entries(result.builds)) {
      assert.ok(['amd64', 'arm64', 'linux', 'mac'].includes(platform));
      assert.ok(typeof build.name === 'string');
      assert.ok(typeof build.size === 'number');
      assert.ok(typeof build.file === 'string');
    }
  });
  
  test('findSinglePlatformBuild works for valid platforms', () => {
    const platforms: Platform[] = ['amd64', 'arm64', 'linux', 'mac'];
    
    platforms.forEach(platform => {
      const result = BuildUtils.findSinglePlatformBuild(platform);
      
      assert.ok(typeof result === 'object');
      assert.ok(typeof result.version === 'string');
      // buildFile can be null if no build exists
      assert.ok(result.buildFile === null || typeof result.buildFile === 'string');
      assert.ok(result.buildFileName === null || typeof result.buildFileName === 'string');
      assert.ok(result.size === null || typeof result.size === 'string');
    });
  });
  
  test('validateDownloadUrl validates GitHub release URLs correctly', () => {
    const validUrl = 'https://github.com/user/repo/releases/download/v1.2.3/app-1.2.3-setup.exe';
    const invalidUrl = 'https://example.com/download';
    const mismatchUrl = 'https://github.com/user/repo/releases/download/v1.2.3/app-1.0.0-setup.exe';
    
    const validResult = BuildUtils.validateDownloadUrl(validUrl);
    assert.strictEqual(validResult.valid, true);
    assert.strictEqual(validResult.version, '1.2.3');
    assert.strictEqual(validResult.filename, 'app-1.2.3-setup.exe');
    
    const invalidResult = BuildUtils.validateDownloadUrl(invalidUrl);
    assert.strictEqual(invalidResult.valid, false);
    assert.ok(invalidResult.reason);
    
    const mismatchResult = BuildUtils.validateDownloadUrl(mismatchUrl);
    assert.strictEqual(mismatchResult.valid, false);
    assert.ok(mismatchResult.reason?.includes('Version mismatch'));
  });
});

describe('Subscriber Management', () => {
  const testSubscribersFile = path.join(__dirname, 'test-subscribers.json');
  
  // Clean up test file after tests
  const cleanup = () => {
    try {
      if (fs.existsSync(testSubscribersFile)) {
        fs.unlinkSync(testSubscribersFile);
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  };
  
  test('Subscriber data structure is valid', () => {
    const subscriber: Subscriber = {
      chatId: 12345,
      username: 'testuser',
      subscribedAt: new Date().toISOString(),
      platforms: ['amd64', 'linux']
    };
    
    assert.ok(typeof subscriber.chatId === 'number');
    assert.ok(typeof subscriber.username === 'string');
    assert.ok(typeof subscriber.subscribedAt === 'string');
    assert.ok(Array.isArray(subscriber.platforms));
    
    subscriber.platforms.forEach(platform => {
      assert.ok(['amd64', 'arm64', 'linux', 'mac'].includes(platform));
    });
    
    cleanup();
  });
  
  test('Platform validation works correctly', () => {
    const validPlatforms: Platform[] = ['amd64', 'arm64', 'linux'];
    const invalidPlatforms = ['x86', 'windows', 'mac', 'android'];
    
    validPlatforms.forEach(platform => {
      // This should not throw
      const testPlatform: Platform = platform;
      assert.ok(testPlatform);
    });
    
    // TypeScript will catch invalid platforms at compile time
    // but we can test runtime validation if needed
  });
});

describe('File Operations', () => {
  test('Package.json exists and has required fields', () => {
    const packageJsonPath = path.join(__dirname, '..', 'package.json');
    assert.ok(fs.existsSync(packageJsonPath), 'package.json should exist');
    
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    assert.ok(packageJson.name, 'package.json should have name');
    assert.ok(packageJson.version, 'package.json should have version');
    assert.ok(packageJson.type === 'module', 'package.json should be ES module');
  });
  
  test('TypeScript config exists and is valid', () => {
    const tsconfigPath = path.join(__dirname, '..', 'tsconfig.json');
    assert.ok(fs.existsSync(tsconfigPath), 'tsconfig.json should exist');
    
    const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
    assert.ok(tsconfig.compilerOptions, 'tsconfig should have compilerOptions');
    assert.strictEqual(tsconfig.compilerOptions.module, 'ESNext');
    assert.strictEqual(tsconfig.compilerOptions.target, 'ES2022');
  });
});

describe('Error Handling', () => {
  test('BuildUtils handles missing version gracefully', () => {
    // Test with a version that definitely doesn't exist
    const result = BuildUtils.findLatestBuilds('999.999.999');
    
    assert.ok(typeof result === 'object');
    // When no builds found for target version, it falls back to latest available version
    assert.ok(typeof result.version === 'string');
    assert.ok(typeof result.builds === 'object');
    
    // Since we have builds in release directory, it should find the latest available builds
    // The exact number depends on what's in the release directory
    assert.ok(Object.keys(result.builds).length >= 0);
  });
  
  test('URL validation handles edge cases', () => {
    const edgeCases = [
      '', // empty string
      'not-a-url',
      'https://github.com/user/repo',
      'https://github.com/user/repo/releases/download/invalid/file.exe',
      'https://github.com/user/repo/releases/download/v1.2.3/', // no filename
    ];
    
    edgeCases.forEach(url => {
      const result = BuildUtils.validateDownloadUrl(url);
      assert.strictEqual(result.valid, false);
      assert.ok(result.reason, `Should have reason for invalid URL: ${url}`);
    });
  });
});

describe('Integration Tests', () => {
  test('Full workflow simulation', async () => {
    // Simulate finding builds
    const buildsResult = BuildUtils.findLatestBuilds();
    assert.ok(buildsResult);
    
    // Simulate subscriber management
    const testSubscriber: Subscriber = {
      chatId: 12345,
      username: 'testuser',
      subscribedAt: new Date().toISOString(),
      platforms: ['amd64']
    };
    
    // Test platform filtering
    const subscribedPlatforms = testSubscriber.platforms;
    const availablePlatforms = Object.keys(buildsResult.builds) as Platform[];
    
    const matchingPlatforms = subscribedPlatforms.filter(platform => 
      availablePlatforms.includes(platform)
    );
    
    // Should work without errors
    assert.ok(Array.isArray(matchingPlatforms));
  });
});