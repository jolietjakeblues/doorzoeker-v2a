import assert from "node:assert/strict";
import test from "node:test";
import { clusterMapPoints } from "../lib/map-clustering.ts";

test("clusters nearby projected markers and leaves distant markers separate", () => {
  const clusters = clusterMapPoints([
    { item: "a", x: 0, y: 0 },
    { item: "b", x: 20, y: 10 },
    { item: "c", x: 200, y: 200 },
  ], 48);
  assert.deepEqual(clusters.map((cluster) => cluster.items), [["a", "b"], ["c"]]);
});

test("merges a connected chain like the recursive v1 algorithm", () => {
  const clusters = clusterMapPoints([
    { item: "a", x: 0, y: 0 },
    { item: "b", x: 30, y: 0 },
    { item: "c", x: 60, y: 0 },
  ], 31);
  assert.deepEqual(clusters[0].items, ["a", "b", "c"]);
});

test("disables clustering when the radius is zero", () => {
  assert.equal(clusterMapPoints([{ item: "a", x: 0, y: 0 }, { item: "b", x: 0, y: 0 }], 0).length, 2);
});
