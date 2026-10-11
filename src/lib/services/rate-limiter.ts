/**
 * High-performance sliding-window in-memory rate limiter.
 * Protects sensitive endpoints (Auth, Review Submissions) against
 * brute-force attacks, resource exhaustion, and denial of service.
 */

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  currentCount: number;
  maxRequests: number;
  remaining: number;
  resetMs: number;
}

// In-memory sliding window store: key -> array of request timestamps in ms
const requestWindows = new Map<string, number[]>();

// Automatic cleanup interval to prevent memory growth
const CLEANUP_INTERVAL_MS = 60 * 1000;
let lastCleanup = Date.now();

function cleanupExpiredEntries(now: number, maxRetentionMs: number = 300 * 1000) {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;

  for (const [key, timestamps] of requestWindows.entries()) {
    const valid = timestamps.filter((t) => now - t < maxRetentionMs);
    if (valid.length === 0) {
      requestWindows.delete(key);
    } else {
      requestWindows.set(key, valid);
    }
  }
}

/**
 * Checks and updates rate limit for a specific identifier (e.g. IP address or User ID).
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  cleanupExpiredEntries(now, config.windowMs * 2);

  const windowStart = now - config.windowMs;
  const timestamps = requestWindows.get(key) || [];

  // Filter timestamps within current sliding window
  const activeTimestamps = timestamps.filter((t) => t > windowStart);

  if (activeTimestamps.length >= config.maxRequests) {
    const oldest = activeTimestamps[0];
    const resetMs = Math.max(0, oldest + config.windowMs - now);

    return {
      allowed: false,
      currentCount: activeTimestamps.length,
      maxRequests: config.maxRequests,
      remaining: 0,
      resetMs,
    };
  }

  // Record this request
  activeTimestamps.push(now);
  requestWindows.set(key, activeTimestamps);

  return {
    allowed: true,
    currentCount: activeTimestamps.length,
    maxRequests: config.maxRequests,
    remaining: config.maxRequests - activeTimestamps.length,
    resetMs: config.windowMs,
  };
}

/**
 * Standard route rate limit tier definitions.
 */
export const RATE_LIMIT_TIERS: Record<string, RateLimitConfig> = {
  // Auth endpoints (brute-force defense): 10 requests / min
  AUTH: { maxRequests: 10, windowMs: 60 * 1000 },
  // Evaluator scoring (high burst capacity): 60 requests / min
  EVALUATOR: { maxRequests: 60, windowMs: 60 * 1000 },
  // General queries: 200 requests / min
  GENERAL: { maxRequests: 200, windowMs: 60 * 1000 },
};

/**
 * Resets rate limit store (useful for testing).
 */
export function resetRateLimits() {
  requestWindows.clear();
}
