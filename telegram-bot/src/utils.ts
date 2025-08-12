// Utility functions for Bun/Node compatibility

/**
 * Check if the current module is being run as the main module
 * Compatible with both Bun and Node.js
 */
export function isMainModule(): boolean {
  // Bun and modern Node.js with ES modules
  if (typeof import.meta !== 'undefined' && import.meta.url) {
    // Check if this file is the entry point
    const currentFile = import.meta.url;
    const entryPoint = `file://${process.argv[1]}`;
    
    // Also handle Bun's direct TypeScript execution
    const scriptName = process.argv[1];
    if (scriptName && currentFile.includes(scriptName.replace(/\.js$/, '.ts'))) {
      return true;
    }
    
    return currentFile === entryPoint;
  }
  
  // Fallback for older environments
  return require.main === module;
}