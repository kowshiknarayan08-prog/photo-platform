import { nanoid } from 'nanoid';
import path from 'node:path';
import { env } from '../../config/env.js';
import { localStorage } from './local.js';
import { supabaseStorage } from './supabase.js';

/**
 * Storage facade. The rest of the app only talks to this object, so switching
 * providers is a one-line config change (STORAGE_DRIVER).
 *
 * Contract:
 *   save({ key, buffer, mimeType })  -> { key, url }
 *   getStream(key)                   -> Readable
 *   delete(key)                      -> void
 */
const drivers = {
  local: localStorage,
  supabase: supabaseStorage,
};

const driver = drivers[env.STORAGE_DRIVER];
if (!driver) {
  throw new Error(
    `Unknown STORAGE_DRIVER "${env.STORAGE_DRIVER}". Use one of: ${Object.keys(drivers).join(', ')}`
  );
}

/** Build a collision-proof storage key that keeps the original extension. */
export function buildStorageKey(eventId, originalName) {
  const ext = path.extname(originalName || '').toLowerCase().slice(0, 10) || '.jpg';
  return `events/${eventId}/${Date.now()}-${nanoid(10)}${ext}`;
}

export const storage = {
  driverName: driver.name,
  save: (args) => driver.save(args),
  getStream: (key) => driver.getStream(key),
  delete: (key) => driver.delete(key),
};

export default storage;
