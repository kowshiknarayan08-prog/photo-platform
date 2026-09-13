import { prisma } from '../lib/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { canViewEvent } from '../utils/authz.js';

/** Load an event with its member list, or throw 404. */
export async function loadEventOr404(eventId) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { members: { select: { userId: true } } },
  });
  if (!event) throw ApiError.notFound('Event not found');
  return event;
}

/**
 * Load an event and confirm the user may view it (owner or assigned member).
 * Returns 404 (not 403) when the user is unrelated to the event so we don't
 * leak the existence of other teams' events.
 */
export async function loadViewableEventOr404(eventId, user) {
  const event = await loadEventOr404(eventId);
  if (!canViewEvent(user, event)) {
    throw ApiError.notFound('Event not found');
  }
  return event;
}
