<template>
  <div class="export-logs-container">
    <button 
      class="export-logs-button" 
      @click="showModal = true"
    >
      <svg
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
          d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
      Export Logs
    </button>
    
    <LogExportModal
      :is-visible="showModal"
      @close="showModal = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import LogExportModal from './LogExportModal.vue'

const showModal = ref(false)
</script>

<style scoped lang="scss">
.export-logs-container {
  display: inline-block;
}

.export-logs-button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background-color: #2196f3;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background-color: #1976d2;
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(33, 150, 243, 0.3);
  }
  
  &:active {
    transform: translateY(0);
  }
  
  svg {
    width: 16px;
    height: 16px;
  }
}
</style>