import dotenv from 'dotenv';

dotenv.config();

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name, fallback) {
  const value = process.env[name];
  return value === undefined || value === '' ? fallback : value;
}

const NODE_ENV = optional('NODE_ENV', 'development');
const isTest = NODE_ENV === 'test';

export const env = {
  NODE_ENV,
  isProd: NODE_ENV === 'production',
  isTest,
  PORT: Number(optional('PORT', '4000')),

  // In test mode we don't want the process to crash if a real DB / secret
  // isn't configured, so secrets fall back to throwaway values.
  DATABASE_URL: isTest
    ? optional('TEST_DATABASE_URL', optional('DATABASE_URL', 'postgresql://localhost:5432/test'))
    : required('DATABASE_URL'),

  JWT_SECRET: isTest ? optional('JWT_SECRET', 'test-secret') : required('JWT_SECRET'),
  JWT_EXPIRES_IN: optional('JWT_EXPIRES_IN', '7d'),
  GALLERY_TOKEN_EXPIRES_IN: optional('GALLERY_TOKEN_EXPIRES_IN', '2h'),

  CORS_ORIGIN: optional('CORS_ORIGIN', 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  STORAGE_DRIVER: optional('STORAGE_DRIVER', 'local'),
  LOCAL_STORAGE_DIR: optional('LOCAL_STORAGE_DIR', 'uploads'),
  PUBLIC_API_URL: optional('PUBLIC_API_URL', `http://localhost:${optional('PORT', '4000')}`),

  SUPABASE_URL: optional('SUPABASE_URL', ''),
  SUPABASE_SERVICE_ROLE_KEY: optional('SUPABASE_SERVICE_ROLE_KEY', ''),
  SUPABASE_STORAGE_BUCKET: optional('SUPABASE_STORAGE_BUCKET', 'photos'),

  MAX_UPLOAD_MB: Number(optional('MAX_UPLOAD_MB', '15')),
  MAX_FILES_PER_UPLOAD: Number(optional('MAX_FILES_PER_UPLOAD', '20')),
};

export default env;
