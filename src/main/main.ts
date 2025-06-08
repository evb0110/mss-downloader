import { app, BrowserWindow, Menu, ipcMain, dialog } from 'electron';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const Store = require('electron-store');
import { UnifiedManuscriptDownloader } from './services/UnifiedManuscriptDownloader';
import { ElectronImageCache } from './services/ElectronImageCache';
import { ElectronPdfMerger } from './services/ElectronPdfMerger';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const isDev = process.env.NODE_ENV === 'development';
const store = new Store();

let mainWindow: BrowserWindow | null = null;
let manuscriptDownloader: UnifiedManuscriptDownloader | null = null;
let imageCache: ElectronImageCache | null = null;
let pdfMerger: ElectronPdfMerger | null = null;

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
          checked: store.get('language', 'en') === 'en',
          click: () => {
            store.set('language', 'en');
            mainWindow?.webContents.send('language-changed', 'en');
          },
        },
        {
          label: 'Русский',
          type: 'radio', 
          checked: store.get('language', 'en') === 'ru',
          click: () => {
            store.set('language', 'ru');
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
  return store.get('language', 'en');
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