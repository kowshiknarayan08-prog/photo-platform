import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { uploadPhotos } from '../middleware/upload.js';
import {
  createEventSchema,
  updateEventSchema,
  eventIdParamSchema,
  createTeamMemberSchema,
  selectPhotosSchema,
  upsertGallerySchema,
} from '../schemas.js';
import {
  createEvent,
  listEvents,
  getEvent,
  updateEvent,
  deleteEvent,
  addTeamMember,
  listMembers,
  removeMember,
} from '../controllers/events.controller.js';
import {
  uploadEventPhotos,
  listEventPhotos,
  setPhotoSelection,
} from '../controllers/photos.controller.js';
import { upsertGallery, getEventGallery } from '../controllers/galleries.controller.js';

const router = Router();

router.use(requireAuth);

// --- Events -----------------------------------------------------------------
router.post('/', requireRole('ADMIN'), validate({ body: createEventSchema }), asyncHandler(createEvent));
router.get('/', asyncHandler(listEvents));
router.get('/:eventId', validate({ params: eventIdParamSchema }), asyncHandler(getEvent));
router.patch(
  '/:eventId',
  requireRole('ADMIN'),
  validate({ params: eventIdParamSchema, body: updateEventSchema }),
  asyncHandler(updateEvent)
);
router.delete(
  '/:eventId',
  requireRole('ADMIN'),
  validate({ params: eventIdParamSchema }),
  asyncHandler(deleteEvent)
);

// --- Team members ----------------------------------------------------------
router.get('/:eventId/members', validate({ params: eventIdParamSchema }), asyncHandler(listMembers));
router.post(
  '/:eventId/members',
  requireRole('ADMIN'),
  validate({ params: eventIdParamSchema, body: createTeamMemberSchema }),
  asyncHandler(addTeamMember)
);
router.delete(
  '/:eventId/members/:userId',
  requireRole('ADMIN'),
  validate({ params: eventIdParamSchema }),
  asyncHandler(removeMember)
);

// --- Photos --------------------------------------------------------------------
router.get('/:eventId/photos', validate({ params: eventIdParamSchema }), asyncHandler(listEventPhotos));
router.post(
  '/:eventId/photos',
  validate({ params: eventIdParamSchema }),
  uploadPhotos,
  asyncHandler(uploadEventPhotos)
);
router.patch(
  '/:eventId/photos/selection',
  requireRole('ADMIN'),
  validate({ params: eventIdParamSchema, body: selectPhotosSchema }),
  asyncHandler(setPhotoSelection)
);

// --- Gallery (nested under event) -----------------------------------------
router.get('/:eventId/gallery', validate({ params: eventIdParamSchema }), asyncHandler(getEventGallery));
router.put(
  '/:eventId/gallery',
  requireRole('ADMIN'),
  validate({ params: eventIdParamSchema, body: upsertGallerySchema }),
  asyncHandler(upsertGallery)
);

export default router;
