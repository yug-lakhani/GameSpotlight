import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command, mode }) => ({
  plugins: [react()],
  build: {
    target: 'es2018',
    sourcemap: false,
    cssCodeSplit: true,
    brotliSize: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return;
          }

          if (id.includes('@supabase/auth-ui-react') || id.includes('@supabase/auth-ui-shared')) {
            return 'auth-ui-vendor';
          }

          if (id.includes('@supabase/')) {
            return 'supabase-vendor';
          }

          if (id.includes('react-router-dom')) {
            return 'router-vendor';
          }

          if (id.includes('react') || id.includes('react-dom')) {
            return 'react-vendor';
          }
        }
      }
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false
      }
    }
  }
}));