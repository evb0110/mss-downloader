<template>
  <div
    v-if="show"
    class="modal-overlay"
    @click="handleOverlayClick"
  >
    <div
      class="modal-content"
      :style="{ width: width || 'auto', maxWidth: width ? 'none' : '500px' }"
      @click.stop
    >
      <div class="modal-header">
        <h3 class="modal-title">
          {{ title }}
        </h3>
        <button
          class="modal-close"
          aria-label="Close"
          @click="$emit('close')"
        >
          ×
        </button>
      </div>
      
      <div class="modal-body">
        <p v-if="message">
          {{ message }}
        </p>
        <slot />
      </div>
      
      <div class="modal-footer">
        <button
          v-if="type === 'confirm'"
          class="btn btn-danger"
          :disabled="loading"
          @click="$emit('confirm')"
        >
          {{ confirmText || 'Confirm' }}
        </button>
        <button
          class="btn btn-secondary"
          :disabled="loading"
          @click="$emit('close')"
        >
          {{ cancelText || 'Cancel' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
    show: boolean;
    title: string;
    message?: string;
    type?: 'alert' | 'confirm';
    confirmText?: string;
    cancelText?: string;
    loading?: boolean;
    closeOnOverlay?: boolean;
    width?: string;
}

const props = withDefaults(defineProps<Props>(), {
    message: undefined,
    type: 'alert',
    confirmText: undefined,
    cancelText: undefined,
    loading: false,
    closeOnOverlay: true,
    width: undefined,
});

const emit = defineEmits<{
    close: [];
    confirm: [];
}>();

function handleOverlayClick() {
    if (props.closeOnOverlay) {
        emit('close');
    }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease-out;
}

.modal-content {
  background: white;
  border-radius: 8px;
  max-width: 500px;
  max-height: 85vh;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  animation: slideIn 0.2s ease-out;
  display: flex;
  flex-direction: column;
}

/* Better handling for larger modal widths */
@media (min-width: 1024px) {
  .modal-content {
    max-height: 90vh;
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 20px 0 20px;
  border-bottom: 1px solid #e9ecef;
  margin-bottom: 0;
  flex-shrink: 0;
}

.modal-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: #212529;
}

.modal-close {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #6c757d;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.modal-close:hover {
  background: #f8f9fa;
  color: #495057;
}

.modal-body {
  padding: 20px;
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.modal-body p {
  margin: 0 0 16px 0;
  line-height: 1.5;
  color: #495057;
}

.modal-footer {
  padding: 0 20px 20px 20px;
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  flex-shrink: 0;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s ease;
  font-size: 0.9rem;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-danger {
  background: #dc3545;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #c82333;
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background: #5a6268;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideIn {
  from { 
    opacity: 0;
    transform: translateY(-20px) scale(0.95);
  }
  to { 
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* Mobile responsive */
@media (max-width: 768px) {
  .modal-content {
    margin: 20px;
    min-width: auto;
    max-width: calc(100vw - 40px);
  }
  
  .modal-footer {
    flex-direction: column-reverse;
  }
  
  .btn {
    width: 100%;
  }
}
</style>