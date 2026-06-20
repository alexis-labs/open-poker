import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  plugins: [],
  build: {
    emptyOutDir: true,
    minify: 'esbuild',
    chunkSizeWarningLimit: 600,
    rolldownOptions: {
      output: {
        codeSplitting: false,
      },
    },
  },
  // Ensure we do not use rolldown if it's being picked up as a plugin or experimental feature
  worker: {
    format: 'es',
  }
});
