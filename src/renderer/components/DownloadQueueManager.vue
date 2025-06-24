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
                min="30"
                max="1000"
                step="10"
                class="setting-range"
                @input="onAutoSplitThresholdChange"
              >
              <div class="range-labels">
                <span>30MB</span>
                <span>1000MB</span>
              </div>
            </div>

            <div class="setting-group">
              <label class="setting-label">
                Concurrent downloads: {{ queueSettings.maxConcurrentDownloads }}
              </label>
              <input
                v-model="queueSettings.maxConcurrentDownloads"
                type="range"
                min="1"
                max="8"
                step="1"
                class="setting-range"
                @input="updateQueueSettings"
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
                min="30"
                max="1000"
                step="10"
                class="setting-range"
                @input="onAutoSplitThresholdChange"
              >
              <div class="range-labels">
                <span>30MB</span>
                <span>1000MB</span>
              </div>
            </div>

            <div class="setting-group">
              <label class="setting-label">
                Concurrent downloads: {{ queueSettings.maxConcurrentDownloads }}
              </label>
              <input
                v-model="queueSettings.maxConcurrentDownloads"
                type="range"
                min="1"
                max="8"
                step="1"
                class="setting-range"
                @input="updateQueueSettings"
              >
              <div class="range-labels">
                <span>1</span>
                <span>8</span>
              </div>
            </div>

            <div class="setting-group">
              <label class="setting-label">
                Download Mode: {{ queueState.globalSettings.simultaneousMode === 'sequential' ? 'Sequential' : queueState.globalSettings.simultaneousMode === 'all' ? 'All Simultaneous' : `Max ${queueState.globalSettings.maxSimultaneousDownloads} Simultaneous` }}
              </label>
              <p class="setting-description">
                Sequential downloads one at a time. Simultaneous downloads multiple manuscripts at once for faster completion.
              </p>
              <div class="mode-controls">
                <select 
                  :value="queueState.globalSettings.simultaneousMode"
                  class="mode-select"
                  @change="handleModeChange($event)"
                >
                  <option value="sequential">
                    Sequential (One at a time)
                  </option>
                  <option value="all">
                    All Simultaneous
                  </option>
                  <option value="custom">
                    Custom Limit
                  </option>
                </select>
                <div 
                  v-if="queueState.globalSettings.simultaneousMode === 'custom'"
                  class="max-simultaneous-control"
                >
                  <label>Max: {{ queueState.globalSettings.maxSimultaneousDownloads }}</label>
                  <input
                    :value="queueState.globalSettings.maxSimultaneousDownloads"
                    type="range"
                    min="1"
                    max="10"
                    step="1"
                    class="setting-range"
                    @input="handleMaxSimultaneousChange($event)"
                  >
                  <div class="range-labels">
                    <span>1</span>
                    <span>10</span>
                  </div>
                </div>
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
            v-if="!isQueueProcessing && !isQueuePaused && queueState.globalSettings.simultaneousMode === 'sequential'"
            class="start-btn"
            :disabled="isProcessingUrls || !hasReadyItems || queueStats.loading > 0"
            data-testid="start-queue"
            @click="startQueue"
          >
            <template v-if="queueStats.loading > 0">
              Loading Manifests...
            </template>
            <template v-else>
              {{ shouldShowResume ? 'Resume Queue' : 'Start Queue' }}
            </template>
          </button>

          <!-- Simultaneous Mode Start Buttons -->
          <button
            v-if="!isQueueProcessing && !isQueuePaused && queueState.globalSettings.simultaneousMode !== 'sequential'"
            class="start-all-btn"
            :disabled="isProcessingUrls || !hasReadyItems || queueStats.loading > 0"
            data-testid="start-all-simultaneous"
            @click="startAllSimultaneous"
          >
            <template v-if="queueStats.loading > 0">
              Loading Manifests...
            </template>
            <template v-else>
              {{ queueState.globalSettings.simultaneousMode === 'all' ? 'Start All Simultaneous' : `Start All (Max ${queueState.globalSettings.maxSimultaneousDownloads})` }}
            </template>
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
            <template v-if="queueStats.loading > 0">
              Loading Manifests...
            </template>
            <template v-else>
              Start Queue
            </template>
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
                      @click.prevent="openInBrowser(group.parent.url)"
                    >
                      {{ group.parent.url }}
                    </a>
                  </strong>
                  <strong v-else>
                    <a
                      v-if="group.parent.status !== 'loading' && group.parent.url"
                      class="manuscript-title-link"
                      style="cursor: pointer;"
                      @click.prevent="openInBrowser(group.parent.url)"
                    >
                      {{ group.parent.displayName }}
                    </a>
                    <span v-else>{{ group.parent.displayName }}</span>
                    <span
                      v-if="group.parts.length > 0"
                      class="part-count-badge"
                    >
                      ({{ group.parts.length }} parts)
                    </span>
                  </strong>
                  <div class="queue-item-meta">
                    <span
                      class="status-badge"
                      :class="`status-${getGroupStatus(group)}`"
                    >{{ getGroupStatusText(group) }}</span>
                    <span
                      v-if="group.parent.status !== 'failed'"
                      class="total-pages-badge"
                    >
                      {{ getTotalPagesText(group) }}
                    </span>
                    <span
                      v-if="group.parent.status !== 'failed'"
                      class="concurrency-badge"
                    >
                      Concurrency: {{ group.parent.downloadOptions?.concurrentDownloads || 3 }}
                    </span>
                    <span
                      v-if="group.parent.libraryOptimizations?.optimizationDescription"
                      class="optimization-badge"
                      :title="group.parent.libraryOptimizations.optimizationDescription"
                    >
                      ⚡ Optimized
                    </span>
                  </div>
                </div>
                <div class="queue-item-controls">
                  <button
                    v-if="editingQueueItemId !== group.parent.id && getParentIndex(group.parent) > 0 && !hasActiveDownloads"
                    class="move-up-btn"
                    title="Move up in queue"
                    @click="moveQueueItemUp(group.parent)"
                  >
                    ↑
                  </button>
                  <button
                    v-if="editingQueueItemId !== group.parent.id && getParentIndex(group.parent) < groupedQueueItems.length - 1 && !hasActiveDownloads"
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
                    v-if="editingQueueItemId !== group.parent.id"
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
                    v-if="canStartIndividualGroup(group)"
                    class="start-individual-btn"
                    title="Start this download individually"
                    data-testid="start-individual-button"
                    @click="startIndividualGroup(group)"
                  >
                    Start
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

              <!-- Auto-split parts (collapsible) -->
              <div 
                v-if="group.parts.length > 0 && isPartsExpanded(group.parent.id)"
                class="auto-parts-list"
              >
                <div
                  v-for="part in group.parts"
                  :key="part.id"
                  class="queue-item part-item"
                  :class="[`status-${part.status}`, { 'loading-manifest': part.status === 'loading' }]"
                  data-testid="queue-part"
                >
                  <div class="queue-item-header">
                    <div class="queue-item-info">
                      <strong>
                        {{ part.displayName }}
                      </strong>
                      <div class="queue-item-meta">
                        <span
                          class="status-badge"
                          :class="`status-${part.status}`"
                        >{{ getStatusText(part.status) }}</span>
                        <span
                          v-if="part.status !== 'failed'"
                          class="total-pages-badge"
                        >
                          Pages {{ part.partInfo?.pageRange.start }}–{{ part.partInfo?.pageRange.end }}
                        </span>
                      </div>
                    </div>
                    <div class="queue-item-controls">
                      <button
                        v-if="part.status === 'downloading'"
                        class="pause-item-btn"
                        title="Pause this part"
                        @click="pauseQueueItem(part.id)"
                      >
                        Pause
                      </button>
                      <button
                        v-if="part.status === 'paused'"
                        class="resume-item-btn"
                        title="Resume this part"
                        @click="resumeQueueItem(part.id)"
                      >
                        Resume
                      </button>
                      <button
                        v-if="part.status === 'completed' || part.status === 'failed'"
                        class="restart-item-btn"
                        title="Restart this part"
                        @click="restartQueueItem(part.id)"
                      >
                        Restart
                      </button>
                      <button
                        v-if="(part.status === 'completed' || part.status === 'failed') && part.outputPath"
                        class="show-finder-btn"
                        :title="getShowInFinderText()"
                        @click="showItemInFinder(part.outputPath)"
                      >
                        {{ getShowInFinderText() }}
                      </button>
                      <button
                        class="remove-btn"
                        title="Remove this part"
                        @click="removeQueueItem(part.id)"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  <!-- Progress bar for individual parts -->
                  <div
                    v-if="part.status === 'downloading' || (part.status === 'paused' && part.progress)"
                    :key="`progress-${part.id}-${part.progress?.current || 0}`"
                    class="item-progress"
                  >
                    <div class="item-progress-header">
                      <span class="item-progress-label">
                        {{ part.status === 'downloading' ? 'Part Progress' : 'Part Paused' }}
                      </span>
                      <span class="item-progress-stats">
                        <template v-if="part.progress">
                          <template v-if="part.progress.stage === 'loading-manifest'">
                            Loading manifest: {{ part.progress.current }}/{{ part.progress.total }} pages ({{ part.progress.percentage }}%)
                          </template>
                          <template v-else>
                            {{ part.status === 'downloading'
                              ? `Downloading ${part.progress.current} of ${part.progress.total}`
                              : `Paused at ${part.progress.current} of ${part.progress.total}`
                            }} ({{ part.progress.percentage }}%)
                          </template>
                        </template>
                        <template v-else>
                          Initializing...
                        </template>
                      </span>
                    </div>
                    <div class="item-progress-bar">
                      <div 
                        class="item-progress-fill"
                        :style="{ width: `${part.progress?.percentage || 0}%` }"
                      />
                    </div>
                    <div
                      v-if="part.progress?.eta"
                      class="item-progress-eta"
                    >
                      Estimated Time: {{ part.progress.eta }}
                    </div>
                  </div>
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
                        
              <!-- Overall progress bar for group -->
              <div
                v-if="shouldShowGroupProgress(group)"
                :key="`progress-${group.parent.id}-${getGroupProgress(group)?.current || 0}`"
                class="item-progress group-progress"
              >
                <div class="item-progress-header">
                  <span class="item-progress-label">
                    {{ getGroupProgressLabel(group) }}
                  </span>
                  <span class="item-progress-stats">
                    {{ getGroupProgressStats(group) }}
                  </span>
                </div>
                <div class="item-progress-bar">
                  <div 
                    class="item-progress-fill"
                    :style="{ width: `${getGroupProgress(group)?.percentage || 0}%` }"
                  />
                </div>
                <div
                  v-if="getGroupProgress(group)?.eta"
                  class="item-progress-eta"
                >
                  Estimated Time: {{ getGroupProgress(group).eta }}
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


  <!-- Supported Libraries Modal -->
  <Modal
    :show="showSupportedLibrariesModal"
    title="Supported Manuscript Libraries"
    type="alert"
    width="min(1200px, 95vw)"
    @close="showSupportedLibrariesModal = false"
  >
    <template #headerContent>
      <p class="libraries-intro">
        Enter a URL from one of the following supported digital libraries to download a manuscript:
      </p>
    </template>

    <div class="libraries-modal-content">
      <div class="libraries-scroll-container">
        <div class="libraries-list">
          <div
            v-for="library in supportedLibraries"
            :key="library.name"
            class="library-item"
          >
            <Spoiler
              :title="library.name"
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
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watchEffect, onMounted } from 'vue';
import type { QueuedManuscript, QueueState, TStatus, TLibrary, TSimultaneousMode } from '../../shared/queueTypes';
import type { LibraryInfo, ManuscriptManifest } from '../../shared/types';
import Modal from './Modal.vue';
import Spoiler from './Spoiler.vue';
import abbaAbabusImage from '../../../assets/abba-ababus.jpg';

// Declare window.electronAPI type
declare global {
  interface Window {
    electronAPI: {
      getLanguage: () => Promise<string>;
      downloadManuscript: (url: string, callbacks: any) => Promise<void>; // Simplified for now
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
      onQueueStateChanged: (callback: (state: QueueState) => void) => () => void;
      cleanupIndexedDBCache: () => Promise<void>;
      showItemInFinder: (filePath: string) => Promise<boolean>;
      
      // Simultaneous download methods
      startAllSimultaneous: () => Promise<void>;
      startItemIndividually: (id: string) => Promise<void>;
      setSimultaneousMode: (mode: string, maxCount?: number) => Promise<void>;
      getSimultaneousState: () => Promise<{
        simultaneousMode: string;
        maxSimultaneousDownloads: number;
        activeDownloads: number;
      }>;
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
        autoSplitThresholdMB: 800,
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
    type: 'info',
});


// Supported Libraries - fetched via IPC
const supportedLibraries = ref<LibraryInfo[]>([]);

// Libraries are now fetched dynamically from the main process

// Queue settings
const queueSettings = ref({
    autoSplitThresholdMB: 800,
    maxConcurrentDownloads: 3
});

// Debounced threshold update
let debounceTimer: NodeJS.Timeout | null = null;

// Watch for queue state changes to sync settings
watchEffect(() => {
    if (queueState.value?.globalSettings) {
        queueSettings.value.autoSplitThresholdMB = queueState.value.globalSettings.autoSplitThresholdMB;
        queueSettings.value.maxConcurrentDownloads = queueState.value.globalSettings.concurrentDownloads;
    }
});

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
    const orphanedParts: QueuedManuscript[] = [];
    
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
    
    // Find orphaned parts (parts without parent items)
    partsMap.forEach((parts, parentId) => {
        const hasParent = parentItems.some(parent => parent.id === parentId);
        if (!hasParent) {
            orphanedParts.push(...parts);
            partsMap.delete(parentId);
        }
    });
    
    // Sort parts by part number for each parent
    partsMap.forEach(parts => {
        parts.sort((a, b) => (a.partInfo?.partNumber || 0) - (b.partInfo?.partNumber || 0));
    });
    
    // Create groups for parent items with their parts
    const groups = parentItems.map(parent => ({
        parent,
        parts: partsMap.get(parent.id) || []
    }));
    
    // Add orphaned parts as individual groups (treating them as parent items)
    orphanedParts.forEach(orphan => {
        groups.push({
            parent: orphan,
            parts: []
        });
    });
    
    return groups;
});

// Expanded parts state
const expandedParts = ref<Set<string>>(new Set());

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
    
    return 'pending';
}

function getGroupStatusText(group: { parent: QueuedManuscript; parts: QueuedManuscript[] }): string {
    return getStatusText(getGroupStatus(group));
}

function getTotalPagesText(group: { parent: QueuedManuscript; parts: QueuedManuscript[] }): string {
    if (group.parts.length === 0) {
        const item = group.parent;
        
        // Show loading message for items that are still loading manifests
        if (item.status === 'loading' || item.totalPages === 0) {
            return 'Loading manifest...';
        }
        
        if (item.downloadOptions && (item.downloadOptions.startPage !== 1 || item.downloadOptions.endPage !== item.totalPages)) {
            return `Pages ${item.downloadOptions.startPage || 1}–${item.downloadOptions.endPage || item.totalPages} (${(item.downloadOptions.endPage || item.totalPages) - (item.downloadOptions.startPage || 1) + 1} of ${item.totalPages})`;
        } else {
            return `All ${item.totalPages} Pages`;
        }
    } else {
        const totalParts = group.parts.length;
        const completedParts = group.parts.filter(p => p.status === 'completed').length;
        return `${completedParts}/${totalParts} parts completed`;
    }
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

// Individual start functionality for simultaneous mode
function canStartIndividualGroup(group: { parent: QueuedManuscript; parts: QueuedManuscript[] }): boolean {
    // Only show start button in simultaneous modes
    if (queueState.value.globalSettings.simultaneousMode === 'sequential') {
        return false;
    }
    
    // Check if group can be started (has pending items)
    if (group.parts.length === 0) {
        return group.parent.status === 'pending' || group.parent.status === 'paused';
    }
    return group.parts.some(part => part.status === 'pending' || part.status === 'paused');
}

async function startIndividualGroup(group: { parent: QueuedManuscript; parts: QueuedManuscript[] }) {
    if (group.parts.length === 0) {
        await startItemIndividually(group.parent.id);
    } else {
        // Start all pending/paused parts in the group
        for (const part of group.parts) {
            if (part.status === 'pending' || part.status === 'paused') {
                await startItemIndividually(part.id);
            }
        }
    }
}

// Progress calculation functions
function shouldShowGroupProgress(group: { parent: QueuedManuscript; parts: QueuedManuscript[] }): boolean {
    if (group.parts.length === 0) {
        const result = group.parent.status === 'downloading' || 
               (group.parent.status === 'paused' && group.parent.progress) ||
               (group.parent.status === 'loading' && group.parent.progress && group.parent.progress.stage === 'loading-manifest');
        
        // Debug logging for Orleans loading
        if (group.parent.status === 'loading' || group.parent.url?.includes('orleans')) {
            console.log('shouldShowGroupProgress debug:', {
                status: group.parent.status,
                hasProgress: !!group.parent.progress,
                progressStage: group.parent.progress?.stage,
                progressData: group.parent.progress,
                result,
                url: group.parent.url
            });
        }
        
        return result;
    }
    return group.parts.some(part => part.status === 'downloading' || (part.status === 'paused' && part.progress));
}

function getGroupProgress(group: { parent: QueuedManuscript; parts: QueuedManuscript[] }) {
    if (group.parts.length === 0) {
        return group.parent.progress;
    }
    
    // Calculate combined progress from all parts
    const partsWithProgress = group.parts.filter(part => part.progress);
    if (partsWithProgress.length === 0) return null;
    
    const totalPages = group.parts.reduce((sum, part) => sum + (part.progress?.total || 0), 0);
    const currentPages = group.parts.reduce((sum, part) => sum + (part.progress?.current || 0), 0);
    const percentage = totalPages > 0 ? Math.round((currentPages / totalPages) * 100) : 0;
    
    // Estimate ETA from active downloading parts
    const downloadingParts = group.parts.filter(part => part.status === 'downloading' && part.progress?.eta);
    const eta = downloadingParts.length > 0 ? downloadingParts[0].progress?.eta : undefined;
    
    return {
        current: currentPages,
        total: totalPages,
        percentage,
        eta: eta || 'calculating...',
        stage: 'downloading' as TStage
    };
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
    if (!window.electronAPI) {
        console.error('electronAPI is not available! Preload script may not have loaded.');
        return;
    }
    
    // Fetch initial state
    const initialState = await window.electronAPI.getQueueState();
    queueState.value = { ...initialState };
    
    // Subscribe to queue updates
    window.electronAPI.onQueueStateChanged((state: QueueState) => {
        // Debug logging for Orleans progress data
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
});

function parseUrls(text: string): string[] {
    return text
        .split(/[\s,;]+/)
        .map((url) => url.trim())
        .filter((url) => url.length > 0);
}

async function parseManuscriptWithCaptcha(url: string) {
    try {
        return await window.electronAPI.parseManuscriptUrl(url);
    } catch (error: any) {
        console.log('parseManuscriptWithCaptcha caught error:', error.message);
        
        
        // Check if this is a captcha error (may be wrapped in IPC error)
        if (error.message?.includes('CAPTCHA_REQUIRED:')) {
            // Extract the captcha URL from the potentially wrapped error message
            const captchaMatch = error.message.match(/CAPTCHA_REQUIRED:(.+?)(?:\s|$)/);
            const captchaUrl = captchaMatch ? captchaMatch[1] : error.message.split('CAPTCHA_REQUIRED:')[1];
            
            console.log('Captcha required for:', url);
            console.log('Captcha URL:', captchaUrl);
            
            const captchaResult = await window.electronAPI.solveCaptcha(captchaUrl);
            
            if (captchaResult.success && captchaResult.content) {
                // For libraries that return manifest directly after captcha
                const iiifManifest = JSON.parse(captchaResult.content);
                
                const pageLinks = iiifManifest.sequences[0].canvases.map((canvas: any) => {
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
    // Clear previous error message
    errorMessage.value = '';
    
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
            } catch (error: any) {
                console.log('[RENDERER] Error caught in processBulkUrls:', error);
                console.log('[RENDERER] Error message:', error.message);
                console.log('[RENDERER] Error type:', typeof error);
                
                // Handle all errors (captcha handled in parseManuscriptWithCaptcha)
                const isExpectedError = error.message?.includes('not valid JSON') ||
                    error.message?.includes('404') ||
                    error.message?.includes('Manuscript not found') ||
                    error.message?.includes('CORS') ||
                    error.message?.includes('Invalid manifest structure') ||
                    error.message?.includes('Captcha verification failed');
            
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

// Simultaneous download functions
async function startAllSimultaneous() {
    await window.electronAPI.startAllSimultaneous();
    hasUserStartedQueue.value = true;
}

async function startItemIndividually(id: string) {
    await window.electronAPI.startItemIndividually(id);
}

async function setSimultaneousMode(mode: TSimultaneousMode, maxCount?: number) {
    await window.electronAPI.setSimultaneousMode(mode, maxCount);
    // Update local state
    queueState.value.globalSettings.simultaneousMode = mode;
    if (maxCount !== undefined) {
        queueState.value.globalSettings.maxSimultaneousDownloads = maxCount;
    }
}

// UI event handlers for simultaneous mode controls
async function handleModeChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    const mode = target.value as TSimultaneousMode;
    await setSimultaneousMode(mode);
}

async function handleMaxSimultaneousChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const maxCount = parseInt(target.value);
    await setSimultaneousMode('custom', maxCount);
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
    } catch (error: any) {
        showAlert('Error', `Failed to show file: ${error.message}`);
    }
}

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
    try {
        await window.electronAPI.openExternal(url);
    } catch (error) {
        console.error('Failed to open URL in browser:', error);
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
    } catch (error: any) {
        console.error('Failed to cleanup IndexedDB cache:', error);
        showAlert('Error', `Failed to clean up cache: ${error.message}`);
    }
}

async function revealDownloadsFolder() {
    await performButtonAction('revealFolder', async () => {
        try {
            const folderPath = await window.electronAPI.openDownloadsFolder();
        } catch (error: any) {
            console.error('Failed to open downloads folder:', error);
            showAlert('Error', `Failed to open downloads folder: ${error.message}`);
            throw error; // Re-throw to prevent showing success state
        }
    });
}

// Queue settings management
function updateQueueSettings() {
    // Settings are updated in real-time via the reactive refs
}

// Debounced auto-split threshold update
function onAutoSplitThresholdChange() {
    if (debounceTimer) {
        clearTimeout(debounceTimer);
    }
    
    debounceTimer = setTimeout(async () => {
        try {
            await window.electronAPI.updateAutoSplitThreshold(queueSettings.value.autoSplitThresholdMB);
        } catch (error) {
            console.error('Failed to update auto-split threshold:', error);
        }
    }, 2000); // 2 second debounce
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
    opacity: 0.7;
}

.queue-item.status-failed {
    opacity: 0.8;
}

.loading-manifests {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #6c757d;
    font-size: 0.9em;
    margin-bottom: 10px;
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
    border-bottom: 1px dotted #dc3545;
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

.total-pages-badge {
    background: #e9ecef;
    color: #495057;
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
@media (min-width: 1200px) {
    .libraries-list {
        grid-template-columns: 1fr 1fr 1fr;
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
.add-more-btn {
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
.add-more-btn:hover {
    background-color: #0056b3;
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(0, 123, 255, 0.2);
}

.info-btn:hover .btn-icon,
.add-more-btn:hover .btn-icon {
    background-color: rgba(255, 255, 255, 0.3);
}

.info-btn:active,
.add-more-btn:active {
    transform: translateY(0);
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
    .add-more-btn {
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

/* Simultaneous Download Controls */
.mode-controls {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 8px;
}

.mode-select {
    padding: 8px 12px;
    border: 1px solid #dee2e6;
    border-radius: 4px;
    background: white;
    font-size: 0.9em;
    color: #495057;
}

.mode-select:focus {
    outline: none;
    border-color: #007bff;
    box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.max-simultaneous-control {
    display: flex;
    flex-direction: column;
    gap: 5px;
    padding: 10px;
    background: #f8f9fa;
    border: 1px solid #dee2e6;
    border-radius: 4px;
}

.max-simultaneous-control label {
    font-size: 0.85em;
    color: #6c757d;
    font-weight: 500;
}

/* Start All Button */
.start-all-btn {
    background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
    color: white;
    border: none;
    border-radius: 8px;
    padding: 12px 20px;
    font-weight: 600;
    font-size: 0.9em;
    cursor: pointer;
    transition: all 0.3s ease;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    box-shadow: 0 2px 4px rgba(40, 167, 69, 0.3);
}

.start-all-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(40, 167, 69, 0.4);
    background: linear-gradient(135deg, #218838 0%, #1e9a85 100%);
}

.start-all-btn:disabled {
    background: #adb5bd;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
    opacity: 0.6;
}

/* Individual Start Button */
.start-individual-btn {
    background: linear-gradient(135deg, #007bff 0%, #0056b3 100%);
    color: white;
    border: none;
    border-radius: 4px;
    padding: 6px 12px;
    font-size: 0.8em;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    box-shadow: 0 1px 3px rgba(0, 123, 255, 0.3);
}

.start-individual-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 6px rgba(0, 123, 255, 0.4);
    background: linear-gradient(135deg, #0056b3 0%, #004085 100%);
}

.start-individual-btn:disabled {
    background: #adb5bd;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
    opacity: 0.6;
}

</style>