export default {
  app: {
    title: 'Manuscript Downloader',
    description: 'Download manuscripts from 8 working digital libraries + 1 in development',
    footer: 'Desktop application for manuscript downloading'
  },
  downloader: {
    title: 'Download Manuscript',
    urlLabel: 'Manuscript URL',
    urlPlaceholder: 'Enter manuscript URL from any supported library...',
    downloadButton: 'Download PDF',
    parsing: 'Parsing manuscript...',
    downloading: 'Downloading images...',
    processing: 'Creating PDF...',
    completed: 'Download completed!',
    error: 'Error occurred',
    cancel: 'Cancel',
    progress: {
      pages: 'Pages: {current}/{total}',
      percentage: '{percentage}% complete',
      timeRemaining: 'Time remaining: {time}',
      downloadSpeed: 'Speed: {speed}/s'
    },
    supportedLibraries: 'Supported Libraries',
    examples: 'Examples',
    clearCache: 'Clear Cache',
    cacheStats: 'Cache Statistics',
    cacheCleared: 'Cache cleared successfully',
    workingLibraries: '8 working + 1 in development'
  },
  libraries: {
    gallica: {
      name: 'Gallica (BnF)',
      description: 'French National Library digital manuscripts (supports any f{page}.* format)'
    },
    unifr: {
      name: 'e-codices (Unifr)',
      description: 'Swiss virtual manuscript library'
    },
    vatican: {
      name: 'Vatican Library',
      description: 'Vatican Apostolic Library digital collections'
    },
    cecilia: {
      name: 'Cecilia (Grand Albigeois)',
      description: 'Grand Albigeois mediatheques digital collections'
    },
    irht: {
      name: 'IRHT (CNRS)',
      description: 'Institut de recherche et d\'histoire des textes digital manuscripts'
    },
    dijon: {
      name: 'Dijon Patrimoine',
      description: 'Bibliothèque municipale de Dijon digital manuscripts'
    },
    laon: {
      name: 'Laon Bibliothèque ⚠️',
      description: 'Bibliothèque municipale de Laon digital manuscripts (NOT WORKING YET - proxy issues)'
    },
    durham: {
      name: 'Durham University',
      description: 'Durham University Library digital manuscripts via IIIF'
    },
    unicatt: {
      name: 'Unicatt (Ambrosiana)',
      description: 'Biblioteca Ambrosiana digital manuscripts'
    }
  },
  settings: {
    title: 'Settings',
    download: {
      title: 'Download Settings',
      maxConcurrent: 'Max Concurrent Downloads',
      maxRetries: 'Max Retries',
      requestTimeout: 'Request Timeout'
    },
    pdf: {
      title: 'PDF Settings',
      autoSplitThreshold: 'Auto-split Threshold'
    },
    ui: {
      title: 'Interface',
      language: 'Language',
      theme: 'Theme',
      themeSystem: 'System',
      themeLight: 'Light',
      themeDark: 'Dark'
    },
    resetToDefaults: 'Reset to Defaults',
    confirmReset: 'Are you sure you want to reset all settings to defaults?'
  },
  common: {
    close: 'Close',
    save: 'Save',
    cancel: 'Cancel',
    ok: 'OK'
  }
}