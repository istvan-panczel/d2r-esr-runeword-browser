import { defineConfig, type Plugin } from 'vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

/** Dev only: full page reload when `npm run guide:watch` rewrites public/guide/ (static files are not part of HMR). */
function guideReload(): Plugin {
  const guideDir = path.resolve(import.meta.dirname, './public/guide');
  return {
    name: 'guide-reload',
    apply: 'serve',
    configureServer(server) {
      server.watcher.add(guideDir);
      const reload = (file: string) => {
        if (file.startsWith(guideDir)) server.ws.send({ type: 'full-reload' });
      };
      server.watcher.on('add', reload);
      server.watcher.on('change', reload);
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/d2r-esr-runeword-browser/' : '/',
  plugins: [
    react(),
    // React Compiler via Babel (plugin-react 6 no longer takes a `babel` option itself)
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
    guideReload(),
  ],
  resolve: {
    alias: {
      '@/components': path.resolve(import.meta.dirname, './src/components'),
      '@/core': path.resolve(import.meta.dirname, './src/core'),
      '@/features': path.resolve(import.meta.dirname, './src/features'),
      '@/utils': path.resolve(import.meta.dirname, './src/utils'),
      '@/lib': path.resolve(import.meta.dirname, './src/lib'),
      '@/data': path.resolve(import.meta.dirname, './src/data'),
      '@': path.resolve(import.meta.dirname, './src'),
      '@public': path.resolve(import.meta.dirname, './public'),
    },
  },
  // Keep console.logs in production so users can see parsing progress
  // esbuild: {
  //   drop: mode === 'production' ? ['console', 'debugger'] : [],
  // },
}));
