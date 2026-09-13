import { prisma } from '../lib/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { verifyPin } from '../utils/pin.js';
import { signGalleryToken } from '../lib/jwt.js';
import { storage } from '../services/storage/index.js';

/** Load a gallery by slug that is currently visible to customers. */
async function loadPublishedGallery(slug) {
  const gallery = await prisma.gallery.findUnique({ where: { slug } });
  // 404 (not 403) for unpublished / unknown so we never confirm a gallery exists
  // before the PIN is presented.
  if (!gallery || !gallery.isPublished) throw ApiError.notFound('Gallery not found');
  if (gallery.expiresAt && gallery.expiresAt.getTime() < Date.now()) {
    throw ApiError.notFound('This gallery link has expired');
  }
  return gallery;
}

/**
 * GET /api/public/galleries/:slug
 * Minimal metadata so the customer page can show a title + PIN prompt.
 */
export async function getPublicGalleryMeta(req, res) {
  const gallery = await loadPublishedGallery(req.params.slug);
  res.json({
    gallery: { title: gallery.title, slug: gallery.slug, requiresPin: true },
  });
}

/**
 * POST /api/public/galleries/:slug/verify   Body: { pin }
 * On success returns a short-lived gallery access token.
 */
export async function verifyGalleryPin(req, res) {
  const gallery = await loadPublishedGallery(req.params.slug);

  const ok = await verifyPin(req.body.pin, gallery.pinHash);
  if (!ok) throw ApiError.unauthorized('Incorrect PIN');

  res.json({
    token: signGalleryToken(gallery),
    gallery: { title: gallery.title, slug: gallery.slug },
  });
}

/**
 * GET /api/public/galleries/:slug/photos
 * Requires a valid gallery token whose slug matches.
 */
export async function listPublicGalleryPhotos(req, res) {
  const { slug } = req.params;
  if (req.galleryToken.slug !== slug) throw ApiError.forbidden('Token does not match this gallery');

  const gallery = await loadPublishedGallery(slug);
  const links = await prisma.galleryPhoto.findMany({
    where: { galleryId: gallery.id },
    include: { photo: { select: { id: true, filename: true, width: true, height: true } } },
    orderBy: { position: 'asc' },
  });

  const token = encodeURIComponent(req.rawGalleryToken ?? req.query.token ?? '');
  res.json({
    gallery: { title: gallery.title, slug: gallery.slug },
    photos: links.map((l) => ({
      id: l.photo.id,
      filename: l.photo.filename,
      url: `/api/public/galleries/${slug}/photos/${l.photo.id}/raw?token=${token}`,
    })),
  });
}

/**
 * GET /api/public/galleries/:slug/photos/:photoId/raw
 * Streams a published photo's bytes. Requires a matching gallery token.
 */
export async function getPublicGalleryPhotoRaw(req, res) {
  const { slug, photoId } = req.params;
  if (req.galleryToken.slug !== slug) throw ApiError.forbidden('Token does not match this gallery');

  const gallery = await loadPublishedGallery(slug);

  // The photo must actually be part of THIS published gallery.
  const link = await prisma.galleryPhoto.findFirst({
    where: { galleryId: gallery.id, photoId },
    include: { photo: true },
  });
  if (!link) throw ApiError.notFound('Photo is not part of this gallery');

  const stream = await storage.getStream(link.photo.storageKey).catch(() => {
    throw ApiError.notFound('Photo file is missing from storage');
  });
  res.setHeader('Content-Type', link.photo.mimeType);
  res.setHeader('Cache-Control', 'private, max-age=3600');
  stream.on('error', () => res.destroy());
  stream.pipe(res);
}
