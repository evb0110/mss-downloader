<template>
  <div class="manuscript-downloader">
    <!-- Language and Cache Controls -->
    <div class="top-controls">
      <div class="language-switcher">
        <button 
          :class="{ active: currentLanguage === 'en' }"
          @click="switchLanguage('en')"
        >
          EN
        </button>
        <button 
          :class="{ active: currentLanguage === 'ru' }"
          @click="switchLanguage('ru')"
        >
          RU
        </button>
      </div>
      <div class="cache-controls">
        <button 
          class="btn btn-secondary"
          @click="showCacheStats"
          :disabled="isDownloading"
          :title="$t('downloader.cacheStats')"
        >
          📊 {{ $t('downloader.cacheStats') }}
        </button>
        <button 
          class="btn btn-secondary"
          @click="clearCache"
          :disabled="isDownloading"
          :title="$t('downloader.clearCache')"
        >
          🗑️ {{ $t('downloader.clearCache') }}
        </button>
      </div>
    </div>

    <!-- Main Content -->
    <div class="content-wrapper">
      <!-- Download Form -->
      <div class="download-section card">
        <h2>{{ $t('downloader.title') }}</h2>
        
        <form @submit.prevent="handleDownload" class="download-form">
          <div class="form-group">
            <label for="manuscript-url" class="form-label">{{ $t('downloader.urlLabel') }}</label>
            <input
              id="manuscript-url"
              v-model="manuscriptUrl"
              type="url"
              :placeholder="$t('downloader.urlPlaceholder')"
              class="form-input"
              :disabled="isDownloading"
              required
            />
            <small class="input-help">{{ $t('downloader.workingLibraries') }}</small>
          </div>

          <button 
            type="submit" 
            class="btn btn-primary"
            :disabled="isDownloading || !manuscriptUrl.trim()"
          >
            {{ isDownloading ? $t('downloader.cancel') : $t('downloader.downloadButton') }}
          </button>
        </form>

        <!-- Status and Progress -->
        <div v-if="downloadStatus" class="status-section">
          <div class="status-message" :class="downloadStatus.phase">
            {{ downloadStatus.message }}
          </div>

          <div v-if="downloadProgress && isDownloading" class="progress-section">
            <div class="progress-bar">
              <div 
                class="progress-fill" 
                :style="{ width: downloadProgress.percentage + '%' }"
              ></div>
            </div>
            
            <div class="progress-details">
              <span>{{ $t('downloader.progress.pages', { 
                current: downloadProgress.downloadedPages, 
                total: downloadProgress.totalPages 
              }) }}</span>
              <span>{{ $t('downloader.progress.percentage', { 
                percentage: Math.round(downloadProgress.percentage) 
              }) }}</span>
            </div>

            <div v-if="downloadProgress.estimatedTimeRemaining > 0" class="progress-eta">
              {{ $t('downloader.progress.timeRemaining', { 
                time: formatTime(downloadProgress.estimatedTimeRemaining) 
              }) }}
            </div>

            <div v-if="downloadProgress.downloadSpeed > 0" class="progress-speed">
              {{ $t('downloader.progress.downloadSpeed', { 
                speed: formatBytes(downloadProgress.downloadSpeed) 
              }) }}
            </div>
          </div>
        </div>

        <div v-if="errorMessage" class="error-section">
          <div class="error-message">
            {{ $t('downloader.error') }}: {{ errorMessage }}
          </div>
        </div>
      </div>

      <!-- Supported Libraries -->
      <div class="libraries-section card">
        <h3>{{ $t('downloader.supportedLibraries') }}</h3>
        <div class="libraries-list">
          <div 
            v-for="library in supportedLibraries" 
            :key="library.name" 
            class="library-item"
            :class="{ 'library-warning': library.name.includes('⚠️') }"
          >
            <h4>{{ library.name }}</h4>
            <p>{{ library.description }}</p>
            <div class="library-example">
              <strong>{{ $t('downloader.examples') }}:</strong>
              <code 
                class="example-url" 
                @click="useExample(library.example)"
                :title="'Click to use this example'"
              >
                {{ library.example }}
              </code>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Cache Stats Modal -->
    <div v-if="showCacheModal" class="modal-overlay" @click="showCacheModal = false">
      <div class="modal-content" @click.stop>
        <h3>{{ $t('downloader.cacheStats') }}</h3>
        <div v-if="cacheStats" class="cache-info">
          <p><strong>Size:</strong> {{ formatBytes(cacheStats.size) }}</p>
          <p><strong>Entries:</strong> {{ cacheStats.entries }}</p>
        </div>
        <button @click="showCacheModal = false" class="btn btn-secondary">Close</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import type { DownloadProgress, DownloadStatus, LibraryInfo } from '../../shared/types'

const { t, locale } = useI18n()

const manuscriptUrl = ref('')
const isDownloading = ref(false)
const downloadProgress = ref<DownloadProgress | null>(null)
const downloadStatus = ref<DownloadStatus | null>(null)
const errorMessage = ref('')
const supportedLibraries = ref<LibraryInfo[]>([])
const currentLanguage = ref('en')
const showCacheModal = ref(false)
const cacheStats = ref<{ size: number; entries: number } | null>(null)

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

onMounted(async () => {
  try {
    await waitForElectronAPI();
    
    // Load supported libraries
    supportedLibraries.value = await window.electronAPI.getSupportedLibraries()
    console.log('Loaded supported libraries:', supportedLibraries.value);
    
    // Get current language
    currentLanguage.value = await window.electronAPI.getLanguage()
    locale.value = currentLanguage.value
    
    // Listen for language changes
    window.electronAPI.onLanguageChanged((language) => {
      currentLanguage.value = language
      locale.value = language
    })
  } catch (error) {
    console.error('Failed to initialize:', error)
  }
})

const switchLanguage = async (language: string) => {
  currentLanguage.value = language
  locale.value = language
  // Language change will be handled by the main process menu
}

const useExample = (exampleUrl: string) => {
  manuscriptUrl.value = exampleUrl
}

const handleDownload = async () => {
  if (isDownloading.value) {
    // Cancel download logic would go here
    return
  }

  errorMessage.value = ''
  downloadProgress.value = null
  downloadStatus.value = null
  isDownloading.value = true

  try {
    await window.electronAPI.downloadManuscript(manuscriptUrl.value.trim(), {
      onProgress: (progress: DownloadProgress) => {
        downloadProgress.value = progress
      },
      onStatusChange: (status: DownloadStatus) => {
        downloadStatus.value = status
      },
      onError: (error: string) => {
        errorMessage.value = error
        isDownloading.value = false
      }
    })
  } catch (error: any) {
    errorMessage.value = error.message || 'Unknown error occurred'
  } finally {
    isDownloading.value = false
  }
}

const showCacheStats = async () => {
  try {
    cacheStats.value = await window.electronAPI.getCacheStats()
    showCacheModal.value = true
  } catch (error) {
    console.error('Failed to get cache stats:', error)
  }
}

const clearCache = async () => {
  try {
    await window.electronAPI.clearCache()
    // Show success message
    downloadStatus.value = {
      phase: 'completed',
      message: t('downloader.cacheCleared')
    }
    setTimeout(() => {
      downloadStatus.value = null
    }, 3000)
  } catch (error) {
    console.error('Failed to clear cache:', error)
    errorMessage.value = 'Failed to clear cache'
  }
}

const formatTime = (milliseconds: number): string => {
  const seconds = Math.round(milliseconds / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}m ${remainingSeconds}s`
}

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}
</script>

<style scoped>
.manuscript-downloader {
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
  min-height: 100vh;
}

.top-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  padding: 1rem;
  background: var(--card-bg);
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border: 1px solid var(--border-light);
  backdrop-filter: blur(8px);
}

.language-switcher {
  display: flex;
  gap: 0.5rem;
}

.language-switcher button {
  padding: 0.5rem 1rem;
  border: 1px solid var(--border-light);
  background: white;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  transition: all var(--animation-timing);
  color: var(--text-color);
}

.language-switcher button.active {
  background: #667eea;
  color: white;
  border-color: #667eea;
}

.language-switcher button:hover:not(.active) {
  border-color: #667eea;
  background: #f8f9ff;
}

.cache-controls {
  display: flex;
  gap: 0.5rem;
}

.content-wrapper {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  align-items: start;
}

.download-section h2, .libraries-section h3 {
  margin: 0 0 1.5rem 0;
  color: var(--text-color);
  font-weight: 600;
}

.download-section h2 {
  font-size: 1.8rem;
}

.download-form {
  margin-bottom: 1.5rem;
}

.status-section {
  margin-top: 1.5rem;
}

.status-message {
  padding: 1rem;
  border-radius: 8px;
  font-weight: 500;
  margin-bottom: 1rem;
}

.status-message.parsing,
.status-message.loading {
  background: rgba(33, 150, 243, 0.1);
  color: var(--info-color);
}

.status-message.success {
  background: rgba(76, 175, 80, 0.1);
  color: var(--success-color);
}

.status-message.error {
  background: rgba(244, 67, 54, 0.1);
  color: var(--error-color);
}

.progress-section {
  margin-top: 1rem;
}

.progress-details {
  display: flex;
  justify-content: space-between;
  font-size: 0.9rem;
  color: var(--secondary-color);
  margin-bottom: 0.5rem;
}

.progress-eta, .progress-speed {
  font-size: 0.85rem;
  color: var(--secondary-color);
}

.error-section {
  margin-top: 1.5rem;
}

.error-message {
  background: rgba(244, 67, 54, 0.1);
  color: var(--error-color);
  padding: 1rem;
  border-radius: 8px;
  font-weight: 500;
}

.libraries-section h3 {
  margin: 0 0 1.5rem 0;
  color: var(--text-color);
  font-size: 1.5rem;
  font-weight: 600;
}

.libraries-list {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  max-height: 70vh;
  overflow-y: auto;
}

.library-item {
  padding: 1rem;
  border: 1px solid var(--border-light);
  border-radius: 8px;
  background: var(--background-color);
  transition: all var(--animation-timing);
}

.library-item:hover {
  border-color: #667eea;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.1);
}

.library-item.library-warning {
  border-color: var(--error-color);
  background: rgba(244, 67, 54, 0.05);
}

.library-item.library-warning h4 {
  color: var(--error-color);
  font-weight: 600;
}

.library-item h4 {
  margin: 0 0 0.5rem 0;
  color: var(--text-color);
  font-size: 1.1rem;
}

.library-item p {
  margin: 0 0 0.75rem 0;
  color: var(--secondary-color);
  font-size: 0.9rem;
}

.library-example {
  font-size: 0.85rem;
}

.library-example strong {
  color: var(--primary-color);
  margin-bottom: 4px;
  display: block;
}

.example-url {
  display: block;
  background: #f8f9fa;
  border: 1px solid var(--border-light);
  border-radius: 4px;
  padding: 8px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.8rem;
  color: #007bff;
  cursor: pointer;
  transition: all var(--animation-timing);
  word-break: break-all;
  line-height: 1.3;
}

.example-url:hover {
  background: #e3f2fd;
  border-color: #007bff;
}

.cache-info p {
  margin: 0.5rem 0;
  color: var(--secondary-color);
}

@media (max-width: 1200px) {
  .content-wrapper {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .manuscript-downloader {
    padding: 1rem;
  }
  
  .top-controls {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }
  
  .cache-controls {
    justify-content: center;
  }
}
</style>