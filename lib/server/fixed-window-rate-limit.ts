import { capMapSize } from "./expiring-map.ts";

export type RateLimitEntry = { count: number; resetAt: number };

type FixedWindowOptions = {
  limit: number;
  maxEntries: number;
  now: number;
  windowMs: number;
};

function pruneExpiredWindows(entries: Map<string, RateLimitEntry>, now: number) {
  for (const [id, entry] of entries) {
    if (entry.resetAt <= now) entries.delete(id);
  }
}

export function consumeFixedWindow(
  entries: Map<string, RateLimitEntry>,
  id: string,
  options: FixedWindowOptions,
) {
  const current = entries.get(id);
  if (current && current.resetAt > options.now) {
    if (current.count >= options.limit) return false;
    current.count += 1;
    return true;
  }

  if (current) entries.delete(id);
  if (entries.size >= options.maxEntries) {
    pruneExpiredWindows(entries, options.now);
  }
  capMapSize(entries, options.maxEntries);

  entries.set(id, { count: 1, resetAt: options.now + options.windowMs });
  return true;
}
