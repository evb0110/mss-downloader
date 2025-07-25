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
          :disabled="isDownloading"
          :title="$t('downloader.cacheStats')"
          @click="showCacheStats"
        >
          📊 {{ $t('downloader.cacheStats') }}
        </button>
        <button 
          class="btn btn-secondary"
          :disabled="isDownloading"
          :title="$t('downloader.clearCache')"
          @click="clearCache"
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
        
        <form
          class="download-form"
          @submit.prevent="handleDownload"
        >
          <div class="form-group">
            <label
              for="manuscript-url"
              class="form-label"
            >{{ $t('downloader.urlLabel') }}</label>
            <input
              id="manuscript-url"
              v-model="manuscriptUrl"
              type="url"
              :placeholder="$t('downloader.urlPlaceholder')"
              class="form-input"
              :disabled="isDownloading"
              required
            >
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
        <div
          v-if="downloadStatus"
          class="status-section"
        >
          <div
            class="status-message"
            :class="downloadStatus.phase"
          >
            {{ downloadStatus.message }}
          </div>

          <div
            v-if="downloadProgress && isDownloading"
            class="progress-section"
          >
            <div class="progress-bar">
              <div 
                class="progress-fill" 
                :style="{ width: downloadProgress.percentage + '%' }"
              />
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

            <div
              v-if="downloadProgress.estimatedTimeRemaining > 0"
              class="progress-eta"
            >
              {{ $t('downloader.progress.timeRemaining', { 
                time: formatTime(downloadProgress.estimatedTimeRemaining) 
              }) }}
            </div>

            <div
              v-if="downloadProgress.downloadSpeed > 0"
              class="progress-speed"
            >
              {{ $t('downloader.progress.downloadSpeed', { 
                speed: formatBytes(downloadProgress.downloadSpeed) 
              }) }}
            </div>
          </div>
        </div>

        <div
          v-if="errorMessage"
          class="error-section"
        >
          <div class="error-message">
            {{ $t('downloader.error') }}: {{ errorMessage }}
          </div>
        </div>
      </div>

      <!-- Supported Libraries -->
      <div class="libraries-section card">
        <h3>{{ $t('downloader.supportedLibraries') }}</h3>
        
        <!-- Search Bar -->
        <div class="library-search">
          <input
            v-model="librarySearchQuery"
            type="text"
            :placeholder="$t('downloader.searchLibraries')"
            class="search-input"
          >
          <div class="search-icon">
            🔍
          </div>
        </div>
        
        <!-- Search Results Summary -->
        <div
          v-if="librarySearchQuery.trim()"
          class="search-summary"
        >
          <div class="search-stats">
            <span class="total-results">
              {{ searchResults.stats.total }} {{ searchResults.stats.total === 1 ? 'library' : 'libraries' }} found
            </span>
            <span
              v-if="searchResults.stats.total > 0"
              class="search-breakdown"
            >
              <span
                v-if="searchResults.stats.exact > 0"
                class="exact-matches"
              >
                {{ searchResults.stats.exact }} exact
              </span>
              <span
                v-if="searchResults.stats.partial > 0"
                class="partial-matches"
              >
                {{ searchResults.stats.partial }} partial
              </span>
              <span
                v-if="searchResults.stats.fuzzy > 0"
                class="fuzzy-matches"
              >
                {{ searchResults.stats.fuzzy }} fuzzy
              </span>
            </span>
          </div>
          <div
            v-if="searchResults.stats.total === 0"
            class="search-suggestions"
          >
            Try searching for: "cambridge", "british", "vatican", "bnf", "wien", "harvard"
          </div>
        </div>
        
        <div class="libraries-list">
          <div 
            v-for="(library, index) in filteredLibraries" 
            :key="library.name" 
            class="library-item"
            :class="{ 
              'library-warning': library.name.includes('⚠️'),
              'exact-match': librarySearchQuery.trim() && index < searchResults.stats.exact,
              'partial-match': librarySearchQuery.trim() && index >= searchResults.stats.exact && index < searchResults.stats.exact + searchResults.stats.partial,
              'fuzzy-match': librarySearchQuery.trim() && index >= searchResults.stats.exact + searchResults.stats.partial
            }"
          >
            <h4>{{ library.name }}</h4>
            <p>{{ library.description }}</p>
            <div class="library-example">
              <strong>{{ $t('downloader.examples') }}:</strong>
              <code 
                class="example-url" 
                :title="'Click to use this example'"
                @click="useExample(library.example)"
              >
                {{ library.example }}
              </code>
            </div>
          </div>
        </div>
        
        <div 
          v-if="filteredLibraries.length === 0 && librarySearchQuery" 
          class="no-results"
        >
          <div class="no-results-message">
            {{ $t('downloader.noLibrariesFound') }}
          </div>
          <div class="search-tips">
            <strong>Search tips:</strong>
            <ul>
              <li>Try shorter keywords (e.g., "cambridge" instead of "cambridge university")</li>
              <li>Search by country or city (e.g., "paris", "london", "vatican")</li>
              <li>Use common abbreviations (e.g., "bnf", "bne", "bnl")</li>
              <li>Try institutional keywords (e.g., "library", "national", "university")</li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <!-- Cache Stats Modal -->
    <div
      v-if="showCacheModal"
      class="modal-overlay"
      @click="showCacheModal = false"
    >
      <div
        class="modal-content"
        @click.stop
      >
        <h3>{{ $t('downloader.cacheStats') }}</h3>
        <div
          v-if="cacheStats"
          class="cache-info"
        >
          <p><strong>Size:</strong> {{ formatBytes(cacheStats.size) }}</p>
          <p><strong>Entries:</strong> {{ cacheStats.entries }}</p>
        </div>
        <button
          class="btn btn-secondary"
          @click="showCacheModal = false"
        >
          Close
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
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
const librarySearchQuery = ref('')

// Enhanced search with categorized results and verbose feedback
const searchResults = computed(() => {
  if (!librarySearchQuery.value.trim()) {
    return {
      libraries: [...supportedLibraries.value].sort((a, b) => a.name.localeCompare(b.name)),
      stats: {
        total: supportedLibraries.value.length,
        exact: 0,
        partial: 0,
        fuzzy: 0,
        query: ''
      }
    }
  }

  const query = librarySearchQuery.value.toLowerCase().trim()
  const exactMatches: LibraryInfo[] = []
  const partialMatches: LibraryInfo[] = []
  const fuzzyMatches: LibraryInfo[] = []
  
  supportedLibraries.value.forEach(library => {
    const name = library.name.toLowerCase()
    const description = library.description.toLowerCase()
    const example = library.example.toLowerCase()
    
    // Exact name match (highest priority)
    if (name === query || name.includes(` ${query} `) || name.startsWith(query + ' ') || name.endsWith(' ' + query)) {
      exactMatches.push(library)
      return
    }
    
    // Partial matches in name, description, or URL
    if (name.includes(query) || description.includes(query) || example.includes(query)) {
      partialMatches.push(library)
      return
    }
    
    // Fuzzy matching with higher threshold - at least 70% of query characters must match consecutively
    const strictFuzzyMatch = (text: string) => {
      if (query.length < 3) return false // Require at least 3 characters for fuzzy search
      
      let maxConsecutive = 0
      let currentConsecutive = 0
      let queryIndex = 0
      
      for (let i = 0; i < text.length && queryIndex < query.length; i++) {
        if (text[i] === query[queryIndex]) {
          currentConsecutive++
          queryIndex++
        } else {
          maxConsecutive = Math.max(maxConsecutive, currentConsecutive)
          currentConsecutive = 0
        }
      }
      maxConsecutive = Math.max(maxConsecutive, currentConsecutive)
      
      // Require at least 70% of query length to match consecutively
      return queryIndex === query.length && maxConsecutive >= Math.ceil(query.length * 0.7)
    }
    
    if (strictFuzzyMatch(name) || strictFuzzyMatch(description)) {
      fuzzyMatches.push(library)
    }
  })
  
  // Sort each category alphabetically
  exactMatches.sort((a, b) => a.name.localeCompare(b.name))
  partialMatches.sort((a, b) => a.name.localeCompare(b.name))
  fuzzyMatches.sort((a, b) => a.name.localeCompare(b.name))
  
  return {
    libraries: [...exactMatches, ...partialMatches, ...fuzzyMatches],
    stats: {
      total: exactMatches.length + partialMatches.length + fuzzyMatches.length,
      exact: exactMatches.length,
      partial: partialMatches.length,
      fuzzy: fuzzyMatches.length,
      query: query
    }
  }
})

// For backward compatibility
const filteredLibraries = computed(() => searchResults.value.libraries)

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

.library-search {
  position: relative;
  margin-bottom: 1.5rem;
}

.search-input {
  width: 100%;
  padding: 0.75rem 2.5rem 0.75rem 1rem;
  border: 1px solid var(--border-light);
  border-radius: 8px;
  font-size: 0.9rem;
  background: var(--background-color);
  color: var(--text-color);
  transition: all var(--animation-timing);
}

.search-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.search-input::placeholder {
  color: var(--secondary-color);
}

.search-icon {
  position: absolute;
  right: 1rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--secondary-color);
  pointer-events: none;
}

.no-results {
  text-align: center;
  padding: 2rem;
  color: var(--secondary-color);
  font-style: italic;
}

.libraries-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
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
  position: relative;
}

.library-item.exact-match {
  border-left: 4px solid #059669;
  background: rgba(5, 150, 105, 0.02);
}

.library-item.partial-match {
  border-left: 4px solid #d97706;
  background: rgba(217, 119, 6, 0.02);
}

.library-item.fuzzy-match {
  border-left: 4px solid #7c3aed;
  background: rgba(124, 58, 237, 0.02);
}

.library-item.exact-match::before {
  content: 'EXACT';
  position: absolute;
  top: 0.5rem;
  right: 0.75rem;
  font-size: 0.7rem;
  font-weight: 600;
  color: #059669;
  background: rgba(5, 150, 105, 0.1);
  padding: 0.2rem 0.4rem;
  border-radius: 3px;
}

.library-item.partial-match::before {
  content: 'PARTIAL';
  position: absolute;
  top: 0.5rem;
  right: 0.75rem;
  font-size: 0.7rem;
  font-weight: 600;
  color: #d97706;
  background: rgba(217, 119, 6, 0.1);
  padding: 0.2rem 0.4rem;
  border-radius: 3px;
}

.library-item.fuzzy-match::before {
  content: 'FUZZY';
  position: absolute;
  top: 0.5rem;
  right: 0.75rem;
  font-size: 0.7rem;
  font-weight: 600;
  color: #7c3aed;
  background: rgba(124, 58, 237, 0.1);
  padding: 0.2rem 0.4rem;
  border-radius: 3px;
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

@media (min-width: 1600px) {
  .libraries-list {
    grid-template-columns: repeat(auto-fit, minmax(450px, 1fr));
  }
}

@media (max-width: 1200px) {
  .content-wrapper {
    grid-template-columns: 1fr;
  }
  
  .libraries-list {
    grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
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
  
  .libraries-list {
    grid-template-columns: 1fr;
  }
}
</style>