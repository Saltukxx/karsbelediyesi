type Entry = { timestamps: number[] };

const store = new Map<string, Entry>();

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

/** Process-local sliding window. Returns true if allowed. */
export function checkLoginRateLimit(ip: string, phone: string): boolean {
  const key = `${ip}|${phone}`;
  const now = Date.now();
  const entry = store.get(key) ?? { timestamps: [] };
  entry.timestamps = entry.timestamps.filter((t) => now - t < WINDOW_MS);
  if (entry.timestamps.length >= MAX_ATTEMPTS) {
    store.set(key, entry);
    return false;
  }
  entry.timestamps.push(now);
  store.set(key, entry);
  return true;
}

export function clientIp(req: Request): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip") || "unknown";
}
