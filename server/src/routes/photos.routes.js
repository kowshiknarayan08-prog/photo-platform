import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { idParamSchema } from '../schemas.js';
import { getPhotoRaw, deletePhoto } from '../controllers/photos.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/:id/raw', validate({ params: idParamSchema }), asyncHandler(getPhotoRaw));
router.delete('/:id', validate({ params: idParamSchema }), asyncHandler(deletePhoto));

export default router;
