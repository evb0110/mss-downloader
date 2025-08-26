<template>
  <div
    class="manuscript-downloader"
    data-testid="download-queue"
  >
    <div class="info-buttons-row">
      <button
        class="info-btn"
        @click="showSupportedLibrariesModal = true"
      >
        <span class="btn-icon">ℹ</span>
        Supported Libraries
      </button>
      <button
        class="negative-converter-btn"
        @click="showNegativeConverterModal = true"
      >
        <span class="btn-icon">📸</span>
        Negative Converter
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
        <div
          class="empty-queue-message"
          data-testid="empty-queue-message"
        >
          <div class="patron-saint">
            <img
              :src="abbaAbabusImage"
              alt="Abba Ababus"
              class="patron-image"
            >
            <div class="patron-text">
              <h3>Welcome to Abba Ababus (MSS Downloader)</h3>
              <p>Under the patronage of Abba Ababus</p>
              <p>No manuscripts in queue. Add URLs below to get started.</p>
            </div>
          </div>
        </div>
        <div class="form-group">
          <label for="bulk-urls">Manuscript URLs</label>
          <textarea
            id="bulk-urls"
            v-model="bulkUrlText"
            placeholder="Enter multiple URLs separated by whitespace, semicolon, or comma
https://gallica.bnf.fr/ark:/12148/...
https://e-codices.unifr.ch/...
https://digi.vatlib.it/..."
            class="bulk-textarea manuscript-input"
            :disabled="isProcessingUrls"
            rows="6"
            data-testid="url-input"
            @keydown="handleTextareaKeydown"
          />
          <small class="help-text">Enter multiple manuscript URLs, one per line or separated by whitespace, semicolon, or comma. Press Ctrl+Enter (or Cmd+Enter on Mac) to add to queue.</small>
        </div>

        <div
          v-if="errorMessage"
          class="error-message"
          data-testid="error-message"
        >
          {{ errorMessage }}
        </div>
        
        <DownloadLogsButton 
          v-if="errorMessage || hasFailedDownloads"
          :show-button="true"
        />
                
        <button
          :disabled="isProcessingUrls || !bulkUrlText.trim()"
          class="load-btn"
          data-testid="add-button"
          @click="processBulkUrls"
        >
          {{ isProcessingUrls ? 'Adding to Queue...' : 'Add to Queue' }}
        </button>

        <!-- Queue Settings (Empty Queue) -->
        <Spoiler
          title="⚙️ Default Download Settings"
          class="settings-spoiler"
        >
          <div class="settings-content">
            <div class="setting-group">
              <label class="setting-label">
                Auto-split threshold: {{ queueSettings.autoSplitThresholdMB }}MB
              </label>
              <p class="setting-description">
                Large documents are automatically split into multiple parts based on this size limit. Changes recalculate existing queued items.
              </p>
              <input
                v-model="queueSettings.autoSplitThresholdMB"
                type="range"
                min="10"
                max="2048"
                step="10"
                class="setting-range"
                @input="onAutoSplitThresholdChange"
              >
              <div class="range-labels">
                <span>10MB</span>
                <span>2048MB</span>
              </div>
            </div>

            <div class="setting-group">
              <label
                class="setting-label"
              >
                Concurrent downloads: {{ queueSettings.maxConcurrentDownloads }}
                <span
                  v-if="effectiveConcurrencyNote"
                  class="note"
                >({{ effectiveConcurrencyNote }})</span>
              </label>
              <input
                v-model.number="queueSettings.maxConcurrentDownloads"
                type="range"
                min="1"
                max="8"
                step="1"
                class="setting-range"
                @input="onConcurrencyChange"
              >
              <div class="range-labels">
                <span>1</span>
                <span>8</span>
              </div>
            </div>
          </div>
        </Spoiler>
      </template>

      <!-- Queue Display -->
      <div
        v-if="queueItems.length > 0"
        class="queue-section"
      >
        <!-- Queue Settings (Non-Empty Queue) -->
        <Spoiler
          title="⚙️ Default Download Settings"
          class="settings-spoiler"
        >
          <div class="settings-content">
            <div class="setting-group">
              <label class="setting-label">
                Auto-split threshold: {{ queueSettings.autoSplitThresholdMB }}MB
              </label>
              <p class="setting-description">
                Large documents are automatically split into multiple parts based on this size limit. Changes recalculate existing queued items.
              </p>
              <input
                v-model="queueSettings.autoSplitThresholdMB"
                type="range"
                min="10"
                max="2048"
                step="10"
                class="setting-range"
                @input="onAutoSplitThresholdChange"
              >
              <div class="range-labels">
                <span>10MB</span>
                <span>2048MB</span>
              </div>
            </div>

            <div class="setting-group">
              <label
                class="setting-label"
              >
                Concurrent downloads: {{ queueSettings.maxConcurrentDownloads }}
                <span
                  v-if="effectiveConcurrencyNote"
                  class="note"
                >({{ effectiveConcurrencyNote }})</span>
              </label>
              <input
                v-model.number="queueSettings.maxConcurrentDownloads"
                type="range"
                min="1"
                max="8"
                step="1"
                class="setting-range"
                @input="onConcurrencyChange"
              >
              <div class="range-labels">
                <span>1</span>
                <span>8</span>
              </div>
            </div>
          </div>
        </Spoiler>
        <!-- Queue Progress Bar -->
        <div
          v-if="queueStats.total > 0"
          class="queue-progress"
          data-testid="queue-stats"
        >
          <div class="queue-progress-header">
            <span class="queue-progress-label">Queue Progress</span>
            <span
              class="queue-progress-stats"
              data-testid="total-items"
            >
              <template v-if="queueStats.loading > 0">
                Loading {{ queueStats.loading }} manifest{{ queueStats.loading > 1 ? 's' : '' }}...
              </template>
              <template v-else>
                {{ queueStatsReady.completed + queueStatsReady.failed }} / {{ queueStatsReady.total }} Manuscripts
              </template>
            </span>
          </div>
          <div
            class="queue-progress-bar"
            data-testid="progress-bar"
          >
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
              v-if="queueStats.loading > 0"
              class="progress-segment loading"
            >
              {{ queueStats.loading }} Loading
            </span>
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
              data-testid="completed-items"
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

        <div
          class="queue-controls"
          data-testid="queue-controls"
        >
          <!-- Sequential Mode Start Button -->
          <button
            v-if="!isQueueProcessing && !isQueuePaused"
            class="start-btn"
            :disabled="isProcessingUrls || !hasReadyItems || queueStats.loading > 0"
            data-testid="start-queue"
            @click="startQueue"
          >
            {{ shouldShowResume ? 'Resume Queue' : 'Start Queue' }}
          </button>
          <button
            v-if="isQueueProcessing && !isQueuePaused"
            class="pause-btn"
            data-testid="pause-queue"
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
            :disabled="isProcessingUrls || !hasReadyItems || queueStats.loading > 0"
            @click="startQueue"
          >
            Start Queue
          </button>
          <button
            v-if="isQueueProcessing || isQueuePaused"
            class="stop-btn"
            data-testid="stop-queue"
            @click="stopQueue"
          >
            Stop Queue
          </button>
          <button
            v-if="!isQueueProcessing && !isQueuePaused && hasCompletedOrFailedItems"
            class="restart-queue-btn"
            title="Restart all completed and failed items"
            @click="restartAllCompletedFailed"
          >
            Restart Queue
          </button>
          <button
            :class="getButtonClass('clearAll', 'clear-queue-btn')"
            :disabled="isButtonDisabled('clearAll', queueItems.length === 0 || isProcessingUrls)"
            title="Delete all items from the queue"
            data-testid="clear-completed"
            @click="clearAllQueue"
          >
            <span
              v-if="getButtonContent('clearAll', 'Delete All').icon"
              class="btn-icon-only"
            >{{ getButtonContent('clearAll', 'Delete All').icon }}</span>
            <span v-else>{{ getButtonContent('clearAll', 'Delete All').text }}</span>
          </button>
          <button
            :class="getButtonClass('cleanupCache', 'cleanup-cache-btn')"
            :disabled="isButtonDisabled('cleanupCache', isProcessingUrls)"
            title="Clean up the image cache for downloaded manuscripts"
            @click="cleanupIndexedDBCache"
          >
            <span
              v-if="getButtonContent('cleanupCache', 'Cleanup Cache').icon"
              class="btn-icon-only"
            >{{ getButtonContent('cleanupCache', 'Cleanup Cache').icon }}</span>
            <span v-else>{{ getButtonContent('cleanupCache', 'Cleanup Cache').text }}</span>
          </button>
          <button
            :class="getButtonClass('revealFolder', 'reveal-folder-btn')"
            :disabled="isButtonDisabled('revealFolder')"
            title="Open the Downloads folder where completed files are saved"
            @click="revealDownloadsFolder"
          >
            <span
              v-if="getButtonContent('revealFolder', 'Reveal Folder').icon"
              class="btn-icon-only"
            >{{ getButtonContent('revealFolder', 'Reveal Folder').icon }}</span>
            <span v-else>{{ getButtonContent('revealFolder', 'Reveal Folder').text }}</span>
          </button>
        </div>


        <div class="queue-actions">
        </div>

        <div class="queue-list">
          <div
            v-for="group in groupedQueueItems"
            :key="group.parent.id"
            class="queue-group"
          >
            <!-- Parent Item -->
            <div
              class="queue-item parent-item"
              :class="[`status-${getGroupStatus(group)}`, { 'loading-manifest': group.parent.status === 'loading' }]"
              data-testid="queue-item"
            >
              <div class="queue-item-header">
                <div class="queue-item-info">
                  <strong v-if="group.parent.status === 'failed'">
                    <span v-if="group.parent.error">{{ group.parent.error }}</span>
                    <span v-else>Failed to Load Manifest</span>
                    <a
                      class="manuscript-error-link"
                      style="cursor: pointer;"
                      title="Click to open in browser"
                      @click.prevent="openInBrowser(group.parent.url)"
                      @contextmenu.prevent="showContextMenu($event, group.parent.url)"
                    >
                      {{ group.parent.url }}
                    </a>
                  </strong>
                  <strong v-else>
                    <a
                      v-if="group.parent.status !== 'loading' && group.parent.url"
                      class="manuscript-title-link"
                      style="cursor: pointer;"
                      title="Click to open in browser"
                      @click.prevent="openInBrowser(group.parent.url)"
                      @contextmenu.prevent="showContextMenu($event, group.parent.url)"
                    >
                      {{ group.parent.displayName }}
                    </a>
                    <span v-else>{{ group.parent.displayName }}</span>
                  </strong>
                  <div class="queue-item-meta">
                    <span
                      class="status-badge"
                      :class="`status-${getGroupStatus(group)}`"
                    >
                      <span
                        v-if="getGroupStatus(group) === 'downloading' || getGroupStatus(group) === 'loading'"
                        class="inline-spinner"
                      />
                      {{ getGroupStatusText(group) }}
                    </span>
                    <span
                      v-if="group.parent.status !== 'failed'"
                      class="concurrency-badge"
                      :title="concurrencyBadgeTitleForGroup(group)"
                    >
                      Concurrency: {{ effectiveGroupConcurrency(group) }}
                    </span>
                    <span
                      v-if="group.parent.status !== 'failed'"
                      class="total-pages-badge"
                    >
                    <span
                      v-if="showManifestSpinnerForItem(group.parent)"
                      class="inline-spinner"
                    />
                      {{ getTotalPagesText(group) }}
                    </span>
                    <span
                      v-if="shouldShowGroupProgress(group) && getGroupPagesProgressText(group)"
                      class="pages-progress-badge"
                    >
                      {{ getGroupPagesProgressText(group) }}
                    </span>
                    <span
                      v-if="shouldShowGroupProgress(group) && getGroupProgress(group)?.eta"
                      class="eta-badge"
                    >
                      ETA: {{ formatTime(getGroupProgress(group)?.eta) }}
                    </span>
                  </div>
                </div>
                <div class="queue-item-controls">
                  <button
                    v-if="!group.isSynthetic && editingQueueItemId !== group.parent.id && getParentIndex(group.parent) > 0 && !hasActiveDownloads"
                    class="move-up-btn"
                    title="Move up in queue"
                    @click="moveQueueItemUp(group.parent)"
                  >
                    ↑
                  </button>
                  <button
                    v-if="!group.isSynthetic && editingQueueItemId !== group.parent.id && getParentIndex(group.parent) < groupedQueueItems.length - 1 && !hasActiveDownloads"
                    class="move-down-btn"
                    title="Move down in queue"
                    @click="moveQueueItemDown(group.parent)"
                  >
                    ↓
                  </button>
                  <button
                    v-if="group.parts.length > 0"
                    class="toggle-parts-btn"
                    :class="{ 'expanded': isPartsExpanded(group.parent.id) }"
                    title="Toggle parts visibility"
                    @click="togglePartsVisibility(group.parent.id)"
                  >
                    {{ isPartsExpanded(group.parent.id) ? '▼' : '▶' }}
                  </button>
                  <button
                    v-if="!group.isSynthetic && editingQueueItemId !== group.parent.id"
                    class="edit-btn"
                    title="Edit download options"
                    data-testid="edit-button"
                    @click="startQueueItemEdit(group.parent)"
                  >
                    Edit
                  </button>
                  <button
                    v-if="canPauseGroup(group)"
                    class="pause-item-btn"
                    title="Pause this download"
                    data-testid="pause-button"
                    @click="pauseGroup(group)"
                  >
                    Pause
                  </button>
                  <button
                    v-if="canResumeGroup(group)"
                    class="resume-item-btn"
                    title="Resume this download"
                    data-testid="resume-button"
                    @click="resumeGroup(group)"
                  >
                    Resume
                  </button>
                  <button
                    v-if="canRestartGroup(group)"
                    class="restart-item-btn"
                    title="Restart download with current settings"
                    @click="restartGroup(group)"
                  >
                    Restart
                  </button>
                  <button
                    v-if="!group.isSynthetic"
                    class="view-logs-btn"
                    :title="'View logs for this download'"
                    @click="viewDownloadLogs(group.parent)"
                  >
                    📋 Logs
                  </button>
                  <button
                    v-if="canShowInFinder(group)"
                    class="show-finder-btn"
                    :title="getShowInFinderText()"
                    @click="showGroupInFinder(group)"
                  >
                    {{ getShowInFinderText() }}
                  </button>
                  <button
                    class="remove-btn"
                    title="Remove from queue"
                    data-testid="delete-button"
                    @click="removeParentWithParts(group.parent.id)"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <!-- Auto-split parts (collapsible, compact view) -->
              <div 
                v-if="group.parts.length > 0 && isPartsExpanded(group.parent.id)"
                class="parts-compact"
              >
                <div
                  v-for="part in group.parts"
                  :key="part.id"
                  class="part-chip"
                  :class="[`status-${part.status}`]"
                  :title="`Pages ${part.partInfo?.pageRange.start}–${part.partInfo?.pageRange.end}`"
                >
                  <span class="part-name">Part {{ part.partInfo?.partNumber }}</span>
                  <span class="part-range">({{ part.partInfo?.pageRange.start }}–{{ part.partInfo?.pageRange.end }})</span>
                  <span class="part-status">• {{ getStatusText(part.status) }}</span>
                </div>
              </div>
                        
              <!-- Edit form (when editing) -->
              <div
                v-if="editingQueueItemId === group.parent.id && editingQueueItem"
                class="queue-edit-form"
                data-testid="edit-modal"
              >
                <div class="edit-section">
                  <div class="edit-header">
                    <label>Page Range</label>
                  </div>
                  <div class="page-range">
                    <input
                      v-model.number="editingQueueItem.startPage"
                      type="number"
                      min="1"
                      class="page-input"
                      data-testid="page-range-input"
                      @blur="validateQueueEditInputs"
                    >
                    <span>–</span>
                    <input
                      v-model.number="editingQueueItem.endPage"
                      type="number"
                      min="1"
                      class="page-input"
                      @blur="validateQueueEditInputs"
                    >
                    <button
                      :disabled="hasEditQueueValidationErrors || !hasQueueItemChanges"
                      class="edit-btn edit-save-btn"
                      title="Apply changes"
                      data-testid="save-button"
                      @click="saveQueueItemEdit()"
                    >
                      Apply
                    </button>
                    <button
                      type="button"
                      class="select-all-btn"
                      @click="selectAllPages(group.parent.totalPages)"
                    >
                      All Pages
                    </button>
                    <button
                      class="edit-btn edit-cancel-btn"
                      title="Cancel changes"
                      @click="cancelQueueItemEdit()"
                    >
                      Cancel
                    </button>
                  </div>
                  <p
                    v-if="hasEditQueueValidationErrors"
                    class="error-message"
                  >
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
                    data-testid="concurrency-input"
                  >
                </div>
              </div>
                        
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Custom Modals -->
  <Modal
    :show="showConfirmModal"
    :title="confirmModal.title"
    :message="confirmModal.message"
    type="confirm"
    :confirm-text="confirmModal.confirmText"
    :cancel-text="confirmModal.cancelText"
    @confirm="handleConfirm"
    @close="closeConfirmModal"
  />

  <Modal
    :show="showAlertModal"
    :title="alertModal.title"
    :message="alertModal.message"
    type="alert"
    cancel-text="Close"
    @close="closeAlertModal"
  />

  <!-- Context Menu -->
  <div 
    v-if="contextMenu.visible"
    class="context-menu"
    :style="{ top: contextMenu.y + 'px', left: contextMenu.x + 'px' }"
    @click.stop
  >
    <div
      class="context-menu-item"
      @click="copyLinkFromMenu"
    >
      📋 Copy Link
    </div>
    <div
      class="context-menu-item"
      @click="openLinkFromMenu"
    >
      🌐 Open in Browser
    </div>
  </div>

  <!-- Log Viewer Modal -->
  <div
    v-if="showLogViewer"
    class="log-viewer-modal"
  >
    <div class="log-viewer-content">
      <div class="log-viewer-header">
        <h3>📋 Logs: {{ currentLogItem?.displayName || 'Download' }}</h3>
        <div class="log-viewer-actions">
          <button
            class="export-log-btn"
            title="Export logs to file"
            @click="exportCurrentLogs"
          >
            💾 Export
          </button>
          <button
            class="clear-log-btn"
            title="Clear logs"
            @click="clearCurrentLogs"
          >
            🗑️ Clear
          </button>
          <button
            class="close-log-btn"
            title="Close"
            @click="closeLogViewer"
          >
            ✖
          </button>
        </div>
      </div>
      <div class="log-viewer-body">
        <div
          v-if="currentLogs.length === 0"
          class="no-logs"
        >
          No logs available for this download yet.
        </div>
        <div
          v-else
          class="log-entries"
        >
          <div
            v-for="(log, index) in currentLogs"
            :key="index"
            :class="['log-entry', `log-${log.level}`]"
          >
            <span class="log-time">{{ formatLogTime(log.timestamp) }}</span>
            <span :class="['log-level', log.level.toLowerCase()]">[{{ log.level.toUpperCase() }}]</span>
            <span class="log-message">{{ log.message }}</span>
            <div
              v-if="log.details"
              class="log-details"
            >
              <pre>{{ JSON.stringify(log.details, null, 2) }}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Supported Libraries Modal -->
  <Modal
    :show="showSupportedLibrariesModal"
    title="Supported Manuscript Libraries"
    type="alert"
    width="min(1600px, 95vw)"
    @close="showSupportedLibrariesModal = false"
  >
    <template #headerContent>
      <p class="libraries-intro">
        Enter a URL from one of the following supported digital libraries to download a manuscript:
      </p>
    </template>

    <div class="libraries-modal-content">
      <!-- Search Bar -->
      <div class="library-search">
        <input
          v-model="librarySearchQuery"
          type="text"
          placeholder="Search libraries..."
          class="search-input"
        >
        <div class="search-icon">
          🔍
        </div>
      </div>
      
      <div class="libraries-scroll-container">
        <div class="libraries-list">
          <div
            v-for="library in filteredLibraries"
            :key="library.name"
            class="library-item"
          >
            <Spoiler
              :title="library.geoBlocked ? library.name + ' 🌍' : library.name"
              :class="{ 'library-warning': library.name.includes('⚠️') }"
              class="library-content-spoiler"
            >
              <p class="library-description">
                {{ library.description }}
              </p>
              <div class="library-examples">
                <div class="library-example">
                  <div class="example-label">
                    Example:
                  </div>
                  <code
                    class="example-url-link"
                    @click="handleExampleClick(library.example); showSupportedLibrariesModal = false"
                  >
                    {{ library.example }}
                  </code>
                </div>
              </div>
            </Spoiler>
          </div>
        </div>
      </div>
      
      <!-- Add All Testing Button -->
      <div class="add-all-test-section">
        <button
          class="add-all-test-btn"
          :disabled="isProcessingUrls"
          @click="addAllTestUrls"
        >
          Add All (Testing)
        </button>
        <p class="add-all-test-description">
          Adds one example URL from each supported library for testing purposes
        </p>
      </div>
    </div>
  </Modal>

  <!-- Add More Documents Modal -->
  <Modal
    :show="showAddMoreDocumentsModal"
    title="Add More Documents"
    type="alert"
    @close="showAddMoreDocumentsModal = false"
  >
    <div class="form-group">
      <label for="modal-bulk-urls">Manuscript URLs</label>
      <textarea
        id="modal-bulk-urls"
        ref="modalTextarea"
        v-model="bulkUrlText"
        placeholder="Enter multiple URLs separated by whitespace, semicolon, or comma
https://gallica.bnf.fr/ark:/12148/...
https://e-codices.unifr.ch/...
https://digi.vatlib.it/..."
        class="bulk-textarea manuscript-input"
        :disabled="isProcessingUrls"
        rows="6"
        @keydown="handleTextareaKeydown"
      />
      <small class="help-text">Enter multiple manuscript URLs, one per line or separated by whitespace, semicolon, or comma. Press Ctrl+Enter (or Cmd+Enter on Mac) to add to queue.</small>
    </div>
        
    <button
      :disabled="isProcessingUrls || !bulkUrlText.trim()"
      class="load-btn"
      @click="processBulkUrls()"
    >
      {{ isProcessingUrls ? 'Adding to Queue...' : 'Add to Queue' }}
    </button>
  </Modal>

  <!-- Negative Converter Modal -->
  <NegativeConverterModal
    :is-visible="showNegativeConverterModal"
    @close="showNegativeConverterModal = false"
  />
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watchEffect, onMounted, onUnmounted } from 'vue';
import type { QueuedManuscript, QueueState, TStatus, TLibrary, TSimultaneousMode, TStage } from '../../shared/queueTypes';
import type { LibraryInfo, ManuscriptManifest, DownloadCallbacks } from '../../shared/types';
import Modal from './Modal.vue';
import Spoiler from './Spoiler.vue';
import NegativeConverterModal from './NegativeConverterModal.vue';
import DownloadLogsButton from './DownloadLogsButton.vue';
import abbaAbabusImage from '../../../assets/abba-ababus.jpg';

// Define log entry type
interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  component?: string;
  details?: Record<string, unknown>;
}

// Simple IIIF canvas interface
interface IIIFCanvas {
  images: Array<{
    resource: {
      '@id'?: string;
      id?: string;
    };
  }>;
}

// Declare window.electronAPI type
declare global {
  interface Window {
    electronAPI: {
      getLanguage: () => Promise<string>;
      downloadManuscript: (url: string, callbacks: DownloadCallbacks) => Promise<void>;
      getSupportedLibraries: () => Promise<LibraryInfo[]>;
      parseManuscriptUrl: (url: string) => Promise<ManuscriptManifest>;
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
      updateAutoSplitThreshold: (thresholdMB: number) => Promise<void>;
      updateGlobalConcurrentDownloads: (newConcurrent: number) => Promise<void>;
      onQueueStateChanged: (callback: (state: QueueState) => void) => () => void;
      cleanupIndexedDBCache: () => Promise<void>;
      showItemInFinder: (filePath: string) => Promise<boolean>;
      setConfig: (key: string, value: unknown) => Promise<void>;
      
    };
  }
}

// Bulk mode state
const bulkUrlText = ref('');
const isProcessingUrls = ref(false);
const errorMessage = ref('');
const modalTextarea = ref<HTMLTextAreaElement | null>(null);

// Queue state (imported from DownloadQueue service via IPC)
const queueState = ref<QueueState>({
    items: [],
    isProcessing: false,
    isPaused: false,
    activeItemIds: [],
    globalSettings: {
        autoStart: false,
        concurrentDownloads: 3,
        pauseBetweenItems: 0,
        autoSplitThresholdMB: 300, // Reduced to prevent "Invalid array length" errors
        simultaneousMode: 'sequential' as TSimultaneousMode,
        maxSimultaneousDownloads: 3,
    },
});

// Edit queue item state
const editingQueueItemId = ref<string | null>(null);
const editingQueueItem = ref<{
    startPage: number;
    endPage: number;
    concurrentDownloads: number;
} | null>(null);


// Button loading states
const buttonLoadingStates = ref<{ [key: string]: 'idle' | 'loading' | 'success' }>({});

// Modal state
const showConfirmModal = ref(false);
const showAlertModal = ref(false);
const showSupportedLibrariesModal = ref(false);
const showNegativeConverterModal = ref(false);

// Log viewer state
const showLogViewer = ref(false);
const currentLogs = ref<LogEntry[]>([]);
const currentLogItem = ref<QueuedManuscript | null>(null);
const downloadLogs = ref<Map<string, LogEntry[]>>(new Map());
const showAddMoreDocumentsModal = ref(false);

// Escape key handler for all modals
function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    if (showConfirmModal.value) {
      showConfirmModal.value = false;
    } else if (showAlertModal.value) {
      showAlertModal.value = false;
    } else if (showSupportedLibrariesModal.value) {
      showSupportedLibrariesModal.value = false;
    } else if (showNegativeConverterModal.value) {
      showNegativeConverterModal.value = false;
    } else if (showLogViewer.value) {
      showLogViewer.value = false;
    } else if (showAddMoreDocumentsModal.value) {
      showAddMoreDocumentsModal.value = false;
    }
  }
}

// Context menu state
const contextMenu = ref({
    visible: false,
    x: 0,
    y: 0,
    url: ''
});

// Set up queue monitoring for logs
let logMonitorInterval: NodeJS.Timeout | null = null;
const previousStatuses = new Map<string, string>();

onMounted(() => {
    // Monitor queue items for status changes
    const checkQueueChanges = () => {
        queueItems.value.forEach(item => {
            const prevStatus = previousStatuses.get(item.id);
            if (prevStatus && prevStatus !== item.status) {
                // Status changed, log it
                if (item.status === 'loading') {
                    addLogEntry(item.id, 'info', 'Loading manuscript manifest...');
                } else if (item.status === 'pending') {
                    addLogEntry(item.id, 'info', 'Waiting in queue');
                } else if (item.status === 'downloading') {
                    addLogEntry(item.id, 'info', 'Download started');
                } else if (item.status === 'completed') {
                    addLogEntry(item.id, 'info', '✅ Download completed successfully');
                } else if (item.status === 'failed') {
                    addLogEntry(item.id, 'error', `❌ Download failed: ${item.error || 'Unknown error'}`);
                } else if (item.status === 'paused') {
                    addLogEntry(item.id, 'info', 'Download paused');
                }
            }
            previousStatuses.set(item.id, item.status);
            
            // Log progress updates
            if (item.status === 'downloading' && item.progress) {
                const progressPercent = Math.round((item.progress.downloaded / item.progress.total) * 100);
                if (progressPercent % 25 === 0) { // Log at 25%, 50%, 75%, 100%
                    addLogEntry(item.id, 'info', `Progress: ${progressPercent}% (${item.progress.downloaded}/${item.progress.total} pages)`);
                }
            }
        });
    };
    
    // Check for changes every second
    logMonitorInterval = setInterval(checkQueueChanges, 1000);
});

onUnmounted(() => {
    // Cleanup interval
    if (logMonitorInterval) {
        clearInterval(logMonitorInterval);
    }
    
    // Remove escape key listener
    document.removeEventListener('keydown', handleKeydown);
});
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
    type: 'info',
});


// Supported Libraries - fetched via IPC
const supportedLibraries = ref<LibraryInfo[]>([]);
const librarySearchQuery = ref('');

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

  const query = librarySearchQuery.value.toLowerCase().trim();
  const exactMatches: LibraryInfo[] = [];
  const partialMatches: LibraryInfo[] = [];
  const fuzzyMatches: LibraryInfo[] = [];
  
  supportedLibraries.value.forEach(library => {
    const name = library.name.toLowerCase();
    const description = library.description.toLowerCase();
    const example = library.example.toLowerCase();
    
    // Exact name match (highest priority)
    if (name === query || name.includes(` ${query} `) || name.startsWith(query + ' ') || name.endsWith(' ' + query)) {
      exactMatches.push(library);
      return;
    }
    
    // Partial matches in name, description, or URL
    if (name.includes(query) || description.includes(query) || example.includes(query)) {
      partialMatches.push(library);
      return;
    }
    
    // Fuzzy matching with higher threshold - at least 70% of query characters must match consecutively
    const strictFuzzyMatch = (text: string) => {
      if (query.length < 3) return false; // Require at least 3 characters for fuzzy search
      
      let maxConsecutive = 0;
      let currentConsecutive = 0;
      let queryIndex = 0;
      
      for (let i = 0; i < text.length && queryIndex < query.length; i++) {
        if (text[i] === query[queryIndex]) {
          currentConsecutive++;
          queryIndex++;
        } else {
          maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
          currentConsecutive = 0;
        }
      }
      maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
      
      // Require at least 70% of query length to match consecutively
      return queryIndex === query.length && maxConsecutive >= Math.ceil(query.length * 0.7);
    };
    
    if (strictFuzzyMatch(name) || strictFuzzyMatch(description)) {
      fuzzyMatches.push(library);
    }
  });
  
  // Sort each category alphabetically
  exactMatches.sort((a, b) => a.name.localeCompare(b.name));
  partialMatches.sort((a, b) => a.name.localeCompare(b.name));
  fuzzyMatches.sort((a, b) => a.name.localeCompare(b.name));
  
  return {
    libraries: [...exactMatches, ...partialMatches, ...fuzzyMatches],
    stats: {
      total: exactMatches.length + partialMatches.length + fuzzyMatches.length,
      exact: exactMatches.length,
      partial: partialMatches.length,
      fuzzy: fuzzyMatches.length,
      query: query
    }
  };
});

// For backward compatibility
const filteredLibraries = computed(() => searchResults.value.libraries);

// Libraries are now fetched dynamically from the main process

// Queue settings
const queueSettings = ref({
    autoSplitThresholdMB: 300, // Changed from 800 to 300 as requested in issue #18
    maxConcurrentDownloads: 3
});

// Debounced threshold update and UI guard against flicker
let debounceTimer: NodeJS.Timeout | null = null;
let adjustGuardTimer: NodeJS.Timeout | null = null;
const isAdjustingAutoSplit = ref(false);

// Watch for queue state changes to sync settings, but do not overwrite while user is adjusting the slider
watchEffect(() => {
    if (queueState.value?.globalSettings) {
        if (!isAdjustingAutoSplit.value) {
            queueSettings.value.autoSplitThresholdMB = queueState.value.globalSettings.autoSplitThresholdMB;
        }
        queueSettings.value.maxConcurrentDownloads = queueState.value.globalSettings.concurrentDownloads;
    }
});

// Show note if library optimizations cap concurrency below global setting
const effectiveConcurrencyNote = computed(() => {
  // Global picker should not warn if current front item is still "loading"
  const items = queueItems.value;
  if (!items || items.length === 0) return '';
  // Prefer a ready item (not 'loading') so we have library optimizations applied
  const candidate = items.find(i => i.status !== 'loading') || items[0];
  // If candidate has no library optimizations yet, don't show a cap note
  if (!candidate.libraryOptimizations || candidate.library === 'loading') return '';
  const perItem = candidate.downloadOptions?.concurrentDownloads || queueSettings.value.maxConcurrentDownloads;
  // Only show a note if the library explicitly defines a cap; if undefined, there's no cap
  const cap = candidate.libraryOptimizations?.maxConcurrentDownloads;
  if (typeof cap === 'number' && cap > 0 && perItem > cap) {
    const libraryName = candidate.library || 'unknown library';
    return `capped to ${cap} for ${libraryName.toUpperCase()}`;
  }
  return '';
});

// Persist global concurrency into config so new items adopt it
let concurrencyDebounce: NodeJS.Timeout | null = null;
function onConcurrencyChange() {
  if (concurrencyDebounce) clearTimeout(concurrencyDebounce);
  concurrencyDebounce = setTimeout(async () => {
    try {
      // Ensure number is sent to config and queue
      const value = Number(queueSettings.value.maxConcurrentDownloads) || 1;
      await Promise.all([
        window.electronAPI.setConfig('maxConcurrentDownloads', value),
        window.electronAPI.updateGlobalConcurrentDownloads(value)
      ]);
      // Update local reflected state so new items get this value immediately in UI
      queueState.value.globalSettings.concurrentDownloads = value;
    } catch (e) {
      console.error('Failed to update maxConcurrentDownloads:', e);
    }
  }, 500);
}

// Bulk mode computed properties
const queueItems = computed(() => queueState.value.items || []);
const isQueueProcessing = computed(() => queueState.value.isProcessing || false);
const isQueuePaused = computed(() => queueState.value.isPaused || false);
const hasActiveDownloads = computed(() => queueItems.value.some((item: QueuedManuscript) => item.status === 'downloading'));

// Group items with their auto-split parts
const groupedQueueItems = computed(() => {
    const items = queueItems.value;
    const parentItems: QueuedManuscript[] = [];
    const partsMap = new Map<string, QueuedManuscript[]>();

    // Separate parent items and parts
    items.forEach(item => {
        if (item.isAutoPart && item.parentId) {
            if (!partsMap.has(item.parentId)) {
                partsMap.set(item.parentId, []);
            }
            partsMap.get(item.parentId)!.push(item);
        } else {
            parentItems.push(item);
        }
    });

    // Sort parts by part number for each parent
    partsMap.forEach(parts => {
        parts.sort((a, b) => (a.partInfo?.partNumber || 0) - (b.partInfo?.partNumber || 0));
    });

    // Create groups for parent items with their parts when parent exists
    const groups: Array<{ parent: any; parts: QueuedManuscript[]; isSynthetic?: boolean }> = [];

    parentItems.forEach(parent => {
        groups.push({ parent, parts: partsMap.get(parent.id) || [], isSynthetic: false });
        // Remove mapped parts so we only synthesize for missing parents below
        if (partsMap.has(parent.id)) partsMap.delete(parent.id);
    });

    // For any remaining parentId keys (no real parent item exists), synthesize a visual parent
    partsMap.forEach((parts, parentId) => {
        if (!parts || parts.length === 0) return;
        const first = parts[0];
        const totalPages = parts.reduce((max, p) => Math.max(max, p.partInfo?.pageRange.end || 0), 0);
        const originalDisplayName = first.partInfo?.originalDisplayName || (first.displayName?.split('_Part_')[0] || first.displayName);
        const syntheticParent: Partial<QueuedManuscript> & { id: string; isSyntheticParent?: boolean } = {
            id: parentId,
            url: first.url,
            displayName: originalDisplayName,
            library: first.library,
            totalPages,
            status: 'pending',
            addedAt: first.addedAt,
            downloadOptions: {
                concurrentDownloads: first.downloadOptions?.concurrentDownloads || 3,
                startPage: 1,
                endPage: totalPages,
            },
        } as any;
        (syntheticParent as any).isSyntheticParent = true;
        groups.push({ parent: syntheticParent, parts, isSynthetic: true });
    });

    return groups;
});

function isRealQueueItem(id: string | undefined): boolean {
    if (!id) return false;
    return !!queueState.value.items.find(i => i.id === id);
}

function effectiveGroupConcurrency(group: { parent: any; parts: QueuedManuscript[]; isSynthetic?: boolean }): number {
    if (!group.isSynthetic && isRealQueueItem(group.parent?.id)) {
        return effectiveItemConcurrency(group.parent as QueuedManuscript);
    }
    const base = group.parts[0];
    return base ? effectiveItemConcurrency(base) : (queueState.value.globalSettings?.concurrentDownloads || 3);
}

function concurrencyBadgeTitleForGroup(group: { parent: any; parts: QueuedManuscript[]; isSynthetic?: boolean }): string {
    const item = (!group.isSynthetic && isRealQueueItem(group.parent?.id)) ? group.parent as QueuedManuscript : (group.parts[0] as QueuedManuscript);
    return concurrencyBadgeTitle(item);
}

// Expanded parts state
const expandedParts = ref<Set<string>>(new Set());

// Stable per-group progress cache to avoid flicker between parts
interface GroupProgressCacheEntry {
  current: number;
  total: number;
  percentage: number;
  eta: number; // -1 when unknown
  partCurrent?: number;
  partTotal?: number;
  activePartId?: string;
  ts: number;
}
const groupProgressCache = ref<Map<string, GroupProgressCacheEntry>>(new Map());

function partRangeTotal(part: QueuedManuscript): number {
  if (part?.partInfo) {
    const r = part.partInfo.pageRange;
    return Math.max(0, (r?.end || 0) - (r?.start || 0) + 1);
  }
  const prog: any = (part as any)?.progress || {};
  if (typeof prog.partTotal === 'number') return Math.max(0, prog.partTotal);
  if (typeof prog.total === 'number') return Math.max(0, prog.total);
  return Math.max(0, part?.totalPages || 0);
}

function recomputeGroupProgressCache() {
  const now = Date.now();
  const prev = groupProgressCache.value; // previous snapshot
  const map = new Map<string, GroupProgressCacheEntry>();

  for (const group of groupedQueueItems.value) {
    const parentId = group.parent.id;

    // Single item (no parts)
    if (group.parts.length === 0) {
      const prog: any = (group.parent as any)?.progress || {};
      const total = Math.max(0, prog?.total ?? group.parent.totalPages ?? 0);
      let current = Math.max(0, prog?.current ?? (group.parent.status === 'completed' ? total : 0));
      // Monotonic clamp
      const prevEntry = prev.get(parentId);
      if (prevEntry && current < prevEntry.current && total === prevEntry.total) {
        current = prevEntry.current;
      }
      const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

      // Renderer-side ETA: compute from rate if service ETA not available
      let eta = typeof prog?.eta === 'number' ? prog.eta : -1;
      if (eta <= 0 && prevEntry && now > prevEntry.ts && current > prevEntry.current) {
        const dt = (now - prevEntry.ts) / 1000;
        const dPages = current - prevEntry.current;
        const rate = dPages / Math.max(dt, 0.001);
        const naive = rate > 0 ? (total - current) / rate : -1;
        if (naive > 0) {
          // EMA smoothing
          const smoothed = prevEntry.eta > 0 ? (0.7 * prevEntry.eta + 0.3 * naive) : naive;
          eta = Math.round(smoothed);
        }
      }

      map.set(parentId, { current, total, percentage, eta, ts: now });
      continue;
    }

    // With parts: aggregate across all parts
    let total = 0;
    let current = 0;
    let partCurrent = 0;
    let partTotal = 0;
    let eta = -1;
    let activePartId: string | undefined;

    // Determine active part preference
    const activePart = group.parts.find(p => p.status === 'downloading')
      || group.parts.find(p => p.status === 'paused' && (p as any).progress)
      || group.parts.find(p => p.status === 'pending')
      || group.parts[0];

    for (const part of group.parts) {
      const pTotal = partRangeTotal(part);
      total += pTotal;
      const pProg: any = (part as any)?.progress || {};
      let pCurrent = 0;
      if (part.status === 'completed') {
        pCurrent = pTotal;
      } else if (typeof pProg.partCurrent === 'number') {
        pCurrent = Math.min(pTotal, Math.max(0, pProg.partCurrent));
      } else if (typeof pProg.currentPartPages === 'number') {
        pCurrent = Math.min(pTotal, Math.max(0, pProg.currentPartPages));
      } else if (typeof pProg.current === 'number' && part.partInfo) {
        // Derive from global current when libraries report manuscript-wide progress using actual page range start
        const parentStart = group.parent?.downloadOptions?.startPage || 1;
        const start = (part.partInfo?.pageRange?.start ?? parentStart);
        const pagesBefore = Math.max(0, start - parentStart);
        pCurrent = Math.min(pTotal, Math.max(0, (pProg.current as number) - pagesBefore));
      }

      // Monotonic clamp per active part
      if (activePart && part.id === activePart.id) {
        const prevEntry = prev.get(parentId);
        if (prevEntry && prevEntry.activePartId === activePart.id && pCurrent < (prevEntry.partCurrent || 0) && pTotal === (prevEntry.partTotal || pTotal)) {
          pCurrent = prevEntry.partCurrent || 0;
        }
      }

      current += pCurrent;

      if (part.id === activePart?.id) {
        partCurrent = pCurrent;
        partTotal = pTotal;
        // Do not take per-chunk ETA for group-level display to avoid resets on part boundaries
        activePartId = part.id;
      }
    }

    // Monotonic clamp for total current
    const prevEntry = prev.get(parentId);
    if (prevEntry && current < prevEntry.current && total === prevEntry.total) {
      current = prevEntry.current;
    }

    const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

    // Renderer-side ETA: compute a manuscript-level ETA from aggregate progress, not per-chunk
    if (prevEntry && now > prevEntry.ts) {
      const dt = (now - prevEntry.ts) / 1000;
      const dPages = current - prevEntry.current;
      if (dPages > 0) {
        const rate = dPages / Math.max(dt, 0.001);
        const naive = rate > 0 ? (total - current) / rate : -1;
        if (naive > 0) {
          const smoothed = prevEntry.eta > 0 ? (0.7 * prevEntry.eta + 0.3 * naive) : naive;
          eta = Math.round(smoothed);
        }
      } else if (prevEntry.eta > 0) {
        // Carry forward last known ETA through short idle periods (e.g., stitching between parts)
        eta = prevEntry.eta;
      }
    }

    map.set(parentId, {
      current,
      total,
      percentage,
      eta,
      partCurrent,
      partTotal,
      activePartId,
      ts: now,
    });
  }

  groupProgressCache.value = map;
}

watchEffect(() => {
  // Recompute cache whenever queue items change
  // This is cheap (linear in number of items) and stabilizes the UI between part transitions
  recomputeGroupProgressCache();
});

// Helper functions for grouped display
function getGroupStatus(group: { parent: QueuedManuscript; parts: QueuedManuscript[] }): string {
    if (group.parts.length === 0) {
        return group.parent.status;
    }
    
    // For groups with parts, determine overall status
    const allStatuses = [group.parent, ...group.parts].map(item => item.status);
    
    if (allStatuses.some(s => s === 'downloading')) return 'downloading';
    if (allStatuses.some(s => s === 'failed')) return 'failed';
    if (allStatuses.some(s => s === 'paused')) return 'paused';
    if (allStatuses.every(s => s === 'completed')) return 'completed';
    if (allStatuses.some(s => s === 'loading')) return 'loading';

    // Anti-flicker: while the queue is actively processing and this group is next-up or has pending parts,
    // show 'downloading' instead of briefly flipping to 'pending' between parts.
    try {
        const items = queueItems.value;
        const nextUp = items.find(i => i.status === 'downloading' || i.status === 'pending' || i.status === 'loading');
        const belongsToGroup = nextUp && (nextUp.parentId ? nextUp.parentId === group.parent.id : nextUp.id === group.parent.id);
        const groupHasPending = group.parts.some(p => p.status === 'pending') || group.parent.status === 'pending';
        if (isQueueProcessing.value && !isQueuePaused.value && belongsToGroup && groupHasPending) {
            return 'downloading';
        }
    } catch {}
    
    return 'pending';
}

function getGroupStatusText(group: { parent: QueuedManuscript; parts: QueuedManuscript[] }): string {
    return getStatusText(getGroupStatus(group));
}

function getTotalPagesText(group: { parent: QueuedManuscript; parts: QueuedManuscript[] }): string {
    if (group.parts.length === 0) {
        const item = group.parent;
        
        // Show loading message for items that are still loading manifests
        if (item.status === 'loading' || !item.totalPages || item.totalPages === 0) {
            return 'Loading manifest...';
        }
        
        if (item.downloadOptions && (item.downloadOptions.startPage !== 1 || item.downloadOptions.endPage !== item.totalPages)) {
            return `Pages ${item.downloadOptions.startPage || 1}–${item.downloadOptions.endPage || item.totalPages} (${(item.downloadOptions.endPage || item.totalPages) - (item.downloadOptions.startPage || 1) + 1} pages)`;
        } else {
            return `All ${item.totalPages} Pages`;
        }
    } else {
        const totalParts = group.parts.length;
        const completedParts = group.parts.filter(p => p.status === 'completed').length;
        return `${completedParts}/${totalParts} parts completed`;
    }
}

// Show a spinner next to "Loading manifest..." only when the item is not already in 'loading' status.
// This avoids duplicate spinners (status badge + pages badge) while keeping a spinner visible when
// the item is still pending/paused and manifest data hasn't arrived yet.
function showManifestSpinnerForItem(item: QueuedManuscript): boolean {
    if (!item) return false;
    // If the item's status is 'loading', the status badge already shows a spinner.
    if (item.status === 'loading') return false;
    // Show spinner if we have explicit manifest-loading progress
    if ((item as any)?.progress?.stage === 'loading-manifest') return true;
    // Or if we don't yet know total pages while pending/paused
    if ((!item.totalPages || item.totalPages === 0) && (item.status === 'pending' || item.status === 'paused')) {
        return true;
    }
    return false;
}

function getParentIndex(parent: QueuedManuscript): number {
    return groupedQueueItems.value.findIndex(group => group.parent.id === parent.id);
}

function isPartsExpanded(parentId: string): boolean {
    return expandedParts.value.has(parentId);
}

function togglePartsVisibility(parentId: string) {
    if (expandedParts.value.has(parentId)) {
        expandedParts.value.delete(parentId);
    } else {
        expandedParts.value.add(parentId);
    }
}

// Group action functions
function canPauseGroup(group: { parent: QueuedManuscript; parts: QueuedManuscript[] }): boolean {
    if (group.parts.length === 0) {
        return group.parent.status === 'downloading';
    }
    return group.parts.some(part => part.status === 'downloading');
}


function canResumeGroup(group: { parent: QueuedManuscript; parts: QueuedManuscript[] }): boolean {
    if (group.parts.length === 0) {
        return group.parent.status === 'paused';
    }
    return group.parts.some(part => part.status === 'paused');
}

function canRestartGroup(group: { parent: QueuedManuscript; parts: QueuedManuscript[] }): boolean {
    if (group.parts.length === 0) {
        return group.parent.status === 'completed' || group.parent.status === 'failed';
    }
    return group.parts.some(part => part.status === 'completed' || part.status === 'failed');
}

function canShowInFinder(group: { parent: QueuedManuscript; parts: QueuedManuscript[] }): boolean {
    if (group.parts.length === 0) {
        return (group.parent.status === 'completed' || group.parent.status === 'failed') && !!group.parent.outputPath;
    }
    return group.parts.some(part => (part.status === 'completed' || part.status === 'failed') && !!part.outputPath);
}

async function pauseGroup(group: { parent: QueuedManuscript; parts: QueuedManuscript[] }) {
    if (group.parts.length === 0) {
        await pauseQueueItem(group.parent.id);
    } else {
        for (const part of group.parts) {
            if (part.status === 'downloading') {
                await pauseQueueItem(part.id);
            }
        }
    }
}

async function resumeGroup(group: { parent: QueuedManuscript; parts: QueuedManuscript[] }) {
    if (group.parts.length === 0) {
        await resumeQueueItem(group.parent.id);
    } else {
        for (const part of group.parts) {
            if (part.status === 'paused') {
                await resumeQueueItem(part.id);
            }
        }
    }
}

async function restartGroup(group: { parent: QueuedManuscript; parts: QueuedManuscript[] }) {
    if (group.parts.length === 0) {
        await restartQueueItem(group.parent.id);
    } else {
        for (const part of group.parts) {
            if (part.status === 'completed' || part.status === 'failed') {
                await restartQueueItem(part.id);
            }
        }
    }
}

async function showGroupInFinder(group: { parent: QueuedManuscript; parts: QueuedManuscript[] }) {
    if (group.parts.length === 0 && group.parent.outputPath) {
        await showItemInFinder(group.parent.outputPath);
    } else {
        const completedPart = group.parts.find(part => part.status === 'completed' && part.outputPath);
        if (completedPart?.outputPath) {
            await showItemInFinder(completedPart.outputPath);
        }
    }
}


// Progress calculation functions
function shouldShowGroupProgress(group: { parent: QueuedManuscript; parts: QueuedManuscript[] }): boolean {
    if (group.parts.length === 0) {
        const basic = group.parent.status === 'downloading' || 
               (group.parent.status === 'paused' && (group.parent as any).progress) ||
               (group.parent.status === 'loading' && (group.parent as any).progress && (group.parent as any).progress.stage === 'loading-manifest');
        // Also show while we have cached progress (prevents disappearing badges between transitions)
        const cached = groupProgressCache.value.get(group.parent.id);
        return basic || (!!cached && (cached.current > 0 || cached.total > 0));
    }
    const anyActive = group.parts.some(part => part.status === 'downloading' || (part.status === 'paused' && (part as any).progress));
    if (anyActive) return true;
    // Keep visible if cached shows we have progress (even if the active part just flipped state)
    const cached = groupProgressCache.value.get(group.parent.id);
    return !!cached && (cached.current > 0 || cached.total > 0);
}

function getGroupProgress(group: { parent: QueuedManuscript; parts: QueuedManuscript[] }) {
    if (group.parts.length === 0) {
        const prog: any = (group.parent as any)?.progress || {};
        const total = prog?.total ?? group.parent.totalPages ?? 0;
        const current = prog?.current ?? (group.parent.status === 'completed' ? total : 0);
        const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
        const eta = typeof prog?.eta === 'number' ? prog.eta : -1;
        return { current, total, percentage, eta, stage: 'downloading' as TStage } as any;
    }

    const cached = groupProgressCache.value.get(group.parent.id);
    if (cached) {
        return {
            current: cached.current,
            total: cached.total,
            percentage: cached.percentage,
            eta: cached.eta,
            stage: 'downloading' as TStage,
        } as any;
    }
    return null;
}

function getGroupProgressLabel(group: { parent: QueuedManuscript; parts: QueuedManuscript[] }): string {
    const status = getGroupStatus(group);
    if (group.parts.length === 0) {
        if (status === 'downloading') return 'Download Progress';
        if (status === 'loading') return 'Loading Progress';
        return 'Paused Progress';
    }
    if (status === 'downloading') return 'Overall Progress';
    if (status === 'loading') return 'Overall Loading';
    return 'Overall Paused';
}

function getGroupPagesProgressText(group: { parent: QueuedManuscript; parts: QueuedManuscript[] }): string {
    const overall: any = getGroupProgress(group);
    if (!overall) return '';
    // Loading manifests stage
    if (overall.stage === 'loading-manifest') {
        return `Loading manifest: ${overall.current}/${overall.total} pages`;
    }
    const totalCurrent = Math.max(0, overall.current || 0);
    const totalTotal = Math.max(0, overall.total || 0);

    // For manuscripts with parts, also show the active part progress
    if (group.parts.length > 0) {
        // Use cached active part numbers when available for stability
        const cached = groupProgressCache.value.get(group.parent.id);
        if (cached && (cached.partTotal || cached.partCurrent !== undefined)) {
            const pc = Math.max(0, cached.partCurrent || 0);
            const pt = Math.max(0, cached.partTotal || 0);
            return `Total pages: ${totalCurrent}/${totalTotal}; part pages: ${pc}/${pt || '?'}`;
        }

        // Fallback: compute from the currently downloading part
        const active = group.parts.find(p => p.status === 'downloading')
            || group.parts.find(p => (p as any).progress && (p as any).progress.partTotal)
            || [...group.parts].reverse().find(p => p.status === 'completed')
            || group.parts[0];

        let partCurrent = 0;
        let partTotal = 0;
        const prog: any = (active as any)?.progress || {};
        if (typeof prog.partCurrent === 'number') partCurrent = Math.max(0, prog.partCurrent);
        else if (typeof prog.currentPartPages === 'number') partCurrent = Math.max(0, prog.currentPartPages);
        if (typeof prog.partTotal === 'number') partTotal = Math.max(0, prog.partTotal);
        else if (typeof prog.currentPartTotal === 'number') partTotal = Math.max(0, prog.currentPartTotal);
        // Graceful fallback if partTotal is unknown but we know the range
        if (!partTotal && active?.partInfo) {
            partTotal = (active.partInfo.pageRange.end - active.partInfo.pageRange.start + 1) || 0;
        }
        // Derive partCurrent from global progress if per-part value is unavailable
        if ((!(partCurrent > 0) || partCurrent < 0) && typeof prog.current === 'number' && active?.partInfo) {
            const parentStart = group.parent?.downloadOptions?.startPage || 1;
            const start = (active.partInfo.pageRange.start ?? parentStart);
            const pagesBefore = Math.max(0, start - parentStart);
            const derived = Math.max(0, Math.min(partTotal || ((active.partInfo.pageRange.end - active.partInfo.pageRange.start + 1) || 0), (prog.current as number) - pagesBefore));
            partCurrent = derived;
        }
        // If the part is completed and we have the total, ensure current equals total
        if (active?.status === 'completed' && partTotal) {
            partCurrent = partTotal;
        }

        return `Total pages: ${totalCurrent}/${totalTotal}; part pages: ${partCurrent}/${partTotal || '?'}`;
    }

    // Single-document (no parts): keep simple
    return `${totalCurrent}/${totalTotal} pages downloaded`;
}

function getGroupProgressStats(group: { parent: QueuedManuscript; parts: QueuedManuscript[] }): string {
    const progress = getGroupProgress(group);
    const status = getGroupStatus(group);
    
    if (!progress) return 'Initializing...';
    if (typeof progress === 'number') return `${progress}%`;
    
    if (group.parts.length === 0) {
        // Handle manifest loading stage
        if (progress.stage === 'loading-manifest') {
            return `Loading manifest: ${progress.current}/${progress.total} pages (${progress.percentage}%)`;
        }
        
        return status === 'downloading'
            ? `Downloading ${progress.current} of ${progress.total} (${progress.percentage}%)`
            : `Paused at ${progress.current} of ${progress.total} (${progress.percentage}%)`;
    } else {
        const downloadingParts = group.parts.filter(part => part.status === 'downloading').length;
        const completedParts = group.parts.filter(part => part.status === 'completed').length;
        return `${completedParts}/${group.parts.length} parts completed, ${downloadingParts} downloading (${progress.percentage}%)`;
    }
}

const queueStats = computed(() => {
    const items = queueItems.value;
    return {
        total: items.length,
        loading: items.filter((item) => item.status === 'loading').length,
        pending: items.filter((item) => item.status === 'pending').length,
        downloading: items.filter((item) => item.status === 'downloading').length,
        completed: items.filter((item) => item.status === 'completed').length,
        failed: items.filter((item) => item.status === 'failed').length,
        paused: items.filter((item) => item.status === 'paused').length,
    };
});

const queueStatsReady = computed(() => {
    // Stats excluding loading items for progress display
    const items = queueItems.value.filter((item) => item.status !== 'loading');
    return {
        total: items.length,
        pending: items.filter((item) => item.status === 'pending').length,
        downloading: items.filter((item) => item.status === 'downloading').length,
        completed: items.filter((item) => item.status === 'completed').length,
        failed: items.filter((item) => item.status === 'failed').length,
        paused: items.filter((item) => item.status === 'paused').length,
    };
});

const hasReadyItems = computed(() => queueItems.value.some((item: QueuedManuscript) => item.status === 'pending'));
const hasCompletedOrFailedItems = computed(() => queueItems.value.some((item: QueuedManuscript) => item.status === 'completed' || item.status === 'failed'));
const hasFailedDownloads = computed(() => queueItems.value.some((item: QueuedManuscript) => item.status === 'failed'));
// Track if the user has manually started queue in this session
const hasUserStartedQueue = ref(false);


// Check if the button should show "Resume" vs "Start"
const shouldShowResume = computed(() => {
    // If queue is empty, always show "Start"
    if (queueItems.value.length === 0) return false;
    
    // If items are still loading manifests, always show "Start" (not "Resume")
    if (queueStats.value.loading > 0) return false;
    
    // If only pending items exist (no started/completed/failed items), show "Start"
    const hasOnlyPendingAndLoadingItems = queueItems.value.every((item: QueuedManuscript) => 
        item.status === 'pending' || item.status === 'loading'
    );
    if (hasOnlyPendingAndLoadingItems) return false;
    
    // If a user has manually started the queue in this session and no items are loading, show resume
    if (hasUserStartedQueue.value && queueStats.value.loading === 0) return true;
    
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
    
    if (editingQueueItem.value.startPage < 1) return true;
    if (editingQueueItem.value.endPage < 1) return true;
    if (editingQueueItem.value.startPage > editingQueueItem.value.endPage) return true;
    
    // Check for duplicates with other items (excluding the current item)
    // Only flag as duplicate if it's the exact same page range for the same URL
    return queueItems.value.some((item: QueuedManuscript) =>
        item.id !== editingQueueItemId.value &&
        item.url === currentItem.url &&
        (item.downloadOptions?.startPage || 1) === editingQueueItem.value!.startPage &&
        (item.downloadOptions?.endPage || item.totalPages) === editingQueueItem.value!.endPage &&
        ['pending', 'downloading', 'completed'].includes(item.status) // Only consider active/successful items as duplicates
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

function getStatusText(status: TStatus): string {
    const statusMap = {
        'pending': 'Pending',
        'downloading': 'Downloading',
        'completed': 'Completed',
        'failed': 'Failed',
        'paused': 'Paused',
        'loading': 'Loading',
        'queued': 'Queued'
    };
    return statusMap[status] || status;
}

async function handleExampleClick(exampleUrl: string) {
    if (queueItems.value.length === 0) {
        // If queue is empty, add to main textarea
        bulkUrlText.value = bulkUrlText.value ? bulkUrlText.value + '\n' + exampleUrl : exampleUrl;
    } else {
        // If queue has items, open "Add More Documents" modal with URL
        bulkUrlText.value = exampleUrl;
        showAddMoreDocumentsModal.value = true;
        await nextTick();
        if (modalTextarea.value) {
            modalTextarea.value.focus();
            modalTextarea.value.setSelectionRange(modalTextarea.value.value.length, modalTextarea.value.value.length);
        }
    }
}

async function addAllTestUrls() {
    // Get the example URL from each library
    const testUrls = supportedLibraries.value
        .filter(library => library.example)
        .map(library => library.example);
    
    if (testUrls.length === 0) return;
    
    // Close the modal
    showSupportedLibrariesModal.value = false;
    
    // If queue is empty, add to main textarea
    if (queueItems.value.length === 0) {
        bulkUrlText.value = testUrls.join('\n');
    } else {
        // If queue has items, add directly to processing
        bulkUrlText.value = testUrls.join('\n');
        await processBulkUrls();
    }
}

async function openAddMoreDocumentsModal() {
    console.log('[openAddMoreDocumentsModal] Opening modal...');
    
    // Clear the textarea content before showing modal
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
    if (!window.electronAPI) {
        console.error('electronAPI is not available! Preload script may not have loaded.');
        return;
    }
    
    // Fetch initial state
    const initialState = await window.electronAPI.getQueueState();
    queueState.value = { ...initialState };
    
    // Subscribe to queue updates
    window.electronAPI.onQueueStateChanged((state: QueueState) => {
        // 🚨 CRITICAL PROGRESS DEBUGGING - Track all progress updates
        const activeItems = state.items?.filter(item => 
            item.status === 'downloading' || item.status === 'loading' || item.progress
        );
        
        if (activeItems && activeItems.length > 0) {
            console.log('🔄 PROGRESS UPDATE DEBUG:', {
                timestamp: Date.now(),
                totalItems: state.items?.length || 0,
                activeCount: activeItems.length,
                activeItems: activeItems.map(item => ({
                    id: item.id.slice(-8),
                    library: item.library,
                    status: item.status,
                    displayName: item.displayName?.slice(0, 50) || 'Unknown',
                    hasProgress: !!item.progress,
                    progress: item.progress ? {
                        current: (item.progress as any)?.current || 0,
                        total: (item.progress as any)?.total || 0,
                        percentage: (item.progress as any)?.percentage || 0,
                        stage: (item.progress as any)?.stage || 'unknown'
                    } : null,
                    concurrency: item.downloadOptions?.concurrentDownloads || 'default',
                    libraryOptimizations: item.libraryOptimizations
                }))
            });
        }
        
        // Debug logging for Orleans progress data (keep existing)
        const orleansItems = state.items?.filter(item => item.url?.includes('orleans') || item.status === 'loading');
        if (orleansItems && orleansItems.length > 0) {
            console.log('Queue state update - Orleans items:', orleansItems.map(item => ({
                id: item.id,
                status: item.status,
                hasProgress: !!item.progress,
                progressData: item.progress,
                url: item.url
            })));
        }
        
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
    // Wait a bit for preload script to finish loading
    if (!window.electronAPI) {
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    await initializeQueue();
    
    if (window.electronAPI) {
        try {
            const libraries = await window.electronAPI.getSupportedLibraries();
            if (libraries && libraries.length > 0) {
                supportedLibraries.value = libraries;
            }
        } catch (error) {
            console.error('Failed to fetch libraries:', error);
        }
    }

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
    
    // Add escape key listener for modals
    document.addEventListener('keydown', handleKeydown);
});

function parseUrls(text: string): string[] {
    // Smart URL parsing that preserves commas in query parameters
    const urls: string[] = [];
    
    // Special handling for URLs with commas in query parameters
    // Look for patterns like "?page=,1" or "?page=, 1"
    const urlPattern = /https?:\/\/[^\s;]+/g;
    let match;
    let _UNUSED_lastIndex = 0;
    
    while ((match = urlPattern.exec(text)) !== null) {
        let url = match[0];
        
        // Check if URL ends with "=" and might have a comma-separated value after it
        if (url.endsWith('=')) {
            // Look for comma followed by value after this URL
            const afterMatch = text.substring(match.index + url.length);
            const commaValueMatch = afterMatch.match(/^,\s*([^\s;]+)/);
            if (commaValueMatch) {
                url += commaValueMatch[0].replace(/\s+/g, ''); // Remove spaces
                urlPattern.lastIndex = match.index + url.length;
            }
        } else if (url.includes('=,')) {
            // URL already contains =, pattern, check if we need to grab more
            const afterMatch = text.substring(match.index + url.length);
            const valueMatch = afterMatch.match(/^\s*([^\s;]+)/);
            if (valueMatch && !valueMatch[1].includes('://')) {
                url += valueMatch[1];
                urlPattern.lastIndex = match.index + url.length;
            }
        }
        
        urls.push(url);
        _UNUSED_lastIndex = urlPattern.lastIndex;
    }
    
    // If no URLs found with pattern, fall back to simple splitting
    // This handles non-URL text that might be in the input
    if (urls.length === 0) {
        return text
            .split(/[\s;]+/)
            .map((item) => item.trim())
            .filter((item) => item.length > 0);
    }
    
    return urls;
}

async function parseManuscriptWithCaptcha(url: string) {
    try {
        return await window.electronAPI.parseManuscriptUrl(url);
    } catch (error: unknown) {
        console.log('parseManuscriptWithCaptcha caught error:', error instanceof Error ? error.message : String(error));
        
        
        // Check if this is a captcha error (may be wrapped in IPC error)
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage?.includes('CAPTCHA_REQUIRED:')) {
            // Extract the captcha URL from the potentially wrapped error message
            const captchaMatch = errorMessage.match(/CAPTCHA_REQUIRED:(.+?)(?:\s|$)/);
            const captchaUrl = captchaMatch ? captchaMatch[1] : errorMessage.split('CAPTCHA_REQUIRED:')[1];
            
            console.log('Captcha required for:', url);
            console.log('Captcha URL:', captchaUrl);
            
            const captchaResult = await window.electronAPI.solveCaptcha(captchaUrl);
            
            if (captchaResult.success && captchaResult.content) {
                // For libraries that return manifest directly after captcha
                const iiifManifest = JSON.parse(captchaResult.content);
                
                const pageLinks = iiifManifest.sequences[0].canvases.map((canvas: IIIFCanvas) => {
                    const resource = canvas.images[0].resource;
                    return resource['@id'] || resource.id;
                }).filter((link: string) => link);
                
                if (pageLinks.length > 0) {
                    return {
                        pageLinks,
                        totalPages: pageLinks.length,
                        library: 'unknown',
                        displayName: url.split('/').pop() || 'Document',
                        originalUrl: url,
                    };
                }
            }
            
            throw new Error(captchaResult.error || 'Captcha verification failed');
        }
        
        // Re-throw other errors
        throw error;
    }
}

async function processBulkUrls() {
    console.log('[processBulkUrls] Called with bulkUrlText:', bulkUrlText.value);
    
    // Clear previous error message
    errorMessage.value = '';
    
    const urls = parseUrls(bulkUrlText.value);
    console.log('[processBulkUrls] Parsed URLs:', urls);
    
    if (urls.length === 0) {
        console.log('[processBulkUrls] No URLs to process, bulkUrlText was:', bulkUrlText.value);
        return;
    }

    // Close modal and clear textarea so user can see queue updates
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
                if (!window.electronAPI) {
                    console.error('electronAPI is not available!');
                    errorCount++;
                    continue;
                }
                
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
            } catch (error: unknown) {
                if (error instanceof Error && error.message.includes('already exists in queue')) {
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
                console.log('[RENDERER] Parsing manifest for URL:', url);
                // Parse manifest in the main process with captcha handling
                const manifest = await parseManuscriptWithCaptcha(url);
                console.log('[RENDERER] Manifest parsed successfully:', manifest.displayName);
                
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
                {
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
                }
                addedCount++;
            } catch (error: unknown) {
                console.log('[RENDERER] Error caught in processBulkUrls:', error);
                console.log('[RENDERER] Error message:', error instanceof Error ? error.message : String(error));
                console.log('[RENDERER] Error type:', typeof error);
                
                // Handle all errors (captcha handled in parseManuscriptWithCaptcha)
                const errorMessage = error instanceof Error ? error.message : '';
                const isExpectedError = errorMessage?.includes('not valid JSON') ||
                    errorMessage?.includes('404') ||
                    errorMessage?.includes('Manuscript not found') ||
                    errorMessage?.includes('CORS') ||
                    errorMessage?.includes('Invalid manifest structure') ||
                    errorMessage?.includes('Captcha verification failed');
            
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

        // Show error message for duplicates or errors
        if (duplicateCount > 0 || errorCount > 0) {
            let message = '';
            if (duplicateCount > 0) {
                message += `${duplicateCount} duplicate${duplicateCount > 1 ? 's' : ''} already exists in queue. `;
            }
            if (errorCount > 0) {
                message += `${errorCount} URL${errorCount > 1 ? 's' : ''} failed to load. `;
            }
            if (addedCount > 0) {
                message += `${addedCount} new manuscript${addedCount > 1 ? 's' : ''} added.`;
            }
            
            errorMessage.value = message.trim();
        } else if (addedCount > 0) {
            // Items were added successfully - no notification needed, user can see them in the queue
        }


    } catch (error: unknown) {
        console.error('[processBulkUrls] Unexpected error during bulk processing:', error);
        showAlert(
            'Error',
            `Failed to process URLs: ${error instanceof Error ? error.message : String(error)}`,
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
    // Log start for all pending items
    queueItems.value.forEach(item => {
        if (item.status === 'pending') {
            addLogEntry(item.id, 'info', 'Download queued for processing');
        }
    });
    
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


async function restartAllCompletedFailed() {
    const itemsToRestart = queueItems.value.filter((item: QueuedManuscript) => 
        item.status === 'completed' || item.status === 'failed'
    );
    
    if (itemsToRestart.length === 0) return;
    
    // Reset all completed/failed items to pending
    for (const item of itemsToRestart) {
        await window.electronAPI.updateQueueItem(item.id, {
            status: 'pending' as TStatus,
            progress: undefined,
            error: undefined
        });
    }
    
    // Start the queue
    await startQueue();
}

function clearAllQueue() {
    if (queueItems.value.length === 0) return;
    
    const hasActiveDownloads = queueItems.value.some((item: QueuedManuscript) => item.status === 'downloading');
    
    const confirmAction = async () => {
        await performButtonAction('clearAll', async () => {
            await window.electronAPI.clearAllFromQueue();
            hasUserStartedQueue.value = false;
            editingQueueItemId.value = null;
            editingQueueItem.value = null;
        });
    };
    
    if (hasActiveDownloads) {
        showConfirm(
            'Delete All Queue Items?',
            'There are active downloads. Stopping the queue will cancel them. Are you sure you want to delete all items?',
            confirmAction,
            'Delete All',
            'Cancel',
        );
    } else {
        showConfirm(
            'Delete All Queue Items?',
            `Are you sure you want to delete all ${queueItems.value.length} items from the queue?`,
            confirmAction,
            'Delete All',
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

// Compute effective concurrency for a queue item, factoring in possible library caps
function effectiveItemConcurrency(item: QueuedManuscript): number {
    const perItem = item.downloadOptions?.concurrentDownloads;
    const globalVal = queueState.value.globalSettings?.concurrentDownloads || 3;
    const base = perItem || globalVal;
    const cap = item.libraryOptimizations?.maxConcurrentDownloads;
    return cap ? Math.min(base, cap) : base;
}

function concurrencyBadgeTitle(item: QueuedManuscript): string {
    const perItem = item.downloadOptions?.concurrentDownloads;
    const globalVal = queueState.value.globalSettings?.concurrentDownloads || 3;
    const cap = item.libraryOptimizations?.maxConcurrentDownloads;
    if (cap && (perItem || globalVal) > cap) {
        return `Capped to ${cap} by ${item.library?.toUpperCase()} optimizations`;
    }
    return `Item: ${perItem ?? 'default'}; Global: ${globalVal}`;
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
    if (editingQueueItem.value.endPage < 1) editingQueueItem.value.endPage = 1;
    if (editingQueueItem.value.startPage > editingQueueItem.value.endPage) editingQueueItem.value.endPage = editingQueueItem.value.startPage;
}

function selectAllPages(totalPages: number) {
    if (!editingQueueItem.value || !totalPages || totalPages === 0) return;
    
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

async function restartQueueItem(id: string) {
    // Reset the item status to pending so it can be downloaded again
    await window.electronAPI.updateQueueItem(id, {
        status: 'pending' as TStatus,
        progress: undefined,
        error: undefined
    });
    
    // Start the queue if it's not already processing
    if (!isQueueProcessing.value) {
        await startQueue();
    }
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

async function moveQueueItemUp(item: QueuedManuscript) {
    const currentIndex = queueState.value.items.findIndex(i => i.id === item.id);
    if (currentIndex > 0) {
        await window.electronAPI.moveQueueItem(currentIndex, currentIndex - 1);
    }
}

async function moveQueueItemDown(item: QueuedManuscript) {
    const currentIndex = queueState.value.items.findIndex(i => i.id === item.id);
    if (currentIndex < queueState.value.items.length - 1) {
        await window.electronAPI.moveQueueItem(currentIndex, currentIndex + 1);
    }
}

function removeParentWithParts(parentId: string) {
    // Find all parts that belong to this parent
    const parts = queueState.value.items.filter(item => item.isAutoPart && item.parentId === parentId);
    const parentItem = queueState.value.items.find(item => item.id === parentId);
    const totalItems = parts.length + (parentItem ? 1 : 0);
    
    const message = totalItems > 1 
        ? `Are you sure you want to remove this manuscript and all ${parts.length} of its parts from the queue?`
        : 'Are you sure you want to remove this manuscript from the queue?';
    
    showConfirm(
        'Remove Manuscript?',
        message,
        async () => {
            // Remove parent first
            if (parentItem) {
                await window.electronAPI.removeFromQueue(parentId);
            }
            // Remove all parts
            for (const part of parts) {
                await window.electronAPI.removeFromQueue(part.id);
            }
        },
        'Remove',
        'Cancel',
    );
}

async function showItemInFinder(filePath: string) {
    try {
        await window.electronAPI.showItemInFinder(filePath);
    } catch (error: unknown) {
        showAlert('Error', `Failed to show file: ${error instanceof Error ? error.message : String(error)}`);
    }
}

// Removed old downloadLogs function - replaced with per-download log viewer

function getShowInFinderText(): string {
    // Detect platform - on macOS it's "Show in Finder", on Windows "Show in Explorer", on Linux "Show in File Manager"
    const platform = navigator.platform.toLowerCase();
    if (platform.includes('mac')) {
        return 'Show in Finder';
    } else if (platform.includes('win')) {
        return 'Show in Explorer';
    } else {
        return 'Show in File Manager';
    }
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

function showAlert(title: string, message: string, type?: string) {
    alertModal.value = {
        title,
        message,
        type: type || 'info',
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


async function openInBrowser(url: string) {
    // Use Electron's shell to open in default browser
    console.log('[RENDERER] openInBrowser called with URL:', url);
    
    if (!url) {
        console.error('[RENDERER] openInBrowser: No URL provided');
        alert('Error: No URL provided to open in browser');
        return;
    }
    
    try {
        console.log('[RENDERER] openInBrowser: Calling window.electronAPI.openExternal...');
        const result = await window.electronAPI.openExternal(url);
        console.log('[RENDERER] openInBrowser: Success result:', result);
        
        // Provide user feedback on successful opening
        if (result && typeof result === 'object' && result.success) {
            console.log(`[RENDERER] openInBrowser: Successfully opened URL using method: ${result.method}`);
            
            // Optional: Show success message to user (only if fallback was used)
            if (result.method !== 'shell.openExternal') {
                console.log(`[RENDERER] openInBrowser: Note - Used fallback method '${result.method}' due to primary method failure`);
            }
        }
    } catch (error) {
        console.error('[RENDERER] openInBrowser: Failed to open URL in browser:', error);
        console.error('[RENDERER] openInBrowser: Error details:', {
            name: (error as any)?.name,
            message: (error as any)?.message,
            stack: (error as any)?.stack,
            url: url,
            platform: navigator.platform
        });
        
        // Show user-friendly error message with additional troubleshooting info
        const errorMessage = (error as any)?.message || error;
        let troubleshootingTip = '';
        
        if (navigator.platform.includes('Mac')) {
            troubleshootingTip = '\n\nTroubleshooting:\n• Check System Preferences → General → Default web browser\n• Try running: System Preferences → Security & Privacy → Allow apps downloaded from...';
        } else if (navigator.platform.includes('Win')) {
            troubleshootingTip = '\n\nTroubleshooting:\n• Check Settings → Apps → Default apps → Web browser\n• Ensure Windows has a default browser set';
        } else {
            troubleshootingTip = '\n\nTroubleshooting:\n• Check your system\'s default browser settings\n• Verify xdg-utils is installed (Linux)';
        }
        
        alert(`Failed to open URL in browser: ${errorMessage}\n\nURL: ${url}${troubleshootingTip}\n\nPlease copy the URL manually if needed.`);
    }
}

// Context menu functions
function showContextMenu(event: MouseEvent, url: string) {
    contextMenu.value = {
        visible: true,
        x: event.clientX,
        y: event.clientY,
        url: url
    };
    
    // Close menu when clicking elsewhere
    document.addEventListener('click', hideContextMenu, { once: true });
}

function hideContextMenu() {
    contextMenu.value.visible = false;
}

async function copyLinkFromMenu() {
    await copyLinkToClipboard(contextMenu.value.url);
    hideContextMenu();
}

async function openLinkFromMenu() {
    await openInBrowser(contextMenu.value.url);
    hideContextMenu();
}

async function copyLinkToClipboard(url: string) {
    try {
        await navigator.clipboard.writeText(url);
        console.log('Link copied to clipboard:', url);
    } catch (error) {
        console.error('Failed to copy link:', error);
        // Fallback to older method if needed
        const textArea = document.createElement('textarea');
        textArea.value = url;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
    }
}

// Log viewer functions
function viewDownloadLogs(item: QueuedManuscript) {
    currentLogItem.value = item;
    currentLogs.value = downloadLogs.value.get(item.id) || [];
    showLogViewer.value = true;
}

function closeLogViewer() {
    showLogViewer.value = false;
    currentLogItem.value = null;
    currentLogs.value = [];
}

function clearCurrentLogs() {
    if (currentLogItem.value) {
        downloadLogs.value.set(currentLogItem.value.id, []);
        currentLogs.value = [];
    }
}

async function exportCurrentLogs() {
    if (!currentLogItem.value) return;
    
    const logs = downloadLogs.value.get(currentLogItem.value.id) || [];
    const logText = logs.map(log => {
        const time = new Date(log.timestamp).toISOString();
        const level = log.level.toUpperCase().padEnd(5);
        const details = log.details ? `\n  Details: ${JSON.stringify(log.details, null, 2)}` : '';
        return `[${time}] [${level}] ${log.message}${details}`;
    }).join('\n\n');
    
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-${currentLogItem.value.displayName.replace(/[^a-z0-9]/gi, '_')}-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function formatLogTime(timestamp: string | number): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
}

// Capture log for a download
function addLogEntry(itemId: string, level: string, message: string, details?: Record<string, unknown>) {
    const logs = downloadLogs.value.get(itemId) || [];
    logs.push({
        timestamp: Date.now(),
        level,
        message,
        details
    });
    downloadLogs.value.set(itemId, logs);
    
    // Update current view if this item is being viewed
    if (currentLogItem.value?.id === itemId) {
        currentLogs.value = logs;
    }
}

async function cleanupIndexedDBCache() {
    try {
        const confirmAction = async () => {
            await performButtonAction('cleanupCache', async () => {
                await window.electronAPI.clearAllCaches();
            });
        };
        
        showConfirm(
            'Cleanup Cache',
            'Are you sure you want to clear all caches? This will delete all downloaded images and cached manifests, and may free up significant disk space.',
            confirmAction,
            'Cleanup',
            'Cancel',
        );
    } catch (error: unknown) {
        console.error('Failed to cleanup IndexedDB cache:', error);
        showAlert('Error', `Failed to clean up cache: ${error instanceof Error ? error.message : String(error)}`);
    }
}

async function revealDownloadsFolder() {
    await performButtonAction('revealFolder', async () => {
        try {
            const _UNUSED_folderPath = await window.electronAPI.openDownloadsFolder();
        } catch (error: unknown) {
            console.error('Failed to open downloads folder:', error);
            showAlert('Error', `Failed to open downloads folder: ${error instanceof Error ? error.message : String(error)}`);
            throw error; // Re-throw to prevent showing success state
        }
    });
}

// Removed old global logs functions - now using per-download logs

// Queue settings management
function _UNUSED_updateQueueSettings() {
    // Settings are updated in real-time via the reactive refs
}

// Debounced auto-split threshold update
function onAutoSplitThresholdChange() {
    // Guard: mark that user is adjusting, so watchEffect won't overwrite the local value
    isAdjustingAutoSplit.value = true;
    if (adjustGuardTimer) clearTimeout(adjustGuardTimer);
    adjustGuardTimer = setTimeout(() => {
        isAdjustingAutoSplit.value = false;
    }, 800); // stop guarding shortly after user stops moving the slider

    // Debounce IPC update (shorter delay to keep UI and state in sync quickly)
    if (debounceTimer) {
        clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(async () => {
        try {
            const thresholdMB = Number(queueSettings.value.autoSplitThresholdMB) || 10;
            await Promise.all([
                // Persist for queue-level splitting logic
                window.electronAPI.updateAutoSplitThreshold(thresholdMB),
                // Persist to global config (bytes) so the downloader service uses the same value
                window.electronAPI.setConfig('autoSplitThreshold', thresholdMB * 1024 * 1024)
            ]);
        } catch (error) {
            console.error('Failed to update auto-split threshold:', error);
        }
    }, 300);
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
        case 'loading':
            return 'loading';
        case 'pending':
        default:
            return 'pending';
    }
}

// Button state management
async function performButtonAction(buttonKey: string, action: () => Promise<void>) {
    buttonLoadingStates.value[buttonKey] = 'loading';
    
    try {
        await action();
        buttonLoadingStates.value[buttonKey] = 'success';
        
        // Reset to idle after showing success state
        setTimeout(() => {
            buttonLoadingStates.value[buttonKey] = 'idle';
        }, 1500);
    } catch (error) {
        buttonLoadingStates.value[buttonKey] = 'idle';
        throw error;
    }
}

function getButtonContent(buttonKey: string, defaultText: string): { text: string; icon: string } {
    const state = buttonLoadingStates.value[buttonKey] || 'idle';
    
    switch (state) {
        case 'loading':
            return { text: '', icon: '⏳' };
        case 'success':
            return { text: '', icon: '✓' };
        case 'idle':
        default:
            return { text: defaultText, icon: '' };
    }
}

function getButtonClass(buttonKey: string, baseClass: string): string {
    const state = buttonLoadingStates.value[buttonKey] || 'idle';
    return `${baseClass} ${state !== 'idle' ? `btn-${state}` : ''}`;
}

function isButtonDisabled(buttonKey: string, originalDisabled: boolean = false): boolean {
    const state = buttonLoadingStates.value[buttonKey] || 'idle';
    return originalDisabled || state === 'loading';
}

function formatTime(seconds: number | undefined): string {
    // Handle undefined, null, NaN, negative values, or zero - show "calculating..." instead of invalid time
    if (seconds === undefined || seconds === null || !Number.isFinite(seconds) || seconds <= 0) {
        return 'calculating...';
    }
    
    const roundedSeconds = Math.round(seconds);
    if (roundedSeconds < 60) return `${roundedSeconds}s`;
    const minutes = Math.floor(roundedSeconds / 60);
    const remainingSeconds = roundedSeconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
}

// Note: refreshQueueState function removed as it was unused
</script>

<style scoped>
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
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
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
    color: #495057;
    font-size: 0.9em;
}

.queue-progress-stats {
    font-weight: 500;
    color: #6c757d;
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

.queue-progress-fill.loading {
    background: linear-gradient(90deg, #17a2b8 0%, #138496 100%);
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
    color: #6c757d;
    border: 1px solid #dee2e6;
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

.progress-segment.loading {
    background: #d1ecf1;
    color: #0c5460;
    border: 1px solid #bee5eb;
}

.queue-controls {
    margin-bottom: 15px;
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
}

.start-btn {
    background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
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
    background: #ffc107;
    color: #212529;
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
    background: #17a2b8;
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
    background: #dc3545;
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

.restart-queue-btn {
    background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 600;
    box-shadow: 0 2px 8px rgba(40, 167, 69, 0.2);
    transition: all 0.2s ease;
}

.restart-queue-btn:hover {
    background: linear-gradient(135deg, #218838 0%, #1ea085 100%);
    box-shadow: 0 3px 12px rgba(40, 167, 69, 0.25);
}

.clear-queue-btn {
    background: #dc3545;
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
    background: #6c757d;
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

.reveal-folder-btn {
    background: #17a2b8;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    transition: background-color 0.2s;
}

.reveal-folder-btn:hover:not(:disabled) {
    background: #138496;
}

.reveal-folder-btn:disabled {
    background: #adb5bd;
    cursor: not-allowed;
    opacity: 0.6;
}

.reveal-logs-btn {
    background: #6c757d;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    transition: background-color 0.2s;
}

.reveal-logs-btn:hover:not(:disabled) {
    background: #5a6268;
}

.reveal-logs-btn:disabled {
    background: #adb5bd;
    cursor: not-allowed;
    opacity: 0.6;
}

.export-logs-btn {
    background: #6610f2;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    transition: background-color 0.2s;
}

.export-logs-btn:hover:not(:disabled) {
    background: #520dc2;
}

.export-logs-btn:disabled {
    background: #adb5bd;
    cursor: not-allowed;
    opacity: 0.6;
}

/* View logs button in queue items */
.view-logs-btn {
    background: #6c757d;
    color: white;
    border: none;
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 13px;
    transition: background-color 0.2s;
    white-space: nowrap;
}

.view-logs-btn:hover {
    background: #5a6268;
}

/* Context menu */
.context-menu {
    position: fixed;
    background: #2d2d2d;
    border: 1px solid #444;
    border-radius: 6px;
    padding: 4px 0;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
    z-index: 10000;
    min-width: 150px;
}

.context-menu-item {
    padding: 8px 16px;
    color: #e0e0e0;
    cursor: pointer;
    font-size: 14px;
    transition: background-color 0.2s;
    user-select: none;
}

.context-menu-item:hover {
    background: #3a3a3a;
}

/* Log viewer modal */
.log-viewer-modal {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
}

.log-viewer-content {
    background: #1e1e1e;
    border-radius: 8px;
    width: 90%;
    max-width: 900px;
    height: 80%;
    max-height: 600px;
    display: flex;
    flex-direction: column;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
}

.log-viewer-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 15px 20px;
    border-bottom: 1px solid #333;
    background: #2d2d2d;
    border-radius: 8px 8px 0 0;
}

.log-viewer-header h3 {
    margin: 0;
    color: #fff;
    font-size: 18px;
}

.log-viewer-actions {
    display: flex;
    gap: 10px;
}

.log-viewer-actions button {
    padding: 6px 12px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    transition: background-color 0.2s;
}

.export-log-btn {
    background: #28a745;
    color: white;
}

.export-log-btn:hover {
    background: #218838;
}

.clear-log-btn {
    background: #dc3545;
    color: white;
}

.clear-log-btn:hover {
    background: #c82333;
}

.close-log-btn {
    background: #6c757d;
    color: white;
}

.close-log-btn:hover {
    background: #5a6268;
}

.log-viewer-body {
    flex: 1;
    overflow-y: auto;
    padding: 15px 20px;
    background: #1a1a1a;
}

.no-logs {
    color: #888;
    text-align: center;
    padding: 40px;
    font-style: italic;
}

.log-entries {
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 12px;
}

.log-entry {
    margin-bottom: 8px;
    padding: 8px;
    border-radius: 4px;
    background: #262626;
    border-left: 3px solid #444;
}

.log-entry.log-error {
    border-left-color: #dc3545;
    background: #2a1f1f;
}

.log-entry.log-warn {
    border-left-color: #ffc107;
    background: #2a2519;
}

.log-entry.log-info {
    border-left-color: #17a2b8;
    background: #1a2328;
}

.log-entry.log-debug {
    border-left-color: #6c757d;
}

.log-time {
    color: #888;
    margin-right: 10px;
}

.log-level {
    font-weight: bold;
    margin-right: 10px;
}

.log-level.error {
    color: #dc3545;
}

.log-level.warn {
    color: #ffc107;
}

.log-level.info {
    color: #17a2b8;
}

.log-level.debug {
    color: #6c757d;
}

.log-message {
    color: #e0e0e0;
}

.log-details {
    margin-top: 5px;
    padding-top: 5px;
    border-top: 1px solid #333;
}

.log-details pre {
    margin: 0;
    color: #999;
    font-size: 11px;
    overflow-x: auto;
}

/* Button state styles */
.btn-loading {
    position: relative;
    color: transparent !important;
    pointer-events: none;
}

.btn-success {
    background: #28a745 !important;
    color: white !important;
    pointer-events: none;
}

.btn-icon-only {
    font-size: 1.2em;
    display: inline-block;
    min-width: 1.5em;
    text-align: center;
}

/* Specific button state overrides */
.clear-queue-btn.btn-loading,
.cleanup-cache-btn.btn-loading,
.reveal-folder-btn.btn-loading,
.apply-settings-btn.btn-loading {
    background: #6c757d !important;
}

.clear-queue-btn.btn-success {
    background: #28a745 !important;
}

.cleanup-cache-btn.btn-success {
    background: #28a745 !important;
}

.reveal-folder-btn.btn-success {
    background: #28a745 !important;
}

.apply-settings-btn.btn-success {
    background: #28a745 !important;
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
    border-left: 4px solid #ffc107;
}

.queue-item.status-paused {
    background: #e2e3e5;
    border-left: 4px solid #c6c8ca;
}

.queue-item.status-completed {
    background: #d4edda;
    border-left: 4px solid #28a745;
}

.queue-item.status-failed {
    background: #f8d7da;
    border-left: 4px solid #dc3545;
}

.queue-item.status-loading,
.queue-item.loading-manifest {
    background: #f8f9fa;
    border-left: 4px solid #6c757d;
}

.queue-item.status-failed {
    opacity: 0.8;
}


.loading-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid #f3f3f3;
    border-top: 2px solid #007bff;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}

.queue-item-header {
    display: grid;
    grid-template-areas:
        "title"
        "buttons"
        "meta";
    grid-template-columns: 1fr;
    row-gap: 6px;
    align-items: start;
}

.queue-item-info strong {
    display: block;
    margin-bottom: 4px;
    word-break: break-all;
}

/* Always stack title, buttons, bubbles using grid */
.queue-item-info { display: contents; }
.queue-item-info > strong { grid-area: title; }
.queue-item-controls { grid-area: buttons; width: 100%; justify-content: flex-start; flex-wrap: wrap; margin: 4px 0 0 0; }
.queue-item-meta { grid-area: meta; width: 100%; }

.manuscript-title-link {
    color: inherit;
    text-decoration: none;
    transition: color 0.2s ease, border-color 0.2s ease;
    display: inline-block;
    max-width: fit-content;
}

.manuscript-title-link:hover {
    color: #007bff;
    border-bottom-color: #007bff;
    text-decoration: none;
}

.manuscript-error-link {
    color: #dc3545;
    text-decoration: none;
    transition: color 0.2s ease, border-color 0.2s ease;
    word-break: break-all;
    display: inline-block;
    max-width: fit-content;
}

.manuscript-error-link:hover {
    color: #c82333;
    border-bottom-color: #c82333;
    text-decoration: none;
}

.queue-item-meta {
    display: flex;
    gap: 10px;
    align-items: center;
    font-size: 0.9em;
    color: #666;
    margin-top: 0.75rem;
    flex-wrap: wrap; /* Allow bubbles to wrap on small widths */
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
    background: #6c757d;
}

.status-badge.status-loading {
    background: #17a2b8;
}

.status-badge.status-downloading {
    background: #ffc107;
    color: #212529;
}

.inline-spinner {
    display: inline-block;
    width: 12px;
    height: 12px;
    border: 2px solid rgba(0,0,0,0.2);
    border-top-color: rgba(0,0,0,0.6);
    border-radius: 50%;
    margin-right: 6px;
    animation: spin 0.8s linear infinite;
}

.status-badge.status-paused {
    background: #6c757d;
    color: white;
}

.status-badge.status-completed {
    background: #28a745;
}

.status-badge.status-failed {
    background: #dc3545;
}

.status-badge.geo-blocked {
    background: #f59e0b;
    color: white;
    margin-left: 0.5rem;
    font-size: 0.75rem;
}

.total-pages-badge {
    background: #e9ecef;
    color: #495057;
    padding: 3px 8px;
    border-radius: 12px;
    font-size: 0.75em;
    font-weight: 600;
    white-space: nowrap;
    display: flex;
    align-items: center;
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

.optimization-badge {
    background: linear-gradient(135deg, #ffd700, #ffed4a);
    color: #7c3d00;
    padding: 3px 8px;
    border-radius: 12px;
    font-size: 0.75em;
    font-weight: 600;
    border: 1px solid #ddb105;
    white-space: nowrap;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    cursor: help;
    animation: subtle-pulse 2s ease-in-out infinite;
}

@keyframes subtle-pulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.02); opacity: 0.9; }
}

.queue-item-controls {
    display: flex;
    gap: 8px;
    margin-left: 20px;
}

.edit-btn {
    background: #ffc107;
    color: #212529;
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
    background: #ffc107;
    color: #212529;
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
    background: #17a2b8;
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

.restart-item-btn {
    background: #28a745;
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

.restart-item-btn:hover {
    background: #218838;
}

.download-logs-btn {
    background: #6c757d;
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
    white-space: nowrap;
}

.download-logs-btn:hover {
    background: #5a6268;
}

.show-finder-btn {
    background: #17a2b8;
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

.show-finder-btn:hover {
    background: #138496;
}

.remove-btn {
    background: #dc3545;
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

.move-up-btn,
.move-down-btn {
    background: #6c757d;
    color: white;
    border: none;
    border-radius: 4px;
    min-width: 28px;
    height: 28px;
    font-size: 14px;
    cursor: pointer;
    transition: background-color 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
}

.move-up-btn:hover,
.move-down-btn:hover {
    background: #5a6268;
}

.parent-item {
    border-left: 4px solid #007bff;
}

.auto-parts-list {
    margin-left: 20px;
    margin-top: 8px;
}

.part-item {
    border-left: 3px solid #6c757d;
    margin-bottom: 8px;
    background: #f8f9fa;
}

.part-count-badge {
    color: #007bff;
    font-weight: normal;
    font-size: 0.9em;
    margin-left: 8px;
}

.toggle-parts-btn {
    background: #6c757d;
    color: white;
    border: none;
    border-radius: 4px;
    min-width: 28px;
    height: 28px;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
}

.toggle-parts-btn:hover {
    background: #5a6268;
}

.toggle-parts-btn.expanded {
    background: #007bff;
}

.toggle-parts-btn.expanded:hover {
    background: #0056b3;
}

.group-progress {
    border-left: 3px solid #007bff;
    background: rgba(0, 123, 255, 0.1);
}

.queue-edit-form .edit-save-btn {
    background: #28a745;
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
    background: #6c757d;
    cursor: not-allowed;
}

.queue-edit-form .edit-cancel-btn {
    background: #6c757d;
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

.parts-compact {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 8px 0 0 8px;
}

.part-chip {
    background: #f1f3f5;
    border: 1px solid #e9ecef;
    border-radius: 12px;
    padding: 2px 8px;
    font-size: 12px;
    color: #495057;
}

.part-chip.status-downloading { background: #fff3cd; color: #856404; border-color: #ffeaa7; }
.part-chip.status-paused { background: #e2e3e5; color: #383d41; border-color: #c6c8ca; }
.part-chip.status-completed { background: #d4edda; color: #155724; border-color: #c3e6cb; }
.part-chip.status-failed { background: #f8d7da; color: #721c24; border-color: #f5c6cb; }
.part-chip.status-loading { background: #d1ecf1; color: #0c5460; border-color: #bee5eb; }

.pages-progress-badge {
    background: #e9ecef;
    color: #495057;
    padding: 3px 8px;
    border-radius: 12px;
    font-size: 0.75em;
    font-weight: 600;
    white-space: nowrap;
}

.eta-badge {
    background: #fff3cd;
    color: #856404;
    padding: 3px 8px;
    border-radius: 12px;
    font-size: 0.75em;
    font-weight: 600;
    border: 1px solid #ffeaa7;
    white-space: nowrap;
}

.compact-progress {
    margin-left: 8px;
    display: inline-flex;
    align-items: center;
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
    color: #495057;
}

.edit-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 12px;
}

.queue-group {
  border-bottom: solid lightgray;
}

/* Buttons are now inline in page-range, no separate edit-actions needed */

.page-range {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
}

.page-input {
    width: 60px;
    padding: 4px 6px;
    border: 1px solid #ccc;
    border-radius: 4px;
}

.select-all-btn {
    background: #007bff;
    border: 1px solid #007bff;
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
    color: #6c757d;
    cursor: not-allowed;
}

.select-all-btn.active:hover {
    background: #f8f9fa;
    border-color: #dee2e6;
}

.concurrency-slider {
    width: 100%;
    max-width: 120px;
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
    color: #495057;
    font-size: 0.8em;
}

.item-progress-stats {
    font-weight: 500;
    color: #6c757d;
    font-size: 0.75em;
}

.item-progress-bar {
    height: 8px;
    background: rgba(233, 236, 239, 0.5);
    border-radius: 4px;
    overflow: hidden;
    margin: 4px 0;
    border: 1px solid rgba(233, 236, 239, 0.8);
}

.item-progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #17a2b8 0%, #138496 100%);
    transition: width 0.3s ease;
    border-radius: 3px;
    box-shadow: inset 0 1px 2px rgba(0,0,0,0.1);
}

.item-progress-eta {
    font-size: 0.7em;
    color: #6c757d;
    text-align: right;
}

.manuscript-downloader {
    max-width: 1200px;
    margin: 0 auto;
    padding: min(2rem, 3vw);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    min-height: calc(100vh - 80px); /* Ensure minimum height but allow expansion */
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.libraries-list {
    margin-top: 1.5rem;
    display: grid;
    grid-template-columns: 1fr;
    gap: 1rem;
}

/* Two columns on medium screens */
@media (min-width: 768px) and (max-width: 1199px) {
    .libraries-list {
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
    }
}

/* Three columns on large screens */
@media (min-width: 1200px) and (max-width: 1599px) {
    .libraries-list {
        grid-template-columns: 1fr 1fr 1fr;
        gap: 1rem;
    }
}

/* Four columns on extra large screens */
@media (min-width: 1600px) {
    .libraries-list {
        grid-template-columns: 1fr 1fr 1fr 1fr;
        gap: 1rem;
    }
}

/* Responsive adjustments for medium screens */
@media (min-width: 768px) and (max-width: 1023px) {
    .library-item {
        padding: 0.75rem;
    }
}

.library-item {
    padding: 0.75rem;
    background: white;
    border-radius: 6px;
    border: 1px solid #dee2e6;
    display: flex;
    flex-direction: column;
    height: fit-content;
    position: relative;
}


.library-content-spoiler {
    margin-top: auto;
    font-size: 0.75rem;
}

.library-content-spoiler[data-expanded="true"] .spoiler-content {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: white;
    border: 1px solid #dee2e6;
    border-radius: 6px;
    padding: 0.75rem;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    z-index: 10;
    margin-top: 0.25rem;
}

.library-description {
    margin: 0 0 0.75rem 0;
    color: #6c757d;
    font-size: 0.75rem;
}

.library-warning {
    color: #dc3545;
    font-weight: 600;
}

.library-example {
    font-size: 0.7rem;
}

.library-example code {
    background: #f8f9fa;
    padding: 0.25rem 0.5rem;
    border-radius: 3px;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    word-break: break-all;
    display: inline-block;
    margin-top: 0.25rem;
}

/* Enhanced library examples with spoilers */
.library-examples-spoiler {
    margin-top: 0.75rem;
}

.library-examples {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.library-example {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.example-label {
    font-weight: 500;
    color: #495057;
    font-size: 0.9rem;
}

.library-example code.example-url-link {
    cursor: pointer;
    text-decoration: underline;
}

.form-group {
    margin-bottom: 1.5rem;
}

label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 600;
    color: #495057;
}

.manuscript-input {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #ced4da;
    border-radius: 4px;
    font-size: 1rem;
    transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
}

.manuscript-input:focus {
    outline: none;
    border-color: #80bdff;
    box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
}

.help-text {
    display: block;
    margin-top: 0.25rem;
    color: #6c757d;
    font-size: 0.875rem;
}

.load-btn {
    width: 100%;
    background-color: #007bff;
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
    background-color: #6c757d;
    cursor: not-allowed;
    opacity: 0.6;
}

/* Button styles for modal triggers */
.info-buttons-row {
    margin-bottom: 0.5rem;
    display: flex;
    justify-content: center;
    gap: 1rem;
    flex-wrap: wrap;
}

.info-btn,
.add-more-btn,
.negative-converter-btn {
    background-color: #007bff;
    color: white;
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 6px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    white-space: nowrap;
    flex-shrink: 0;
}

.btn-icon {
    background-color: rgba(255, 255, 255, 0.2);
    color: white;
    border-radius: 50%;
    width: 1.5rem;
    height: 1.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.9rem;
    font-weight: bold;
    margin-right: 0.75rem;
    flex-shrink: 0;
}

.info-btn:hover,
.add-more-btn:hover,
.negative-converter-btn:hover {
    background-color: #0056b3;
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(0, 123, 255, 0.2);
}

.info-btn:hover .btn-icon,
.add-more-btn:hover .btn-icon,
.negative-converter-btn:hover .btn-icon {
    background-color: rgba(255, 255, 255, 0.3);
}

.info-btn:active,
.add-more-btn:active,
.negative-converter-btn:active {
    transform: translateY(0);
}

.negative-converter-btn {
    background-color: #6c757d !important;
}

.negative-converter-btn:hover {
    background-color: #545b62 !important;
}

.error-message {
    color: #dc3545;
    font-size: 0.85em;
    margin-top: 5px;
}

/* Queue Settings Spoiler */
.settings-spoiler {
    margin: 1.5rem 0;
}

.settings-content {
    padding: 1rem 0;
}

.setting-group {
    margin-bottom: 1.5rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid #e9ecef;
}

.setting-group:last-child {
    border-bottom: none;
    margin-bottom: 0;
}

.setting-checkbox {
    display: flex;
    align-items: flex-start;
    cursor: pointer;
    margin-bottom: 0.5rem;
}

.setting-checkbox input[type="checkbox"] {
    margin-right: 0.75rem;
    margin-top: 0.125rem;
    cursor: pointer;
}

.checkbox-label {
    font-weight: 500;
    color: #495057;
}

.setting-label {
    display: block;
    font-weight: 500;
    color: #495057;
    margin-bottom: 0.5rem;
}

.setting-range {
    width: 100%;
    margin-bottom: 0.5rem;
}

.range-labels {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    color: #6c757d;
}

.setting-description {
    font-size: 13px;
    color: #6c757d;
    margin: 0.5rem 0 0 0;
    line-height: 1.4;
}

.apply-settings-btn {
    background: #007bff;
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 500;
    transition: background-color 0.2s;
    width: 100%;
}

.apply-settings-btn:hover:not(:disabled) {
    background: #0056b3;
}

.apply-settings-btn:disabled {
    background: #adb5bd;
    cursor: not-allowed;
    opacity: 0.6;
}

/* Libraries Modal */
.libraries-modal-content {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
}

.libraries-intro {
    margin: 0;
    color: #495057;
    font-size: 0.9rem;
    line-height: 1.4;
    font-style: italic;
}

.library-search {
    position: relative;
    margin: 1rem 0;
}

.search-input {
    width: 100%;
    padding: 0.75rem 2.5rem 0.75rem 1rem;
    border: 1px solid #dee2e6;
    border-radius: 8px;
    font-size: 0.9rem;
    background: white;
    color: #495057;
    transition: all 0.2s ease;
}

.search-input:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.search-input::placeholder {
    color: #6c757d;
}

.search-icon {
    position: absolute;
    right: 1rem;
    top: 50%;
    transform: translateY(-50%);
    color: #6c757d;
    pointer-events: none;
}

.libraries-scroll-container {
    flex: 1;
    overflow-y: auto;
    min-height: 0;
    padding-right: 4px; /* Space for scrollbar */
    margin-right: -4px;
}

/* Add All Test Section */
.add-all-test-section {
    margin-top: 2rem;
    text-align: center;
    border-top: 1px solid #dee2e6;
    padding-top: 1.5rem;
    flex-shrink: 0;
}

.add-all-test-btn {
    background: linear-gradient(135deg, #17a2b8 0%, #138496 100%);
    color: white;
    border: none;
    padding: 0.75rem 2rem;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 600;
    font-size: 1rem;
    transition: all 0.2s ease;
    box-shadow: 0 2px 8px rgba(23, 162, 184, 0.2);
}

.add-all-test-btn:hover:not(:disabled) {
    background: linear-gradient(135deg, #138496 0%, #117a8b 100%);
    box-shadow: 0 3px 12px rgba(23, 162, 184, 0.25);
    transform: translateY(-1px);
}

.add-all-test-btn:disabled {
    background: #adb5bd;
    cursor: not-allowed;
    opacity: 0.6;
    box-shadow: none;
    transform: none;
}

.add-all-test-description {
    margin-top: 0.5rem;
    font-size: 0.85rem;
    color: #6c757d;
}

/* Mobile responsiveness for buttons - only wrap on very narrow screens */
@media (max-width: 520px) {
    .info-buttons-row {
        flex-direction: column;
        align-items: center;
        gap: 0.75rem;
    }
    
    .info-btn,
    .add-more-btn,
    .negative-converter-btn {
        width: 100%;
        font-size: min(1rem, 3.2vw);
    }
}

/* Patron Saint Styles */
.patron-saint {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1.5rem;
    background: var(--card-background, #f8f9fa);
    border-radius: 8px;
    border: 2px solid var(--border-color, #ddd);
    margin-bottom: 1rem;
}

.patron-image {
    width: 80px;
    height: 100px;
    object-fit: cover;
    border-radius: 6px;
    border: 2px solid var(--accent-color, #007bff);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    flex-shrink: 0;
}

.patron-text {
    flex: 1;
}

.patron-text h3 {
    margin: 0 0 0.5rem 0;
    color: var(--text-color, #333);
    font-size: 1.25rem;
    font-weight: 600;
}

.patron-text p {
    margin: 0.25rem 0;
    color: var(--text-secondary, #666);
    line-height: 1.4;
}

.patron-text p:first-of-type {
    font-style: italic;
    font-size: 0.9rem;
    color: var(--accent-color, #007bff);
}

@media (max-width: 768px) {
    .patron-saint {
        flex-direction: column;
        text-align: center;
        gap: 1rem;
    }
    
    .patron-image {
        width: 60px;
        height: 75px;
    }
}


/* Prevent text wrapping in buttons with icon + text combinations */
button {
    white-space: nowrap;
}


</style>
