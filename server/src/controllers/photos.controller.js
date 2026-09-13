import { prisma } from '../lib/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { storage, buildStorageKey } from '../services/storage/index.js';
import { loadViewableEventOr404, loadEventOr404 } from '../services/events.service.js';
import {
  canUploadToEvent,
  canViewPhoto,
  canDeletePhoto,
  isEventOwner,
  photoListScope,
} from '../utils/authz.js';

function photoDTO(p) {
  return {
    id: p.id,
    eventId: p.eventId,
    filename: p.filename,
    mimeType: p.mimeType,
    fileSize: p.fileSize,
    isSelected: p.isSelected,
    uploadedById: p.uploadedById,
    uploadedBy: p.uploadedBy
      ? { id: p.uploadedBy.id, name: p.uploadedBy.name }
      : undefined,
    createdAt: p.createdAt,
    url: `/api/photos/${p.id}/raw`,
  };
}

/**
 * POST /api/events/:eventId/photos   (multipart, field name: "photos")
 * Owner or assigned member. Supports multiple files. Partial failures are
 * reported rather than failing the whole batch.
 */
export async function uploadEventPhotos(req, res) {
  const event = await loadEventOr404(req.params.eventId);
  if (!canUploadToEvent(req.user, event)) {
    throw ApiError.forbidden('You are not assigned to this event');
  }

  const files = req.files ?? [];
  if (files.length === 0) throw ApiError.badRequest('No files received (field name must be "photos")');

  const uploaded = [];
  const failed = [];

  for (const file of files) {
    const key = buildStorageKey(event.id, file.originalname);
    try {
      const { url } = await storage.save({
        key,
        buffer: file.buffer,
        mimeType: file.mimetype,
      });
      const photo = await prisma.photo.create({
        data: {
          eventId: event.id,
          uploadedById: req.user.id,
          filename: file.originalname,
          storageKey: key,
          storageUrl: url,
          mimeType: file.mimetype,
          fileSize: file.size,
        },
      });
      uploaded.push(photoDTO(photo));
    } catch (err) {
      // Best-effort cleanup so we don't leave an orphaned object behind.
      await storage.delete(key).catch(() => {});
      failed.push({ filename: file.originalname, reason: err.message });
    }
  }

  if (uploaded.length === 0) {
    throw ApiError.badRequest('All uploads failed', failed);
  }

  res.status(201).json({
    uploaded,
    failed,
    summary: { received: files.length, stored: uploaded.length, failed: failed.length },
  });
}

/**
 * GET /api/events/:eventId/photos
 *  - owner  -> all photos
 *  - member -> only their own uploads
 */
export async function listEventPhotos(req, res) {
  const event = await loadViewableEventOr404(req.params.eventId, req.user);
  const scope = photoListScope(req.user, event);

  const where = { eventId: event.id };
  if (scope === 'own') where.uploadedById = req.user.id;

  const photos = await prisma.photo.findMany({
    where,
    include: { uploadedBy: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });

  res.json({
    photos: photos.map(photoDTO),
    scope, // "all" | "own"  -> handy for the UI
  });
}

/**
 * GET /api/photos/:id/raw
 * Streams the actual image bytes after an access check.
 */
export async function getPhotoRaw(req, res) {
  const photo = await prisma.photo.findUnique({
    where: { id: req.params.id },
    include: { event: { include: { members: { select: { userId: true } } } } },
  });
  if (!photo) throw ApiError.notFound('Photo not found');

  if (!canViewPhoto(req.user, photo.event, photo)) {
    throw ApiError.forbidden('You do not have access to this photo');
  }

  const stream = await storage.getStream(photo.storageKey).catch(() => {
    throw ApiError.notFound('Photo file is missing from storage');
  });

  res.setHeader('Content-Type', photo.mimeType);
  res.setHeader('Cache-Control', 'private, max-age=3600');
  stream.on('error', () => res.destroy());
  stream.pipe(res);
}

/**
 * PATCH /api/events/:eventId/photos/selection   (owner only)
 * Body: { photoIds: string[], selected: boolean }
 */
export async function setPhotoSelection(req, res) {
  const event = await loadEventOr404(req.params.eventId);
  if (!isEventOwner(req.user, event)) throw ApiError.forbidden('Only the event Admin can select photos');

  const { photoIds, selected } = req.body;

  const result = await prisma.photo.updateMany({
    where: { id: { in: photoIds }, eventId: event.id },
    data: { isSelected: selected },
  });

  res.json({ updated: result.count, selected });
}

/** DELETE /api/photos/:id  (owner or uploader) */
export async function deletePhoto(req, res) {
  const photo = await prisma.photo.findUnique({
    where: { id: req.params.id },
    include: { event: { include: { members: { select: { userId: true } } } } },
  });
  if (!photo) throw ApiError.notFound('Photo not found');

  if (!canDeletePhoto(req.user, photo.event, photo)) {
    throw ApiError.forbidden();
  }

  await storage.delete(photo.storageKey).catch(() => {});
  await prisma.photo.delete({ where: { id: photo.id } });
  res.status(204).end();
}
