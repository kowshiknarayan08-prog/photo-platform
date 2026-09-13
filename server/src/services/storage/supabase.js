import { createClient } from '@supabase/supabase-js';
import { Readable } from 'node:stream';
import { env } from '../../config/env.js';

/**
 * Supabase Storage driver (used in production). Requires:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_STORAGE_BUCKET
 *
 * The bucket is kept PRIVATE. Photos are streamed back through the API after
 * an access check, so no public bucket URL is ever handed out.
 */
let client;
function getClient() {
  if (!client) {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error(
        'Supabase storage selected but SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set'
      );
    }
    client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
  }
  return client;
}

const bucket = () => getClient().storage.from(env.SUPABASE_STORAGE_BUCKET);

export const supabaseStorage = {
  name: 'supabase',

  async save({ key, buffer, mimeType }) {
    const { error } = await bucket().upload(key, buffer, {
      contentType: mimeType,
      upsert: false,
    });
    if (error) throw new Error(`Supabase upload failed: ${error.message}`);
    return { key, url: null };
  },

  async getStream(key) {
    const { data, error } = await bucket().download(key);
    if (error) throw new Error(`Supabase download failed: ${error.message}`);
    // data is a Blob; convert to a Node Readable stream
    const arrayBuffer = await data.arrayBuffer();
    return Readable.from(Buffer.from(arrayBuffer));
  },

  async delete(key) {
    const { error } = await bucket().remove([key]);
    if (error) throw new Error(`Supabase delete failed: ${error.message}`);
  },
};

export default supabaseStorage;
