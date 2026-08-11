import assert from "node:assert/strict";
import test from "node:test";
import { consumeFixedWindow } from "../lib/server/fixed-window-rate-limit.ts";

const options = (now, overrides = {}) => ({
  limit: 2,
  maxEntries: 5_000,
  now,
  windowMs: 60_000,
  ...overrides,
});

test("blocks above the limit and resets exactly at the window boundary", () => {
  const entries = new Map();

  assert.equal(consumeFixedWindow(entries, "client", options(1_000)), true);
  assert.equal(consumeFixedWindow(entries, "client", options(1_001)), true);
  assert.equal(consumeFixedWindow(entries, "client", options(1_002)), false);
  assert.equal(consumeFixedWindow(entries, "client", options(61_000)), true);
  assert.deepEqual(entries.get("client"), { count: 1, resetAt: 121_000 });
});

test("prunes expired clients before evicting one live client at capacity", () => {
  const entries = new Map([
    ["expired", { count: 1, resetAt: 999 }],
    ["live", { count: 1, resetAt: 2_000 }],
  ]);

  assert.equal(consumeFixedWindow(entries, "new", options(1_000, { maxEntries: 2 })), true);
  assert.deepEqual([...entries.keys()], ["live", "new"]);
});

test("evicts only the oldest client when every window is still live", () => {
  const entries = new Map([
    ["oldest", { count: 1, resetAt: 2_000 }],
    ["newer", { count: 1, resetAt: 2_000 }],
  ]);

  assert.equal(consumeFixedWindow(entries, "new", options(1_000, { maxEntries: 2 })), true);
  assert.deepEqual([...entries.keys()], ["newer", "new"]);
});
