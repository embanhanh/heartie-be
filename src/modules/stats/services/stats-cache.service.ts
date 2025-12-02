import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { RedisOptions } from 'ioredis';

@Injectable()
export class StatsCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(StatsCacheService.name);
  private readonly client: Redis;

  constructor(private readonly configService: ConfigService) {
    const redisOptions: RedisOptions = {
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: parseInt(this.configService.get<string>('REDIS_PORT') ?? '6379', 10),
      password: this.configService.get<string>('REDIS_PASSWORD') ?? undefined,
      maxRetriesPerRequest: 2,
      enableReadyCheck: false,
      lazyConnect: true,
      keyPrefix: 'stats:',
    };

    this.client = new Redis(redisOptions);
    this.client.on('error', (error) => {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error(`Redis error: ${reason}`);
    });

    this.client.connect().catch((error) => {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error(`Unable to connect to Redis for stats cache: ${reason}`);
    });
  }

  async onModuleDestroy() {
    if (this.client.status !== 'end') {
      await this.client.quit();
    }
  }

  buildCacheKey(parts: Array<string | number | Date | undefined | null>): string {
    return parts
      .map((part) => {
        if (part instanceof Date) {
          return part.toISOString();
        }
        if (typeof part === 'number' || typeof part === 'string') {
          return part.toString();
        }
        return 'any';
      })
      .join(':');
  }

  async getJSON<T>(key: string): Promise<T | null> {
    const raw = await this.client.get(key);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as T;
    } catch (error) {
      this.logger.warn(`Failed to parse cached payload for key ${key}: ${String(error)}`);
      return null;
    }
  }

  async setJSON(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  async zincrby(key: string, increment: number, member: string): Promise<void> {
    await this.client.zincrby(key, increment, member);
  }

  async zrevrangeWithScores(
    key: string,
    limit: number,
  ): Promise<Array<{ member: string; score: number }>> {
    if (limit <= 0) {
      return [];
    }

    const raw = await this.client.zrevrange(key, 0, limit - 1, 'WITHSCORES');
    const entries: Array<{ member: string; score: number }> = [];

    for (let i = 0; i < raw.length; i += 2) {
      entries.push({ member: raw[i] ?? '', score: Number(raw[i + 1] ?? 0) });
    }

    return entries;
  }
}
