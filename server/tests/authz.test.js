import { describe, it, expect } from 'vitest';
import {
  isAdmin,
  isEventOwner,
  isEventMember,
  canViewEvent,
  canUploadToEvent,
  photoListScope,
  canViewPhoto,
  canDeletePhoto,
  canManageGallery,
} from '../src/utils/authz.js';

const admin = { id: 'u_admin', role: 'ADMIN' };
const member = { id: 'u_member', role: 'MEMBER' };
const stranger = { id: 'u_stranger', role: 'MEMBER' };

const event = {
  ownerId: 'u_admin',
  members: [{ userId: 'u_member' }],
};

describe('role helpers', () => {
  it('identifies admins', () => {
    expect(isAdmin(admin)).toBe(true);
    expect(isAdmin(member)).toBe(false);
    expect(isAdmin(null)).toBe(false);
  });

  it('identifies the event owner', () => {
    expect(isEventOwner(admin, event)).toBe(true);
    expect(isEventOwner(member, event)).toBe(false);
  });

  it('identifies assigned members', () => {
    expect(isEventMember(member, event)).toBe(true);
    expect(isEventMember(stranger, event)).toBe(false);
    expect(isEventMember(admin, event)).toBe(false);
  });
});

describe('event access', () => {
  it('owner and assigned member can view; stranger cannot', () => {
    expect(canViewEvent(admin, event)).toBe(true);
    expect(canViewEvent(member, event)).toBe(true);
    expect(canViewEvent(stranger, event)).toBe(false);
  });

  it('only owner and assigned member can upload', () => {
    expect(canUploadToEvent(admin, event)).toBe(true);
    expect(canUploadToEvent(member, event)).toBe(true);
    expect(canUploadToEvent(stranger, event)).toBe(false);
  });
});

describe('photo visibility scope', () => {
  it('owner sees all, member sees own, stranger sees none', () => {
    expect(photoListScope(admin, event)).toBe('all');
    expect(photoListScope(member, event)).toBe('own');
    expect(photoListScope(stranger, event)).toBe('none');
  });

  it('member can view only their own photo', () => {
    const ownPhoto = { uploadedById: 'u_member' };
    const otherPhoto = { uploadedById: 'u_someone_else' };
    expect(canViewPhoto(member, event, ownPhoto)).toBe(true);
    expect(canViewPhoto(member, event, otherPhoto)).toBe(false);
    expect(canViewPhoto(admin, event, otherPhoto)).toBe(true);
  });

  it('member can delete only their own photo; owner can delete any', () => {
    const ownPhoto = { uploadedById: 'u_member' };
    const otherPhoto = { uploadedById: 'u_someone_else' };
    expect(canDeletePhoto(member, event, ownPhoto)).toBe(true);
    expect(canDeletePhoto(member, event, otherPhoto)).toBe(false);
    expect(canDeletePhoto(admin, event, otherPhoto)).toBe(true);
  });
});

describe('gallery management', () => {
  it('only the event owner (Admin) can manage/publish the gallery', () => {
    expect(canManageGallery(admin, event)).toBe(true);
    expect(canManageGallery(member, event)).toBe(false);
    expect(canManageGallery(stranger, event)).toBe(false);
  });
});
