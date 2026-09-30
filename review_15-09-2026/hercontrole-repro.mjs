// Hercontrole dd647f7. Alle externe aanroepen zijn mocks.
import assert from 'node:assert/strict';
const root = 'file:///C:/AI/doorzoeker-v2a-standalone/';
const { POST } = await import(root + 'app/api/vraag/uitvoeren/route.ts');
const { executeVraagQuery, generateAntwoord } = await import(root + 'lib/server/vraag-adapter.ts');
const { assertSafeVraagQuery, enforceOuterLimit } = await import(root + 'lib/vraag/query-guard.ts');
const { Parser } = await import(root + 'node_modules/@traqula/parser-sparql-1-2/dist/esm/index.js').catch(async () => {
  // Resolve package through the installed project context.
  const { createRequire } = await import('node:module');
  return createRequire(root + 'package.json')('@traqula/parser-sparql-1-2');
});
const oldFetch = globalThis.fetch;
const oldKey = process.env.ANTHROPIC_API_KEY;
try {
  assert.throws(() => assertSafeVraagQuery('SELECT * WHERE { SERVICE <https://example.invalid/> { ?s ?p ?o } }'));
  const nested = enforceOuterLimit('SELECT ?s WHERE { { SELECT ?s WHERE { ?s ?p ?o } LIMIT 5 } ?s ?p2 ?o2 }', 200);
  assert.equal(new Parser().parse(nested).solutionModifiers.limitOffset.limit, 200);
  console.log('HERSTELD: directe SERVICE geweigerd; subquery krijgt buitenste LIMIT 200.');

  let forwarded = '';
  globalThis.fetch = async (_url, init) => {
    forwarded = new URLSearchParams(init.body).get('query');
    return Response.json({ head: { vars: [] }, results: { bindings: [] } });
  };
  const bypass = 'SELECT ?s WHERE { ?s ?p ?o FILTER EXISTS { SERVICE <https://example.invalid/sparql> { ?a ?b ?c } } }';
  const response = await POST(new Request('https://review.test/api/vraag/uitvoeren', { method: 'POST', body: JSON.stringify({ query: bypass }) }));
  assert.equal(response.status, 200);
  assert.match(forwarded, /SERVICE/);
  console.log('OPEN P1: SERVICE binnen FILTER EXISTS wordt door uitvoerroute doorgestuurd.');

  for (const suffix of ['LIMIT 500 OFFSET 10', 'LIMIT 500 # comment']) {
    const query = 'SELECT ?s WHERE { ?s ?p ?o } ' + suffix;
    assert.doesNotThrow(() => new Parser().parse(query));
    const out = enforceOuterLimit(query, 200);
    assert.throws(() => new Parser().parse(out));
    console.log('OPEN P2: ongeldige dubbele LIMIT:', out.replaceAll('\n', ' '));
  }

  process.env.ANTHROPIC_API_KEY = 'mock-only';
  let prompt;
  globalThis.fetch = async (_url, init) => {
    prompt = JSON.parse(init.body).messages[0].content;
    return Response.json({content:[{type:'text',text:'Mock'}],stop_reason:'end_turn'});
  };
  await generateAntwoord('Hoeveel kerken zijn er?', {head:{vars:['aantal']},results:{bindings:[{aantal:{type:'literal',value:'42'}}]}}, 'telling');
  assert.doesNotMatch(prompt, /Noem dan het totaal \(1\)/);
  assert.match(prompt, /totale aantal staat in de kolom/);
  console.log('HERSTELD: telling 42 krijgt geen instructie meer om totaal 1 te noemen.');

  const prefix = 'PREFIX geof: <http://www.opengis.net/def/function/geosparql/> ';
  const where = 'WHERE { ?rm <urn:geometry> ?wkt . ?area <urn:geometry> ?areaWkt . FILTER(geof:sfWithin(?wkt, ?areaWkt)) }';
  const rows = Array.from({length:250}, (_, i) => ({rm:{type:'uri',value:'urn:rm:' + i}, wkt:{type:'literal',value:'POINT(5 5)'},areaWkt:{type:'literal',value:'POLYGON((0 0,10 0,10 10,0 10,0 0))'}}));
  for (const projection of ['SELECT (COUNT(DISTINCT ?rm) AS ?aantal) ', 'SELECT ?rm ']) {
    let calls = 0;
    globalThis.fetch = async () => {
      if (++calls === 1) throw new DOMException('timed out','TimeoutError');
      return Response.json({head:{vars:['rm','wkt','areaWkt']},results:{bindings:rows}});
    };
    const result = await executeVraagQuery(prefix + projection + where + ' LIMIT 5');
    assert.equal(result.results.bindings.length, 200);
    assert.equal(result.head.vars.includes('aantal'), false);
    console.log('OPEN P1: ruimtelijke terugval geeft 200 detailrijen voor', projection.trim(), 'LIMIT 5; telling/projectie/limiet niet hersteld.');
  }
} finally {
  globalThis.fetch = oldFetch;
  if (oldKey === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = oldKey;
}
