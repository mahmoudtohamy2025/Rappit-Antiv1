import * as dotenv from 'dotenv';
import * as path from 'path';

// Load test environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.test') });

// Set test environment
process.env.NODE_ENV = 'test';

// Check if we should use testcontainers (for E2E tests)
const USE_TESTCONTAINERS = process.env.USE_TESTCONTAINERS === 'true';

// Increase timeout for all tests (especially for container startup)
jest.setTimeout(USE_TESTCONTAINERS ? 60000 : 30000);

// Global test setup
beforeAll(async () => {
  console.log('🧪 Test suite starting...');
  console.log('🐳 Using testcontainers:', USE_TESTCONTAINERS ? 'YES' : 'NO');
  
  if (!USE_TESTCONTAINERS) {
    console.log('📦 Database:', process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':***@'));
    console.log('📮 Redis:', `${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`);
  }
});

import { closeRedisConnection } from '../src/queues/redis-connection';

// ...

afterAll(async () => {
  await closeRedisConnection();
  console.log('✅ Test suite complete');
});
