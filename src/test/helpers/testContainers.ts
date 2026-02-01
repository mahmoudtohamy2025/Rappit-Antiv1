import { GenericContainer, StartedTestContainer } from 'testcontainers';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import Redis from 'ioredis';

let postgresContainer: StartedTestContainer | null = null;
let redisContainer: StartedTestContainer | null = null;
let redisClient: Redis | null = null;

/**
 * Start PostgreSQL test container
 */
export async function startPostgresContainer(): Promise<{
  container: StartedTestContainer;
  connectionString: string;
}> {
  if (postgresContainer) {
    return {
      container: postgresContainer,
      connectionString: getPostgresConnectionString(),
    };
  }

  console.log('🐘 Starting PostgreSQL test container...');
  
  postgresContainer = await new PostgreSqlContainer('postgres:15-alpine')
    .withDatabase('rappit_test')
    .withUsername('rappit_test')
    .withPassword('rappit_test_pass')
    .withExposedPorts(5432)
    .start();

  const connectionString = postgresContainer.getConnectionUri();
  process.env.DATABASE_URL = connectionString;

  console.log('✅ PostgreSQL container started:', connectionString.replace(/:[^:@]+@/, ':***@'));

  return {
    container: postgresContainer,
    connectionString,
  };
}

/**
 * Start Redis test container
 */
export async function startRedisContainer(): Promise<{
  container: StartedTestContainer;
  host: string;
  port: number;
}> {
  if (redisContainer) {
    return {
      container: redisContainer,
      host: redisContainer.getHost(),
      port: redisContainer.getMappedPort(6379),
    };
  }

  console.log('🔴 Starting Redis test container...');

  redisContainer = await new GenericContainer('redis:7-alpine')
    .withExposedPorts(6379)
    .start();

  const host = redisContainer.getHost();
  const port = redisContainer.getMappedPort(6379);

  // Update environment variables
  process.env.REDIS_HOST = host;
  process.env.REDIS_PORT = port.toString();
  process.env.REDIS_URL = `redis://${host}:${port}`;

  console.log('✅ Redis container started:', `${host}:${port}`);

  return {
    container: redisContainer,
    host,
    port,
  };
}

/**
 * Get PostgreSQL connection string
 */
export function getPostgresConnectionString(): string {
  if (!postgresContainer) {
    throw new Error('PostgreSQL container not started');
  }
  return postgresContainer.getConnectionUri();
}

/**
 * Get Redis connection config
 */
export function getRedisConfig(): { host: string; port: number } {
  if (!redisContainer) {
    throw new Error('Redis container not started');
  }
  return {
    host: redisContainer.getHost(),
    port: redisContainer.getMappedPort(6379),
  };
}

/**
 * Get or create Redis client
 */
export function getRedisClient(): Redis {
  if (!redisClient) {
    const config = getRedisConfig();
    redisClient = new Redis({
      host: config.host,
      port: config.port,
      maxRetriesPerRequest: null,
    });
  }
  return redisClient;
}

/**
 * Stop all test containers
 */
export async function stopAllContainers(): Promise<void> {
  console.log('🛑 Stopping test containers...');

  // Close Redis client
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }

  // Stop Redis container
  if (redisContainer) {
    await redisContainer.stop();
    redisContainer = null;
  }

  // Stop PostgreSQL container
  if (postgresContainer) {
    await postgresContainer.stop();
    postgresContainer = null;
  }

  console.log('✅ All test containers stopped');
}

/**
 * Check if containers are running
 */
export function areContainersRunning(): boolean {
  return !!(postgresContainer && redisContainer);
}
