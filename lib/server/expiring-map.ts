type ExpiringValue = { expiresAt: number };

export function pruneExpiredEntries<Key, Value extends ExpiringValue>(
  entries: Map<Key, Value>,
  now = Date.now(),
) {
  let removed = 0;

  for (const [key, value] of entries) {
    if (value.expiresAt > now) continue;
    entries.delete(key);
    removed += 1;
  }

  return removed;
}
