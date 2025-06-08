<template>
  <div class="app">
    <ManuscriptDownloader />
  </div>
</template>

<script setup lang="ts">
import ManuscriptDownloader from './components/ManuscriptDownloader.vue'
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