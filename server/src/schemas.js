import { z } from 'zod';

const email = z.string().trim().toLowerCase().email('A valid email is required');
const password = z.string().min(8, 'Password must be at least 8 characters').max(200);
const name = z.string().trim().min(1, 'Name is required').max(120);
const pin = z.string().regex(/^\d{4,8}$/, 'PIN must be 4 to 8 digits');
const cuid = z.string().min(1);

export const registerSchema = z.object({
  name,
  email,
  password,
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required'),
});

export const createEventSchema = z.object({
  name: z.string().trim().min(1, 'Event name is required').max(160),
  description: z.string().trim().max(2000).optional(),
});

export const updateEventSchema = createEventSchema.partial();

export const createTeamMemberSchema = z.object({
  name,
  email,
  password,
});

export const assignMemberSchema = z.object({
  userId: cuid,
});

export const idParamSchema = z.object({
  id: cuid,
});

export const eventIdParamSchema = z.object({
  eventId: cuid,
});

export const selectPhotosSchema = z.object({
  photoIds: z.array(cuid).min(1, 'Provide at least one photo id'),
  selected: z.boolean(),
});

export const upsertGallerySchema = z.object({
  title: z.string().trim().min(1, 'Gallery title is required').max(160),
  pin,
  // Optional explicit selection; when omitted the currently-selected photos are used.
  photoIds: z.array(cuid).optional(),
  expiresAt: z.coerce.date().optional(),
});

export const updateGallerySchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  pin: pin.optional(),
  photoIds: z.array(cuid).optional(),
  expiresAt: z.coerce.date().nullable().optional(),
});

export const slugParamSchema = z.object({
  slug: z.string().min(6).max(64),
});

export const verifyPinSchema = z.object({
  pin,
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});
