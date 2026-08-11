import assert from "node:assert/strict";
import test from "node:test";
import { pruneExpiredEntries } from "../lib/server/expiring-map.ts";

test("removes every expired entry and preserves live entries", () => {
  const entries = new Map([
    ["expired-before", { expiresAt: 999, value: "oud" }],
    ["expired-now", { expiresAt: 1_000, value: "grens" }],
    ["live", { expiresAt: 1_001, value: "actueel" }],
  ]);

  assert.equal(pruneExpiredEntries(entries, 1_000), 2);
  assert.deepEqual([...entries.keys()], ["live"]);
});

test("reports zero when no cache entry has expired", () => {
  const entries = new Map([["live", { expiresAt: 2_000 }]]);

  assert.equal(pruneExpiredEntries(entries, 1_000), 0);
  assert.equal(entries.size, 1);
});
