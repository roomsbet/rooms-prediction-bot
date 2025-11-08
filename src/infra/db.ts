/**
 * Database Client - Prisma connection
 */

import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// Graceful shutdown
export async function disconnectDB() {
  await prisma.$disconnect();
}

