<template>
    <div class="download-queue-manager">
        <!-- Queue Status Header -->
        <div class="queue-status-header">
            <div class="queue-status-info">
                <h2>Download Queue Manager</h2>
                <p class="queue-description">
                    Manage your manuscript downloads with advanced queue features
                </p>
                <div
                    class="queue-status-badge"
                    :class="`status-${queueStatusClass}`"
                >
                    {{ getStatusText(queueStatusClass) }}
                </div>
            </div>
            <div class="queue-main-controls">
                <button 
                    :disabled="queueStats.pending === 0 && !isProcessing" 
                    class="btn btn-primary"
                    :class="isProcessing ? 'btn-danger' : 'btn-success'"
                    @click="toggleProcessing"
                >
                    {{ isProcessing ? 'Stop' : 'Start' }}
                </button>
            </div>
        </div>

        <!-- Queue Statistics -->
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-number">
                    {{ queueStats.total }}
                </div>
                <div class="stat-label">
                    Total
                </div>
            </div>
            <div class="stat-card pending">
                <div class="stat-number">
                    {{ queueStats.pending }}
                </div>
                <div class="stat-label">
                    Pending
                </div>
            </div>
            <div class="stat-card downloading">
                <div class="stat-number">
                    {{ queueStats.downloading }}
                </div>
                <div class="stat-label">
                    Downloading
                </div>
            </div>
            <div class="stat-card completed">
                <div class="stat-number">
                    {{ queueStats.completed }}
                </div>
                <div class="stat-label">
                    Completed
                </div>
            </div>
            <div class="stat-card failed">
                <div class="stat-number">
                    {{ queueStats.failed }}
                </div>
                <div class="stat-label">
                    Failed
                </div>
            </div>
        </div>

        <!-- Add Manuscript Section -->
        <div class="add-manuscript-section card">
            <h3>Add Manuscript</h3>
      
            <!-- Supported Libraries -->
            <div class="supported-libraries">
                <h4>Supported Libraries</h4>
                <div class="libraries-grid">
                    <div
                        v-for="library in supportedLibraries"
                        :key="library.name"
                        class="library-card"
                    >
                        <h5>{{ library.name }}</h5>
                        <p class="library-description">
                            {{ library.description }}
                        </p>
                        <div class="library-example">
                            <strong>Example URL:</strong>
                            <code
                                class="example-url-link"
                                @click="handleExampleClick(library.example)"
                            >{{ library.example }}</code>
                        </div>
                    </div>
                </div>
            </div>
      
            <!-- URL Input -->
            <div class="form-group">
                <label for="manuscript-url" class="form-label">Manuscript URL</label>
                <div class="input-with-help">
                    <input 
                        id="manuscript-url"
                        v-model="newManuscriptUrl"
                        type="url"
                        placeholder="https://gallica.bnf.fr/ark:/12148/..."
                        class="form-input"
                        :class="{ 'input-error': urlError }"
                        @input="clearErrors"
                    >
                    <small class="input-help">Enter a manuscript URL from one of the supported libraries</small>
                </div>
            </div>

            <!-- Load Manuscript Button -->
            <div class="form-group">
                <button 
                    :disabled="!newManuscriptUrl || isLoadingManifest" 
                    class="btn btn-secondary load-btn"
                    @click="loadManifest"
                >
                    {{ isLoadingManifest ? 'Loading...' : 'Load Manuscript' }}
                </button>
            </div>

            <!-- Manuscript Info (after loading) -->
            <div
                v-if="loadedManifest"
                class="manuscript-info"
            >
                <div class="manifest-success">
                    <h4>{{ loadedManifest.displayName }}</h4>
                    <p class="manifest-details">
                        <span class="library-tag">{{ loadedManifest.library.toUpperCase() }}</span>
                        Total pages available: <strong>{{ loadedManifest.totalPages }}</strong>
                    </p>
                </div>

                <!-- Page Range Selection -->
                <div class="page-range-section">
                    <h4>Page Range</h4>
                    <p class="numbering-explanation">
                        Page numbers follow the original manuscript numbering
                    </p>
          
                    <div class="page-inputs-row">
                        <div class="page-input-group">
                            <label for="start-page" class="form-label">Start Page</label>
                            <input 
                                id="start-page"
                                v-model.number="startPage"
                                type="number"
                                min="1"
                                :max="loadedManifest.totalPages"
                                class="form-input page-input"
                                @blur="validatePageInputs"
                            >
                        </div>
                        <div class="page-input-separator">
                            —
                        </div>
                        <div class="page-input-group">
                            <label for="end-page" class="form-label">End Page</label>
                            <input 
                                id="end-page"
                                v-model.number="endPage"
                                type="number"
                                min="1"
                                :max="loadedManifest.totalPages"
                                class="form-input page-input"
                                @blur="validatePageInputs"
                            >
                        </div>
                    </div>

                    <div class="page-range-display">
                        <span
                            v-if="isFullDownload"
                            class="range-text"
                        >
                            Download all pages
                        </span>
                        <span
                            v-else
                            class="range-text"
                        >
                            Download pages {{ startPage }} - {{ endPage }}
                        </span>
                        <span class="page-count">({{ selectedPageCount }} pages)</span>
                    </div>
                </div>

                <!-- Download Options -->
                <div class="download-options-section">
                    <h4>Download Options</h4>
          
                    <div class="form-group">
                        <label for="concurrent-downloads" class="form-label">Concurrent Downloads</label>
                        <div class="concurrent-downloads-control">
                            <input 
                                id="concurrent-downloads"
                                v-model.number="concurrentDownloads"
                                type="range"
                                min="1"
                                max="8"
                                class="slider"
                            >
                            <div class="concurrent-value-display">
                                <span class="concurrent-number">{{ concurrentDownloads }}</span>
                                <span class="concurrent-label">
                                    {{ concurrentDownloads === 1 ? 'Sequential' : 
                                        concurrentDownloads <= 3 ? 'Recommended' : 
                                        'Maximum' }}
                                </span>
                            </div>
                        </div>
                        <small class="input-help">Higher values download faster but may cause server issues</small>
                    </div>
                </div>

                <!-- Add to Queue Button -->
                <div class="add-to-queue-actions">
                    <button 
                        :disabled="!loadedManifest || isAddingToQueue || hasValidationErrors" 
                        class="btn btn-primary add-queue-btn"
                        @click="addToQueue"
                    >
                        {{ isAddingToQueue ? 'Adding...' : 'Add to Queue' }}
                    </button>
                </div>
            </div>

            <!-- Error Display -->
            <div
                v-if="addError"
                class="error-message"
            >
                {{ addError }}
            </div>
        </div>

        <!-- Queue Items -->
        <div class="queue-items-section card">
            <div class="queue-header">
                <h3>Queue Items</h3>
                <div class="queue-controls">
                    <button 
                        :disabled="queueStats.completed === 0"
                        class="btn btn-secondary"
                        @click="clearCompleted"
                    >
                        Clear Completed
                    </button>
                    <button 
                        :disabled="queueStats.failed === 0"
                        class="btn btn-secondary"
                        @click="clearFailed"
                    >
                        Clear Failed
                    </button>
                </div>
            </div>

            <!-- Queue Items List -->
            <div class="queue-items-list">
                <div
                    v-for="(item, index) in queueItems"
                    :key="item.id"
                    class="queue-item"
                    :class="`status-${item.status}`"
                >
                    <div class="item-header">
                        <h4>{{ item.displayName }}</h4>
                        <div class="item-controls">
                            <button 
                                v-if="item.status === 'pending'"
                                class="btn btn-secondary btn-sm"
                                @click="removeItem(item.id)"
                            >
                                Remove
                            </button>
                            <button 
                                v-if="item.status === 'downloading'"
                                class="btn btn-secondary btn-sm"
                                @click="pauseItem(item.id)"
                            >
                                Pause
                            </button>
                            <button 
                                v-if="item.status === 'paused'"
                                class="btn btn-primary btn-sm"
                                @click="resumeItem(item.id)"
                            >
                                Resume
                            </button>
                        </div>
                    </div>

                    <div class="item-details">
                        <span class="library-tag">{{ item.library.toUpperCase() }}</span>
                        <span class="page-range">{{ getPageRangeText(item) }}</span>
                        <span class="status-text">{{ getStatusDisplayText(item.status) }}</span>
                    </div>

                    <!-- Progress Bar -->
                    <div v-if="item.progress" class="item-progress">
                        <div class="progress-bar">
                            <div 
                                class="progress-fill" 
                                :style="{ width: item.progress.percentage + '%' }"
                            ></div>
                        </div>
                        <div class="progress-details">
                            <span>{{ item.progress.current }}/{{ item.progress.total }} pages</span>
                            <span>{{ Math.round(item.progress.percentage) }}%</span>
                            <span v-if="item.progress.eta">ETA: {{ item.progress.eta }}</span>
                        </div>
                    </div>

                    <!-- Error Message -->
                    <div v-if="item.error" class="item-error">
                        {{ item.error }}
                    </div>
                </div>

                <!-- Empty State -->
                <div
                    v-if="queueItems.length === 0"
                    class="empty-state"
                >
                    <div class="empty-icon">
                        📋
                    </div>
                    <h3>Empty Queue</h3>
                    <p>Add your first manuscript to get started</p>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { QueueState, QueuedManuscript } from '../../shared/queueTypes'
import type { UnifiedManifest, LibraryInfo } from '../../shared/types'

// Reactive state
const queueState = ref<QueueState>({
    items: [],
    isProcessing: false,
    isPaused: false,
    globalSettings: {
        autoStart: false,
        concurrentDownloads: 3,
        pauseBetweenItems: 0,
    },
})

const supportedLibraries = ref<LibraryInfo[]>([])
const newManuscriptUrl = ref('')
const isLoadingManifest = ref(false)
const isAddingToQueue = ref(false)
const loadedManifest = ref<UnifiedManifest | null>(null)
const urlError = ref('')
const addError = ref('')

// Form state
const startPage = ref(1)
const endPage = ref(1)
const concurrentDownloads = ref(3)

// Computed
const queueItems = computed(() => queueState.value.items)
const isProcessing = computed(() => queueState.value.isProcessing)
const queueStats = computed(() => {
    const items = queueState.value.items
    return {
        total: items.length,
        pending: items.filter((item) => item.status === 'pending').length,
        downloading: items.filter((item) => item.status === 'downloading').length,
        completed: items.filter((item) => item.status === 'completed').length,
        failed: items.filter((item) => item.status === 'failed').length,
        paused: items.filter((item) => item.status === 'paused').length,
    }
})

const queueStatusClass = computed(() => {
    if (queueStats.value.failed > 0) return 'error'
    if (queueStats.value.downloading > 0) return 'downloading'
    if (queueStats.value.completed === queueStats.value.total && queueStats.value.total > 0) return 'completed'
    return 'idle'
})

const isFullDownload = computed(() => {
    return startPage.value === 1 && endPage.value === (loadedManifest.value?.totalPages || 1)
})

const selectedPageCount = computed(() => {
    return Math.max(0, endPage.value - startPage.value + 1)
})

const hasValidationErrors = computed(() => {
    return !loadedManifest.value || startPage.value > endPage.value || startPage.value < 1 || endPage.value > (loadedManifest.value?.totalPages || 1)
})

// Methods
function getStatusText(status: string): string {
    const statusMap: Record<string, string> = {
        idle: 'Idle',
        downloading: 'Downloading',
        completed: 'Completed',
        error: 'Error'
    }
    return statusMap[status] || 'Unknown'
}

function getStatusDisplayText(status: string): string {
    const statusMap: Record<string, string> = {
        pending: 'Pending',
        downloading: 'Downloading',
        completed: 'Completed',
        failed: 'Failed',
        paused: 'Paused'
    }
    return statusMap[status] || 'Unknown'
}

async function loadManifest() {
    if (!newManuscriptUrl.value) return
    
    isLoadingManifest.value = true
    clearErrors()
    
    try {
        const manifest = await window.electronAPI.parseManuscriptUrl(newManuscriptUrl.value)
        loadedManifest.value = manifest
        startPage.value = 1
        endPage.value = manifest.totalPages
    } catch (error: any) {
        urlError.value = error.message
        addError.value = `Failed to load manuscript: ${error.message}`
    } finally {
        isLoadingManifest.value = false
    }
}

function validatePageInputs() {
    if (!loadedManifest.value) return
  
    if (startPage.value < 1) startPage.value = 1
    if (startPage.value > loadedManifest.value.totalPages) startPage.value = loadedManifest.value.totalPages
    if (endPage.value < 1) endPage.value = 1
    if (endPage.value > loadedManifest.value.totalPages) endPage.value = loadedManifest.value.totalPages
    if (startPage.value > endPage.value) endPage.value = startPage.value
}

function clearErrors() {
    urlError.value = ''
    addError.value = ''
}

async function addToQueue() {
    if (!loadedManifest.value || hasValidationErrors.value) return

    isAddingToQueue.value = true
    addError.value = ''

    try {
        await window.electronAPI.addToQueue({
            url: newManuscriptUrl.value,
            displayName: loadedManifest.value.displayName,
            library: loadedManifest.value.library,
            totalPages: loadedManifest.value.totalPages,
            downloadOptions: {
                concurrentDownloads: concurrentDownloads.value,
                startPage: startPage.value,
                endPage: endPage.value,
            },
        })

        // Reset form
        newManuscriptUrl.value = ''
        loadedManifest.value = null
        startPage.value = 1
        endPage.value = 1
        concurrentDownloads.value = 3

    } catch (error: any) {
        addError.value = `Failed to add to queue: ${error.message}`
    } finally {
        isAddingToQueue.value = false
    }
}

async function toggleProcessing() {
    try {
        if (isProcessing.value) {
            await window.electronAPI.stopQueueProcessing()
        } else {
            await window.electronAPI.startQueueProcessing()
        }
    } catch (error: any) {
        console.error('Error toggling processing:', error)
    }
}

async function removeItem(id: string) {
    try {
        await window.electronAPI.removeFromQueue(id)
    } catch (error: any) {
        console.error('Error removing item:', error)
    }
}

async function pauseItem(id: string) {
    try {
        await window.electronAPI.pauseQueueItem(id)
    } catch (error: any) {
        console.error('Error pausing item:', error)
    }
}

async function resumeItem(id: string) {
    try {
        await window.electronAPI.resumeQueueItem(id)
    } catch (error: any) {
        console.error('Error resuming item:', error)
    }
}

async function clearCompleted() {
    try {
        await window.electronAPI.clearCompletedFromQueue()
    } catch (error: any) {
        console.error('Error clearing completed:', error)
    }
}

async function clearFailed() {
    try {
        await window.electronAPI.clearFailedFromQueue()
    } catch (error: any) {
        console.error('Error clearing failed:', error)
    }
}

function getPageRangeText(item: QueuedManuscript): string {
    const start = item.downloadOptions?.startPage || 1
    const end = item.downloadOptions?.endPage || item.totalPages
    if (start === 1 && end === item.totalPages) {
        return `${item.totalPages} pages`
    }
    return `${start}-${end} (${end - start + 1} pages)`
}

function handleExampleClick(exampleUrl: string) {
    newManuscriptUrl.value = exampleUrl
    clearErrors()
}

// Lifecycle
onMounted(async () => {
    try {
        // Load supported libraries
        supportedLibraries.value = await window.electronAPI.getSupportedLibraries()
        
        // Get initial queue state
        queueState.value = await window.electronAPI.getQueueState()
        
        // Listen for queue state updates
        window.electronAPI.onQueueStateChanged((newState: QueueState) => {
            queueState.value = newState
        })
        
    } catch (error) {
        console.error('Failed to initialize queue manager:', error)
    }
})
</script>

<style scoped>
/* Using existing styles from main.scss */
</style> 