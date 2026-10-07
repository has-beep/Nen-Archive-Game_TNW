import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// `vite build --mode single` produces one self-contained HTML file, worker
// included, for publishing the game as a standalone page. The normal build is
// a regular multi-file bundle for hosting under the Nen Archive site.
export default defineConfig(({ mode }) => ({
  plugins: mode === 'single' ? [react(), viteSingleFile()] : [react()],
  worker: { format: 'es' },
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    target: 'es2022',
    chunkSizeWarningLimit: 4000,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 120000,
  },
}))
