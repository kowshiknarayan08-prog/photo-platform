import { fileURLToPath } from 'node:url';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import api from './routes/index.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      origin(origin, cb) {
        // allow same-origin / curl (no Origin header) and any whitelisted origin
        if (!origin || env.CORS_ORIGIN.includes(origin) || env.CORS_ORIGIN.includes('*')) {
          return cb(null, true);
        }
        cb(new Error(`Origin ${origin} not allowed by CORS`));
      },
      credentials: true,
    })
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  if (!env.isTest) app.use(morgan(env.isProd ? 'combined' : 'dev'));

  app.use('/api', api);

  // Serve the built React app in production (single-service deploy option).
  // Not used by the Vercel + Render split, but handy for a one-box deploy.
  if (env.isProd && process.env.SERVE_CLIENT === 'true') {
    const clientDir = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../../client/dist'
    );
    app.use(express.static(clientDir));
    app.get('*', (_req, res) => res.sendFile('index.html', { root: clientDir }));
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export default createApp;
