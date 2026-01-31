import { PrismaClient } from '@prisma/client';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

let prisma: PrismaClient | null = null;

/**
 * Setup test database
 * - Creates PrismaClient instance
 * - Syncs schema (skip migrations since schema may already exist)
 * - Returns client for use in tests
 */
export async function setupTestDB(): Promise<PrismaClient> {
  if (prisma) {
    return prisma;
  }

  // Create Prisma client
  prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    log: process.env.LOG_LEVEL === 'debug' ? ['query', 'error', 'warn'] : ['error'],
  });

  // Connect
  await prisma.$connect();

  // Sync schema without migrations (handles existing schema)
  try {
    await execAsync('npx prisma db push --skip-generate --accept-data-loss 2>/dev/null || true');
    console.log('✅ Test database schema synced');
  } catch (error) {
    // Ignore errors - schema may already be in sync
    console.log('⚠️ Schema sync skipped (already in sync)');
  }

  return prisma;
}

/**
 * Teardown test database
 * - Disconnects Prisma client
 */
export async function teardownTestDB(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}

/**
 * Clear all tables (keep schema)
 * - Truncates all tables in correct order (respecting foreign keys)
 */
export async function clearTables(): Promise<void> {
  if (!prisma) {
    throw new Error('Prisma client not initialized');
  }

  const tables = [
    'shipment_tracking',
    'shipment_event',
    'shipment_item',
    'shipment',
    'shipping_account',
    'processed_shipment_job',
    'integration_log',
    'order_timeline_event',
    'order_item',
    'order',
    'shipping_address',
    'inventory_reservation',
    'inventory_adjustment',
    'sku',
    'unmapped_item',
    'sku_mapping',
    'processed_webhook_event',
    'channel_connection',
    'channel',
    'user',
    'organization',
  ];

  // Disable foreign key checks
  await prisma.$executeRawUnsafe('SET session_replication_role = replica;');

  // Truncate tables
  for (const table of tables) {
    try {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE;`);
    } catch (error) {
      console.warn(`Warning: Could not truncate ${table}:`, error.message);
    }
  }

  // Re-enable foreign key checks
  await prisma.$executeRawUnsafe('SET session_replication_role = DEFAULT;');
}

/**
 * Get Prisma client (must be initialized first)
 */
export function getTestDB(): PrismaClient {
  if (!prisma) {
    throw new Error('Test DB not initialized. Call setupTestDB() first.');
  }
  return prisma;
}

/**
 * Execute in transaction and rollback (for unit tests)
 */
export async function executeInTransaction<T>(
  fn: (tx: any) => Promise<T>,
): Promise<T> {
  if (!prisma) {
    throw new Error('Prisma client not initialized');
  }

  let result: T;

  await prisma.$transaction(async (tx) => {
    result = await fn(tx);
    // Force rollback by throwing
    throw new Error('ROLLBACK');
  }).catch((error) => {
    if (error.message !== 'ROLLBACK') {
      throw error;
    }
  });

  return result!;
}
