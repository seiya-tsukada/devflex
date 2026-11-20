// Vercel Function entry point. Bundled by scripts/build-vercel.ts into
// .vercel/output/functions/api.func; Express apps are valid (req, res) handlers.
import { createApp } from './app.ts';

export default createApp();
