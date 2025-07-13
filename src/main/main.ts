import { app, BrowserWindow, Menu, ipcMain, dialog, shell, session } from 'electron';
import { join } from 'path';
import { promises as fs } from 'fs';
import os from 'os';
import { ManuscriptDownloaderService } from './services/ManuscriptDownloaderService';
import { ElectronImageCache } from './services/ElectronImageCache';
import { ElectronPdfMerger } from './services/ElectronPdfMerger';
import { EnhancedManuscriptDownloaderService } from './services/EnhancedManuscriptDownloaderService';
import { EnhancedDownloadQueue } from './services/EnhancedDownloadQueue';
import { configService } from './services/ConfigService';
import { NegativeConverterService } from './services/NegativeConverterService';
import type { QueuedManuscript, QueueState } from '../shared/queueTypes';
import type { ConversionSettings } from './services/NegativeConverterService';

// __dirname is available in CommonJS

// Function to read app version
async function getAppVersion(): Promise<string> {
  try {
    const packageJsonPath = join(__dirname, '../../package.json');
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
    return packageJson.version;
  } catch (error) {
    console.warn('Could not read version from package.json:', error);
    return '1.0.0';
  }
}

const isDev = (process.env.NODE_ENV === 'development' || !app.isPackaged) && process.env.NODE_ENV !== 'test';

let mainWindow: BrowserWindow | null = null;
let manuscriptDownloader: ManuscriptDownloaderService | null = null;
let enhancedManuscriptDownloader: EnhancedManuscriptDownloaderService | null = null;
let imageCache: ElectronImageCache | null = null;
let pdfMerger: ElectronPdfMerger | null = null;
let enhancedDownloadQueue: EnhancedDownloadQueue | null = null;
let negativeConverter: NegativeConverterService | null = null;

// Global headless detection - available to all functions
const isHeadless = process.argv.includes('--headless') || 
                   process.env.NODE_ENV === 'test' ||
                   process.env.DISPLAY === ':99' || // Playwright test display
                   process.env.CI === 'true';

const createWindow = () => {
  const preloadPath = join(__dirname, '../preload/preload.js');
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath,
      webSecurity: false, // Disable for dev to avoid CORS issues
      allowRunningInsecureContent: true,
      devTools: true, // Always enable devtools
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
      opacity: 0, // Make completely transparent
      focusable: false, // Prevent focus
      alwaysOnTop: false, // Ensure it stays in background
    }),
  });

  // Force devtools open immediately (but not for tests or headless mode)
  if (isDev && process.env.NODE_ENV !== 'test' && !isHeadless) {
    // Disable autofill to prevent console errors
    mainWindow.webContents.on('devtools-opened', () => {
      // DevTools is open, but we can't disable autofill from here
    });
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  // Enable context menu (works like browser)
  mainWindow.webContents.on('context-menu', (_, params) => {
    const contextMenuItems: Electron.MenuItemConstructorOptions[] = [];

    // Always add editing options based on context
    if (params.isEditable) {
      contextMenuItems.push(
        { label: 'Cut', role: 'cut', enabled: params.editFlags.canCut },
        { label: 'Copy', role: 'copy', enabled: params.editFlags.canCopy },
        { label: 'Paste', role: 'paste', enabled: params.editFlags.canPaste },
        { type: 'separator' },
        { label: 'Select All', role: 'selectAll', enabled: params.editFlags.canSelectAll }
      );
    } else {
      // For non-editable content, still show copy and select all
      contextMenuItems.push(
        { label: 'Copy', role: 'copy', enabled: params.editFlags.canCopy },
        { label: 'Select All', role: 'selectAll', enabled: params.editFlags.canSelectAll }
      );
    }

    // Add inspect element only in dev mode and not in headless mode
    if (isDev && !isHeadless) {
      contextMenuItems.push(
        { type: 'separator' },
        { 
          label: 'Inspect Element', 
          click: () => {
            if (mainWindow?.webContents.isDevToolsOpened()) {
              // DevTools already open, inspect immediately
              mainWindow.webContents.inspectElement(params.x, params.y);
              mainWindow.webContents.devToolsWebContents?.focus();
            } else {
              // DevTools not open, wait for it to open
              const onDevToolsOpened = () => {
                mainWindow?.webContents.inspectElement(params.x, params.y);
                // Focus DevTools after inspection
                setTimeout(() => {
                  mainWindow?.webContents.devToolsWebContents?.focus();
                }, 100);
                mainWindow?.webContents.removeListener('devtools-opened', onDevToolsOpened);
              };
              mainWindow?.webContents.once('devtools-opened', onDevToolsOpened);
              mainWindow?.webContents.openDevTools({ mode: 'detach' });
            }
          }
        }
      );
    }

    const contextMenu = Menu.buildFromTemplate(contextMenuItems);
    contextMenu.popup({ window: mainWindow! });
  });

  mainWindow.webContents.on('did-fail-load', (_, errorCode, errorDescription, validatedURL) => {
    console.error('Failed to load page:', { errorCode, errorDescription, validatedURL });
  });

  // Handle F12 key for DevTools toggle (not in headless mode)
  mainWindow.webContents.on('before-input-event', (_, input) => {
    if (input.key === 'F12' && input.type === 'keyDown' && !isHeadless) {
      if (mainWindow?.webContents.isDevToolsOpened()) {
        mainWindow.webContents.closeDevTools();
      } else {
        mainWindow?.webContents.openDevTools({ mode: 'detach' });
      }
    }
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
    // CRITICAL: Never show window during tests or headless mode
    // This prevents browser windows from opening during Playwright tests
    if (!isHeadless && process.env.NODE_ENV !== 'test') {
      mainWindow?.show();
      mainWindow?.maximize();
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
            // Don't open DevTools in headless mode
            if (!isHeadless) {
              if (mainWindow?.webContents.isDevToolsOpened()) {
                mainWindow.webContents.closeDevTools();
              } else {
                mainWindow?.webContents.openDevTools({ mode: 'detach' });
              }
            }
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
          click: async () => {
            const version = await getAppVersion();
            dialog.showMessageBox(mainWindow!, {
              type: 'info',
              title: 'About Abba Ababus (MSS Downloader)',
              message: `Abba Ababus (MSS Downloader) v${version}`,
              detail: 'Download manuscripts from digital libraries worldwide including Gallica BnF, e-codices, Vatican Library, and 25+ other institutions',
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
  
  negativeConverter = new NegativeConverterService();
  
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

// Simultaneous download handlers
ipcMain.handle('queue-start-all-simultaneous', async () => {
  if (!enhancedDownloadQueue) {
    throw new Error('Enhanced download queue not initialized');
  }
  return enhancedDownloadQueue.startAllSimultaneous();
});

ipcMain.handle('queue-start-item-individual', async (_event, id: string) => {
  if (!enhancedDownloadQueue) {
    throw new Error('Enhanced download queue not initialized');
  }
  return enhancedDownloadQueue.startItemIndividually(id);
});

ipcMain.handle('queue-set-simultaneous-mode', async (_event, mode: string, maxCount?: number) => {
  if (!enhancedDownloadQueue) {
    throw new Error('Enhanced download queue not initialized');
  }
  enhancedDownloadQueue.setSimultaneousMode(mode as any, maxCount);
});

ipcMain.handle('queue-get-simultaneous-state', async () => {
  if (!enhancedDownloadQueue) {
    throw new Error('Enhanced download queue not initialized');
  }
  const state = enhancedDownloadQueue.getState();
  return {
    simultaneousMode: state.globalSettings.simultaneousMode,
    maxSimultaneousDownloads: state.globalSettings.maxSimultaneousDownloads,
    activeDownloads: state.activeItemIds?.length || 0,
  };
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

ipcMain.handle('choose-save-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory'],
    title: 'Choose where to save converted PDF',
    defaultPath: app.getPath('downloads')
  });
  
  if (result.canceled) {
    return null;
  }
  
  return result.filePaths[0];
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
      // CRITICAL: Never show captcha window during tests or headless mode
      if (!isHeadless && process.env.NODE_ENV !== 'test') {
        captchaWindow.show();
        console.log('[MAIN] Captcha window shown for URL:', url);
      } else {
        console.log('[MAIN] Captcha window creation skipped due to headless mode');
        captchaWindow.close();
        resolve({ success: false, error: 'Captcha cannot be solved in headless mode' });
      }
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

// Negative converter handlers
ipcMain.handle('convert-negative-to-positive', async (_event, { fileData, fileName, settings, outputDirectory }: {
  fileData: number[] | Uint8Array | ArrayBuffer;
  fileName: string;
  settings: ConversionSettings;
  outputDirectory?: string;
}) => {
  if (!negativeConverter) {
    throw new Error('Negative converter not initialized');
  }
  
  // Convert to Uint8Array properly
  let uint8Data: Uint8Array;
  if (fileData instanceof ArrayBuffer) {
    uint8Data = new Uint8Array(fileData);
  } else if (Array.isArray(fileData)) {
    uint8Data = new Uint8Array(fileData);
  } else if (fileData instanceof Uint8Array) {
    uint8Data = fileData;
  } else {
    throw new Error('Invalid file data format');
  }
  
  return negativeConverter.convertPdf(
    uint8Data,
    fileName,
    settings,
    (progress) => {
      mainWindow?.webContents.send('negative-conversion-progress', progress);
    },
    outputDirectory
  );
});

ipcMain.handle('save-image-file', async (_event, filePath: string, imageData: Uint8Array) => {
  try {
    await fs.writeFile(filePath, imageData);
    return true;
  } catch (error) {
    console.error('Failed to save image file:', error);
    throw new Error(`Failed to save image: ${filePath}`);
  }
});

ipcMain.handle('render-pdf-to-images', async (_event, pdfPath: string, outputDir: string) => {
  try {
    // Create output directory if it doesn't exist
    await fs.mkdir(outputDir, { recursive: true });
    
    // Send message to renderer to do the PDF rendering
    mainWindow?.webContents.send('start-pdf-rendering', { pdfPath, outputDir });
    
    // Return immediately - renderer will handle the work
    return { success: true, message: 'PDF rendering started in renderer process' };
  } catch (error) {
    console.error('Failed to start PDF rendering:', error);
    throw new Error(`Failed to start PDF rendering: ${error}`);
  }
});

ipcMain.handle('open-in-folder', async (_event, filePath: string) => {
  if (!filePath) {
    throw new Error('No file path provided');
  }
  
  try {
    await fs.access(filePath);
    shell.showItemInFolder(filePath);
    return true;
  } catch (error) {
    console.error('Failed to open file in folder:', error);
    throw new Error(`File not found: ${filePath}`);
  }
});

// PDF rendering completion handlers
let pdfRenderingResolver: ((pageCount: number) => void) | null = null;
let pdfRenderingRejecter: ((error: Error) => void) | null = null;

ipcMain.handle('pdf-rendering-complete', async (_event, pageCount: number) => {
  console.log(`📄 Renderer reported completion: ${pageCount} pages`);
  if (pdfRenderingResolver) {
    pdfRenderingResolver(pageCount);
    pdfRenderingResolver = null;
    pdfRenderingRejecter = null;
  }
  return true;
});

ipcMain.handle('pdf-rendering-error', async (_event, error: string) => {
  console.log(`❌ Renderer reported error: ${error}`);
  if (pdfRenderingRejecter) {
    pdfRenderingRejecter(new Error(error));
    pdfRenderingResolver = null;
    pdfRenderingRejecter = null;
  }
  return true;
});

ipcMain.handle('pdf-rendering-progress', async (_event, { stage, message, progress }: { stage: string, message: string, progress?: number }) => {
  console.log(`📊 Renderer progress: ${stage} - ${message} (${progress || 0}%)`);
  // Forward progress to the conversion progress handler if needed
  mainWindow?.webContents.send('negative-conversion-progress', { stage, message, progress });
  return true;
});

// Helper function to wait for renderer completion
function waitForRendererCompletion(): Promise<number> {
  return new Promise((resolve, reject) => {
    pdfRenderingResolver = resolve;
    pdfRenderingRejecter = reject;
    
    // Timeout after 2 minutes
    setTimeout(() => {
      if (pdfRenderingResolver) {
        pdfRenderingRejecter = null;
        pdfRenderingResolver = null;
        reject(new Error('PDF rendering timed out'));
      }
    }, 120000);
  });
}

// Export for use in services
module.exports = { waitForRendererCompletion };

