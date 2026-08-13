import assert from "node:assert/strict";
import test from "node:test";
import { capMapSize, pruneExpiredEntries } from "../lib/server/expiring-map.ts";

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

test("capMapSize evicts the oldest-inserted key once the cap is reached", () => {
  const entries = new Map([["oudste", 1], ["middelste", 2], ["nieuwste", 3]]);

  capMapSize(entries, 3);

  assert.deepEqual([...entries.keys()], ["middelste", "nieuwste"]);
});

test("capMapSize doet niets zolang de Map onder de cap blijft", () => {
  const entries = new Map([["a", 1], ["b", 2]]);

  capMapSize(entries, 3);

  assert.deepEqual([...entries.keys()], ["a", "b"]);
});
