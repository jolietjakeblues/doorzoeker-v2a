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

// Gedeeld door elke begrensde in-memory Map in de server-laag (zoekcache,
// termsuggestiecache, rate-limitvensters): houdt de Map onder maxEntries
// door de oudst-ingevoegde sleutel te verwijderen. Map bewaart
// invoegvolgorde, dus de eerste sleutel uit de iterator is altijd de
// oudste - geen aparte tijdstempel-boekhouding nodig.
export function capMapSize<Key, Value>(entries: Map<Key, Value>, maxEntries: number) {
  if (entries.size < maxEntries) return;
  const oldestKey = entries.keys().next().value;
  if (oldestKey !== undefined) entries.delete(oldestKey);
}
