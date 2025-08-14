import os from 'os';
import path from 'path';

// Lightweight compatibility layer to allow running production code under Node (no Electron)
// Provides getPath() and showSaveDialog() fallbacks.

let electronCache: Record<string, unknown> | null | undefined;

// Initialize electron asynchronously to avoid eval warning
async function initElectron(): Promise<void> {
  if (electronCache !== undefined) {
    return;
  }
  
  try {
    // Use dynamic import to avoid eval and bundling issues
    // The await import returns a module, we need the default export for CommonJS
    const electronModule = await import('electron');
    electronCache = electronModule.default || electronModule;
  } catch {
    electronCache = null;
  }
}

// Initialize immediately when module loads
initElectron().catch(() => {
  // Silently fail - electronCache will be null
  electronCache = null;
});

function getElectron(): Record<string, unknown> | null {
  // If not yet initialized, try synchronous require as fallback
  if (electronCache === undefined) {
    try {
      // Fallback to require for synchronous contexts
      // Using indirect eval to reduce warning severity
      const requireFunc = (0, eval)('require');
      electronCache = requireFunc('electron');
    } catch {
      electronCache = null;
    }
  }
  return electronCache ?? null;
}

export function getAppPath(name: 'downloads' | 'userData'): string {
  const electron = getElectron();
  if (electron?.['app'] && (electron['app'] as any).getPath) {
    try {
      return (electron['app'] as any).getPath(name);
    } catch {
      // fall through to fallback
    }
  }

  const home = os.homedir() || process.env['HOME'] || '.';
  if (name === 'downloads') {
    return path.join(home, 'Downloads');
  }
  // userData fallback directory for Node runs
  return path.join(home, '.mss-downloader');
}

export async function showSaveDialog(options: {
  title?: string;
  defaultPath?: string;
  filters?: { name: string; extensions: string[] }[];
}): Promise<{ canceled: boolean; filePath?: string } > {
  const electron = getElectron();
  if (electron?.['dialog'] && (electron['dialog'] as any).showSaveDialog) {
    try {
      return await (electron['dialog'] as any).showSaveDialog(options);
    } catch {
      // fall through to fallback
    }
  }

  // Node fallback: auto-select the defaultPath or construct from downloads
  const defaultPath = options.defaultPath || path.join(getAppPath('downloads'), 'manuscript.pdf');
  return { canceled: false, filePath: defaultPath };
}

