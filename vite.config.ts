import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [],
  build: {
    minify: 'esbuild',
  },
  // Ensure we do not use rolldown if it's being picked up as a plugin or experimental feature
  worker: {
    format: 'es',
  }
});
