import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    outDir: 'workers-dist',
    emptyOutDir: true,
    lib: {
      entry: resolve(__dirname, 'src/workers/pdf-worker.ts'),
      name: 'PDFWorker',
      fileName: 'pdf-worker',
      formats: ['iife']
    },
    rollupOptions: {
      output: {
        format: 'iife',
        entryFileNames: 'pdf-worker.js'
      }
    },
    target: 'es2020',
    minify: false
  }
})