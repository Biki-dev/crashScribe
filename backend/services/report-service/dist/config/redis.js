"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DistributedLock = void 0;
exports.getRedisClient = getRedisClient;
const ioredis_1 = require("ioredis");
const index_js_1 = require("./index.js");
let redisClient = null;
function getRedisClient() {
    if (!index_js_1.config.useRedis) {
        return null;
    }
    if (!redisClient) {
        try {
            redisClient = new ioredis_1.Redis(index_js_1.config.redisUrl, {
                maxRetriesPerRequest: 1,
                retryStrategy: () => null, // don't block if redis is down
                lazyConnect: true,
            });
            redisClient.on('error', (err) => {
                console.warn('[Redis Warning] Connection error, falling back to database locks:', err.message);
            });
        }
        catch (e) {
            console.warn('[Redis] Redis initialization failed, fallback active');
        }
    }
    return redisClient;
}
class DistributedLock {
    static inMemoryLocks = new Set();
    /**
     * Acquires a distributed lock for a key. Uses Redis if enabled/available, else in-memory lock.
     */
    static async acquire(key, ttlSeconds = 10) {
        const redis = getRedisClient();
        const lockKey = `lock:report:${key}`;
        if (redis && redis.status === 'ready') {
            try {
                const result = await redis.set(lockKey, 'locked', 'EX', ttlSeconds, 'NX');
                return result === 'OK';
            }
            catch (err) {
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
    static async release(key) {
        const redis = getRedisClient();
        const lockKey = `lock:report:${key}`;
        if (redis && redis.status === 'ready') {
            try {
                await redis.del(lockKey);
            }
            catch (err) {
                // ignore
            }
        }
        this.inMemoryLocks.delete(lockKey);
    }
}
exports.DistributedLock = DistributedLock;
