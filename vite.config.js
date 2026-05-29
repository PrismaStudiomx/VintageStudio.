import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // base: './' es vital para que las rutas de los archivos sean relativas
  base: './', 
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    // Aumenta el límite para que el build no falle por tamaño
    chunkSizeWarningLimit: 1000, 
    rollupOptions: {
      output: {
        // Separa las librerías pesadas en un archivo llamado 'vendor'
        manualChunks(id) {
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        }
      }
    }
  }
})