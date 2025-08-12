#!/usr/bin/env bun

import * as esbuild from 'esbuild';
import * as path from 'path';

interface BuildOptions extends esbuild.BuildOptions {
  entryPoints: string[];
  bundle: boolean;
  platform: 'node' | 'browser' | 'neutral';
  target: string;
  external?: string[];
  outfile: string;
  format: 'cjs' | 'esm' | 'iife';
  sourcemap?: boolean;
  minify?: boolean;
  loader?: { [ext: string]: esbuild.Loader };
  define?: { [key: string]: string };
}

// Build configuration for main process with pdf-lib bundled
const buildMain = async (): Promise<void> => {
  try {
    const buildOptions: BuildOptions = {
      entryPoints: ['src/main/main.ts'],
      bundle: true,
      platform: 'node',
      target: 'node18',
      external: [
        'electron',
        'canvas', // Optional dependency
        'jsdom', // Keep external due to native dependencies
        'jimp', // Keep external due to native dependencies
      ],
      outfile: 'dist/main/main.js',
      format: 'cjs',
      sourcemap: process.env.NODE_ENV === 'development',
      minify: process.env.NODE_ENV === 'production',
      loader: {
        '.ts': 'ts',
      },
      define: {
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
      },
    };

    await esbuild.build(buildOptions);
    console.log('Main process bundled successfully with pdf-lib included');
  } catch (error: any) {
    console.error('Build failed:', error);
    process.exit(1);
  }
};

// Also bundle the preload script
const buildPreload = async (): Promise<void> => {
  try {
    const preloadOptions: BuildOptions = {
      entryPoints: ['src/preload/preload.ts'],
      bundle: true,
      platform: 'node',
      target: 'node18',
      external: ['electron'],
      outfile: 'dist/preload/preload.js',
      format: 'cjs',
      sourcemap: false,
      minify: process.env.NODE_ENV === 'production',
    };

    await esbuild.build(preloadOptions);
    console.log('Preload script bundled successfully');
  } catch (error: any) {
    console.error('Preload build failed:', error);
    process.exit(1);
  }
};

// Run both builds
(async (): Promise<void> => {
  await buildPreload();
  await buildMain();
})();