import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { idParamSchema, updateGallerySchema } from '../schemas.js';
import {
  updateGallery,
  publishGallery,
  unpublishGallery,
} from '../controllers/galleries.controller.js';

const router = Router();

router.use(requireAuth, requireRole('ADMIN'));

router.patch('/:id', validate({ params: idParamSchema, body: updateGallerySchema }), asyncHandler(updateGallery));
router.post('/:id/publish', validate({ params: idParamSchema }), asyncHandler(publishGallery));
router.post('/:id/unpublish', validate({ params: idParamSchema }), asyncHandler(unpublishGallery));

export default router;
