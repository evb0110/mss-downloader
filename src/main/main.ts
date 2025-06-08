import { app, BrowserWindow, Menu, ipcMain, dialog } from 'electron';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import Store from 'electron-store';
import { UnifiedManuscriptDownloader } from './services/UnifiedManuscriptDownloader.js';
import { ElectronImageCache } from './services/ElectronImageCache.js';
import { ElectronPdfMerger } from './services/ElectronPdfMerger.js';
import { DownloadQueue } from './services/DownloadQueue.js';
import type { QueuedManuscript, QueueState } from '../shared/queueTypes';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const isDev = process.env.NODE_ENV === 'development';
const store = new Store();

let mainWindow: BrowserWindow | null = null;
let manuscriptDownloader: UnifiedManuscriptDownloader | null = null;
let imageCache: ElectronImageCache | null = null;
let pdfMerger: ElectronPdfMerger | null = null;
let downloadQueue: DownloadQueue | null = null;

const createWindow = () => {
  const preloadPath = join(__dirname, '../preload/preload.js');
  console.log('Preload path:', preloadPath);
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath,
    },
    title: 'Manuscript Downloader',
    titleBarStyle: 'default',
    show: false,
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
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
      label: 'Language',
      submenu: [
        {
          label: 'English',
          type: 'radio',
          checked: (store as any).get('language', 'en') === 'en',
          click: () => {
            (store as any).set('language', 'en');
            mainWindow?.webContents.send('language-changed', 'en');
          },
        },
        {
          label: 'Русский',
          type: 'radio', 
          checked: (store as any).get('language', 'en') === 'ru',
          click: () => {
            (store as any).set('language', 'ru');
            mainWindow?.webContents.send('language-changed', 'ru');
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

app.whenReady().then(() => {
  imageCache = new ElectronImageCache();
  pdfMerger = new ElectronPdfMerger();
  manuscriptDownloader = new UnifiedManuscriptDownloader(pdfMerger);
  downloadQueue = DownloadQueue.getInstance(pdfMerger);
  
  // Listen for queue state changes and send to renderer
  downloadQueue.on('stateChanged', (state: QueueState) => {
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
  return (store as any).get('language', 'en');
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
  console.log('get-supported-libraries called');
  console.log('manuscriptDownloader:', manuscriptDownloader);
  const libraries = manuscriptDownloader?.getSupportedLibraries() || [];
  console.log('libraries:', libraries);
  return libraries;
});

ipcMain.handle('parse-manuscript-url', async (_event, url: string) => {
  if (!manuscriptDownloader) {
    throw new Error('Manuscript downloader not initialized');
  }
  return manuscriptDownloader.parseManuscriptUrl(url);
});

// Queue management handlers
ipcMain.handle('queue-add-manuscript', async (_event, manuscript: Omit<QueuedManuscript, 'id' | 'addedAt' | 'status'>) => {
  if (!downloadQueue) {
    throw new Error('Download queue not initialized');
  }
  return downloadQueue.addManuscript(manuscript);
});

ipcMain.handle('queue-remove-manuscript', async (_event, id: string) => {
  if (!downloadQueue) {
    throw new Error('Download queue not initialized');
  }
  return downloadQueue.removeManuscript(id);
});

ipcMain.handle('queue-start-processing', async () => {
  if (!downloadQueue) {
    throw new Error('Download queue not initialized');
  }
  return downloadQueue.startProcessing();
});

ipcMain.handle('queue-pause-processing', async () => {
  if (!downloadQueue) {
    throw new Error('Download queue not initialized');
  }
  return downloadQueue.pauseProcessing();
});

ipcMain.handle('queue-resume-processing', async () => {
  if (!downloadQueue) {
    throw new Error('Download queue not initialized');
  }
  return downloadQueue.resumeProcessing();
});

ipcMain.handle('queue-stop-processing', async () => {
  if (!downloadQueue) {
    throw new Error('Download queue not initialized');
  }
  return downloadQueue.stopProcessing();
});

ipcMain.handle('queue-pause-item', async (_event, id: string) => {
  if (!downloadQueue) {
    throw new Error('Download queue not initialized');
  }
  return downloadQueue.pauseItem(id);
});

ipcMain.handle('queue-resume-item', async (_event, id: string) => {
  if (!downloadQueue) {
    throw new Error('Download queue not initialized');
  }
  return downloadQueue.resumeItem(id);
});

ipcMain.handle('queue-clear-completed', async () => {
  if (!downloadQueue) {
    throw new Error('Download queue not initialized');
  }
  return downloadQueue.clearCompleted();
});

ipcMain.handle('queue-clear-failed', async () => {
  if (!downloadQueue) {
    throw new Error('Download queue not initialized');
  }
  return downloadQueue.clearFailed();
});

ipcMain.handle('queue-clear-all', async () => {
  if (!downloadQueue) {
    throw new Error('Download queue not initialized');
  }
  return downloadQueue.clearAll();
});

ipcMain.handle('queue-update-item', async (_event, id: string, updates: Partial<QueuedManuscript>) => {
  if (!downloadQueue) {
    throw new Error('Download queue not initialized');
  }
  return downloadQueue.updateItem(id, updates);
});

ipcMain.handle('queue-get-state', async () => {
  if (!downloadQueue) {
    throw new Error('Download queue not initialized');
  }
  return downloadQueue.getState();
});

ipcMain.handle('cleanup-indexeddb-cache', async () => {
  if (!imageCache) {
    throw new Error('Image cache not initialized');
  }
  return imageCache.clearCache();
});