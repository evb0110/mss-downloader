<template>
  <Modal
    v-if="isVisible"
    title="📸 Negative to Positive Converter"
    :show="isVisible"
    :closeOnOverlay="false"
    width="auto"
    @close="handleClose"
  >
    <div class="negative-converter">
      <div v-if="!selectedFile" class="upload-zone">
        <div class="upload-area" @click="selectFile" @drop="handleDrop" @dragover.prevent @dragenter.prevent>
          <div class="upload-icon">📄</div>
          <h3>Select or Drop PDF with Negative Images</h3>
          <p>Choose a PDF file containing photographic negatives to convert to positive images.</p>
          <button class="select-file-btn">Select PDF File</button>
        </div>
      </div>

      <div v-else class="file-selected">
        <div class="file-info">
          <div class="file-icon">📄</div>
          <div class="file-details">
            <h4>{{ selectedFile.name }}</h4>
            <p>Size: {{ formatFileSize(selectedFile.size) }}</p>
          </div>
        </div>

        <div v-if="conversionStatus" class="conversion-status">
          <div class="status-header">
            <h4>{{ conversionStatus.stage }}</h4>
          </div>
          <div class="status-message">
            <span class="status-text">{{ conversionStatus.message }}</span>
          </div>
          
          <div v-if="conversionStatus.progress !== undefined" class="progress-bar">
            <div 
              class="progress-fill" 
              :style="{ width: conversionStatus.progress + '%' }"
            ></div>
            <span class="progress-text">{{ conversionStatus.progress }}%</span>
          </div>
        </div>

        <div v-if="outputDirectory" class="output-directory">
          <strong>Output Folder:</strong> {{ outputDirectory }}
        </div>

        <div class="action-buttons">
          <button 
            v-if="!isConverting && !conversionComplete && !outputDirectory" 
            class="choose-folder-btn" 
            @click="chooseOutputFolder"
          >
            📁 Choose Output Folder
          </button>
          
          <button 
            v-if="!isConverting && !conversionComplete" 
            class="convert-btn" 
            @click="startConversion"
          >
            🔄 Convert to Positive
          </button>
        </div>
        
        <!-- Secondary actions when folder is selected -->
        <div v-if="outputDirectory && !isConverting && !conversionComplete" class="secondary-actions">
          <button 
            class="change-folder-btn" 
            @click="chooseOutputFolder"
          >
            📁 Change Output Folder
          </button>
        </div>
        
        <!-- Completion actions -->
        <div v-if="conversionComplete" class="completion-actions">
          <button 
            class="download-btn" 
            @click="downloadResult"
          >
            📁 Open in Finder
          </button>
          
          <button 
            class="convert-another-btn" 
            @click="resetConverter"
          >
            🔄 Convert Another File
          </button>
        </div>
      </div>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import Modal from './Modal.vue'

interface ConversionSettings {
  quality: number
  dpi: number
}

interface ConversionStatus {
  stage: string
  message: string
  progress?: number
}

const emit = defineEmits<{
  close: []
}>()

defineProps<{
  isVisible: boolean
}>()

const selectedFile = ref<File | null>(null)
const isConverting = ref(false)
const conversionComplete = ref(false)
const conversionStatus = ref<ConversionStatus | null>(null)
const resultFilePath = ref<string | null>(null)
const outputDirectory = ref<string | null>(null)

const conversionSettings = reactive<ConversionSettings>({
  quality: 100,
  dpi: 0
})

const selectFile = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.pdf'
  input.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (file) {
      selectedFile.value = file
    }
  }
  input.click()
}

const handleDrop = (e: DragEvent) => {
  e.preventDefault()
  const files = e.dataTransfer?.files
  if (files?.[0] && files[0].type === 'application/pdf') {
    selectedFile.value = files[0]
  }
}


const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const startConversion = async () => {
  if (!selectedFile.value) return
  
  isConverting.value = true
  conversionComplete.value = false
  
  try {
    const arrayBuffer = await selectedFile.value.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)
    
    conversionStatus.value = {
      stage: 'Preparing conversion...',
      message: 'Initializing image processing',
      progress: 0
    }

    const result = await window.electronAPI.convertNegativeToPositive({
      fileData: arrayBuffer, // Send ArrayBuffer directly
      fileName: selectedFile.value.name,
      settings: {
        quality: conversionSettings.quality,
        dpi: conversionSettings.dpi
      },
      outputDirectory: outputDirectory.value || undefined
    })

    if (result.success) {
      conversionComplete.value = true
      resultFilePath.value = result.outputPath
      conversionStatus.value = {
        stage: 'Conversion Complete! ✅',
        message: `Successfully converted ${result.pageCount} pages`,
        progress: 100
      }
    } else {
      throw new Error(result.error || 'Conversion failed')
    }
  } catch (error) {
    conversionStatus.value = {
      stage: 'Conversion Failed ❌',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  } finally {
    isConverting.value = false
  }
}

const downloadResult = async () => {
  if (resultFilePath.value) {
    await window.electronAPI.openInFolder(resultFilePath.value)
  }
}

const chooseOutputFolder = async () => {
  try {
    const selectedPath = await window.electronAPI.chooseSaveDirectory()
    if (selectedPath) {
      outputDirectory.value = selectedPath
    }
  } catch (error) {
    console.error('Failed to choose output directory:', error)
  }
}

const resetConverter = () => {
  selectedFile.value = null
  isConverting.value = false
  conversionComplete.value = false
  conversionStatus.value = null
  resultFilePath.value = null
  // Keep outputDirectory for user convenience
}


const handleClose = async () => {
  // Stop any ongoing conversion and cleanup
  if (isConverting.value) {
    await window.electronAPI.stopNegativeConversion?.()
  }
  
  // Clear all state and memory
  resetConverter()
  
  // Emit close event
  emit('close')
}

window.electronAPI?.onNegativeConversionProgress?.((progress) => {
  if (conversionStatus.value) {
    conversionStatus.value = progress
  }
})
</script>

<style scoped>
.negative-converter {
  padding: 1rem;
}

.upload-zone {
  text-align: center;
}

.upload-area {
  border: 2px dashed #ccc;
  border-radius: 8px;
  padding: 2rem;
  cursor: pointer;
  transition: all 0.3s ease;
}

.upload-area:hover {
  border-color: #007bff;
  background-color: #f8f9fa;
}

.upload-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.select-file-btn {
  background: #007bff;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 4px;
  cursor: pointer;
  margin-top: 1rem;
}

.file-selected {
  width: 100%;
}

.file-info {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 8px;
  margin-bottom: 1.5rem;
}

.file-icon {
  font-size: 2rem;
}

.file-details {
  flex: 1;
}

.file-details h4 {
  margin: 0 0 0.25rem 0;
  color: #333;
  white-space: nowrap;
  word-break: keep-all;
  overflow-wrap: break-word;
}

.file-details p {
  margin: 0;
  color: #666;
  font-size: 0.9rem;
}


.conversion-status {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1.5rem;
}

.status-header {
  margin-bottom: 0.75rem;
}

.status-header h4 {
  margin: 0;
  color: #333;
}

.status-message {
  margin-bottom: 1rem;
}

.status-text {
  color: #666;
  font-size: 0.9rem;
  line-height: 1.4;
  word-wrap: break-word;
  display: block;
}

.progress-bar {
  position: relative;
  background: #e9ecef;
  border-radius: 4px;
  height: 24px;
  overflow: hidden;
}

.progress-fill {
  background: linear-gradient(90deg, #28a745, #20c997);
  height: 100%;
  transition: width 0.3s ease;
}

.progress-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 0.8rem;
  font-weight: 500;
  color: #333;
}

.action-buttons {
  display: flex;
  gap: 1rem;
  justify-content: center;
}

.convert-btn, .download-btn, .convert-another-btn, .choose-folder-btn, .change-folder-btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.3s ease;
}

.convert-btn {
  background: #007bff;
  color: white;
}

.convert-btn:hover {
  background: #0056b3;
}

.download-btn {
  background: #28a745;
  color: white;
}

.download-btn:hover {
  background: #1e7e34;
}

.convert-another-btn {
  background: #6c757d;
  color: white;
}

.convert-another-btn:hover {
  background: #5a6268;
}

.choose-folder-btn {
  background: #17a2b8;
  color: white;
}

.choose-folder-btn:hover {
  background: #138496;
}

.output-directory {
  background: #e9ecef;
  padding: 0.75rem;
  border-radius: 4px;
  margin-bottom: 1rem;
  font-size: 0.9rem;
  word-break: break-all;
}

.secondary-actions {
  display: flex;
  justify-content: center;
  margin-top: 0.5rem;
}

.completion-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  margin-top: 1rem;
}

.change-folder-btn {
  background: #6c757d;
  color: white;
  padding: 0.5rem 1rem;
  font-size: 0.85rem;
}

.change-folder-btn:hover {
  background: #5a6268;
}
</style>