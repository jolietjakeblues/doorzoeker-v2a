// Run: node review-repro.mjs. All external calls are mocked.
import assert from 'node:assert/strict';
const root = 'file:///C:/AI/doorzoeker-v2a-standalone/';
const { POST } = await import(root + 'app/api/vraag/uitvoeren/route.ts');
const { generateAntwoord, executeVraagQuery } = await import(root + 'lib/server/vraag-adapter.ts');
const { capListLimit } = await import(root + 'lib/vraag/postprocess.ts');
const originalFetch = globalThis.fetch;
const originalKey = process.env.ANTHROPIC_API_KEY;
try {
  let forwarded;
  globalThis.fetch = async (_url, init) => {
    forwarded = new URLSearchParams(init.body).get('query');
    return Response.json({ head: { vars: [] }, results: { bindings: [] } });
  };
  const unsafe = 'SELECT * WHERE { SERVICE <https://example.invalid/sparql> { ?s ?p ?o } }';
  const response = await POST(new Request('https://review.test/api/vraag/uitvoeren', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: unsafe }),
  }));
  assert.equal(response.status, 200);
  assert.equal(forwarded, unsafe);
  console.log('CONFIRMED: unrestricted SELECT/SERVICE is forwarded unchanged, without LIMIT. No live request made.');

  process.env.ANTHROPIC_API_KEY = 'mock-only';
  let prompt;
  globalThis.fetch = async (_url, init) => {
    prompt = JSON.parse(init.body).messages[0].content;
    return Response.json({ content: [{ type: 'text', text: 'Mock response' }], stop_reason: 'end_turn' });
  };
  await generateAntwoord('Hoeveel kerken zijn er?', { head: { vars: ['aantal'] }, results: { bindings: [{ aantal: { type: 'literal', value: '42' } }] } });
  assert.match(prompt, /totaal \(1\)/);
  console.log('CONFIRMED: count value 42 yields instruction "Noem dan het totaal (1)". Actual model response not tested.');

  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    if (calls === 1) throw new DOMException('timed out', 'TimeoutError');
    return Response.json({ head: { vars: ['rm'] }, results: { bindings: [{ rm: { type: 'uri', value: 'https://review.test/monument/1' } }] } });
  };
  const result = await executeVraagQuery('PREFIX geof: <http://www.opengis.net/def/function/geosparql/> SELECT ?rm WHERE { ?rm <urn:geometry> ?wkt . ?area <urn:geometry> ?areaWkt . FILTER(geof:sfWithin(?wkt, ?areaWkt)) } LIMIT 200');
  assert.equal(result.results.bindings.length, 0);
  console.log('CONFIRMED: spatial fallback drops every row when geometry variables are not projected; returns successful empty result.');

  const nested = 'SELECT ?s WHERE { { SELECT ?s WHERE { ?s ?p ?o } LIMIT 5 } ?s ?p2 ?o2 }';
  assert.equal(capListLimit(nested), nested);
  console.log('CONFIRMED: LIMIT in subquery prevents adding outer LIMIT.');
} finally {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = originalKey;
}
