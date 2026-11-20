/**
 * Produces a Vercel Build Output API v3 bundle in `.vercel/output`:
 *   - static/            the Vite SPA (from dist/)
 *   - functions/api.func a single Node.js function that serves every /api/* route
 *   - config.json        routing: static files first, /api/* to the function, SPA fallback
 *
 * The API is bundled into one ESM file with Vite's SSR build, so the runtime never has to
 * resolve `.ts` imports or node_modules. Run after `vite build` (see `npm run build`).
 */
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'vite';

const root = path.resolve(import.meta.dirname, '..');
const distDir = path.join(root, 'dist');
const outputDir = path.join(root, '.vercel', 'output');
const functionDir = path.join(outputDir, 'functions', 'api.func');

if (!fs.existsSync(path.join(distDir, 'index.html'))) {
  throw new Error('dist/index.html not found. Run "vite build" before this script.');
}

fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(functionDir, { recursive: true });

// 1. Static assets
fs.cpSync(distDir, path.join(outputDir, 'static'), { recursive: true });

// 2. API function bundle
await build({
  root,
  configFile: false,
  logLevel: 'warn',
  ssr: { noExternal: true, target: 'node' },
  build: {
    ssr: path.join(root, 'server', 'vercel.ts'),
    outDir: functionDir,
    emptyOutDir: false,
    target: 'node22',
    minify: false,
    rolldownOptions: {
      output: { format: 'esm', entryFileNames: 'index.mjs', codeSplitting: false },
    },
  },
});

fs.writeFileSync(
  path.join(functionDir, '.vc-config.json'),
  JSON.stringify(
    {
      runtime: 'nodejs22.x',
      handler: 'index.mjs',
      launcherType: 'Nodejs',
      shouldAddHelpers: false,
      supportsResponseStreaming: true,
      maxDuration: 30,
    },
    null,
    2,
  ),
);

// 3. Routing
fs.writeFileSync(
  path.join(outputDir, 'config.json'),
  JSON.stringify(
    {
      version: 3,
      routes: [
        {
          src: '^/assets/(.*)$',
          headers: { 'Cache-Control': 'public, max-age=31536000, immutable' },
          continue: true,
        },
        { handle: 'filesystem' },
        { src: '^/api(?:/.*)?$', dest: '/api' },
        { src: '^/(.*)$', dest: '/index.html' },
      ],
    },
    null,
    2,
  ),
);

console.log(`Vercel build output written to ${path.relative(root, outputDir)}`);
