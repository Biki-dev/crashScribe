import { Redis } from 'ioredis';
import { config } from './index.js';

let redisClient: Redis | null = null;

export function getRedisClient(): Redis | null {
  if (!config.useRedis) {
    return null;
  }

  if (!redisClient) {
    try {
      redisClient = new Redis(config.redisUrl, {
        maxRetriesPerRequest: 1,
        retryStrategy: () => null, // don't block if redis is down
        lazyConnect: true,
      });

      redisClient.on('error', (err) => {
        console.warn('[Redis Warning] Connection error, falling back to database locks:', err.message);
      });
    } catch (e) {
      console.warn('[Redis] Redis initialization failed, fallback active');
    }
  }

  return redisClient;
}

export class DistributedLock {
  private static inMemoryLocks = new Set<string>();

  /**
   * Acquires a distributed lock for a key. Uses Redis if enabled/available, else in-memory lock.
   */
  static async acquire(key: string, ttlSeconds: number = 10): Promise<boolean> {
    const redis = getRedisClient();
    const lockKey = `lock:report:${key}`;

    if (redis && redis.status === 'ready') {
      try {
        const result = await redis.set(lockKey, 'locked', 'EX', ttlSeconds, 'NX');
        return result === 'OK';
      } catch (err) {
        console.warn('[Redis Lock Error] Fallback to in-memory lock');
      }
    }

    // In-memory fallback lock
    if (this.inMemoryLocks.has(lockKey)) {
      return false; // lock held
    }

    this.inMemoryLocks.add(lockKey);
    setTimeout(() => {
      this.inMemoryLocks.delete(lockKey);
    }, ttlSeconds * 1000);

    return true;
  }

  /**
   * Releases distributed lock
   */
  static async release(key: string): Promise<void> {
    const redis = getRedisClient();
    const lockKey = `lock:report:${key}`;

    if (redis && redis.status === 'ready') {
      try {
        await redis.del(lockKey);
      } catch (err) {
        // ignore
      }
    }

    this.inMemoryLocks.delete(lockKey);
  }
}
