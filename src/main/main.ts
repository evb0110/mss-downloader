import { app, BrowserWindow, Menu, ipcMain, dialog, shell, session } from 'electron';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';
import os from 'os';
import { ManuscriptDownloaderService } from './services/ManuscriptDownloaderService.js';
import { ElectronImageCache } from './services/ElectronImageCache.js';
import { ElectronPdfMerger } from './services/ElectronPdfMerger.js';
import { EnhancedManuscriptDownloaderService } from './services/EnhancedManuscriptDownloaderService.js';
import { EnhancedDownloadQueue } from './services/EnhancedDownloadQueue.js';
import { configService } from './services/ConfigService.js';
import type { QueuedManuscript, QueueState } from '../shared/queueTypes';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const isDev = (process.env.NODE_ENV === 'development' || !app.isPackaged) && process.env.NODE_ENV !== 'test';

let mainWindow: BrowserWindow | null = null;
let manuscriptDownloader: ManuscriptDownloaderService | null = null;
let enhancedManuscriptDownloader: EnhancedManuscriptDownloaderService | null = null;
let imageCache: ElectronImageCache | null = null;
let pdfMerger: ElectronPdfMerger | null = null;
let enhancedDownloadQueue: EnhancedDownloadQueue | null = null;

const createWindow = () => {
  const preloadPath = join(__dirname, '../preload/preload.js');
  const isHeadless = process.argv.includes('--headless') || process.env.NODE_ENV === 'test';
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath,
      webSecurity: false, // Disable for dev to avoid CORS issues
      allowRunningInsecureContent: true,
    },
    title: 'Abba Ababus (MSS Downloader)',
    titleBarStyle: 'default',
    show: false, // Never show initially
    ...(isHeadless && {
      x: -2000, // Move off-screen
      y: -2000,
      skipTaskbar: true,
      minimizable: false,
      maximizable: false,
      resizable: false,
    }),
  });

  // Force devtools open immediately (but not for tests)
  if (isDev && process.env.NODE_ENV !== 'test') {
    // Disable autofill to prevent console errors
    mainWindow.webContents.on('devtools-opened', () => {
      // DevTools is open, but we can't disable autofill from here
    });
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.webContents.on('did-fail-load', (_, errorCode, errorDescription, validatedURL) => {
    console.error('Failed to load page:', { errorCode, errorDescription, validatedURL });
  });

  // Remove problematic event listeners for now

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173').catch(err => {
      console.error('Error loading URL:', err);
    });
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    if (!isHeadless) {
      mainWindow?.show();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

const createMenu = () => {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Clear Cache',
          click: async () => {
            try {
              await imageCache?.clearCache();
              dialog.showMessageBox(mainWindow!, {
                type: 'info',
                title: 'Cache Cleared',
                message: 'Image cache has been cleared successfully.',
              });
            } catch (error) {
              dialog.showErrorBox('Error', 'Failed to clear cache: ' + error);
            }
          },
        },
        { type: 'separator' },
        {
          role: 'quit',
        },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'Language',
      submenu: [
        {
          label: 'English',
          type: 'radio',
          checked: configService.get('language') === 'en',
          click: () => {
            configService.set('language', 'en');
            mainWindow?.webContents.send('language-changed', 'en');
          },
        },
        {
          label: 'Русский',
          type: 'radio', 
          checked: configService.get('language') === 'ru',
          click: () => {
            configService.set('language', 'ru');
            mainWindow?.webContents.send('language-changed', 'ru');
          },
        },
      ],
    },
    {
      label: 'Debug',
      submenu: [
        {
          label: 'Open DevTools',
          accelerator: 'F12',
          click: () => {
            mainWindow?.webContents.openDevTools({ mode: 'detach' });
          },
        },
        {
          label: 'Reload',
          accelerator: 'F5',
          click: () => {
            mainWindow?.reload();
          },
        },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About',
          click: () => {
            dialog.showMessageBox(mainWindow!, {
              type: 'info',
              title: 'About Manuscript Downloader',
              message: 'Manuscript Downloader v1.0.0',
              detail: 'Download manuscripts from Gallica BnF, e-codices Unifr, and Vatican Library',
            });
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
};

// Cleanup function to remove temporary image files
async function cleanupTempFiles(): Promise<void> {
  try {
    const tempDir = os.tmpdir();
    const possibleTempDirs = [
      tempDir,
      join(tempDir, 'mss-downloader'),
      join(app.getPath('temp'), 'mss-downloader'),
      join(app.getPath('downloads'), '.temp'),
      join(app.getPath('userData'), 'temp-images')
    ];
    
    for (const dir of possibleTempDirs) {
      try {
        const files = await fs.readdir(dir);
        const jpgFiles = files.filter(file => 
          file.endsWith('.jpg') && 
          (file.includes('_page_') || file.includes('temp_') || file.includes('manuscript_'))
        );
        
        for (const file of jpgFiles) {
          try {
            await fs.unlink(join(dir, file));
          } catch {
            // Ignore individual file cleanup errors
          }
        }
      } catch {
        // Directory might not exist, that's fine
      }
    }
  } catch (error) {
    console.warn('Error during temp file cleanup:', error);
  }
}

// Disable autofill features that cause DevTools errors
app.commandLine.appendSwitch('disable-features', 'Autofill');

app.whenReady().then(async () => {
  imageCache = new ElectronImageCache();
  pdfMerger = new ElectronPdfMerger();
  manuscriptDownloader = new ManuscriptDownloaderService(pdfMerger);
  enhancedManuscriptDownloader = new EnhancedManuscriptDownloaderService();
  enhancedDownloadQueue = EnhancedDownloadQueue.getInstance();
  
  // Clean up any temporary image files from previous sessions
  try {
    await cleanupTempFiles();
  } catch (error) {
    console.warn('Failed to cleanup temp files:', error);
  }
  
  // Listen for queue state changes and send to renderer
  enhancedDownloadQueue.on('stateChanged', (state: QueueState) => {
    mainWindow?.webContents.send('queue-state-changed', state);
  });
  
  createWindow();
  createMenu();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('get-language', () => {
  return configService.get('language');
});

// Config management handlers
ipcMain.handle('config-get', (_event, key: string) => {
  return configService.get(key as any);
});

ipcMain.handle('config-set', (_event, key: string, value: any) => {
  configService.set(key as any, value);
  // Notify renderer of config changes
  mainWindow?.webContents.send('config-changed', key, value);
});

ipcMain.handle('config-get-all', () => {
  return configService.getAll();
});

ipcMain.handle('config-set-multiple', (_event, updates: Record<string, any>) => {
  configService.setMultiple(updates);
  // Notify renderer of config changes
  mainWindow?.webContents.send('config-changed-multiple', updates);
});

ipcMain.handle('config-reset', () => {
  configService.reset();
  const newConfig = configService.getAll();
  // Notify renderer of config reset
  mainWindow?.webContents.send('config-reset', newConfig);
});

ipcMain.handle('download-manuscript', async (_event, url: string, _callbacks: any) => {
  if (!manuscriptDownloader) {
    throw new Error('Manuscript downloader not initialized');
  }
  
  return manuscriptDownloader.downloadManuscript(url, {
    onProgress: (progress) => {
      mainWindow?.webContents.send('download-progress', progress);
    },
    onStatusChange: (status) => {
      mainWindow?.webContents.send('download-status', status);
    },
    onError: (error) => {
      mainWindow?.webContents.send('download-error', error);
    },
  });
});

ipcMain.handle('get-supported-libraries', () => {
  if (!enhancedManuscriptDownloader) {
    console.error('enhancedManuscriptDownloader is null!');
    return [];
  }
  
  try {
    const libraries = enhancedManuscriptDownloader.getSupportedLibraries();
    return libraries;
  } catch (error) {
    console.error('Error calling getSupportedLibraries:', error);
    return [];
  }
});

ipcMain.handle('parse-manuscript-url', async (_event, url: string) => {
  if (!enhancedManuscriptDownloader) {
    throw new Error('Enhanced manuscript downloader not initialized');
  }
  
  try {
    return await enhancedManuscriptDownloader.loadManifest(url);
  } catch (error: any) {
    // Check if this is a captcha error that should be handled by the UI
    if (error.message?.startsWith('CAPTCHA_REQUIRED:')) {
      // Let the error pass through to the UI for captcha handling
      throw error;
    }
    // Handle other errors normally
    throw error;
  }
});

// Queue management handlers
ipcMain.handle('queue-add-manuscript', async (_event, manuscript: Omit<QueuedManuscript, 'id' | 'addedAt' | 'status'>) => {
  if (!enhancedDownloadQueue) {
    throw new Error('Enhanced download queue not initialized');
  }
  return enhancedDownloadQueue.addManuscript(manuscript);
});

ipcMain.handle('queue-remove-manuscript', async (_event, id: string) => {
  if (!enhancedDownloadQueue) {
    throw new Error('Enhanced download queue not initialized');
  }
  return enhancedDownloadQueue.removeManuscript(id);
});

ipcMain.handle('queue-start-processing', async () => {
  if (!enhancedDownloadQueue) {
    throw new Error('Enhanced download queue not initialized');
  }
  return enhancedDownloadQueue.startProcessing();
});

ipcMain.handle('queue-pause-processing', async () => {
  if (!enhancedDownloadQueue) {
    throw new Error('Enhanced download queue not initialized');
  }
  enhancedDownloadQueue.pauseProcessing();
});

ipcMain.handle('queue-resume-processing', async () => {
  if (!enhancedDownloadQueue) {
    throw new Error('Enhanced download queue not initialized');
  }
  enhancedDownloadQueue.resumeProcessing();
});

ipcMain.handle('queue-stop-processing', async () => {
  if (!enhancedDownloadQueue) {
    throw new Error('Enhanced download queue not initialized');
  }
  enhancedDownloadQueue.stopProcessing();
});

ipcMain.handle('queue-pause-item', async (_event, id: string) => {
  if (!enhancedDownloadQueue) {
    throw new Error('Enhanced download queue not initialized');
  }
  return enhancedDownloadQueue.pauseItem(id);
});

ipcMain.handle('queue-resume-item', async (_event, id: string) => {
  if (!enhancedDownloadQueue) {
    throw new Error('Enhanced download queue not initialized');
  }
  return enhancedDownloadQueue.resumeItem(id);
});

ipcMain.handle('queue-clear-completed', async () => {
  if (!enhancedDownloadQueue) {
    throw new Error('Enhanced download queue not initialized');
  }
  enhancedDownloadQueue.clearCompleted();
});

ipcMain.handle('queue-clear-failed', async () => {
  if (!enhancedDownloadQueue) {
    throw new Error('Enhanced download queue not initialized');
  }
  enhancedDownloadQueue.clearFailed();
});

ipcMain.handle('queue-clear-all', async () => {
  if (!enhancedDownloadQueue) {
    throw new Error('Enhanced download queue not initialized');
  }
  enhancedDownloadQueue.clearAll();
});

ipcMain.handle('queue-update-item', async (_event, id: string, updates: Partial<QueuedManuscript>) => {
  if (!enhancedDownloadQueue) {
    throw new Error('Enhanced download queue not initialized');
  }
  return enhancedDownloadQueue.updateItem(id, updates);
});

ipcMain.handle('queue-get-state', async () => {
  if (!enhancedDownloadQueue) {
    throw new Error('Enhanced download queue not initialized');
  }
  return enhancedDownloadQueue.getState();
});

ipcMain.handle('queue-update-autosplit-threshold', async (_event, thresholdMB: number) => {
  if (!enhancedDownloadQueue) {
    throw new Error('Enhanced download queue not initialized');
  }
  return enhancedDownloadQueue.updateAutoSplitThreshold(thresholdMB);
});

ipcMain.handle('queue-move-item', async (_event, fromIndex: number, toIndex: number) => {
  if (!enhancedDownloadQueue) {
    throw new Error('Enhanced download queue not initialized');
  }
  return enhancedDownloadQueue.moveItem(fromIndex, toIndex);
});

ipcMain.handle('cleanup-indexeddb-cache', async () => {
  if (!imageCache) {
    throw new Error('Image cache not initialized');
  }
  return imageCache.clearCache();
});

ipcMain.handle('clear-manifest-cache', async () => {
  if (!enhancedManuscriptDownloader) {
    throw new Error('Enhanced manuscript downloader not initialized');
  }
  
  try {
    await (enhancedManuscriptDownloader as any).manifestCache.clear();
    return { success: true, message: 'Manifest cache cleared successfully' };
  } catch (error: any) {
    throw new Error(`Failed to clear manifest cache: ${error.message}`);
  }
});

ipcMain.handle('clear-all-caches', async () => {
  if (!enhancedDownloadQueue) {
    throw new Error('Enhanced download queue not initialized');
  }
  
  try {
    await enhancedDownloadQueue.clearAllCaches();
    return { success: true, message: 'All caches cleared successfully' };
  } catch (error: any) {
    throw new Error(`Failed to clear all caches: ${error.message}`);
  }
});

ipcMain.handle('open-downloads-folder', async () => {
  const downloadsDir = app.getPath('downloads');
  
  // Open the folder
  await shell.openPath(downloadsDir);
  
  return downloadsDir;
});

ipcMain.handle('get-downloads-path', () => {
  return app.getPath('downloads');
});

ipcMain.handle('show-item-in-finder', async (_event, filePath: string) => {
  if (!filePath) {
    throw new Error('No file path provided');
  }
  
  try {
    // Check if the file exists
    await fs.access(filePath);
    
    // Show the file in Finder/Explorer
    shell.showItemInFolder(filePath);
    
    return true;
  } catch (error) {
    console.error('Failed to show item in finder:', error);
    throw new Error(`File not found: ${filePath}`);
  }
});

ipcMain.handle('open-external', async (_event, url: string) => {
  if (!url) {
    throw new Error('No URL provided');
  }
  
  try {
    await shell.openExternal(url);
    return true;
  } catch (error) {
    console.error('Failed to open external URL:', error);
    throw new Error(`Failed to open URL: ${url}`);
  }
});

ipcMain.handle('solve-captcha', async (_event, url: string) => {
  console.log('[MAIN] solve-captcha called with URL:', url);
  
  return new Promise((resolve) => {
    const captchaWindow = new BrowserWindow({
      width: 900,
      height: 700,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: true,
        session: session.defaultSession, // Use default session to share cookies
      },
      title: 'Complete Captcha - Close window when done',
      modal: true,
      parent: mainWindow || undefined,
      show: false
    });

    // Track if we've completed the captcha
    let captchaCompleted = false;
    
    // Handle loading errors
    captchaWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
      console.log('[MAIN] Captcha window failed to load:', errorCode, errorDescription);
      // Don't close on error, let user retry
    });
    
    captchaWindow.loadURL(url);
    
    captchaWindow.once('ready-to-show', () => {
      captchaWindow.show();
      console.log('[MAIN] Captcha window shown for URL:', url);
      
    });

    
    // Monitor URL changes for manifest content
    captchaWindow.webContents.on('did-navigate', (_event, navigationUrl) => {
      console.log('[MAIN] Captcha window navigated to:', navigationUrl);
      
      // Check if we got JSON content
      if (navigationUrl.includes('/manifest')) {
        setTimeout(() => {
          if (captchaCompleted || captchaWindow.isDestroyed()) return;
          
          captchaWindow.webContents.executeJavaScript('document.body.innerText')
            .then((content) => {
              if (content.trim().startsWith('{') && content.includes('sequences')) {
                console.log('[MAIN] Valid IIIF manifest detected');
                captchaCompleted = true;
                captchaWindow.close();
                resolve({ success: true, content });
              }
            })
            .catch(() => {
              // Ignore errors
            });
        }, 2000);
      }
    });
    
    // Handle custom protocol for manual captcha completion
    captchaWindow.webContents.on('will-navigate', (_event, navUrl) => {
      if (navUrl === 'captcha://completed') {
        console.log('[MAIN] User indicated captcha completed');
        captchaCompleted = true;
        captchaWindow.close();
        resolve({ success: true });
      }
    });
    
    
    captchaWindow.on('closed', () => {
      if (!captchaCompleted) {
        console.log('[MAIN] Captcha window closed by user');
        
        resolve({ success: false, error: 'Captcha window was closed' });
      }
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      if (!captchaWindow.isDestroyed()) {
        captchaWindow.close();
        resolve({ success: false, error: 'Captcha verification timed out' });
      }
    }, 5 * 60 * 1000);
  });
});