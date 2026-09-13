import { prisma } from '../lib/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { hashPassword, publicUser } from '../utils/password.js';
import { isEventOwner } from '../utils/authz.js';
import { loadEventOr404, loadViewableEventOr404 } from '../services/events.service.js';

const eventInclude = {
  _count: { select: { photos: true, members: true } },
  members: { include: { user: { select: { id: true, name: true, email: true, role: true } } } },
  gallery: { select: { id: true, slug: true, isPublished: true, publishedAt: true, title: true } },
};

/** POST /api/events  (ADMIN) */
export async function createEvent(req, res) {
  const event = await prisma.event.create({
    data: {
      name: req.body.name,
      description: req.body.description ?? null,
      ownerId: req.user.id,
    },
    include: eventInclude,
  });
  res.status(201).json({ event });
}

/**
 * GET /api/events
 *  - ADMIN: events they own
 *  - MEMBER: events they are assigned to
 */
export async function listEvents(req, res) {
  const where =
    req.user.role === 'ADMIN'
      ? { ownerId: req.user.id }
      : { members: { some: { userId: req.user.id } } };

  const events = await prisma.event.findMany({
    where,
    include: eventInclude,
    orderBy: { createdAt: 'desc' },
  });
  res.json({ events });
}

/** GET /api/events/:eventId */
export async function getEvent(req, res) {
  const event = await loadViewableEventOr404(req.params.eventId, req.user);
  const [full, photosSelected] = await Promise.all([
    prisma.event.findUnique({ where: { id: event.id }, include: eventInclude }),
    prisma.photo.count({ where: { eventId: event.id, isSelected: true } }),
  ]);
  res.json({ event: { ...full, photosSelected } });
}

/** PATCH /api/events/:eventId  (owner only) */
export async function updateEvent(req, res) {
  const event = await loadEventOr404(req.params.eventId);
  if (!isEventOwner(req.user, event)) throw ApiError.forbidden();

  const updated = await prisma.event.update({
    where: { id: event.id },
    data: {
      ...(req.body.name !== undefined ? { name: req.body.name } : {}),
      ...(req.body.description !== undefined ? { description: req.body.description } : {}),
    },
    include: eventInclude,
  });
  res.json({ event: updated });
}

/** DELETE /api/events/:eventId  (owner only) */
export async function deleteEvent(req, res) {
  const event = await loadEventOr404(req.params.eventId);
  if (!isEventOwner(req.user, event)) throw ApiError.forbidden();
  await prisma.event.delete({ where: { id: event.id } });
  res.status(204).end();
}

/**
 * POST /api/events/:eventId/members
 * Body: { name, email, password } -> creates a MEMBER user and assigns them.
 * If a user with that email already exists they are assigned as-is (must be MEMBER).
 */
export async function addTeamMember(req, res) {
  const event = await loadEventOr404(req.params.eventId);
  if (!isEventOwner(req.user, event)) throw ApiError.forbidden();

  const { name, email, password } = req.body;

  let user = await prisma.user.findUnique({ where: { email } });
  if (user && user.role !== 'MEMBER') {
    throw ApiError.conflict('That email belongs to an Admin account');
  }
  if (!user) {
    user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: await hashPassword(password),
        role: 'MEMBER',
      },
    });
  }

  await prisma.eventMember.upsert({
    where: { eventId_userId: { eventId: event.id, userId: user.id } },
    create: { eventId: event.id, userId: user.id },
    update: {},
  });

  res.status(201).json({ member: publicUser(user) });
}

/** GET /api/events/:eventId/members */
export async function listMembers(req, res) {
  const event = await loadViewableEventOr404(req.params.eventId, req.user);
  const members = await prisma.eventMember.findMany({
    where: { eventId: event.id },
    include: { user: { select: { id: true, name: true, email: true, role: true, createdAt: true } } },
    orderBy: { createdAt: 'asc' },
  });
  res.json({ members: members.map((m) => m.user) });
}

/** DELETE /api/events/:eventId/members/:userId  (owner only) */
export async function removeMember(req, res) {
  const event = await loadEventOr404(req.params.eventId);
  if (!isEventOwner(req.user, event)) throw ApiError.forbidden();

  await prisma.eventMember.deleteMany({
    where: { eventId: event.id, userId: req.params.userId },
  });
  res.status(204).end();
}
