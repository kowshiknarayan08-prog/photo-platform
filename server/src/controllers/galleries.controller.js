import { customAlphabet } from 'nanoid';
import { prisma } from '../lib/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { hashPin } from '../utils/pin.js';
import { isEventOwner } from '../utils/authz.js';
import { loadEventOr404 } from '../services/events.service.js';

// URL-safe, unambiguous slug (no look-alike characters)
const makeSlug = customAlphabet('23456789abcdefghjkmnpqrstuvwxyz', 12);

function galleryDTO(g) {
  return {
    id: g.id,
    eventId: g.eventId,
    title: g.title,
    slug: g.slug,
    isPublished: g.isPublished,
    publishedAt: g.publishedAt,
    expiresAt: g.expiresAt,
    createdAt: g.createdAt,
    photoCount: g._count?.photos ?? g.photos?.length ?? undefined,
    shareUrl: `/gallery/${g.slug}`,
    photos: g.photos
      ? g.photos.map((gp) => ({
          id: gp.photo.id,
          filename: gp.photo.filename,
          position: gp.position,
          url: `/api/public/galleries/${g.slug}/photos/${gp.photo.id}/raw`,
        }))
      : undefined,
  };
}

/** Resolve which photo ids to put in the gallery. */
async function resolvePhotoIds(eventId, explicitIds) {
  if (explicitIds && explicitIds.length > 0) {
    const valid = await prisma.photo.findMany({
      where: { id: { in: explicitIds }, eventId },
      select: { id: true },
    });
    return valid.map((p) => p.id);
  }
  const selected = await prisma.photo.findMany({
    where: { eventId, isSelected: true },
    select: { id: true },
  });
  return selected.map((p) => p.id);
}

async function replaceGalleryPhotos(galleryId, photoIds) {
  await prisma.galleryPhoto.deleteMany({ where: { galleryId } });
  if (photoIds.length > 0) {
    await prisma.galleryPhoto.createMany({
      data: photoIds.map((photoId, i) => ({ galleryId, photoId, position: i })),
      skipDuplicates: true,
    });
  }
}

/**
 * PUT /api/events/:eventId/gallery   (owner only)
 * Creates the gallery if it doesn't exist, otherwise updates it. Draft only —
 * publishing is a separate explicit step.
 */
export async function upsertGallery(req, res) {
  const event = await loadEventOr404(req.params.eventId);
  if (!isEventOwner(req.user, event)) throw ApiError.forbidden('Only the event Admin can manage the gallery');

  const { title, pin, photoIds, expiresAt } = req.body;
  const resolvedIds = await resolvePhotoIds(event.id, photoIds);
  if (resolvedIds.length === 0) {
    throw ApiError.badRequest('Select at least one photo before creating the gallery');
  }

  const existing = await prisma.gallery.findUnique({ where: { eventId: event.id } });

  const gallery = existing
    ? await prisma.gallery.update({
        where: { id: existing.id },
        data: { title, pinHash: await hashPin(pin), expiresAt: expiresAt ?? null },
      })
    : await prisma.gallery.create({
        data: {
          eventId: event.id,
          title,
          slug: makeSlug(),
          pinHash: await hashPin(pin),
          expiresAt: expiresAt ?? null,
        },
      });

  await replaceGalleryPhotos(gallery.id, resolvedIds);

  const full = await prisma.gallery.findUnique({
    where: { id: gallery.id },
    include: { photos: { include: { photo: true }, orderBy: { position: 'asc' } } },
  });
  res.status(existing ? 200 : 201).json({ gallery: galleryDTO(full) });
}

/** PATCH /api/galleries/:id   (owner only) */
export async function updateGallery(req, res) {
  const gallery = await prisma.gallery.findUnique({
    where: { id: req.params.id },
    include: { event: true },
  });
  if (!gallery) throw ApiError.notFound('Gallery not found');
  if (!isEventOwner(req.user, gallery.event)) throw ApiError.forbidden();

  const data = {};
  if (req.body.title !== undefined) data.title = req.body.title;
  if (req.body.pin !== undefined) data.pinHash = await hashPin(req.body.pin);
  if (req.body.expiresAt !== undefined) data.expiresAt = req.body.expiresAt;

  await prisma.gallery.update({ where: { id: gallery.id }, data });

  if (req.body.photoIds !== undefined) {
    const ids = await resolvePhotoIds(gallery.eventId, req.body.photoIds);
    await replaceGalleryPhotos(gallery.id, ids);
  }

  const full = await prisma.gallery.findUnique({
    where: { id: gallery.id },
    include: { photos: { include: { photo: true }, orderBy: { position: 'asc' } } },
  });
  res.json({ gallery: galleryDTO(full) });
}

/** POST /api/galleries/:id/publish   (owner only) */
export async function publishGallery(req, res) {
  const gallery = await prisma.gallery.findUnique({
    where: { id: req.params.id },
    include: { event: true, _count: { select: { photos: true } } },
  });
  if (!gallery) throw ApiError.notFound('Gallery not found');
  if (!isEventOwner(req.user, gallery.event)) throw ApiError.forbidden();
  if (gallery._count.photos === 0) {
    throw ApiError.badRequest('Cannot publish a gallery with no photos');
  }

  const updated = await prisma.gallery.update({
    where: { id: gallery.id },
    data: { isPublished: true, publishedAt: new Date() },
    include: { _count: { select: { photos: true } } },
  });
  res.json({ gallery: galleryDTO(updated) });
}

/** POST /api/galleries/:id/unpublish   (owner only) */
export async function unpublishGallery(req, res) {
  const gallery = await prisma.gallery.findUnique({
    where: { id: req.params.id },
    include: { event: true },
  });
  if (!gallery) throw ApiError.notFound('Gallery not found');
  if (!isEventOwner(req.user, gallery.event)) throw ApiError.forbidden();

  const updated = await prisma.gallery.update({
    where: { id: gallery.id },
    data: { isPublished: false },
  });
  res.json({ gallery: galleryDTO(updated) });
}

/** GET /api/events/:eventId/gallery   (owner or member) */
export async function getEventGallery(req, res) {
  const gallery = await prisma.gallery.findUnique({
    where: { eventId: req.params.eventId },
    include: {
      event: { include: { members: { select: { userId: true } } } },
      photos: { include: { photo: true }, orderBy: { position: 'asc' } },
    },
  });
  if (!gallery) return res.json({ gallery: null });

  const isOwner = isEventOwner(req.user, gallery.event);
  const isMember = gallery.event.members.some((m) => m.userId === req.user.id);
  if (!isOwner && !isMember) throw ApiError.notFound('Event not found');

  res.json({ gallery: galleryDTO(gallery) });
}
