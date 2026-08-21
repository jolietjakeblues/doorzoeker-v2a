import assert from "node:assert/strict";
import test from "node:test";
import { withRceErrorHandling } from "../lib/server/route-error-handling.ts";

test("een TimeoutError geeft 504 met een eerlijker bericht dan een echte connectiviteitsfout", async () => {
  // Live geraakt 21-08-2026: AbortSignal.timeout() (requestSignal in
  // sparql-client.ts) verwerpt met een TimeoutError-DOMException wanneer een
  // breed RN2-begrip de standaard 20s-timeout raakt terwijl de RCE-bron zelf
  // gewoon bereikbaar is. "Niet bereikbaar" (502) suggereert dan ten
  // onrechte een storing.
  const response = await withRceErrorHandling(
    { event: "test.timeout" },
    async () => { throw new DOMException("signal timed out", "TimeoutError"); },
  );
  assert.equal(response.status, 504);
  assert.deepEqual(await response.json(), {
    error: "Deze zoekopdracht duurt op dit moment ongewoon lang bij de RCE-bron. Probeer het over een paar seconden opnieuw.",
  });
});

test("herkent ook de Node/undici-foutmelding voor een timeout, niet alleen de DOMException-naam", () => {
  return withRceErrorHandling(
    { event: "test.timeout-message" },
    async () => { throw new Error("The operation was aborted due to timeout"); },
  ).then(async (response) => {
    assert.equal(response.status, 504);
    assert.match((await response.json()).error, /ongewoon lang/);
  });
});

test("een gewone fout blijft 502 met het bestaande 'niet bereikbaar'-bericht", async () => {
  const response = await withRceErrorHandling(
    { event: "test.connectivity" },
    async () => { throw new Error("offline"); },
  );
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { error: "De RCE Linked Data-service is momenteel niet bereikbaar." });
});

test("een route kan zijn eigen timeoutbericht en foutbericht meegeven", async () => {
  const response = await withRceErrorHandling(
    { event: "test.custom", message: "Aangepast niet-bereikbaar-bericht.", timeoutMessage: "Aangepast timeoutbericht." },
    async () => { throw new DOMException("signal timed out", "TimeoutError"); },
  );
  assert.deepEqual(await response.json(), { error: "Aangepast timeoutbericht." });
});

test("een succesvolle handler laat de fout-afhandeling ongemoeid", async () => {
  const response = await withRceErrorHandling(
    { event: "test.success" },
    async () => Response.json({ ok: true }),
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
});
