export type SharedCachePolicy = {
  browserSeconds: number;
  sharedSeconds: number;
};

export const CACHE_POLICY = {
  conceptDetails: { browserSeconds: 300, sharedSeconds: 3_600 },
  relatedObjects: { browserSeconds: 60, sharedSeconds: 300 },
  searchResults: { browserSeconds: 60, sharedSeconds: 300 },
  termSuggestions: { browserSeconds: 60, sharedSeconds: 300 },
} as const satisfies Record<string, SharedCachePolicy>;

export const NO_STORE = "no-store";

export function sharedCacheControl(policy: SharedCachePolicy) {
  return `public, max-age=${policy.browserSeconds}, s-maxage=${policy.sharedSeconds}`;
}
