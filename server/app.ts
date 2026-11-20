import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { createApiRouter } from './routes/api.ts';

/**
 * Builds the Express app that serves `/api`. It never calls `listen()`, so the same app
 * is used by the local Node server (server.ts) and the Vercel Function (server/vercel.ts).
 */
export function createApp(): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));
  // Express 5 leaves req.body undefined when no JSON body was sent.
  app.use((req, _res, next) => {
    req.body ??= {};
    next();
  });

  app.use('/api', createApiRouter());
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API エンドポイントが見つかりません。' });
  });

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[api] Unhandled error', error);
    if (res.headersSent) return;
    res.status(500).json({ error: 'サーバー内部でエラーが発生しました。' });
  });

  return app;
}
