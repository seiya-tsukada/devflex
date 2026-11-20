import path from 'node:path';
import { existsSync } from 'node:fs';
import express from 'express';
import { createApiRouter } from './server/routes/api.ts';

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? 'localhost';
const isProd = process.env.NODE_ENV === 'production';

const app = express();
app.use(express.json({ limit: '1mb' }));
// Express 5 leaves req.body undefined when no JSON body was sent.
app.use((req, _res, next) => {
  req.body ??= {};
  next();
});

app.use('/api', createApiRouter());

if (isProd) {
  const distDir = path.resolve(import.meta.dirname, 'dist');
  if (!existsSync(distDir)) {
    throw new Error(`Build output not found at ${distDir}. Run "npm run build" first.`);
  }
  app.use(express.static(distDir));
  app.get('/{*splat}', (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
} else {
  // Vite is a dev dependency, so only load it outside production.
  const { createServer } = await import('vite');
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}

const server = app.listen(PORT, HOST, () => {
  console.log(`Mini Software Factory listening on http://${HOST}:${PORT}`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => server.close(() => process.exit(0)));
}
