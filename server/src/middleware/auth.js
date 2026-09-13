import { verifyToken } from '../lib/jwt.js';
import { prisma } from '../lib/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from './asyncHandler.js';

function readBearer(req) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme === 'Bearer' && token) return token;
  return null;
}

/**
 * Require a valid user session token. Loads the user and attaches it as
 * `req.user`. Rejects gallery tokens.
 */
export const requireAuth = asyncHandler(async (req, _res, next) => {
  const token = readBearer(req);
  if (!token) throw ApiError.unauthorized();

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    throw ApiError.unauthorized('Invalid or expired token');
  }
  if (payload.type !== 'user') throw ApiError.unauthorized('Invalid token type');

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) throw ApiError.unauthorized('Account no longer exists');

  req.user = user;
  next();
});

/**
 * Require the authenticated user to have one of the given roles.
 * Usage: router.post('/', requireAuth, requireRole('ADMIN'), handler)
 */
export const requireRole =
  (...roles) =>
  (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden(`Requires role: ${roles.join(' or ')}`));
    }
    next();
  };

/**
 * Require a valid gallery access token (issued after a correct PIN).
 * Attaches `req.galleryToken = { id, slug }`.
 */
export const requireGalleryToken = asyncHandler(async (req, _res, next) => {
  const token = readBearer(req) || req.query.token;
  if (!token) throw ApiError.unauthorized('Gallery access token required');

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    throw ApiError.unauthorized('Invalid or expired gallery token');
  }
  if (payload.type !== 'gallery') throw ApiError.unauthorized('Invalid token type');

  req.galleryToken = { id: payload.sub, slug: payload.slug };
  req.rawGalleryToken = token; // needed to embed in <img> URLs
  next();
});
