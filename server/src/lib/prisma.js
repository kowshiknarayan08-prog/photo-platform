import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';

// Reuse a single PrismaClient across hot reloads in development to avoid
// exhausting database connections.
const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.__prisma ??
  new PrismaClient({
    log: env.isProd ? ['error'] : ['error', 'warn'],
  });

if (!env.isProd) {
  globalForPrisma.__prisma = prisma;
}

export default prisma;
