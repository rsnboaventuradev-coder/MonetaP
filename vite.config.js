import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
    root: '.',
    base: './', // Use relative paths for Electron compatibility

    build: {
        outDir: 'dist',
        emptyOutDir: true,
        // Optimize for production
        minify: 'esbuild',
        sourcemap: false,
        target: 'es2020'
    },

    server: {
        port: 5173,
        strictPort: true,
        host: 'localhost'
    },

    // Ensure compatibility with both Electron and Capacitor
    optimizeDeps: {
        exclude: ['@capacitor/core', '@capacitor/haptics', '@capacitor/local-notifications']
    }
});
