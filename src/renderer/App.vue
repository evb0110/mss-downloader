<template>
  <div class="app">
    <DownloadQueueManager />
  </div>
</template>

<script setup lang="ts">
import DownloadQueueManager from './components/DownloadQueueManager.vue'
import { PdfRendererService } from './services/PdfRendererService'
import { onMounted, onUnmounted } from 'vue'

const pdfRenderer = new PdfRendererService()

let ipcCleanup: (() => void) | null = null

onMounted(() => {
  const handlePdfRendering = async ({ pdfPath, outputDir }: { pdfPath: string, outputDir: string }) => {
    console.log('🖼️ Received PDF rendering request in renderer process')
    console.log(`   PDF path: ${pdfPath}`)
    console.log(`   Output: ${outputDir}`)
    
    try {
      // Stage 1: Convert PDF to images (save directly to disk)
      await window.electronAPI.updateRenderingProgress('Stage 1: PDF Rendering', 'Converting PDF pages to images...', 40)
      
      const imageFiles = await pdfRenderer.renderPdfFromFile(pdfPath, outputDir)
      console.log(`✅ Stage 1 complete: ${imageFiles.length} images rendered to disk`)
      
      // Stage 2: Invert images (read from disk, process, save back to disk)
      await window.electronAPI.updateRenderingProgress('Stage 2: Image Inversion', 'Inverting colors from negative to positive...', 50)
      console.log('🔄 Starting Stage 2: Image inversion from disk...')
      let finalFiles: string[] = [];
      
      try {
        const invertedFiles = await pdfRenderer.invertImageFiles(imageFiles, outputDir)
        console.log(`✅ Stage 2 complete: ${invertedFiles.length} images inverted`)
        finalFiles = invertedFiles
      } catch (inversionError) {
        console.error('❌ Image inversion failed, keeping original images:', inversionError)
        finalFiles = imageFiles // Use original images if inversion fails
      }
      
      // Stage 3: Create PDF from inverted images
      await window.electronAPI.updateRenderingProgress('Stage 3: Creating PDF', 'Assembling inverted images into PDF...', 80)
      console.log('🔄 Starting Stage 3: PDF creation...')
      
      try {
        // Extract source filename for better naming
        const sourceFileName = pdfPath.split(/[/\\]/).pop() || 'input.pdf'
        const createdPdfPath = await pdfRenderer.createPdfFromImages(finalFiles, outputDir, sourceFileName)
        console.log(`✅ Stage 3 complete: PDF created at ${createdPdfPath}`)
      } catch (pdfError) {
        console.error('❌ PDF creation failed:', pdfError)
      }
      
      console.log('📁 All files saved to:', outputDir)
      
      // Notify main process that rendering and inversion are complete
      await window.electronAPI.notifyRenderingComplete(finalFiles.length)
    } catch (error) {
      console.error('❌ PDF rendering failed in renderer:', error)
      // Notify main process about the error
      await window.electronAPI.notifyRenderingError(error instanceof Error ? error.message : 'Unknown error')
    }
  }
  
  ipcCleanup = window.electronAPI.onPdfRenderingRequest(handlePdfRendering)
})

onUnmounted(() => {
  ipcCleanup?.()
})
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