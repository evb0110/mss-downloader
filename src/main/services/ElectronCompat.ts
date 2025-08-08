import os from 'os';
import path from 'path';

// Lightweight compatibility layer to allow running production code under Node (no Electron)
// Provides getPath() and showSaveDialog() fallbacks.

let electronCache: any | undefined;

function getElectron(): any | null {
  if (electronCache !== undefined) {
    return electronCache;
  }
  
  try {
    // Dynamic import to avoid bundling issues
    electronCache = eval("require('electron')");
    return electronCache;
  } catch {
    electronCache = null;
    return null;
  }
}

export function getAppPath(name: 'downloads' | 'userData'): string {
  const electron = getElectron();
  if (electron?.app?.getPath) {
    try {
      return electron.app.getPath(name);
    } catch {
      // fall through to fallback
    }
  }

  const home = os.homedir() || process.env.HOME || '.';
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
  if (electron?.dialog?.showSaveDialog) {
    try {
      return await electron.dialog.showSaveDialog(options as any);
    } catch {
      // fall through to fallback
    }
  }

  // Node fallback: auto-select the defaultPath or construct from downloads
  const defaultPath = options.defaultPath || path.join(getAppPath('downloads'), 'manuscript.pdf');
  return { canceled: false, filePath: defaultPath };
}

