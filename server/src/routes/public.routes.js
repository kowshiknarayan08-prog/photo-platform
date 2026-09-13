import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { requireGalleryToken } from '../middleware/auth.js';
import { slugParamSchema, verifyPinSchema } from '../schemas.js';
import {
  getPublicGalleryMeta,
  verifyGalleryPin,
  listPublicGalleryPhotos,
  getPublicGalleryPhotoRaw,
} from '../controllers/public.controller.js';

const router = Router();

// No user auth here — this is the customer-facing surface.
router.get('/galleries/:slug', validate({ params: slugParamSchema }), asyncHandler(getPublicGalleryMeta));
router.post(
  '/galleries/:slug/verify',
  validate({ params: slugParamSchema, body: verifyPinSchema }),
  asyncHandler(verifyGalleryPin)
);
router.get(
  '/galleries/:slug/photos',
  validate({ params: slugParamSchema }),
  requireGalleryToken,
  asyncHandler(listPublicGalleryPhotos)
);
router.get(
  '/galleries/:slug/photos/:photoId/raw',
  requireGalleryToken,
  asyncHandler(getPublicGalleryPhotoRaw)
);

export default router;
