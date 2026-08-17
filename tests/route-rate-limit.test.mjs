import assert from "node:assert/strict";
import test from "node:test";
import { createRateLimiter, rateLimitedResponse } from "../lib/server/route-rate-limit.ts";

test("staat tot de limiet toe en blokkeert daarna, per client-id (cf-connecting-ip)", () => {
  const limiter = createRateLimiter(2);
  const request = (ip) => new Request("https://doorzoeker.test/", { headers: { "cf-connecting-ip": ip } });

  assert.equal(limiter.consume(request("1.2.3.4")), true);
  assert.equal(limiter.consume(request("1.2.3.4")), true);
  assert.equal(limiter.consume(request("1.2.3.4")), false);
  // Een andere client heeft zijn eigen budget.
  assert.equal(limiter.consume(request("5.6.7.8")), true);
});

test("valt terug op x-forwarded-for en dan op 'unknown' zonder cf-connecting-ip", () => {
  const limiter = createRateLimiter(1);
  const forwarded = new Request("https://doorzoeker.test/", { headers: { "x-forwarded-for": "9.9.9.9, 1.1.1.1" } });
  const bare = new Request("https://doorzoeker.test/");

  assert.equal(limiter.consume(forwarded), true);
  // Zelfde client-id (eerste IP uit x-forwarded-for) is nu verbruikt.
  assert.equal(limiter.consume(new Request("https://doorzoeker.test/", { headers: { "x-forwarded-for": "9.9.9.9" } })), false);
  assert.equal(limiter.consume(bare), true);
  assert.equal(limiter.consume(bare), false);
});

test("elke createRateLimiter()-aanroep krijgt een eigen, onafhankelijke Map (routes delen geen budget)", () => {
  const a = createRateLimiter(1);
  const b = createRateLimiter(1);
  const request = new Request("https://doorzoeker.test/", { headers: { "cf-connecting-ip": "1.2.3.4" } });

  assert.equal(a.consume(request), true);
  // b's budget is niet aangeraakt door a's verbruik.
  assert.equal(b.consume(request), true);
});

test("rateLimitedResponse geeft 429 met Retry-After", async () => {
  const response = rateLimitedResponse();
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("Retry-After"), "60");
  assert.deepEqual(await response.json(), { error: "Te veel zoekopdrachten. Probeer het over een minuut opnieuw." });
});
