import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

/**
 * Sign a session token for an authenticated user (Admin or Team Member).
 */
export function signUserToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, email: user.email, type: 'user' },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );
}

/**
 * Sign a short-lived token that grants a customer read access to ONE gallery.
 * Issued only after the correct PIN is supplied.
 */
export function signGalleryToken(gallery) {
  return jwt.sign(
    { sub: gallery.id, slug: gallery.slug, type: 'gallery' },
    env.JWT_SECRET,
    { expiresIn: env.GALLERY_TOKEN_EXPIRES_IN }
  );
}

export function verifyToken(token) {
  return jwt.verify(token, env.JWT_SECRET);
}
