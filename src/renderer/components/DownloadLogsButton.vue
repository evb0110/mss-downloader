<template>
  <div class="download-logs-container">
    <button 
      v-if="showButton"
      class="download-logs-button" 
      :disabled="isDownloading"
      @click="downloadLogs"
    >
      <svg
        v-if="!isDownloading"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"
        />
      </svg>
      <span
        v-if="isDownloading"
        class="spinner"
      />
      {{ isDownloading ? 'Saving...' : 'Download Logs' }}
    </button>
    
    <div
      v-if="successMessage"
      class="success-message"
    >
      {{ successMessage }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{
  showButton: boolean;
}>();

const isDownloading = ref(false);
const successMessage = ref('');

const downloadLogs = async () => {
  isDownloading.value = true;
  successMessage.value = '';
  
  try {
    const result = await window.electronAPI.downloadLogs();
    if (result.success) {
      successMessage.value = `Logs saved to: ${result.filepath}`;
      // Clear message after 10 seconds
      setTimeout(() => {
        successMessage.value = '';
      }, 10000);
    } else {
      console.error('Failed to download logs:', result.error);
      successMessage.value = 'Failed to save logs. Check console for details.';
    }
  } catch (error) {
    console.error('Error downloading logs:', error);
    successMessage.value = 'Error saving logs. Please try again.';
  } finally {
    isDownloading.value = false;
  }
};
</script>

<style scoped lang="scss">
.download-logs-container {
  margin-top: 10px;
}

.download-logs-button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background-color: #4a5568;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover:not(:disabled) {
    background-color: #2d3748;
    transform: translateY(-1px);
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  svg {
    width: 16px;
    height: 16px;
  }
}

.spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: white;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.success-message {
  margin-top: 8px;
  padding: 8px 12px;
  background-color: #48bb78;
  color: white;
  border-radius: 4px;
  font-size: 13px;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>