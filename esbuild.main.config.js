const esbuild = require('esbuild');
const path = require('path');

// Build configuration for main process with pdf-lib bundled
const buildMain = async () => {
  try {
    await esbuild.build({
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
    });
    
    console.log('Main process bundled successfully with pdf-lib included');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
};

// Also bundle the preload script
const buildPreload = async () => {
  try {
    await esbuild.build({
      entryPoints: ['src/preload/preload.ts'],
      bundle: true,
      platform: 'node',
      target: 'node18',
      external: ['electron'],
      outfile: 'dist/preload/preload.js',
      format: 'cjs',
      sourcemap: false,
      minify: process.env.NODE_ENV === 'production',
    });
    
    console.log('Preload script bundled successfully');
  } catch (error) {
    console.error('Preload build failed:', error);
    process.exit(1);
  }
};

// Run both builds
(async () => {
  await buildPreload();
  await buildMain();
})();