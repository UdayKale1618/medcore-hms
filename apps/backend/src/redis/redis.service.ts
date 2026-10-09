import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly redis: Redis;
  private readonly memoryFallback = new Map<string, { value: string; expiresAt: number }>();
  private isConnected = false;

  constructor() {
    const redisOptions = {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    };

    if (process.env.REDIS_URL) {
      this.redis = new Redis(process.env.REDIS_URL, redisOptions);
    } else {
      this.redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT || 6379),
        ...redisOptions,
      });
    }

    this.redis.connect()
      .then(() => {
        this.isConnected = true;
      })
      .catch(() => {
        this.isConnected = false;
      });

    this.redis.on('error', () => {
      this.isConnected = false;
    });

    this.redis.on('connect', () => {
      this.isConnected = true;
    });
  }

  async set(key: string, value: string, ttlSeconds: number) {
    if (this.isConnected) {
      try {
        await this.redis.set(key, value, 'EX', ttlSeconds);
        return;
      } catch {
        this.isConnected = false;
      }
    }
    this.memoryFallback.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async get(key: string) {
    if (this.isConnected) {
      try {
        return await this.redis.get(key);
      } catch {
        this.isConnected = false;
      }
    }
    const item = this.memoryFallback.get(key);
    if (!item) return null;
    if (Date.now() > item.expiresAt) {
      this.memoryFallback.delete(key);
      return null;
    }
    return item.value;
  }

  async delete(key: string) {
    if (this.isConnected) {
      try {
        await this.redis.del(key);
      } catch {
        this.isConnected = false;
      }
    }
    this.memoryFallback.delete(key);
  }

  async onModuleDestroy() {
    try {
      if (this.isConnected) {
        await this.redis.quit();
      }
    } catch {
      // Ignored
    }
  }
}