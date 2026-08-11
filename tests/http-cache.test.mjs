import assert from "node:assert/strict";
import test from "node:test";
import { CACHE_POLICY, NO_STORE, sharedCacheControl } from "../lib/server/http-cache.ts";

test("renders the shared cache policy used by search and relation routes", () => {
  assert.equal(
    sharedCacheControl(CACHE_POLICY.searchResults),
    "public, max-age=60, s-maxage=300",
  );
  assert.equal(
    sharedCacheControl(CACHE_POLICY.relatedObjects),
    "public, max-age=60, s-maxage=300",
  );
});

test("keeps concept details longer than volatile search results", () => {
  assert.equal(
    sharedCacheControl(CACHE_POLICY.conceptDetails),
    "public, max-age=300, s-maxage=3600",
  );
});

test("defines one no-store value for non-cacheable responses", () => {
  assert.equal(NO_STORE, "no-store");
});
