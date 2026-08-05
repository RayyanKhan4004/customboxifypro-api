import type { ThrottlerStorage } from '@nestjs/throttler';
import type Redis from 'ioredis';

interface ThrottlerStorageRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

const SCRIPT = `
local hits = redis.call('INCR', KEYS[1])
if hits == 1 then
  redis.call('PEXPIRE', KEYS[1], tonumber(ARGV[1]))
end
local ttlMs = redis.call('PTTL', KEYS[1])
local blockedKey = KEYS[1] .. ':blocked'
local isBlocked = 0
local timeToBlockExpire = 0
if hits > tonumber(ARGV[2]) and tonumber(ARGV[3]) > 0 then
  local remaining = redis.call('PTTL', blockedKey)
  if remaining <= 0 then
    redis.call('SET', blockedKey, '1', 'PX', tonumber(ARGV[3]))
    remaining = tonumber(ARGV[3])
  end
  isBlocked = 1
  timeToBlockExpire = remaining
end
return { hits, ttlMs, isBlocked, timeToBlockExpire }
`;

export class RedisThrottlerStorage implements ThrottlerStorage {
  constructor(private readonly redis: Redis) {
    this.redis.defineCommand('throttleIncr', {
      numberOfKeys: 1,
      lua: SCRIPT,
    });
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const result = await (
      this.redis as Redis & {
        throttleIncr: (
          key: string,
          ttl: number,
          limit: number,
          blockDuration: number,
        ) => Promise<[number, number, number, number]>;
      }
    ).throttleIncr(
      `throttle:${throttlerName}:${key}`,
      ttl,
      limit,
      blockDuration,
    );

    return {
      totalHits: result[0],
      timeToExpire: result[1],
      isBlocked: result[2] === 1,
      timeToBlockExpire: result[3],
    };
  }
}
