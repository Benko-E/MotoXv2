import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Relative paths, because GitHub Pages serves us from the /MotoX/ subpath.
  base: './',

  server: {
    port: 5174,
    strictPort: true,
  },

  build: {
    // GitHub Pages serves docs/ from main. It is wiped on every build, so
    // nothing else may live in it (plans go in plans/).
    outDir: 'docs',
    emptyOutDir: true,
    target: 'es2022',
    chunkSizeWarningLimit: 4000, // Three.js is big, and that's fine
  },

  test: {
    include: ['tests/**/*.test.ts'],
    // DOM tests opt in with a `// @vitest-environment happy-dom` comment.
    environment: 'node',
  },
})
