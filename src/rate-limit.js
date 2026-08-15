// Simple in-memory fixed-window rate limiter. Buckets are keyed by an
// arbitrary string (e.g. an IP address) and pruned lazily so the map never
// grows without bound.
const buckets = new Map(); // key -> { count, resetAt }

let lastPrune = 0;

function prune(now) {
  // Prune expired buckets at most once a minute.
  if (now - lastPrune < 60_000) return;
  lastPrune = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export function checkRateLimit(key, { limit, windowMs }, now = Date.now()) {
  prune(now);
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }
  if (bucket.count >= limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }
  bucket.count++;
  return { ok: true, remaining: limit - bucket.count, retryAfterSeconds: 0 };
}

export function resetRateLimit(key) {
  buckets.delete(key);
}
