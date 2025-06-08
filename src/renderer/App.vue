<template>
  <div class="app">
    <DownloadQueueManager />
  </div>
</template>

<script setup lang="ts">
import DownloadQueueManager from './components/DownloadQueueManager.vue'
</script>

<style>
@import './styles/main.scss';
</style>

<style scoped>
.app {
  width: 100vw;
  height: 100vh;
  overflow: auto;
  background: var(--background-color);
}
</style>