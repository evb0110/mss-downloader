import { createApp } from 'vue'
import { createI18n } from 'vue-i18n'
import App from './App.vue'

import en from './translations/en'
import ru from './translations/ru'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages: {
    en,
    ru
  }
})

// Wait for electronAPI to be available
const waitForElectronAPI = () => {
  return new Promise<void>((resolve) => {
    if (window.electronAPI) {
      resolve();
    } else {
      const checkAPI = () => {
        if (window.electronAPI) {
          resolve();
        } else {
          setTimeout(checkAPI, 100);
        }
      };
      checkAPI();
    }
  });
};

// Initialize electron API functionality
waitForElectronAPI().then(() => {
  console.log('electronAPI is available');
  
  // Get initial language from main process
  window.electronAPI.getLanguage().then(language => {
    i18n.global.locale.value = language
  });

  // Listen for language changes from menu
  window.electronAPI.onLanguageChanged((language: string) => {
    i18n.global.locale.value = language
  });
}).catch(() => {
  console.error('electronAPI not available after waiting');
});

const app = createApp(App)
app.use(i18n)
app.mount('#app')