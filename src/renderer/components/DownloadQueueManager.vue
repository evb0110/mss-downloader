<template>
    <div class="manuscript-downloader">
        <div class="info-buttons-row">
            <button
                class="info-btn"
                @click="showSupportedLibrariesModal = true"
            >
                <span class="btn-icon">ℹ</span>
                Supported Libraries
            </button>
            <button
                v-if="queueItems.length > 0"
                class="add-more-btn"
                @click="openAddMoreDocumentsModal"
            >
                <span class="btn-icon">+</span>
                Add More Documents
            </button>
        </div>

        <!-- Bulk Queue Mode -->
        <div class="bulk-queue-form">
            <!-- Show input form directly if no queue items -->
            <template v-if="queueItems.length === 0">
                <div class="form-group">
                    <label for="bulk-urls">Manuscript URLs</label>
                    <textarea
                        id="bulk-urls"
                        v-model="bulkUrlText"
                        placeholder="Enter manuscript URLs here, one per line or separated by commas/semicolons."
                        class="bulk-textarea manuscript-input"
                        :disabled="isProcessingUrls"
                        rows="6"
                        @keydown="handleTextareaKeydown"
                    />
                    <small class="help-text">
                        Accepted URLs: Gallica BnF (gallica.bnf.fr), e-codices (e-codices.unifr.ch), Vatican Library (digi.vatlib.it).
                    </small>
                </div>
                
                <button
                    :disabled="isProcessingUrls || !bulkUrlText.trim()"
                    class="load-btn"
                    @click="processBulkUrls"
                >
                    {{ isProcessingUrls ? 'Adding to Queue...' : 'Add to Queue' }}
                </button>
            </template>


            <!-- Queue Display -->
            <div
                v-if="queueItems.length > 0"
                class="queue-section"
            >
                <!-- Queue Progress Bar -->
                <div
                    v-if="queueStats.total > 0"
                    class="queue-progress"
                >
                    <div class="queue-progress-header">
                        <span class="queue-progress-label">Queue Progress</span>
                        <span class="queue-progress-stats">
                            {{ queueStats.completed + queueStats.failed }} / {{ queueStats.total }} Manuscripts
                        </span>
                    </div>
                    <div class="queue-progress-bar">
                        <!-- Individual segments for each item in queue order -->
                        <div
                            v-for="item in queueItems"
                            :key="item.id"
                            class="queue-progress-fill"
                            :class="getProgressSegmentClass(item.status)"
                            :style="{ width: `${Math.round((1 / queueStats.total) * 100)}%` }"
                            :title="`${item.displayName}: ${item.status}`"
                        />
                    </div>
                    <div class="queue-progress-breakdown">
                        <span
                            v-if="queueStats.downloading > 0"
                            class="progress-segment downloading"
                        >
                            {{ queueStats.downloading }} Downloading
                        </span>
                        <span
                            v-if="queueStats.pending > 0"
                            class="progress-segment pending"
                        >
                            {{ queueStats.pending }} Pending
                        </span>
                        <span
                            v-if="queueStats.paused > 0"
                            class="progress-segment paused"
                        >
                            {{ queueStats.paused }} Paused
                        </span>
                        <span
                            v-if="queueStats.completed > 0"
                            class="progress-segment completed"
                        >
                            {{ queueStats.completed }} Completed
                        </span>
                        <span
                            v-if="queueStats.failed > 0"
                            class="progress-segment failed"
                        >
                            {{ queueStats.failed }} Failed
                        </span>
                    </div>
                </div>

                <div class="queue-controls">
                    <button
                        v-if="!isQueueProcessing && !isQueuePaused"
                        class="start-btn"
                        :disabled="isProcessingUrls || !hasReadyItems"
                        @click="startQueue"
                    >
                        {{ shouldShowResume ? 'Resume Queue' : 'Start Queue' }}
                    </button>
                    <button
                        v-if="isQueueProcessing && !isQueuePaused"
                        class="pause-btn"
                        @click="pauseQueue"
                    >
                        Pause Queue
                    </button>
                    <button
                        v-if="isQueuePaused && shouldShowResume"
                        class="resume-btn"
                        @click="resumeQueue"
                    >
                        Resume Queue
                    </button>
                    <button
                        v-if="isQueuePaused && !shouldShowResume"
                        class="start-btn"
                        :disabled="isProcessingUrls || !hasReadyItems"
                        @click="startQueue"
                    >
                        Start Queue
                    </button>
                    <button
                        v-if="isQueueProcessing || isQueuePaused"
                        class="stop-btn"
                        @click="stopQueue"
                    >
                        Stop Queue
                    </button>
                    <button
                        class="clear-queue-btn"
                        :disabled="queueItems.length === 0 || isProcessingUrls"
                        title="Clear all items from the queue"
                        @click="clearAllQueue"
                    >
                        Clear All
                    </button>
                    <button
                        class="cleanup-cache-btn"
                        :disabled="isProcessingUrls"
                        title="Clean up the image cache for downloaded manuscripts"
                        @click="cleanupIndexedDBCache"
                    >
                        Cleanup Cache
                    </button>
                    
                    <!-- Loading manifests indicator -->
                    <div
                        v-if="isProcessingUrls"
                        class="loading-manifests"
                    >
                        <div class="loading-spinner" />
                        <span>Loading Manifests...</span>
                    </div>
                </div>

                <div class="queue-list">
                    <div
                        v-for="item in queueItems"
                        :key="item.id"
                        class="queue-item"
                        :class="[`status-${item.status}`, { 'loading-manifest': item.status === 'loading' }]"
                    >
                        <div class="queue-item-header">
                            <div class="queue-item-info">
                                <strong v-if="item.status === 'failed'">
                                    Failed to Load Manifest
                                    <a
                                        :href="item.url"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        class="manuscript-error-link"
                                    >
                                        {{ item.url }}
                                    </a>
                                </strong>
                                <strong v-else>
                                    <a
                                        v-if="item.status !== 'loading' && item.url"
                                        :href="item.url"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        class="manuscript-title-link"
                                    >
                                        {{ item.displayName }}
                                    </a>
                                    <span v-else>{{ item.displayName }}</span>
                                </strong>
                                <div class="queue-item-meta">
                                    <span
                                        class="status-badge"
                                        :class="`status-${item.status}`"
                                    >{{ item.status }}</span>
                                    <span
                                        v-if="item.status !== 'failed'"
                                        class="total-pages-badge"
                                    >
                                        <template v-if="item.downloadOptions && (item.downloadOptions.startPage !== 1 || item.downloadOptions.endPage !== item.totalPages)">
                                            Pages {{ item.downloadOptions.startPage || 1 }}–{{ item.downloadOptions.endPage || item.totalPages }} ({{ (item.downloadOptions.endPage || item.totalPages) - (item.downloadOptions.startPage || 1) + 1 }} of {{ item.totalPages }})
                                        </template>
                                        <template v-else>
                                            All {{ item.totalPages }} Pages
                                        </template>
                                    </span>
                                    <span
                                        v-if="item.status !== 'failed'"
                                        class="concurrency-badge"
                                    >
                                        Concurrency: {{ item.downloadOptions?.concurrentDownloads || 3 }}
                                    </span>
                                </div>
                            </div>
                            <div class="queue-item-controls">
                                <button
                                    v-if="(item.status === 'pending' || item.status === 'downloading' || item.status === 'paused') && editingQueueItemId !== item.id"
                                    class="edit-btn"
                                    title="Edit download options"
                                    @click="startQueueItemEdit(item)"
                                >
                                    Edit
                                </button>
                                <button
                                    v-if="item.status === 'downloading'"
                                    class="pause-item-btn"
                                    title="Pause this download"
                                    @click="pauseQueueItem(item.id)"
                                >
                                    Pause
                                </button>
                                <button
                                    v-if="item.status === 'paused'"
                                    class="resume-item-btn"
                                    title="Resume this download"
                                    @click="resumeQueueItem(item.id)"
                                >
                                    Resume
                                </button>
                                <button
                                    class="remove-btn"
                                    title="Remove from queue"
                                    @click="removeQueueItem(item.id)"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                        
                        <!-- Edit form (for pending, downloading, and paused items when editing) -->
                        <div
                            v-if="editingQueueItemId === item.id && (item.status === 'pending' || item.status === 'downloading' || item.status === 'paused') && editingQueueItem"
                            class="queue-edit-form"
                        >
                            <div class="edit-section">
                                <div class="edit-header">
                                    <label>Page Range</label>
                                    <div class="edit-actions">
                                        <button
                                            :disabled="hasEditQueueValidationErrors || !hasQueueItemChanges"
                                            class="edit-btn edit-save-btn"
                                            title="Apply changes"
                                            @click="saveQueueItemEdit()"
                                        >
                                            Apply
                                        </button>
                                        <button
                                            class="edit-btn edit-cancel-btn"
                                            title="Cancel changes"
                                            @click="cancelQueueItemEdit()"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                                <div class="page-range">
                                    <input
                                        v-model.number="editingQueueItem.startPage"
                                        type="number"
                                        min="1"
                                        :max="item.totalPages"
                                        class="page-input"
                                        @blur="validateQueueEditInputs"
                                    >
                                    <span>–</span>
                                    <input
                                        v-model.number="editingQueueItem.endPage"
                                        type="number"
                                        min="1"
                                        :max="item.totalPages"
                                        class="page-input"
                                        @blur="validateQueueEditInputs"
                                    >
                                    <button
                                        type="button"
                                        class="select-all-btn"
                                        :class="{ 'active': editingQueueItem.startPage === 1 && editingQueueItem.endPage === item.totalPages }"
                                        @click="selectAllPages(item.totalPages)"
                                    >
                                        All Pages
                                    </button>
                                </div>
                                <p v-if="hasEditQueueValidationErrors" class="error-message">
                                    Invalid page range or duplicate entry.
                                </p>
                            </div>
                            
                            <div class="edit-section">
                                <label>Concurrent Downloads: {{ editingQueueItem.concurrentDownloads }}</label>
                                <input
                                    v-model.number="editingQueueItem.concurrentDownloads"
                                    type="range"
                                    min="1"
                                    max="8"
                                    class="concurrency-slider"
                                >
                            </div>
                        </div>
                        
                        <!-- Progress bar for downloading and paused items -->
                        <div
                            v-if="item.status === 'downloading' || (item.status === 'paused' && item.progress)"
                            :key="`progress-${item.id}-${item.progress?.current || 0}`"
                            class="item-progress"
                        >
                            <div class="item-progress-header">
                                <span class="item-progress-label">
                                    {{ item.status === 'downloading' ? 'Download Progress' : 'Paused Progress' }}
                                </span>
                                <span class="item-progress-stats">
                                    <template v-if="item.progress">
                                        {{ item.status === 'downloading'
                                            ? `Downloading ${item.progress.current} of ${item.progress.total}`
                                            : `Paused at ${item.progress.current} of ${item.progress.total}`
                                        }} ({{ item.progress.percentage }}%)
                                    </template>
                                    <template v-else>
                                        Initializing...
                                    </template>
                                </span>
                            </div>
                            <div class="item-progress-bar">
                                <div 
                                    class="item-progress-fill"
                                    :style="{ width: `${item.progress?.percentage || 0}%` }"
                                />
                            </div>
                            <div
                                v-if="item.progress?.eta"
                                class="item-progress-eta"
                            >
                                Estimated Time: {{ item.progress.eta }}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Custom Modals (simplified from original) -->
    <div v-if="showConfirmModal" class="modal-overlay">
        <div class="modal-content">
            <h3>{{ confirmModal.title }}</h3>
            <p>{{ confirmModal.message }}</p>
            <div class="modal-actions">
                <button @click="handleConfirm">{{ confirmModal.confirmText }}</button>
                <button @click="closeConfirmModal">{{ confirmModal.cancelText }}</button>
            </div>
        </div>
    </div>

    <div v-if="showAlertModal" class="modal-overlay">
        <div class="modal-content">
            <h3>{{ alertModal.title }}</h3>
            <p>{{ alertModal.message }}</p>
            <div class="modal-actions">
                <button @click="closeAlertModal">Close</button>
            </div>
        </div>
    </div>

    <!-- Supported Libraries Modal (simplified) -->
    <div v-if="showSupportedLibrariesModal" class="modal-overlay">
        <div class="modal-content">
            <h3>Supported Libraries</h3>
            <p>Enter a URL from one of the following supported digital libraries to download a manuscript:</p>

            <div class="libraries-list">
                <div
                    v-for="library in supportedLibraries"
                    :key="library.name"
                    class="library-item"
                >
                    <h4 :class="{ 'library-warning': library.name.includes('⚠️') }">
                        {{ library.name }}
                    </h4>
                    <p
                        class="library-description"
                        :class="{ 'library-warning': library.description.includes('NOT WORKING YET') }"
                    >
                        {{ library.description }}
                    </p>
                    <div class="library-example">
                        <strong>Example URL:</strong>
                        <code
                            class="example-url-link"
                            @click="handleExampleClick(library.example); showSupportedLibrariesModal = false"
                        >{{ library.example }}</code>
                    </div>
                </div>
            </div>
            <div class="modal-actions">
                <button @click="showSupportedLibrariesModal = false">Close</button>
            </div>
        </div>
    </div>

    <!-- Add More Documents Modal (simplified) -->
    <div v-if="showAddMoreDocumentsModal" class="modal-overlay">
        <div class="modal-content">
            <h3>Add More Documents</h3>
            <div class="form-group">
                <label for="modal-bulk-urls">Manuscript URLs</label>
                <textarea
                    id="modal-bulk-urls"
                    ref="modalTextarea"
                    v-model="bulkUrlText"
                    placeholder="Enter manuscript URLs here, one per line or separated by commas/semicolons."
                    class="bulk-textarea manuscript-input"
                    :disabled="isProcessingUrls"
                    rows="6"
                    @keydown="handleTextareaKeydown"
                />
                <small class="help-text">
                    Accepted URLs: Gallica BnF (gallica.bnf.fr), e-codices (e-codices.unifr.ch), Vatican Library (digi.vatlib.it).
                </small>
            </div>
            
            <button
                :disabled="isProcessingUrls || !bulkUrlText.trim()"
                class="load-btn"
                @click="processBulkUrls()"
            >
                {{ isProcessingUrls ? 'Adding to Queue...' : 'Add to Queue' }}
            </button>
            <div class="modal-actions">
                <button @click="showAddMoreDocumentsModal = false">Cancel</button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watchEffect, onMounted } from 'vue';
import type { QueuedManuscript, QueueState, TStatus, TLibrary } from '../../shared/queueTypes';
import type { LibraryInfo, UnifiedManifest } from '../../shared/types';

// Declare window.electronAPI type
declare global {
  interface Window {
    electronAPI: {
      getLanguage: () => Promise<string>;
      downloadManuscript: (url: string, callbacks: any) => Promise<void>; // Simplified for now
      getSupportedLibraries: () => Promise<LibraryInfo[]>;
      parseManuscriptUrl: (url: string) => Promise<UnifiedManifest>;
      onLanguageChanged: (callback: (language: string) => void) => () => void;
      
      addToQueue: (manuscript: Omit<QueuedManuscript, 'id' | 'addedAt' | 'status'>) => Promise<string>;
      removeFromQueue: (id: string) => Promise<boolean>;
      startQueueProcessing: () => Promise<void>;
      pauseQueueProcessing: () => Promise<void>;
      resumeQueueProcessing: () => Promise<void>;
      stopQueueProcessing: () => Promise<void>;
      pauseQueueItem: (id: string) => Promise<boolean>;
      resumeQueueItem: (id: string) => Promise<boolean>;
      clearCompletedFromQueue: () => Promise<number>;
      clearFailedFromQueue: () => Promise<number>;
      clearAllFromQueue: () => Promise<number>;
      updateQueueItem: (id: string, updates: Partial<QueuedManuscript>) => Promise<boolean>;
      getQueueState: () => Promise<QueueState>;
      onQueueStateChanged: (callback: (state: QueueState) => void) => () => void;
      cleanupIndexedDBCache: () => Promise<void>;
    };
  }
}

// Bulk mode state
const bulkUrlText = ref('');
const isProcessingUrls = ref(false);
const modalTextarea = ref<HTMLTextAreaElement | null>(null);

// Queue state (imported from DownloadQueue service via IPC)
const queueState = ref<QueueState>({
    items: [],
    isProcessing: false,
    isPaused: false,
    globalSettings: {
        autoStart: false,
        concurrentDownloads: 3,
        pauseBetweenItems: 0,
    },
});

// Edit queue item state
const editingQueueItemId = ref<string | null>(null);
const editingQueueItem = ref<{
    startPage: number;
    endPage: number;
    concurrentDownloads: number;
} | null>(null);


// Modal state
const showConfirmModal = ref(false);
const showAlertModal = ref(false);
const showSupportedLibrariesModal = ref(false);
const showAddMoreDocumentsModal = ref(false);
const confirmModal = ref({
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    onConfirm: () => {},
});
const alertModal = ref({
    title: '',
    message: '',
});

// Supported Libraries - fetched via IPC
const supportedLibraries = ref<LibraryInfo[]>([]);

// Set up confirmation callback for unified downloader (not directly used by queue, but kept for consistency if direct downloads were enabled)
// window.electronAPI.setShowConfirmCallback((title, message, onConfirm, confirmText = 'Confirm', cancelText = 'Cancel') => {
//     showConfirm(title, message, onConfirm, confirmText, cancelText);
// });



// Bulk mode computed properties
const queueItems = computed(() => queueState.value.items || []);
const isQueueProcessing = computed(() => queueState.value.isProcessing || false);
const isQueuePaused = computed(() => queueState.value.isPaused || false);

const queueStats = computed(() => {
    const items = queueItems.value;
    return {
        total: items.length,
        pending: items.filter((item) => item.status === 'pending' || item.status === 'loading').length,
        downloading: items.filter((item) => item.status === 'downloading').length,
        completed: items.filter((item) => item.status === 'completed').length,
        failed: items.filter((item) => item.status === 'failed').length,
        paused: items.filter((item) => item.status === 'paused').length,
    };
});

const hasReadyItems = computed(() => queueItems.value.some((item: QueuedManuscript) => item.status === 'pending'));
// Track if the user has manually started queue in this session
const hasUserStartedQueue = ref(false);


// Check if the button should show "Resume" vs "Start"
const shouldShowResume = computed(() => {
    // If queue is empty, always show "Start"
    if (queueItems.value.length === 0) return false;
    
    // If only pending items exist (no started/completed/failed items), show "Start"
    const hasOnlyPendingItems = queueItems.value.every((item: QueuedManuscript) => item.status === 'pending' || item.status === 'loading');
    if (hasOnlyPendingItems) return false;
    
    // If a user has manually started the queue in this session, show resume
    if (hasUserStartedQueue.value) return true;
    
    // If queue is currently processing (auto-resumed), show appropriate button
    if (isQueueProcessing.value) return true;
    
    // If there are any non-pending items (paused, completed, failed), show resume
    const hasNonPendingItems = queueItems.value.some((item: QueuedManuscript) => 
        item.status !== 'pending' && item.status !== 'loading',
    );
    if (hasNonPendingItems) return true;
    
    // Otherwise show "Start" for first-time interaction
    return false;
});


const hasEditQueueValidationErrors = computed(() => {
    if (!editingQueueItem.value) return true;
    const currentItem = queueItems.value.find((item: QueuedManuscript) => item.id === editingQueueItemId.value);
    if (!currentItem) return true;
    
    if (editingQueueItem.value.startPage < 1 || editingQueueItem.value.startPage > currentItem.totalPages) return true;
    if (editingQueueItem.value.endPage < 1 || editingQueueItem.value.endPage > currentItem.totalPages) return true;
    if (editingQueueItem.value.startPage > editingQueueItem.value.endPage) return true;
    
    // Check for duplicates with other items (excluding the current item)
    return queueItems.value.some((item: QueuedManuscript) =>
        item.id !== editingQueueItemId.value &&
        item.url === currentItem.url &&
        (item.downloadOptions?.startPage || 1) === editingQueueItem.value!.startPage &&
        (item.downloadOptions?.endPage || item.totalPages) === editingQueueItem.value!.endPage,
    );
});

const hasQueueItemChanges = computed(() => {
    if (!editingQueueItem.value) return false;
    
    const currentItem = queueItems.value.find((item: QueuedManuscript) => item.id === editingQueueItemId.value);
    if (!currentItem) return false;
    
    const currentOptions = currentItem.downloadOptions;
    return editingQueueItem.value.startPage !== (currentOptions?.startPage || 1) ||
        editingQueueItem.value.endPage !== (currentOptions?.endPage || currentItem.totalPages) ||
        editingQueueItem.value.concurrentDownloads !== (currentOptions?.concurrentDownloads || 3);
});


async function handleExampleClick(exampleUrl: string) {
    bulkUrlText.value = bulkUrlText.value ? bulkUrlText.value + '\n' + exampleUrl : exampleUrl;
}

async function openAddMoreDocumentsModal() {
    // Clear the textarea content
    bulkUrlText.value = '';
    
    // Show the modal
    showAddMoreDocumentsModal.value = true;
    
    // Focus the textarea after modal opens
    await nextTick();
    if (modalTextarea.value) {
        modalTextarea.value.focus();
    }
}

// Initialize queue on component mount - moved to onMounted for proper timing

async function initializeQueue() {
    // Fetch initial state
    const initialState = await window.electronAPI.getQueueState();
    queueState.value = { ...initialState };
    
    // Subscribe to queue updates
    window.electronAPI.onQueueStateChanged((state: QueueState) => {
        // Force Vue to detect deep changes by creating completely new object references
        const newState = {
            ...state,
            items: state.items ? state.items.map((item: QueuedManuscript) => ({
                ...item,
                progress: item.progress ? { ...item.progress } : undefined,
            })) : [],
        };
        
        queueState.value = newState;
    });
}

// Initialize queue and fetch supported libraries when component mounts
onMounted(async () => {
    await initializeQueue();
    supportedLibraries.value = await window.electronAPI.getSupportedLibraries();

    // After loading from storage, if there are downloading items without progress, try to re-establish
    const downloadingItems = queueState.value.items?.filter((item: QueuedManuscript) => 
        item.status === 'downloading' && !item.progress,
    ) || [];
    
    if (downloadingItems.length > 0) {
        // Force a queue state refresh after a short delay
        setTimeout(async () => {
            const refreshedState = await window.electronAPI.getQueueState();
            queueState.value = { ...refreshedState };
        }, 1000);
    }
});

function parseUrls(text: string): string[] {
    return text
        .split(/[\s,;]+/)
        .map((url) => url.trim())
        .filter((url) => url.length > 0);
}

async function processBulkUrls() {
    const urls = parseUrls(bulkUrlText.value);
    
    if (urls.length === 0) return;

    // Close modal immediately and clear textarea so user can see queue updates
    showAddMoreDocumentsModal.value = false;
    bulkUrlText.value = '';

    isProcessingUrls.value = true;
    
    try {
        let addedCount = 0;
        let errorCount = 0;
        let duplicateCount = 0;
    
        // Filter out URLs that would create duplicates
        const urlsToProcess: string[] = [];
        const tempIds: string[] = [];
        const seenCanonicalUrls = new Set<string>();
    
        // Helper function for canonicalization (same as in queue)
        const canonicalizeUrl = (checkUrl: string) => {
            try {
                if (!checkUrl || typeof checkUrl !== 'string') {
                    return checkUrl;
                }
                
                const trimmedUrl = checkUrl.trim().replace(/\/$/, '');
                
                if (trimmedUrl.includes('gallica.bnf.fr/ark:')) {
                    const arkMatch = trimmedUrl.match(/ark:\/12148\/([^/]+)/);
                    const pageMatch = trimmedUrl.match(/\/f(\d+)\./);
                    
                    if (arkMatch) {
                        const arkId = arkMatch[1];
                        const pageNumber = pageMatch ? pageMatch[1] : '1';
                        return `gallica://ark:12148/${arkId}/f${pageNumber}`;
                    }
                }
                
                return trimmedUrl;
            } catch (error) {
                console.warn('Error canonicalizing URL:', checkUrl, error);
                return checkUrl;
            }
        };
    
        for (const url of urls) {
            const urlCanonical = canonicalizeUrl(url);
            
            // Check if this canonical URL is already in the current batch
            if (seenCanonicalUrls.has(urlCanonical)) {
                duplicateCount++;
                continue;
            }
            
            seenCanonicalUrls.add(urlCanonical);
            
            // Also check against existing queue items
            const existingItem = queueState.value.items.find(item => canonicalizeUrl(item.url) === urlCanonical);
            if (existingItem) {
                duplicateCount++;
                continue;
            }

            try {
                // Add a placeholder item to the queue with 'loading' status
                const tempId = await window.electronAPI.addToQueue({
                    url,
                    displayName: `Loading manifest for ${url.substring(0, 50)}...`,
                    library: 'loading' as TLibrary,
                    totalPages: 0,
                    downloadOptions: {
                        concurrentDownloads: queueState.value.globalSettings?.concurrentDownloads || 3,
                        startPage: 1,
                        endPage: 1,
                    },
                });
                tempIds.push(tempId);
                urlsToProcess.push(url);
            } catch (error: any) {
                if (error.message.includes('already exists in queue')) {
                    duplicateCount++;
                } else {
                    console.error(`[processBulkUrls] Unexpected error for ${url}:`, error);
                    errorCount++; // Count this as an error if not a duplicate
                }
            }
        }

        // Then load manifests and update items
        for (let i = 0; i < urlsToProcess.length; i++) {
            const url = urlsToProcess[i];
            const tempId = tempIds[i];
        
            try {
                // Parse manifest in the main process
                const manifest = await window.electronAPI.parseManuscriptUrl(url);
                
                // Final duplicate check after manifest is loaded
                const urlCanonical = canonicalizeUrl(url);
                const existingCompleteItem = queueState.value.items.find((item: QueuedManuscript) => {
                    if (item.id === tempId) return false; // Don't compare with itself
                    
                    const itemUrlCanonical = canonicalizeUrl(item.url);
                    const sameUrl = itemUrlCanonical === urlCanonical;
                    const samePageRange = (item.downloadOptions?.startPage || 1) === 1 &&
                        (item.downloadOptions?.endPage || item.totalPages) === manifest.totalPages;
                    
                    return sameUrl && samePageRange && ['pending', 'downloading', 'completed'].includes(item.status);
                });
                
                if (existingCompleteItem) {
                    // Remove the temp item and count as duplicate
                    await window.electronAPI.removeFromQueue(tempId);
                    duplicateCount++;
                    continue;
                }
                
                // Update the temporary item with actual manifest data
                await window.electronAPI.updateQueueItem(tempId, {
                    displayName: manifest.displayName,
                    library: manifest.library as TLibrary,
                    totalPages: manifest.totalPages,
                    status: 'pending' as TStatus,
                    downloadOptions: {
                        concurrentDownloads: queueState.value.globalSettings?.concurrentDownloads || 3,
                        startPage: 1,
                        endPage: manifest.totalPages,
                    },
                });
                addedCount++;
            } catch (error: any) {
                // Determine if this is an expected error that doesn't need console logging
                const isExpectedError = error.message?.includes('not valid JSON') ||
                    error.message?.includes('404') ||
                    error.message?.includes('Manuscript not found') ||
                    error.message?.includes('CORS') ||
                    error.message?.includes('Invalid manifest structure');
            
                if (!isExpectedError) {
                    // Only log unexpected errors to avoid console spam
                    console.error(`Failed to load manifest for ${url}:`, error);
                }
            
                await window.electronAPI.updateQueueItem(tempId, {
                    displayName: `Failed to load: ${url.substring(0, 50)}...`,
                    status: 'failed' as TStatus,
                    error: error.message,
                });
                errorCount++;
            }
        }

        // Show alert for duplicates to inform the user
        if (duplicateCount > 0 || errorCount > 0) {
            let message = '';
            if (duplicateCount > 0) {
                message += `${duplicateCount} duplicate${duplicateCount > 1 ? 's' : ''} found and skipped. `;
            }
            if (errorCount > 0) {
                message += `${errorCount} URL${errorCount > 1 ? 's' : ''} failed to load. `;
            }
            if (addedCount > 0) {
                message += `${addedCount} new manuscript${addedCount > 1 ? 's' : ''} added.`;
            } else if (duplicateCount === 0 && errorCount === 0) {
                message = 'No new manuscripts were added.'; // Should not happen if urls.length > 0 but no adds/duplicates/errors
            }

            showAlert(
                'Processing Results',
                message,
            );
        } else if (addedCount > 0) {
            // Show success if items were added and no duplicates/errors
            showAlert(
                'Success',
                `${addedCount} new manuscript${addedCount > 1 ? 's' : ''} added to queue.`,
            );
        }


    } catch (error: any) {
        console.error('[processBulkUrls] Unexpected error during bulk processing:', error);
        showAlert(
            'Error',
            `Failed to process URLs: ${error.message}`,
        );
    } finally {
        isProcessingUrls.value = false;
        // Optionally, start processing if autoStart is true and queue is not already processing
        if (queueState.value.globalSettings.autoStart && !isQueueProcessing.value) {
            startQueue();
        }
    }
}


async function startQueue() {
    await window.electronAPI.startQueueProcessing();
    hasUserStartedQueue.value = true;
}

async function pauseQueue() {
    await window.electronAPI.pauseQueueProcessing();
}

async function resumeQueue() {
    await window.electronAPI.resumeQueueProcessing();
    hasUserStartedQueue.value = true;
}

async function stopQueue() {
    await window.electronAPI.stopQueueProcessing();
    hasUserStartedQueue.value = false; // Reset when queue is stopped manually
}

function clearAllQueue() {
    if (queueItems.value.length === 0) return;
    
    const hasActiveDownloads = queueItems.value.some((item: QueuedManuscript) => item.status === 'downloading');
    
    if (hasActiveDownloads) {
        showConfirm(
            'Clear All Queue Items?',
            'There are active downloads. Stopping the queue will cancel them. Are you sure you want to clear all items?',
            async () => {
                await window.electronAPI.clearAllFromQueue();
                hasUserStartedQueue.value = false;
                editingQueueItemId.value = null;
                editingQueueItem.value = null;
            },
            'Clear All',
            'Cancel',
        );
    } else {
        showConfirm(
            'Clear All Queue Items?',
            `Are you sure you want to clear all ${queueItems.value.length} items from the queue?`,
            async () => {
                await window.electronAPI.clearAllFromQueue();
                hasUserStartedQueue.value = false;
                editingQueueItemId.value = null;
                editingQueueItem.value = null;
            },
            'Clear All',
            'Cancel',
        );
    }
}

function startQueueItemEdit(item: QueuedManuscript) {
    editingQueueItemId.value = item.id;
    editingQueueItem.value = {
        startPage: item.downloadOptions?.startPage || 1,
        endPage: item.downloadOptions?.endPage || item.totalPages,
        concurrentDownloads: item.downloadOptions?.concurrentDownloads || queueState.value.globalSettings?.concurrentDownloads || 3,
    };
}

function cancelQueueItemEdit() {
    editingQueueItemId.value = null;
    editingQueueItem.value = null;
}

function validateQueueEditInputs() {
    if (!editingQueueItem.value) return;
    const currentItem = queueItems.value.find((item: QueuedManuscript) => item.id === editingQueueItemId.value);
    if (!currentItem) return;
    
    if (editingQueueItem.value.startPage < 1) editingQueueItem.value.startPage = 1;
    if (editingQueueItem.value.startPage > currentItem.totalPages) editingQueueItem.value.startPage = currentItem.totalPages;
    if (editingQueueItem.value.endPage < 1) editingQueueItem.value.endPage = 1;
    if (editingQueueItem.value.endPage > currentItem.totalPages) editingQueueItem.value.endPage = currentItem.totalPages;
    if (editingQueueItem.value.startPage > editingQueueItem.value.endPage) editingQueueItem.value.endPage = editingQueueItem.value.startPage;
}

function selectAllPages(totalPages: number) {
    if (!editingQueueItem.value) return;
    
    editingQueueItem.value.startPage = 1;
    editingQueueItem.value.endPage = totalPages;
}

async function saveQueueItemEdit() {
    if (!editingQueueItem.value || hasEditQueueValidationErrors.value) return; // Removed || !downloadQueue.value as we use IPC
    
    const success = await window.electronAPI.updateQueueItem(editingQueueItemId.value!, {
        downloadOptions: {
            startPage: editingQueueItem.value.startPage,
            endPage: editingQueueItem.value.endPage,
            concurrentDownloads: editingQueueItem.value.concurrentDownloads,
        },
    });
    
    if (success) {
        editingQueueItemId.value = null;
        editingQueueItem.value = null;
    } else {
        showAlert('Error', 'Failed to update queue item.');
    }
}

async function pauseQueueItem(id: string) {
    await window.electronAPI.pauseQueueItem(id);
}

async function resumeQueueItem(id: string) {
    await window.electronAPI.resumeQueueItem(id);
}

function removeQueueItem(id: string) {
    showConfirm(
        'Remove Manuscript?',
        'Are you sure you want to remove this manuscript from the queue?',
        async () => {
            await window.electronAPI.removeFromQueue(id);
        },
        'Remove',
        'Cancel',
    );
}



// Modal functions
function showConfirm(title: string, message: string, onConfirm: () => void, confirmText = '', cancelText = '') {
    confirmModal.value = {
        title,
        message,
        confirmText: confirmText || 'Confirm',
        cancelText: cancelText || 'Cancel',
        onConfirm,
    };
    showConfirmModal.value = true;
}

function showAlert(title: string, message: string) {
    alertModal.value = {
        title,
        message,
    };
    showAlertModal.value = true;
}

function handleConfirm() {
    confirmModal.value.onConfirm();
    closeConfirmModal();
}

function closeConfirmModal() {
    showConfirmModal.value = false;
}

function closeAlertModal() {
    showAlertModal.value = false;
}

async function cleanupIndexedDBCache() {
    try {
        showConfirm(
            'Cleanup Cache',
            'Are you sure you want to clear the image cache? This will delete all downloaded images and may free up significant disk space.',
            async () => {
                await window.electronAPI.cleanupIndexedDBCache();
                showAlert('Cache Cleanup', 'Image cache has been cleared successfully.');
            },
            'Cleanup',
            'Cancel',
        );
    } catch (error: any) {
        console.error('Failed to cleanup IndexedDB cache:', error);
        showAlert('Error', `Failed to clean up cache: ${error.message}`);
    }
}

function handleTextareaKeydown(event: KeyboardEvent) {
    // Check for Ctrl+Enter (Windows/Linux) or Cmd+Enter (Mac)
    const isModifierPressed = event.ctrlKey || event.metaKey;
    const isEnterPressed = event.key === 'Enter';
    
    if (isModifierPressed && isEnterPressed) {
        // Prevent default behavior (new line)
        event.preventDefault();
        
        // Only trigger if the button would be enabled
        if (!isProcessingUrls.value && bulkUrlText.value.trim()) {
            processBulkUrls();
        }
    }
}

function getProgressSegmentClass(status: TStatus): string {
    switch (status) {
        case 'completed':
            return 'completed';
        case 'failed':
            return 'failed';
        case 'downloading':
            return 'downloading';
        case 'paused':
            return 'paused';
        case 'pending':
        case 'loading':
        default:
            return 'pending';
    }
}
</script>

<style scoped>
/* Modal Overlay and Content Styles */
.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
}

.modal-content {
    background: white;
    padding: 25px;
    border-radius: 8px;
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
    max-width: 500px;
    width: 90%;
    z-index: 1001;
    display: flex;
    flex-direction: column;
    gap: 15px;
}

.modal-content h3 {
    margin-top: 0;
    color: #333;
    font-size: 1.5em;
    border-bottom: 1px solid #eee;
    padding-bottom: 10px;
}

.modal-content p {
    margin: 0;
    color: #555;
    line-height: 1.6;
}

.modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 20px;
}

.modal-actions button {
    padding: 10px 20px;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 500;
    border: none;
    transition: background-color 0.2s ease;
}

.modal-actions button:first-child { /* Confirm button style */
    background-color: #007bff;
    color: white;
}

.modal-actions button:first-child:hover {
    background-color: #0056b3;
}

.modal-actions button:last-child { /* Cancel/Close button style */
    background-color: #6c757d;
    color: white;
}

.modal-actions button:last-child:hover {
    background-color: #5a6268;
}


/* General Styles from barsky.club/src/styles/main.scss relevant to this component, or duplicated from the original component for consistency */
:root {
    --primary-color: #007bff;
    --secondary-color: #6c757d;
    --success-color: #28a745;
    --danger-color: #dc3545;
    --warning-color: #ffc107;
    --info-color: #17a2b8;
    --light-color: #f8f9fa;
    --dark-color: #343a40;
    --border-color: #dee2e6;
    --text-color: #212529;
    --header-color: #495057;
    --bg-light: #ffffff;
    --bg-dark: #f0f2f5;
    --font-family-base: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    --font-family-mono: "SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}

body {
    font-family: var(--font-family-base);
    line-height: 1.6;
    color: var(--text-color);
    background-color: var(--bg-dark);
    margin: 0;
    padding: 0;
}

.manuscript-downloader {
    max-width: 1200px;
    margin: 0 auto;
    padding: min(2rem, 3vw);
    font-family: var(--font-family-base);
    max-height: calc(100vh - 80px); /* 100svh minus navbar height */
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.info-buttons-row {
    display: flex;
    justify-content: flex-end; /* Align to the right */
    gap: 10px;
    margin-bottom: 20px;
    flex-wrap: wrap; /* Allow wrapping on smaller screens */
}

.info-btn, .add-more-btn {
    background-color: var(--info-color);
    color: white;
    border: none;
    padding: 8px 15px;
    border-radius: 5px;
    cursor: pointer;
    font-size: 0.9em;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    transition: background-color 0.2s ease;
}

.info-btn:hover, .add-more-btn:hover {
    background-color: #118c9f;
}

.info-btn .btn-icon, .add-more-btn .btn-icon {
    font-size: 1.1em;
}

.form-group {
    margin-bottom: 1rem;
}

label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 600;
    color: var(--header-color);
}

.manuscript-input {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    font-size: 1rem;
    transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
}

.manuscript-input:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
}

.help-text {
    display: block;
    margin-top: 0.25rem;
    color: var(--secondary-color);
    font-size: 0.875rem;
}

.load-btn {
    width: 100%;
    background-color: var(--primary-color);
    color: white;
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 4px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.15s ease-in-out;
}

.load-btn:hover:not(:disabled) {
    background-color: #0056b3;
}

.load-btn:disabled {
    background-color: var(--secondary-color);
    cursor: not-allowed;
    opacity: 0.6;
}

/* Bulk Mode Styles */
.bulk-queue-form {
    max-width: 100%;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    flex: 1;
    min-height: 0;
}

.bulk-textarea {
    min-height: 120px;
    resize: vertical;
    font-family: var(--font-family-mono);
    font-size: 14px;
    line-height: 1.4;
    width: 100%;
    box-sizing: border-box;
    padding: 12px;
    border: 1px solid #ccc;
    border-radius: 6px;
    word-wrap: break-word;
    overflow-wrap: break-word;
}

/* Responsive adjustments for smaller screens */
@media (max-width: 768px) {
    .bulk-textarea {
        font-size: 13px;
        min-height: 140px; /* Slightly taller on mobile for multi-line placeholder */
        padding: 10px;
    }
}

@media (max-width: 480px) {
    .bulk-textarea {
        font-size: 12px;
        min-height: 160px; /* Even taller on very small screens */
        padding: 8px;
        line-height: 1.3;
    }
}

/* Queue Section */
.queue-section {
    margin-top: 20px;
    padding: 15px;
    background: #e8f4fd;
    border-radius: 8px;
    border: 1px solid #b3d7ff;
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0; /* Allow flex child to shrink */
}

/* Queue Progress */
.queue-progress {
    margin-bottom: 15px;
    padding: 12px;
    background: white;
    border-radius: 6px;
    border: 1px solid #dee2e6;
}

.queue-progress-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
}

.queue-progress-label {
    font-weight: 600;
    color: var(--header-color);
    font-size: 0.9em;
}

.queue-progress-stats {
    font-weight: 500;
    color: var(--secondary-color);
    font-size: 0.85em;
}

.queue-progress-bar {
    height: 8px;
    background: #e9ecef;
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 8px;
}

.queue-progress-fill {
    height: 100%;
    transition: width 0.3s ease;
    float: left;
}

.queue-progress-fill.completed {
    background: linear-gradient(90deg, #28a745 0%, #20c997 100%);
}

.queue-progress-fill.failed {
    background: linear-gradient(90deg, #dc3545 0%, #c82333 100%);
}

.queue-progress-fill.downloading {
    background: linear-gradient(90deg, #ffc107 0%, #fd7e14 100%);
}

.queue-progress-fill.paused {
    background: linear-gradient(90deg, #6c757d 0%, #5a6268 100%);
}

.queue-progress-fill.pending {
    background: linear-gradient(90deg, #e9ecef 0%, #dee2e6 100%);
}

.queue-progress-breakdown {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
}

.progress-segment {
    padding: 2px 6px;
    border-radius: 10px;
    font-size: 0.7em;
    font-weight: 600;
    text-transform: uppercase;
}

.progress-segment.pending {
    background: #f8f9fa;
    color: var(--secondary-color);
    border: 1px solid var(--border-color);
}

.progress-segment.downloading {
    background: #fff3cd;
    color: #856404;
    border: 1px solid #ffeaa7;
}

.progress-segment.paused {
    background: #e2e3e5;
    color: #383d41;
    border: 1px solid #c6c8ca;
}

.progress-segment.completed {
    background: #d4edda;
    color: #155724;
    border: 1px solid #c3e6cb;
}

.progress-segment.failed {
    background: #f8d7da;
    color: #721c24;
    border: 1px solid #f5c6cb;
}

.queue-controls {
    margin-bottom: 15px;
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
}

.start-btn {
    background: linear-gradient(135deg, var(--success-color) 0%, #20c997 100%);
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 600;
    box-shadow: 0 2px 8px rgba(40, 167, 69, 0.2);
    transition: all 0.2s ease;
}

.start-btn:hover:not(:disabled) {
    background: linear-gradient(135deg, #218838 0%, #1ea085 100%);
    box-shadow: 0 3px 12px rgba(40, 167, 69, 0.25);
}

.start-btn:disabled {
    background: #adb5bd;
    cursor: not-allowed;
    opacity: 0.6;
    box-shadow: none;
}

.pause-btn {
    background: var(--warning-color);
    color: var(--dark-color);
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 500;
}

.pause-btn:hover {
    background: #e0a800;
}

.resume-btn {
    background: var(--info-color);
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 500;
}

.resume-btn:hover {
    background: #138496;
}

.stop-btn {
    background: var(--danger-color);
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 500;
}

.stop-btn:hover {
    background: #c82333;
}

.clear-queue-btn {
    background: var(--danger-color);
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 500;
}

.clear-queue-btn:hover:not(:disabled) {
    background: #c82333;
}

.clear-queue-btn:disabled {
    background: #adb5bd;
    cursor: not-allowed;
    opacity: 0.6;
}

.cleanup-cache-btn {
    background: var(--secondary-color);
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 500;
}

.cleanup-cache-btn:hover:not(:disabled) {
    background: #5a6268;
}

.cleanup-cache-btn:disabled {
    background: #adb5bd;
    cursor: not-allowed;
    opacity: 0.6;
}

.queue-list {
    background: white;
    border-radius: 6px;
    overflow: hidden;
    overflow-y: auto;
}

.queue-item {
    padding: 10px;
    border-bottom: 1px solid #eee;
}

.queue-item:last-child {
    border-bottom: none;
}

.queue-item.status-pending {
    background: #f8f9fa;
    border-left: 4px solid #dee2e6;
}

.queue-item.status-downloading {
    background: #fff3cd;
    border-left: 4px solid var(--warning-color);
}

.queue-item.status-paused {
    background: #e2e3e5;
    border-left: 4px solid #c6c8ca;
}

.queue-item.status-completed {
    background: #d4edda;
    border-left: 4px solid var(--success-color);
}

.queue-item.status-failed {
    background: #f8d7da;
    border-left: 4px solid var(--danger-color);
}

.queue-item.status-loading,
.queue-item.loading-manifest {
    background: #f8f9fa;
    border-left: 4px solid var(--secondary-color);
    opacity: 0.7;
}

.queue-item.status-failed {
    opacity: 0.8;
}

.loading-manifests {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--secondary-color);
    font-size: 0.9em;
    margin-bottom: 10px;
}

.loading-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid #f3f3f3;
    border-top: 2px solid var(--primary-color);
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}

.queue-item-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
}

.queue-item-info strong {
    display: block;
    margin-bottom: 4px;
    word-break: break-all;
}

.manuscript-title-link {
    color: inherit;
    text-decoration: none;
    border-bottom: 1px dotted currentColor;
    transition: color 0.2s ease, border-color 0.2s ease;
}

.manuscript-title-link:hover {
    color: var(--primary-color);
    border-bottom-color: var(--primary-color);
    text-decoration: none;
}

.manuscript-error-link {
    color: var(--danger-color);
    text-decoration: none;
    border-bottom: 1px dotted var(--danger-color);
    transition: color 0.2s ease, border-color 0.2s ease;
    word-break: break-all;
}

.manuscript-error-link:hover {
    color: #c82333;
    border-bottom-color: #c82333;
    text-decoration: none;
}

.error-prefix {
    color: var(--danger-color);
    font-weight: 700;
    text-transform: uppercase;
    font-size: 0.9em;
    letter-spacing: 0.5px;
}

.queue-item-meta {
    display: flex;
    gap: 10px;
    align-items: center;
    font-size: 0.9em;
    color: #666;
    margin-top: 0.75rem;
}

.status-badge {
    color: white;
    padding: 3px 8px;
    border-radius: 12px;
    font-size: 0.75em;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    white-space: nowrap;
}

.status-badge.status-pending {
    background: var(--secondary-color);
}

.status-badge.status-loading {
    background: var(--info-color);
}

.status-badge.status-downloading {
    background: var(--warning-color);
    color: var(--dark-color);
}

.status-badge.status-paused {
    background: var(--secondary-color);
    color: white;
}

.status-badge.status-completed {
    background: var(--success-color);
}

.status-badge.status-failed {
    background: var(--danger-color);
}

.total-pages-badge {
    background: #e9ecef;
    color: var(--header-color);
    padding: 3px 8px;
    border-radius: 12px;
    font-size: 0.75em;
    font-weight: 600;
    white-space: nowrap;
}

.concurrency-badge {
    background: #d1ecf1;
    color: #0c5460;
    padding: 3px 8px;
    border-radius: 12px;
    font-size: 0.75em;
    font-weight: 600;
    border: 1px solid #bee5eb;
    white-space: nowrap;
}

.downloading-range-badge {
    background: #fff3cd;
    color: #856404;
    padding: 3px 8px;
    border-radius: 12px;
    font-size: 0.75em;
    font-weight: 600;
    border: 1px solid #ffeaa7;
}

.queue-item-controls {
    display: flex;
    gap: 8px;
}

.edit-btn {
    background: var(--warning-color);
    color: var(--dark-color);
    border: none;
    border-radius: 4px;
    min-width: 28px;
    height: 28px;
    padding: 0 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 500;
}

.edit-btn:hover {
    background: #e0a800;
}

.pause-item-btn {
    background: var(--warning-color);
    color: var(--dark-color);
    border: none;
    border-radius: 4px;
    min-width: 28px;
    height: 28px;
    padding: 0 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 500;
}

.pause-item-btn:hover {
    background: #e0a800;
}

.resume-item-btn {
    background: var(--info-color);
    color: white;
    border: none;
    border-radius: 4px;
    min-width: 28px;
    height: 28px;
    padding: 0 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 500;
}

.resume-item-btn:hover {
    background: #138496;
}

.remove-btn {
    background: var(--danger-color);
    color: white;
    border: none;
    border-radius: 4px;
    min-width: 28px;
    height: 28px;
    padding: 0 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 500;
    line-height: 1;
}

.remove-btn:hover {
    background: #c82333;
}

.queue-edit-form .edit-save-btn {
    background: var(--success-color);
    color: white;
    font-size: 12px;
    padding: 6px 12px;
    min-width: auto;
    height: 28px;
    font-weight: 500;
    border-radius: 4px;
}

.queue-edit-form .edit-save-btn:hover:not(:disabled) {
    background: #218838;
}

.queue-edit-form .edit-save-btn:disabled {
    background: var(--secondary-color);
    cursor: not-allowed;
}

.queue-edit-form .edit-cancel-btn {
    background: var(--secondary-color);
    color: white;
    font-size: 12px;
    padding: 6px 12px;
    min-width: auto;
    height: 28px;
    font-weight: 500;
    border-radius: 4px;
}

.queue-edit-form .edit-cancel-btn:hover {
    background: #5a6268;
}

/* Queue Edit Form */
.queue-edit-form {
    margin-top: 12px;
    padding: 12px;
    background: #f8f9fa;
    border-radius: 6px;
    border: 1px solid #dee2e6;
}

.queue-edit-form .edit-section {
    margin-bottom: 12px;
}

.queue-edit-form .edit-section:last-of-type {
    margin-bottom: 8px;
}

.queue-edit-form label {
    display: block;
    font-size: 0.9em;
    margin-bottom: 4px;
    font-weight: 500;
    color: var(--header-color);
}

.error-message {
    color: var(--danger-color);
    font-size: 0.85em;
    margin-top: 5px;
}

.edit-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 12px;
}

.edit-actions {
    display: flex;
    gap: 6px;
}

.select-all-btn {
    background: var(--primary-color);
    border: 1px solid var(--primary-color);
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.8em;
    font-weight: 500;
    transition: all 0.2s ease;
}

.select-all-btn:hover {
    background: #0056b3;
    border-color: #0056b3;
}

.select-all-btn.active {
    background: #f8f9fa;
    border-color: #dee2e6;
    color: var(--secondary-color);
    cursor: not-allowed;
}

.select-all-btn.active:hover {
    background: #f8f9fa;
    border-color: #dee2e6;
}

/* Individual Item Progress */
.item-progress {
    margin-top: 10px;
    padding: 8px;
    background: #f8f9fa;
    border-radius: 4px;
    border: 1px solid #dee2e6;
}

.item-progress-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
}

.item-progress-label {
    font-weight: 600;
    color: var(--header-color);
    font-size: 0.8em;
}

.item-progress-stats {
    font-weight: 500;
    color: var(--secondary-color);
    font-size: 0.75em;
}

.item-progress-bar {
    height: 6px;
    background: #e9ecef;
    border-radius: 3px;
    overflow: hidden;
    margin-bottom: 6px;
}

.item-progress-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--warning-color) 0%, #fd7e14 100%);
    transition: width 0.3s ease;
}

.item-progress-eta {
    font-size: 0.7em;
    color: var(--secondary-color);
    text-align: right;
}

.libraries-list {
    margin-top: 1.5rem;
}

.library-item {
    margin-bottom: 1.5rem;
    padding: 1rem;
    background: white;
    border-radius: 6px;
    border: 1px solid #dee2e6;
}

.library-item h4 {
    margin: 0 0 0.5rem 0;
    color: var(--primary-color);
    font-size: 1.1rem;
}

.library-description {
    margin: 0 0 0.75rem 0;
    color: var(--secondary-color);
    font-size: 0.9rem;
}

.library-warning {
    color: var(--danger-color);
    font-weight: 600;
}

.library-example {
    font-size: 0.85rem;
}

.library-example code {
    background: #f8f9fa;
    padding: 0.25rem 0.5rem;
    border-radius: 3px;
    font-family: var(--font-family-mono);
    word-break: break-all;
    display: inline-block;
    margin-top: 0.25rem;
}

.library-example code.example-url-link {
    cursor: pointer;
    text-decoration: underline;
}

.error-message {
    color: var(--danger-color);
    font-size: 0.85em;
    margin-top: 5px;
}

/* Generic modal styles (basic, replace with a proper Modal component if needed) */
.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
}

.modal-content {
    background: white;
    padding: 25px;
    border-radius: 8px;
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
    max-width: 500px;
    width: 90%;
    z-index: 1001;
    display: flex;
    flex-direction: column;
    gap: 15px;
}

.modal-content h3 {
    margin-top: 0;
    color: #333;
    font-size: 1.5em;
    border-bottom: 1px solid #eee;
    padding-bottom: 10px;
}

.modal-content p {
    margin: 0;
    color: #555;
    line-height: 1.6;
}

.modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 20px;
}

.modal-actions button {
    padding: 10px 20px;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 500;
    border: none;
    transition: background-color 0.2s ease;
}

.modal-actions button:first-child { /* Confirm button style */
    background-color: #007bff;
    color: white;
}

.modal-actions button:first-child:hover {
    background-color: #0056b3;
}

.modal-actions button:last-child { /* Cancel/Close button style */
    background-color: #6c757d;
    color: white;
}

.modal-actions button:last-child:hover {
    background-color: #5a6268;
}
</style>