<template>
  <div v-if="isOpen" class="modal-overlay" @click.self="close">
    <div class="modal-content settings-modal">
      <div class="modal-header">
        <h2>{{ t('settings.title') }}</h2>
        <button class="close-btn" @click="close">&times;</button>
      </div>
      
      <div class="modal-body">
        <div class="settings-section">
          <h3>{{ t('settings.download.title') }}</h3>
          
          <div class="setting-item">
            <label>{{ t('settings.download.maxConcurrent') }}</label>
            <input 
              type="number" 
              min="1" 
              max="20" 
              v-model.number="localConfig.maxConcurrentDownloads"
              @change="updateConfig('maxConcurrentDownloads', localConfig.maxConcurrentDownloads)"
            />
          </div>
          
          <div class="setting-item">
            <label>{{ t('settings.download.maxRetries') }}</label>
            <input 
              type="number" 
              min="1" 
              max="50" 
              v-model.number="localConfig.maxRetries"
              @change="updateConfig('maxRetries', localConfig.maxRetries)"
            />
          </div>
          
          <div class="setting-item">
            <label>{{ t('settings.download.requestTimeout') }}</label>
            <div class="input-with-unit">
              <input 
                type="number" 
                min="5000" 
                max="120000" 
                step="1000"
                v-model.number="localConfig.requestTimeout"
                @change="updateConfig('requestTimeout', localConfig.requestTimeout)"
              />
              <span class="unit">ms</span>
            </div>
          </div>
        </div>

        <div class="settings-section">
          <h3>{{ t('settings.pdf.title') }}</h3>
          
          <div class="setting-item">
            <label>{{ t('settings.pdf.quality') }}</label>
            <div class="slider-container">
              <input 
                type="range" 
                min="0.5" 
                max="1" 
                step="0.1"
                v-model.number="localConfig.pdfQuality"
                @change="updateConfig('pdfQuality', localConfig.pdfQuality)"
                class="quality-slider"
              />
              <span class="slider-value">{{ Math.round(localConfig.pdfQuality * 100) }}%</span>
            </div>
          </div>
          
          <div class="setting-item">
            <label>{{ t('settings.pdf.autoSplitThreshold') }}</label>
            <div class="input-with-unit">
              <input 
                type="number" 
                min="100" 
                max="2000" 
                step="50"
                v-model.number="autoSplitThresholdMB"
                @change="updateAutoSplitThreshold"
              />
              <span class="unit">MB</span>
            </div>
          </div>
        </div>

        <div class="settings-section">
          <h3>{{ t('settings.ui.title') }}</h3>
          
          <div class="setting-item">
            <label>{{ t('settings.ui.language') }}</label>
            <select 
              v-model="localConfig.language" 
              @change="updateConfig('language', localConfig.language)"
            >
              <option value="en">English</option>
              <option value="ru">Русский</option>
            </select>
          </div>
          
          <div class="setting-item">
            <label>{{ t('settings.ui.theme') }}</label>
            <select 
              v-model="localConfig.theme" 
              @change="updateConfig('theme', localConfig.theme)"
            >
              <option value="system">{{ t('settings.ui.themeSystem') }}</option>
              <option value="light">{{ t('settings.ui.themeLight') }}</option>
              <option value="dark">{{ t('settings.ui.themeDark') }}</option>
            </select>
          </div>
        </div>
      </div>
      
      <div class="modal-footer">
        <button class="btn btn-secondary" @click="resetToDefaults">
          {{ t('settings.resetToDefaults') }}
        </button>
        <button class="btn btn-primary" @click="close">
          {{ t('common.close') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

interface Props {
  isOpen: boolean;
}

interface Emits {
  (e: 'close'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// Local reactive config state
const localConfig = reactive({
  maxConcurrentDownloads: 8,
  maxRetries: 10,
  requestTimeout: 30000,
  pdfQuality: 0.9,
  autoSplitThreshold: 800 * 1024 * 1024, // bytes
  language: 'en',
  theme: 'system'
});

// Computed property for auto-split threshold in MB
const autoSplitThresholdMB = computed({
  get: () => Math.round(localConfig.autoSplitThreshold / (1024 * 1024)),
  set: (value: number) => {
    localConfig.autoSplitThreshold = value * 1024 * 1024;
  }
});

// Load initial config
onMounted(async () => {
  try {
    const config = await window.electronAPI.getAllConfig();
    Object.assign(localConfig, config);
  } catch (error) {
    console.error('Failed to load config:', error);
  }
});

// Update specific config setting
const updateConfig = async (key: string, value: any) => {
  try {
    await window.electronAPI.setConfig(key, value);
  } catch (error) {
    console.error(`Failed to update config ${key}:`, error);
  }
};

// Update auto-split threshold
const updateAutoSplitThreshold = () => {
  updateConfig('autoSplitThreshold', localConfig.autoSplitThreshold);
};

// Reset to defaults
const resetToDefaults = async () => {
  if (confirm(t('settings.confirmReset'))) {
    try {
      await window.electronAPI.resetConfig();
      // Config will be updated via the config-reset event
    } catch (error) {
      console.error('Failed to reset config:', error);
    }
  }
};

// Listen for config changes from other sources
const handleConfigChanged = (key: string, value: any) => {
  if (key in localConfig) {
    (localConfig as any)[key] = value;
  }
};

const handleConfigReset = (newConfig: any) => {
  Object.assign(localConfig, newConfig);
};

onMounted(() => {
  const unsubscribeConfigChanged = window.electronAPI.onConfigChanged(handleConfigChanged);
  const unsubscribeConfigReset = window.electronAPI.onConfigReset(handleConfigReset);
  
  onUnmounted(() => {
    unsubscribeConfigChanged();
    unsubscribeConfigReset();
  });
});

const close = () => {
  emit('close');
};
</script>

<style scoped>
.settings-modal {
  width: 600px;
  max-width: 90vw;
  max-height: 80vh;
  overflow-y: auto;
}

.settings-section {
  margin-bottom: 2rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid #e0e0e0;
}

.settings-section:last-child {
  border-bottom: none;
  margin-bottom: 0;
}

.settings-section h3 {
  margin: 0 0 1rem 0;
  color: #333;
  font-size: 1.1rem;
  font-weight: 600;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.setting-item:last-child {
  margin-bottom: 0;
}

.setting-item label {
  font-weight: 500;
  color: #555;
  flex: 1;
}

.setting-item input,
.setting-item select {
  width: 200px;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.9rem;
}

.setting-item input:focus,
.setting-item select:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.input-with-unit {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.input-with-unit input {
  width: 150px;
}

.unit {
  color: #666;
  font-size: 0.9rem;
}

.slider-container {
  display: flex;
  align-items: center;
  gap: 1rem;
  width: 200px;
}

.quality-slider {
  flex: 1;
  width: auto !important;
}

.slider-value {
  color: #666;
  font-size: 0.9rem;
  font-weight: 500;
  min-width: 40px;
}

.modal-footer {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  margin-top: 1.5rem;
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.btn-primary {
  background-color: #007bff;
  color: white;
}

.btn-primary:hover {
  background-color: #0056b3;
}

.btn-secondary {
  background-color: #6c757d;
  color: white;
}

.btn-secondary:hover {
  background-color: #545b62;
}

/* Dark theme support */
.dark .settings-section {
  border-bottom-color: #444;
}

.dark .settings-section h3 {
  color: #e0e0e0;
}

.dark .setting-item label {
  color: #ccc;
}

.dark .setting-item input,
.dark .setting-item select {
  background-color: #2d2d2d;
  border-color: #555;
  color: #e0e0e0;
}

.dark .setting-item input:focus,
.dark .setting-item select:focus {
  border-color: #007bff;
}

.dark .unit,
.dark .slider-value {
  color: #aaa;
}
</style>