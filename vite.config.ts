import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  root: 'src/renderer',
  base: './',
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
    minify: 'esbuild',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/renderer/index.html')
      },
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('vue') || id.includes('@vue') || id.includes('vue-i18n') || id.includes('@intlify')) {
              return 'vue-vendor';
            }
            if (id.includes('jspdf') || id.includes('pdf-lib')) {
              return 'pdf-vendor';
            }
            if (id.includes('lodash') || id.includes('marked')) {
              return 'utils';
            }
          }
        }
      }
    }
  },
  server: {
    port: 5173
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer'),
      '@shared': resolve(__dirname, 'src/shared')
    }
  }
})