import { defineConfig } from 'vite';
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

// sql.js necesita su archivo .wasm junto a la app: se copia a public/ al arrancar.
const require = createRequire(import.meta.url);
const dist = dirname(require.resolve('sql.js'));
mkdirSync('public', { recursive: true });
// En el navegador sql.js usa su versión "browser"; se copian las dos por las dudas.
for (const f of ['sql-wasm.wasm', 'sql-wasm-browser.wasm']) copyFileSync(join(dist, f), `public/${f}`);

export default defineConfig({
  base: './',
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  build: { target: 'es2022', outDir: 'dist', chunkSizeWarningLimit: 2000 },
});
