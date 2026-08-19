export type SharedCachePolicy = {
  browserSeconds: number;
  sharedSeconds: number;
};

export const CACHE_POLICY = {
  conceptDetails: { browserSeconds: 300, sharedSeconds: 3_600 },
  relatedObjects: { browserSeconds: 60, sharedSeconds: 300 },
  searchResults: { browserSeconds: 60, sharedSeconds: 300 },
  termSuggestions: { browserSeconds: 60, sharedSeconds: 300 },
  // 017-archeologische-context-onderzoeksgebied.md: dit resultaat kost 15+
  // seconden om te berekenen maar verandert vrijwel nooit (een rijksmonument-
  // locatie en de archeologie eronder liggen vast) - een maand lange
  // s-maxage is bewust gekozen boven de gebruikelijke minuten, zie
  // "Beslissingen" in dat document.
  archeologischeContext: { browserSeconds: 3_600, sharedSeconds: 2_592_000 },
} as const satisfies Record<string, SharedCachePolicy>;

export const NO_STORE = "no-store";

export function sharedCacheControl(policy: SharedCachePolicy) {
  return `public, max-age=${policy.browserSeconds}, s-maxage=${policy.sharedSeconds}`;
}
