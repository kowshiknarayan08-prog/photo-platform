import multer from 'multer';
import { Prisma } from '@prisma/client';
import { ApiError } from '../utils/ApiError.js';
import { env } from '../config/env.js';

// 404 for unmatched routes
export function notFoundHandler(_req, res) {
  res.status(404).json({ error: { message: 'Route not found' } });
}

// Central error handler. Must have 4 args for Express to treat it as such.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  let status = 500;
  let message = 'Internal server error';
  let details;

  if (err instanceof ApiError) {
    status = err.status;
    message = err.message;
    details = err.details;
  } else if (err instanceof multer.MulterError) {
    status = 400;
    message =
      err.code === 'LIMIT_FILE_SIZE'
        ? `File too large (max ${env.MAX_UPLOAD_MB} MB)`
        : err.code === 'LIMIT_FILE_COUNT'
          ? `Too many files (max ${env.MAX_FILES_PER_UPLOAD})`
          : `Upload error: ${err.message}`;
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      status = 409;
      message = `A record with that ${err.meta?.target ?? 'value'} already exists`;
    } else if (err.code === 'P2025') {
      status = 404;
      message = 'Record not found';
    } else {
      status = 400;
      message = 'Database request error';
    }
  } else if (err?.type === 'entity.parse.failed') {
    status = 400;
    message = 'Malformed JSON body';
  }

  if (status >= 500) {
    // Log the real error server-side; never leak internals to the client.
    console.error('[error]', err);
  }

  const payload = { error: { message } };
  if (details) payload.error.details = details;
  if (!env.isProd && status >= 500) payload.error.stack = err.stack;

  res.status(status).json(payload);
}
