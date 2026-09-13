import { Router } from 'express';
import authRoutes from './auth.routes.js';
import eventRoutes from './events.routes.js';
import photoRoutes from './photos.routes.js';
import galleryRoutes from './galleries.routes.js';
import publicRoutes from './public.routes.js';

const api = Router();

api.get('/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

api.use('/auth', authRoutes);
api.use('/events', eventRoutes);
api.use('/photos', photoRoutes);
api.use('/galleries', galleryRoutes);
api.use('/public', publicRoutes);

export default api;
