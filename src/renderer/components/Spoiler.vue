<template>
    <div
        class="spoiler"
        :class="{ 'is-open': isOpen }"
    >
        <button 
            type="button"
            class="spoiler-trigger"
            :aria-expanded="isOpen"
            :aria-controls="contentId"
            @click="toggle"
        >
            <span class="spoiler-title">
                <slot name="title">{{ title }}</slot>
            </span>
            <div class="spoiler-icon">
                <svg
                    width="20"
                    height="20"
                    viewBox="0 0 20 20"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <path
                        d="M6 8L10 12L14 8"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    />
                </svg>
            </div>
        </button>
    
        <div 
            :id="contentId"
            class="spoiler-content"
            :style="{ height: isOpen ? 'auto' : '0px' }"
        >
            <div class="spoiler-inner">
                <slot />
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

interface Props {
    title?: string;
    defaultOpen?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    title: '',
    defaultOpen: false,
});

const isOpen = ref(props.defaultOpen);
const contentId = `spoiler-${Math.random().toString(36).substr(2, 9)}`;

function toggle() {
    isOpen.value = !isOpen.value;
}
</script>

<style scoped>
.spoiler {
  border: 1px solid #dee2e6;
  border-radius: 8px;
  overflow: hidden;
  background: #f8f9fa;
  transition: box-shadow 0.2s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.spoiler:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.spoiler-trigger {
  width: 100%;
  padding: 1rem 1.25rem;
  background: #e9ecef;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: background-color 0.2s ease;
  text-align: left;
}

.spoiler-trigger:hover {
  background: #dee2e6;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.spoiler-trigger:focus-visible {
  background: #dee2e6;
  box-shadow: inset 0 0 0 2px #007bff;
}

.spoiler-title {
  font-weight: 600;
  color: #495057;
  font-size: 1.1rem;
}

.spoiler-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  color: #6c757d;
  transition: transform 0.3s ease, color 0.2s ease;
  flex-shrink: 0;
  margin-left: 0.5rem;
}

.is-open .spoiler-icon {
  transform: rotate(180deg);
  color: #007bff;
}

.spoiler-content {
  overflow: hidden;
  transition: height 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.spoiler-inner {
  padding: 1rem 1.25rem;
}

.is-open .spoiler-trigger {
  background: #e7f3ff;
  border-bottom: 1px solid #b8daff;
}

.is-open .spoiler {
  border-color: #b8daff;
  box-shadow: 0 2px 8px rgba(0, 123, 255, 0.15);
}

@media (prefers-reduced-motion: reduce) {
  .spoiler-content,
  .spoiler-icon {
    transition: none;
  }
}
</style>