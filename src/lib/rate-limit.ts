// Ad-hoc in-memory rate limiter.
// NOTE: state is per-Worker-instance and resets on cold start. Not durable.
// Good enough to deter casual spam/scrapers; not a replacement for a real
// distributed limiter (Upstash/Redis/Cloudflare RL) if abuse becomes an issue.

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function getClientIp(request: Request): string {
  const h = request.headers;
  return (
    h.get("cf-connecting-ip") ||
    h.get("x-real-ip") ||
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

export function rateLimit(opts: {
  key: string;          // e.g. `reservations:${ip}`
  limit: number;        // max requests
  windowMs: number;     // window length
}): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  const b = buckets.get(opts.key);

  if (!b || b.resetAt <= now) {
    buckets.set(opts.key, { count: 1, resetAt: now + opts.windowMs });
    return { ok: true };
  }

  if (b.count >= opts.limit) {
    return { ok: false, retryAfterSec: Math.ceil((b.resetAt - now) / 1000) };
  }

  b.count += 1;
  return { ok: true };
}

// Light periodic cleanup so the map doesn't grow unbounded.
let lastSweep = 0;
export function maybeSweep() {
  const now = Date.now();
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
}
