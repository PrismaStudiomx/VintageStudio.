import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    // 1. Aumentamos el límite de tamaño para evitar errores de compilación
    chunkSizeWarningLimit: 1000, 
    
    // 2. Optimizamos la división de archivos (esto evita que el index se corrompa)
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        }
      }
    }
  }
})