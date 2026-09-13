import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from '../../config/env.js';

/**
 * Local-disk storage driver. Files are written under LOCAL_STORAGE_DIR.
 * Good for development; not suitable for a multi-instance production deploy.
 */
const ROOT = path.resolve(process.cwd(), env.LOCAL_STORAGE_DIR);

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

export const localStorage = {
  name: 'local',

  async save({ key, buffer }) {
    const dest = path.join(ROOT, key);
    await ensureDir(path.dirname(dest));
    await fs.writeFile(dest, buffer);
    return {
      key,
      // Served by GET /api/photos/:id/raw, so no direct URL is exposed.
      url: null,
    };
  },

  async getStream(key) {
    const filePath = path.join(ROOT, key);
    await fs.access(filePath); // throws if missing
    return createReadStream(filePath);
  },

  async delete(key) {
    const filePath = path.join(ROOT, key);
    await fs.rm(filePath, { force: true });
  },
};

export default localStorage;
