<template>
  <Modal
    v-if="isVisible"
    title="📊 Export Logs"
    :show="isVisible"
    :close-on-overlay="true"
    width="500px"
    @close="$emit('close')"
  >
    <div class="log-export">
      <div class="export-info">
        <p class="info-text">
          Export detailed logs to help diagnose issues. These logs contain all download attempts, 
          errors, network requests, and system information.
        </p>
      </div>

      <div class="export-options">
        <h3>Export Options</h3>
        
        <div class="option-group">
          <label class="option-label">
            <span class="option-title">Format</span>
            <select 
              v-model="exportOptions.format" 
              class="option-select"
            >
              <option value="json">JSON (Machine Readable)</option>
              <option value="readable">Text (Human Readable)</option>
            </select>
          </label>
          <p class="option-description">
            {{ exportOptions.format === 'json' 
              ? 'Structured JSON format for automated analysis and GitHub issue attachments' 
              : 'Easy-to-read text format for manual review' }}
          </p>
        </div>

        <div class="option-group">
          <label class="option-label">
            <input 
              v-model="exportOptions.includeDebug"
              type="checkbox" 
              class="option-checkbox"
            >
            <span>Include Debug Logs</span>
          </label>
          <p class="option-description">
            Include detailed debug information (may result in larger file size)
          </p>
        </div>

        <div class="option-group">
          <label class="option-label">
            <input 
              v-model="exportOptions.compress"
              type="checkbox" 
              class="option-checkbox"
            >
            <span>Compress File (.gz)</span>
          </label>
          <p class="option-description">
            Compress the log file to reduce size for easier sharing
          </p>
        </div>
      </div>

      <div 
        v-if="exportStatus" 
        class="export-status" 
        :class="exportStatus.type"
      >
        <span class="status-icon">{{ exportStatus.type === 'success' ? '✅' : '❌' }}</span>
        <span class="status-message">{{ exportStatus.message }}</span>
      </div>

      <div class="action-buttons">
        <button 
          class="export-btn" 
          :disabled="isExporting"
          @click="exportLogs"
        >
          <span v-if="!isExporting">💾 Export Logs</span>
          <span v-else>⏳ Exporting...</span>
        </button>
        
        <button 
          v-if="exportedFilePath"
          class="show-file-btn"
          @click="showInFinder"
        >
          📁 Show in Folder
        </button>
      </div>

      <div class="privacy-notice">
        <p class="notice-text">
          <strong>Privacy Notice:</strong> Logs may contain URLs and file paths but no personal 
          authentication data. Review the exported file before sharing.
        </p>
      </div>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import Modal from './Modal.vue'

// Props
defineProps<{
  isVisible: boolean
}>()

// Emits
const _UNUSED_emit = defineEmits<{
  close: []
}>()

// Export options
const exportOptions = reactive({
  format: 'readable' as 'json' | 'readable',
  includeDebug: false,
  compress: true
})

// Export state
const isExporting = ref(false)
const exportedFilePath = ref<string | null>(null)
const exportStatus = ref<{ type: 'success' | 'error', message: string } | null>(null)

// Export logs function
async function exportLogs() {
  isExporting.value = true
  exportStatus.value = null
  exportedFilePath.value = null

  try {
    const filePath = await window.electronAPI.exportLogs({
      format: exportOptions.format,
      includeDebug: exportOptions.includeDebug,
      compress: exportOptions.compress
    })
    
    exportedFilePath.value = filePath
    exportStatus.value = {
      type: 'success',
      message: `Logs exported successfully to ${filePath.split('/').pop()}`
    }
  } catch (error: unknown) {
    console.error('Failed to export logs:', error)
    exportStatus.value = {
      type: 'error',
      message: `Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  } finally {
    isExporting.value = false
  }
}

// Show exported file in finder/explorer
async function showInFinder() {
  if (exportedFilePath.value) {
    try {
      await window.electronAPI.showItemInFinder(exportedFilePath.value)
    } catch (error) {
      console.error('Failed to show file in finder:', error)
    }
  }
}
</script>

<style scoped>
.log-export {
  padding: 20px;
}

.export-info {
  margin-bottom: 25px;
  padding: 15px;
  background: #f5f5f5;
  border-radius: 8px;
}

.info-text {
  margin: 0;
  color: #555;
  line-height: 1.5;
}

.export-options {
  margin-bottom: 25px;
}

.export-options h3 {
  margin: 0 0 15px 0;
  font-size: 18px;
  color: #333;
}

.option-group {
  margin-bottom: 20px;
  padding: 15px;
  background: #fafafa;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
}

.option-label {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 500;
  color: #333;
  cursor: pointer;
}

.option-title {
  min-width: 60px;
}

.option-select {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  font-size: 14px;
}

.option-checkbox {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.option-description {
  margin: 8px 0 0 0;
  font-size: 13px;
  color: #666;
  line-height: 1.4;
}

.export-status {
  margin-bottom: 20px;
  padding: 12px 15px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.export-status.success {
  background: #e8f5e9;
  border: 1px solid #4caf50;
}

.export-status.error {
  background: #ffebee;
  border: 1px solid #f44336;
}

.status-icon {
  font-size: 18px;
}

.status-message {
  flex: 1;
  font-size: 14px;
}

.export-status.success .status-message {
  color: #2e7d32;
}

.export-status.error .status-message {
  color: #c62828;
}

.action-buttons {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.export-btn,
.show-file-btn {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.export-btn {
  background: #2196f3;
  color: white;
}

.export-btn:hover:not(:disabled) {
  background: #1976d2;
}

.export-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.show-file-btn {
  background: #f5f5f5;
  color: #333;
  border: 1px solid #ddd;
}

.show-file-btn:hover {
  background: #e8e8e8;
}

.privacy-notice {
  padding: 12px 15px;
  background: #fff3cd;
  border: 1px solid #ffeaa7;
  border-radius: 6px;
}

.notice-text {
  margin: 0;
  font-size: 13px;
  color: #856404;
  line-height: 1.5;
}
</style>