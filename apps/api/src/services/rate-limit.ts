type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const limits = new Map<string, RateLimitEntry>();

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

export function checkRateLimit(
  key: string,
  windowMs: number,
  max: number
): RateLimitResult {
  const now = Date.now();
  const entry = limits.get(key);

  if (!entry || now >= entry.resetAt) {
    const resetAt = now + windowMs;
    limits.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: max - 1, resetAt };
  }

  if (entry.count >= max) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count += 1;
  limits.set(key, entry);
  return { allowed: true, remaining: Math.max(0, max - entry.count), resetAt: entry.resetAt };
}
