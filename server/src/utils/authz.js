/**
 * Pure authorization helpers. No database or HTTP dependencies so they are
 * trivially unit-testable (see tests/authz.test.js).
 *
 * The "event" objects passed in are expected to have:
 *   { ownerId: string, members: [{ userId: string }] }
 */

export function isAdmin(user) {
  return !!user && user.role === 'ADMIN';
}

export function isEventOwner(user, event) {
  return !!user && !!event && event.ownerId === user.id;
}

export function isEventMember(user, event) {
  if (!user || !event || !Array.isArray(event.members)) return false;
  return event.members.some((m) => m.userId === user.id);
}

/** Can this user see the event and its basic data? Owner or assigned member. */
export function canViewEvent(user, event) {
  return isEventOwner(user, event) || isEventMember(user, event);
}

/** Can this user upload photos to the event? Owner or assigned member. */
export function canUploadToEvent(user, event) {
  return isEventOwner(user, event) || isEventMember(user, event);
}

/**
 * Which photos of an event may this user list?
 *  - Admin/owner: every photo ("View all photos uploaded by the team").
 *  - Team member: only the photos they uploaded ("View their uploaded photos").
 */
export function photoListScope(user, event) {
  if (isEventOwner(user, event)) return 'all';
  if (isEventMember(user, event)) return 'own';
  return 'none';
}

export function canViewPhoto(user, event, photo) {
  if (isEventOwner(user, event)) return true;
  if (isEventMember(user, event)) return photo.uploadedById === user.id;
  return false;
}

export function canDeletePhoto(user, event, photo) {
  if (isEventOwner(user, event)) return true;
  return isEventMember(user, event) && photo.uploadedById === user.id;
}

/** Only the event owner (an Admin) can manage / publish the gallery. */
export function canManageGallery(user, event) {
  return isEventOwner(user, event);
}
