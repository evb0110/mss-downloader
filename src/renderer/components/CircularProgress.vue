<template>
  <div class="circular-progress" :title="`${current}/${total} pages (${Math.round(percentage)}%)`">
    <svg :width="size" :height="size" viewBox="0 0 36 36">
      <path
        class="circle-bg"
        d="M18 2.0845
           a 15.9155 15.9155 0 0 1 0 31.831
           a 15.9155 15.9155 0 0 1 0 -31.831"
        fill="none"
        stroke="#eee"
        stroke-width="3"
      />
      <path
        class="circle"
        :stroke-dasharray="dashArray"
        d="M18 2.0845
           a 15.9155 15.9155 0 0 1 0 31.831
           a 15.9155 15.9155 0 0 1 0 -31.831"
        fill="none"
        stroke="#007bff"
        stroke-width="3"
        stroke-linecap="round"
      />
      <text x="18" y="20.35" class="percentage" text-anchor="middle">
        {{ current }}
      </text>
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  percentage: number;
  current: number;
  total: number;
  size?: number;
}

const props = defineProps<Props>();

const size = computed(() => props.size ?? 36);

const normalized = computed(() => {
  const p = Math.max(0, Math.min(100, props.percentage || 0));
  return p;
});

const dashArray = computed(() => `${normalized.value}, 100`);
</script>

<style scoped>
.circular-progress {
  width: 36px;
  height: 36px;
}

.circle-bg {
  stroke: #eee;
}

.circle {
  transition: stroke-dasharray 0.3s ease;
  stroke: #0d6efd;
}

.percentage {
  font-size: 9px;
  fill: #333;
  font-weight: 700;
}
</style>

