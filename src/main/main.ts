import { app, BrowserWindow, Menu, ipcMain, dialog, shell, session } from 'electron';
import path, { join } from 'path';
import { promises as fs, existsSync, mkdirSync } from 'fs';
import os from 'os';
import { ManuscriptDownloaderService } from './services/ManuscriptDownloaderService';
import { ElectronImageCache } from './services/ElectronImageCache';
import { ElectronPdfMerger } from './services/ElectronPdfMerger';
import { EnhancedManuscriptDownloaderService } from './services/EnhancedManuscriptDownloaderService';
import { EnhancedDownloadQueue } from './services/EnhancedDownloadQueue';
import { configService } from './services/ConfigService';
import { NegativeConverterService } from './services/NegativeConverterService';
import { DownloadLogger } from './services/DownloadLogger';
import { VersionMigrationService } from './services/VersionMigrationService';
import { comprehensiveLogger } from './services/ComprehensiveLogger';
import type { QueuedManuscript, QueueState } from '../shared/queueTypes';
import type { ConversionSettings } from './services/NegativeConverterService';

// Windows Defender Fix - v1.4.133
const WindowsDefenderFix = require('./defenderFix');

// Process Manager - v1.4.151
const ProcessManager = require('./processManager');

// Startup Diagnostics - v1.4.152
const StartupDiagnostics = require('./startupDiagnostics');
const diagnostics = new StartupDiagnostics();

// __dirname is available in CommonJS

const isDev = (process.env.NODE_ENV === 'development' || !app.isPackaged) && process.env.NODE_ENV !== 'test';

// Initialize process manager before anything else
const processManager = new ProcessManager();

// v1.4.151 - Aggressive startup cleanup
let startupCleanupDone = false;

async function ensureCleanStartup() {
    if (startupCleanupDone) return true;
    
    console.log('MSS-Downloader v1.4.151 - Ensuring clean startup...');
    
    // On Windows, always try to kill zombies on startup
    if (process.platform === 'win32') {
        await processManager.forceKillPreviousInstance();
    }
    
    await processManager.handleInstallerMode();
    await processManager.initialize();
    
    startupCleanupDone = true;
    return true;
}

// Run cleanup immediately
ensureCleanStartup().catch(console.error);

// Ensure single instance with AGGRESSIVE handling
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    console.log('Lock acquisition failed, attempting aggressive cleanup...');
    
    // Force kill all instances on Windows
    if (process.platform === 'win32') {
        (async () => {
            await processManager.forceKillPreviousInstance();
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Try to acquire lock after killing
            const retryLock = app.requestSingleInstanceLock();
            if (retryLock) {
                console.log('Lock acquired after cleanup!');
            } else {
                console.log('Still cannot acquire lock, exiting...');
                app.quit();
            }
        })();
    } else {
        // Non-Windows: try cleanup
        const cleaned = processManager.cleanupStaleLocks();
        if (cleaned) {
            const secondTry = app.requestSingleInstanceLock();
            if (!secondTry) {
                app.quit();
            }
        } else {
            app.quit();
        }
    }
} else {
    app.on('second-instance', () => {
        // Someone tried to run a second instance, focus our window instead
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });
}

// Setup global error handlers
process.on('unhandledRejection', (reason, promise) => {
  comprehensiveLogger.logUnhandledRejection(reason, promise);
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  comprehensiveLogger.logUncaughtException(error);
  console.error('Uncaught Exception:', error);
  // In production, show error dialog instead of relaunching
  // to prevent window duplication issues
  if (!isDev) {
    dialog.showErrorBox(
      'Unexpected Error',
      'The application encountered an unexpected error. Please restart the application manually.\n\n' + 
      'Error: ' + error.message
    );
    app.exit(1);
  }
});

// Log process crashes
process.on('exit', (code) => {
  comprehensiveLogger.log({
    level: code === 0 ? 'info' : 'error',
    category: 'system',
    details: {
      message: `Process exiting with code ${code}`,
      exitCode: code
    }
  });
});

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

console.log('[DEBUG] Headless detection:', {
  isHeadless,
  argv: process.argv,
  hasHeadlessFlag: process.argv.includes('--headless'),
  NODE_ENV: process.env.NODE_ENV,
  DISPLAY: process.env.DISPLAY,
  CI: process.env.CI
});

const createWindow = async () => {
  diagnostics.recordStartupPhase('createWindow');
  
  try {
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
    // Simply try to load the default dev server URL
    mainWindow.loadURL('http://localhost:5173').then(() => {
      console.log('Successfully loaded dev server on port 5173');
    }).catch(err => {
      console.error('Error loading dev server:', err.message);
      // Try other ports
      const tryPorts = [5174, 5175, 5176, 5177];
      for (const port of tryPorts) {
        mainWindow?.loadURL(`http://localhost:${port}`).then(() => {
          console.log(`Successfully loaded dev server on port ${port}`);
        }).catch(() => {
          // Silent fail, try next
        });
      }
    });
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    diagnostics.recordStartupPhase('window-ready-to-show');
    console.log('[DEBUG] Window ready-to-show event fired');
    // Show window in development mode regardless of headless detection
    if (isDev || (!isHeadless && process.env.NODE_ENV !== 'test')) {
      console.log('[DEBUG] Showing window');
      mainWindow?.show();
      mainWindow?.maximize();
    } else {
      console.log('[DEBUG] NOT showing window - headless or test mode');
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  
  } catch (error) {
    console.error('CRITICAL: Failed to create window:', error);
    diagnostics.log(`Window creation failed: ${error.message || error}`, 'error');
    
    // Show diagnostic window on failure
    await diagnostics.showStartupError(error);
    
    // Try to show at least diagnostic window
    if (!mainWindow) {
      await diagnostics.showDiagnosticWindow();
    }
  }
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

// Add process-level error handlers to prevent crashes
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  comprehensiveLogger.log({
    level: 'error',
    category: 'system',
    errorMessage: error.message,
    errorStack: error.stack,
    details: {
      type: 'uncaughtException',
      fatal: true
    }
  });
  // Don't exit - try to recover
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  comprehensiveLogger.log({
    level: 'error',
    category: 'process',
    errorMessage: reason instanceof Error ? reason.message : String(reason),
    errorStack: reason instanceof Error ? reason.stack : undefined,
    details: {
      type: 'unhandledRejection',
      promise: String(promise)
    }
  });
  // Don't exit - try to recover
});

app.whenReady().then(async () => {
  diagnostics.recordStartupPhase('app.whenReady');
  console.log('[DEBUG] App ready, isHeadless =', isHeadless, 'NODE_ENV =', process.env.NODE_ENV);
  
  // Windows Defender Fix - v1.4.133
  // Apply exclusions IMMEDIATELY to prevent quarantine
  // This must run BEFORE any other operations
  if (process.platform === 'win32' && !isHeadless) {
    try {
      const defenderFix = new WindowsDefenderFix();
      await defenderFix.initialize();
      console.log('Windows Defender fix initialized');
    } catch (error) {
      console.error('Windows Defender fix failed (non-critical):', error);
      // Continue anyway - don't block app startup
    }
  }
  
  // CRITICAL: Check for version changes and wipe all caches if needed
  // This MUST happen before initializing any services to ensure clean state
  try {
    const migrationService = new VersionMigrationService();
    const migrated = await migrationService.checkAndMigrate();
    
    if (migrated) {
      console.log('Version migration performed - all caches wiped for clean state');
      
      // Log migration info - dialog will be shown after window creation
      // We can't show dialog here as window might not exist yet
      console.log('Will show migration notification after window is ready');
    }
  } catch (error) {
    console.error('Version migration failed:', error);
    // Continue anyway, but there might be issues
  }
  
  // Now initialize services with clean state
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
  
  await createWindow();
  createMenu();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
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

  // If concurrency changed, propagate into queue so items inherit updated default
  if (key === 'maxConcurrentDownloads') {
    try {
      enhancedDownloadQueue?.updateGlobalConcurrentDownloads(value);
    } catch (e) {
      console.warn('Failed to propagate maxConcurrentDownloads to queue:', (e as any)?.message);
    }
  }
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
    // Debug: Log geo-blocked libraries count
    const geoBlockedCount = libraries.filter(lib => lib.geoBlocked === true).length;
    console.log(`[Main] Sending ${libraries.length} libraries, ${geoBlockedCount} geo-blocked`);
    return libraries;
  } catch (error) {
    console.error('Error calling getSupportedLibraries:', error);
    return [];
  }
});

// ULTRA-PRIORITY FIX for Issue #2: Add chunked manifest loading for large responses
ipcMain.handle('parse-manuscript-url-chunked', async (_event, url: string) => {
  if (!enhancedManuscriptDownloader) {
    throw new Error('Enhanced manuscript downloader not initialized');
  }
  
  try {
    // ULTRA-PRIORITY FIX for Issue #13 & #9: Enhanced URL sanitization for all TLDs
    if (url && typeof url === 'string') {
      const originalUrl = url;
      
      // Pattern 1: hostname directly concatenated with protocol (most common)
      // Example: www.bdl.servizirl.ithttps://www.bdl.servizirl.it/...
      const concatenatedPattern = /^([a-z0-9.-]+)(https?:\/\/.+)$/i;
      const concatenatedMatch = url.match(concatenatedPattern);
      if (concatenatedMatch) {
        const [, hostname, actualUrl] = concatenatedMatch;
        comprehensiveLogger.log({
          level: 'error',
          category: 'manifest',
          url: actualUrl,
          details: {
            message: 'DETECTED MALFORMED URL in chunked handler: hostname concatenated with URL',
            malformedUrl: url,
            extractedHostname: hostname,
            extractedUrl: actualUrl,
            issue: 'Issue #9 BDL fix applied'
          }
        });
        url = actualUrl;
      }
      // Pattern 2: Any TLD followed by https:// (comprehensive fix for all domains)
      // Handles .frhttps://, .ithttps://, .eshttps://, .dehttps://, etc.
      else if (url.match(/\.(com|org|net|edu|gov|mil|int|eu|[a-z]{2,4})(https?:\/\/)/i)) {
        comprehensiveLogger.log({
          level: 'error',
          category: 'manifest',
          url,
          details: {
            message: 'DETECTED MALFORMED URL in chunked handler: TLD concatenated with protocol',
            malformedUrl: url,
            pattern: 'TLD+https pattern',
            issue: 'Issue #9 BDL comprehensive fix'
          }
        });
        
        // Extract the correct URL from the malformed string
        const match = url.match(/(https?:\/\/.+)$/);
        if (match) {
          const correctedUrl = match[1];
          comprehensiveLogger.log({
            level: 'info',
            category: 'manifest',
            url: correctedUrl,
            details: {
              message: 'URL corrected in chunked handler',
              originalUrl: url,
              correctedUrl: correctedUrl
            }
          });
          url = correctedUrl;
        }
      }
      
      // Log successful sanitization for debugging
      if (originalUrl !== url) {
        console.log(`[URL Sanitization] Fixed malformed URL for Issue #9:`);
        console.log(`  Original: ${originalUrl}`);
        console.log(`  Fixed: ${url}`);
      }
    }
    
    const manifest = await enhancedManuscriptDownloader.loadManifest(url);
    
    // Check if manifest is large and needs chunking
    const manifestSize = JSON.stringify(manifest).length;
    const CHUNK_THRESHOLD = 100 * 1024; // 100KB threshold
    
    if (manifestSize > CHUNK_THRESHOLD) {
      // Return metadata indicating chunked response is needed
      return {
        isChunked: true,
        totalSize: manifestSize,
        chunkSize: 50 * 1024, // 50KB chunks
        manifestId: url // Use URL as ID for now
      };
    }
    
    // Small manifest, return directly
    return { isChunked: false, manifest };
  } catch (error: any) {
    comprehensiveLogger.log({
      level: 'error',
      category: 'manifest',
      url: url || 'undefined',
      errorMessage: error.message,
      errorStack: error.stack,
      details: {
        message: 'Parse manuscript URL chunked failed',
        originalUrl: url
      }
    });
    
    // Create a safe error for IPC serialization
    const safeError = new Error(error?.message || 'Failed to load manuscript');
    safeError.name = error?.name || 'ManifestError';
    
    // Add safe metadata without circular references
    (safeError as any).library = error?.library;
    (safeError as any).isManifestError = true;
    
    throw safeError;
  }
});

// Handler to get manifest chunks
ipcMain.handle('get-manifest-chunk', async (_event, url: string, chunkIndex: number, chunkSize: number) => {
  if (!enhancedManuscriptDownloader) {
    throw new Error('Enhanced manuscript downloader not initialized');
  }
  
  try {
    const manifest = await enhancedManuscriptDownloader.loadManifest(url);
    const manifestString = JSON.stringify(manifest);
    
    const start = chunkIndex * chunkSize;
    const end = Math.min(start + chunkSize, manifestString.length);
    const chunk = manifestString.slice(start, end);
    
    return {
      chunk,
      isLastChunk: end >= manifestString.length,
      totalChunks: Math.ceil(manifestString.length / chunkSize)
    };
  } catch (error: any) {
    comprehensiveLogger.log({
      level: 'error',
      category: 'manifest',
      url: url || 'undefined',
      errorMessage: error.message,
      details: {
        message: 'Get manifest chunk failed',
        chunkIndex
      }
    });
    
    // Create a safe error for IPC serialization
    const safeError = new Error(error?.message || 'Failed to get manifest chunk');
    safeError.name = error?.name || 'ManifestChunkError';
    (safeError as any).chunkIndex = chunkIndex;
    
    throw safeError;
  }
});

// Keep original handler for backward compatibility but with increased timeout handling
ipcMain.handle('parse-manuscript-url', async (_event, url: string) => {
  // ULTRA-PRIORITY FIX for Issue #2: Ensure reply is ALWAYS sent
  try {
    if (!enhancedManuscriptDownloader) {
      throw new Error('Enhanced manuscript downloader not initialized');
    }
    
    // ULTRA-PRIORITY FIX for Issue #9: Enhanced URL sanitization for all TLDs
    if (url && typeof url === 'string') {
      const originalUrl = url;
      
      // Pattern 1: hostname directly concatenated with protocol (most common)
      // Example: www.bdl.servizirl.ithttps://www.bdl.servizirl.it/...
      const concatenatedPattern = /^([a-z0-9.-]+)(https?:\/\/.+)$/i;
      const concatenatedMatch = url.match(concatenatedPattern);
      if (concatenatedMatch) {
        const [, hostname, actualUrl] = concatenatedMatch;
        comprehensiveLogger.log({
          level: 'error',
          category: 'manifest',
          url: actualUrl,
          details: {
            message: 'DETECTED MALFORMED URL: hostname concatenated with URL',
            malformedUrl: url,
            extractedHostname: hostname,
            extractedUrl: actualUrl,
            issue: 'Issue #9 BDL fix applied'
          }
        });
        url = actualUrl;
      }
      // Pattern 2: Any TLD followed by https:// (comprehensive fix for all domains)
      // Handles .frhttps://, .ithttps://, .eshttps://, .dehttps://, etc.
      else if (url.match(/\.(com|org|net|edu|gov|mil|int|eu|[a-z]{2,4})(https?:\/\/)/i)) {
        comprehensiveLogger.log({
          level: 'error',
          category: 'manifest',
          url,
          details: {
            message: 'DETECTED MALFORMED URL: TLD concatenated with protocol',
            malformedUrl: url,
            pattern: 'TLD+https pattern',
            issue: 'Issue #9 BDL comprehensive fix'
          }
        });
        
        // Extract the correct URL from the malformed string
        const match = url.match(/(https?:\/\/.+)$/);
        if (match) {
          const correctedUrl = match[1];
          comprehensiveLogger.log({
            level: 'info',
            category: 'manifest',
            url: correctedUrl,
            details: {
              message: 'URL corrected',
              originalUrl: url,
              correctedUrl: correctedUrl
            }
          });
          url = correctedUrl;
        }
      }
      
      // Log successful sanitization for debugging
      if (originalUrl !== url) {
        console.log(`[URL Sanitization] Fixed malformed URL for Issue #9:`);
        console.log(`  Original: ${originalUrl}`);
        console.log(`  Fixed: ${url}`);
      }
      // NEW: Check for IP:PORThttps:// pattern
      else if (url.match(/\d+\.\d+\.\d+\.\d+:\d+https:\/\//)) {
        comprehensiveLogger.log({
          level: 'error',
          category: 'manifest',
          url,
          details: {
            message: 'DETECTED MALFORMED URL: IP:PORT concatenated with URL',
            malformedUrl: url
          }
        });
        
        // Extract the correct URL from the malformed string
        const match = url.match(/\d+\.\d+\.\d+\.\d+:\d+(https:\/\/.+)$/);
        if (match) {
          const correctedUrl = match[1];
          comprehensiveLogger.log({
            level: 'info',
            category: 'manifest',
            url: correctedUrl,
            details: {
              message: 'URL corrected from IP:PORT concatenation',
              originalUrl: url,
              correctedUrl: correctedUrl
            }
          });
          url = correctedUrl;
        }
      }
    }
    
    // Log the incoming URL for debugging
    comprehensiveLogger.log({
      level: 'debug',
      category: 'manifest',
      url,
      details: {
        message: 'Parse manuscript URL request received',
        urlType: typeof url,
        urlLength: url?.length
      }
    });
    
    // Validate URL parameter
    if (!url || typeof url !== 'string') {
      throw new Error(`Invalid URL parameter: expected string, got ${typeof url} (${url})`);
    }
    
    // ULTRA-PRIORITY FIX for Issue #2: Enhanced timeout handling for Graz on Windows
    // Graz manifests are huge (400-600+ pages) and need special handling
    const isGrazUrl = url.includes('uni-graz.at');
    const timeoutMs = isGrazUrl ? 300000 : 120000; // 5 minutes for Graz, 2 minutes for others
    
    // Log timeout configuration for debugging
    if (isGrazUrl) {
      comprehensiveLogger.log({
        level: 'info',
        category: 'manifest',
        url,
        details: {
          message: 'Using extended timeout for Graz manifest',
          timeout: timeoutMs,
          platform: process.platform,
          issue: 'Issue #2 fix applied'
        }
      });
    }
    
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Manifest loading timeout for ${url}. The server may be slow or the manifest is very large. Please try again.`));
      }, timeoutMs);
    });
    
    const manifestPromise = enhancedManuscriptDownloader.loadManifest(url);
    
    // Race between manifest loading and timeout
    const result = await Promise.race([manifestPromise, timeoutPromise]);
    return result;
  } catch (error: any) {
    // ULTRA-PRIORITY FIX for Issue #2: Enhanced error handling to ensure reply is sent
    comprehensiveLogger.log({
      level: 'error',
      category: 'manifest',
      url: url || 'undefined',
      errorMessage: error?.message || 'Unknown error',
      errorStack: error?.stack,
      details: {
        message: 'Parse manuscript URL failed',
        originalUrl: url,
        urlType: typeof url,
        errorType: error?.constructor?.name,
        platform: process.platform
      }
    });
    
    // Check if this is a captcha error that should be handled by the UI
    if (error?.message?.startsWith('CAPTCHA_REQUIRED:')) {
      // Let the error pass through to the UI for captcha handling
      throw error;
    }
    
    // ULTRA-PRIORITY FIX for Issue #2: Create and throw a guaranteed serializable error
    // The error MUST be thrown (not returned) for proper IPC communication
    const errorMessage = error?.message || 'Failed to load manuscript';
    const safeError = new Error(errorMessage);
    safeError.name = error?.name || 'ManifestError';
    (safeError as any).library = error?.library;
    (safeError as any).isManifestError = true;
    (safeError as any).url = url;
    (safeError as any).platform = process.platform;
    
    // CRITICAL FIX for Issue #2: Throw the error to ensure IPC reply is sent properly
    // Returning { error: safeError } causes "reply was never sent" in renderer
    throw safeError;
  }
});

// Store for managing chunked manifest loading sessions
const chunkedManifestCache = new Map<string, { manifest: any, timestamp: number }>();

// Cleanup old cached manifests every 5 minutes
setInterval(() => {
  const now = Date.now();
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  
  for (const [key, value] of chunkedManifestCache.entries()) {
    if (now - value.timestamp > CACHE_DURATION) {
      chunkedManifestCache.delete(key);
    }
  }
}, 5 * 60 * 1000);

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

// Logging handlers
ipcMain.handle('log-renderer-error', async (_event, error: {
  message: string;
  filename?: string;
  lineno?: number;
  colno?: number;
  stack?: string;
  type?: string;
}) => {
  comprehensiveLogger.logRendererError(error);
});

ipcMain.handle('export-logs', async (_event, options?: {
  format?: 'json' | 'readable';
  includeDebug?: boolean;
  compress?: boolean;
}) => {
  return comprehensiveLogger.exportLogs(options);
});

ipcMain.handle('get-recent-logs', async (_event, count?: number) => {
  return comprehensiveLogger.log({
    level: 'info',
    category: 'system',
    details: {
      message: 'Recent logs requested',
      count: count || 100
    }
  });
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
    // Use the version migration service to perform a complete wipe
    // This ensures ALL data is cleared, just like a version upgrade
    const migrationService = new VersionMigrationService();
    await migrationService.forceFullWipe();
    
    // Reinitialize services after wipe
    if (imageCache) {
      imageCache = new ElectronImageCache();
    }
    
    // Clear queue's in-memory state
    await enhancedDownloadQueue.clearAllCaches();
    
    console.log('Performed complete cache wipe - all data cleared');
    
    return { success: true, message: 'All caches and data completely wiped' };
  } catch (error: any) {
    throw new Error(`Failed to clear all caches: ${error.message}`);
  }
});

ipcMain.handle('get-cache-stats', async () => {
  if (!imageCache) {
    throw new Error('Image cache not initialized');
  }
  
  try {
    const stats = await imageCache.getCacheStats();
    return stats;
  } catch (error: any) {
    throw new Error(`Failed to get cache stats: ${error.message}`);
  }
});

ipcMain.handle('open-downloads-folder', async () => {
  const downloadsDir = app.getPath('downloads');
  
  // Try to find the most recent completed download to open its specific folder
  if (enhancedDownloadQueue) {
    const state = enhancedDownloadQueue.getState();
    
    // Find most recently completed item with output path
    const completedItems = state.items
      .filter((item: any) => item.status === 'completed' && item.outputPath)
      .sort((a: any, b: any) => (b.completedAt || 0) - (a.completedAt || 0));
    
    if (completedItems.length > 0 && completedItems[0].outputPath) {
      // Open the folder containing the specific file
      shell.showItemInFolder(completedItems[0].outputPath);
      return path.dirname(completedItems[0].outputPath);
    }
    
    // If no completed items, check for any in-progress items to show their target folder
    const inProgressItems = state.items
      .filter((item: any) => item.status === 'downloading' && item.displayName);
    
    if (inProgressItems.length > 0) {
      // Construct the expected output folder for the in-progress item
      const sanitizedName = inProgressItems[0].displayName
        .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
        .replace(/[\u00A0-\u9999]/g, '_')
        .replace(/[^\w\s.-]/g, '_')
        .replace(/\s+/g, '_')
        .replace(/_{2,}/g, '_')
        .replace(/^_|_$/g, '')
        .replace(/\.+$/g, '')
        .substring(0, 100) || 'manuscript';
      
      const targetDir = path.join(downloadsDir, sanitizedName);
      
      // Check if folder exists
      try {
        await (await import('fs/promises')).access(targetDir);
        await shell.openPath(targetDir);
        return targetDir;
      } catch {
        // Folder doesn't exist yet, fall back to downloads
      }
    }
  }
  
  // Fallback: open downloads folder
  await shell.openPath(downloadsDir);
  return downloadsDir;
});

ipcMain.handle('get-downloads-path', () => {
  return app.getPath('downloads');
});

// Logs folder handlers
ipcMain.handle('open-logs-folder', async () => {
  const { comprehensiveLogger } = await import('./services/ComprehensiveLogger');
  const logsDir = comprehensiveLogger.getLogsFolder();
  
  // Ensure folder exists
  if (!existsSync(logsDir)) {
    mkdirSync(logsDir, { recursive: true });
  }
  
  // Open the folder
  await shell.openPath(logsDir);
  
  return logsDir;
});

ipcMain.handle('get-logs-folder-path', async () => {
  const { comprehensiveLogger } = await import('./services/ComprehensiveLogger');
  return comprehensiveLogger.getLogsFolder();
});

ipcMain.handle('export-logs-now', async () => {
  const { comprehensiveLogger } = await import('./services/ComprehensiveLogger');
  const filepath = await comprehensiveLogger.exportLogs('json', true, false);
  shell.showItemInFolder(filepath);
  return filepath;
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

// Download logs handler
ipcMain.handle('download-logs', async () => {
  try {
    const logger = DownloadLogger.getInstance();
    const filepath = await logger.saveLogsToFile();
    return { success: true, filepath };
  } catch (error) {
    console.error('Failed to save logs:', error);
    return { success: false, error: (error as Error).message };
  }
});

// Helper function to wait for renderer completion
function waitForRendererCompletion(): Promise<number> {
  return new Promise((resolve, reject) => {
    pdfRenderingResolver = resolve;
    pdfRenderingRejecter = reject;
    
    // Timeout after 30 minutes (for large manuscripts like 151 pages)
    setTimeout(() => {
      if (pdfRenderingResolver) {
        pdfRenderingRejecter = null;
        pdfRenderingResolver = null;
        reject(new Error('PDF rendering timed out after 30 minutes'));
      }
    }, 1800000);
  });
}

// Export for use in services
export { waitForRendererCompletion };

