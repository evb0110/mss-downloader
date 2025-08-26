#!/usr/bin/env node
// Bootstrapper to run TypeScript test files under Electron main process
// Usage: electron run-electron-ts.cjs /absolute/or/relative/path/to/file.ts

const path = require('path');
const fs = require('fs');

// Register ts-node in transpile-only mode for speed and to avoid full typechecking
require('ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
    moduleResolution: 'node',
    esModuleInterop: true,
    target: 'ES2020',
    lib: ['ES2020']
  }
});

// Determine target TS file
const target = process.argv[2];
if (!target) {
  console.error('Usage: electron run-electron-ts.cjs <path-to-typescript-file>');
  process.exit(1);
}

const resolved = path.resolve(process.cwd(), target);
if (!fs.existsSync(resolved)) {
  console.error('Target file not found:', resolved);
  process.exit(1);
}

// Execute the TS file in Electron main process
require(resolved);

