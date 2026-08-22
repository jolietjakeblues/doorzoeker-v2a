import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeMassDescriptionHtml } from "../lib/server/html-sanitize.ts";

const BASE = "https://mass.cultureelerfgoed.nl";

test("laat toegestane tags en tekst ongemoeid", () => {
  const out = sanitizeMassDescriptionHtml("<h1>Historie</h1><p>Een <strong>fregat</strong>.</p>", BASE);
  assert.equal(out, "<h1>Historie</h1><p>Een <strong>fregat</strong>.</p>");
});

test("pakt niet-toegestane tags uit maar behoudt de inhoud (bv. de div-wrappers uit de brondata)", () => {
  const out = sanitizeMassDescriptionHtml('<div lang="en"><p>Hendrika</p></div>', BASE);
  assert.equal(out, "<p>Hendrika</p>");
});

test("verwijdert script-tags mét inhoud, niet alleen de tag", () => {
  const out = sanitizeMassDescriptionHtml("<p>voor</p><script>alert(document.cookie)</script><p>na</p>", BASE);
  assert.equal(out, "<p>voor</p><p>na</p>");
  assert.ok(!out.includes("alert"));
});

test("verwijdert style-tags mét inhoud", () => {
  const out = sanitizeMassDescriptionHtml("<style>body{display:none}</style><p>tekst</p>", BASE);
  assert.equal(out, "<p>tekst</p>");
});

test("laat alleen href over op <a>, verwijdert onclick en andere attributen", () => {
  const out = sanitizeMassDescriptionHtml('<a href="https://example.org" onclick="steal()" target="_blank">link</a>', BASE);
  assert.equal(out, '<a href="https://example.org">link</a>');
  assert.ok(!out.includes("onclick"));
});

test("weigert javascript:-URL's in href", () => {
  const out = sanitizeMassDescriptionHtml('<a href="javascript:alert(1)">klik</a>', BASE);
  assert.equal(out, "<a>klik</a>");
});

test("weigert data:-URL's in src (bv. een data:text/html-payload)", () => {
  const out = sanitizeMassDescriptionHtml('<img src="data:text/html,<script>alert(1)</script>" alt="x">', BASE);
  assert.ok(!out.includes("data:"));
});

test("weigert javascript:-URL's ondanks tabs/spaties/hoofdletters (bekende XSS-omzeiling)", () => {
  const out = sanitizeMassDescriptionHtml('<a href="\tJaVaScRiPt:alert(1)">klik</a>', BASE);
  assert.equal(out, "<a>klik</a>");
});

test("weigert javascript:-URL's verstopt achter decimale karakterverwijzingen (&#58; voor de dubbele punt, gemeld door een externe review 22-08-2026: de browser decodeert dit tijdens attribute-value tokenizing, ná een letterlijke stringcheck)", () => {
  const out = sanitizeMassDescriptionHtml('<a href="javascript&#58;alert(1)">klik</a>', BASE);
  assert.equal(out, "<a>klik</a>");
});

test("weigert javascript:-URL's verstopt achter hexadecimale karakterverwijzingen (&#x3a;)", () => {
  const out = sanitizeMassDescriptionHtml('<a href="javascript&#x3a;alert(1)">klik</a>', BASE);
  assert.equal(out, "<a>klik</a>");
});

test("weigert javascript:-URL's met een karakterverwijzing zonder puntkomma (&#58 zonder ;, browsers accepteren dit ook)", () => {
  const out = sanitizeMassDescriptionHtml('<a href="javascript&#58alert(1)">klik</a>', BASE);
  assert.equal(out, "<a>klik</a>");
});

test("weigert een karakterverwijzing die het hele schema spelt, niet alleen de dubbele punt", () => {
  const out = sanitizeMassDescriptionHtml('<a href="&#106;avascript:alert(1)">klik</a>', BASE);
  assert.equal(out, "<a>klik</a>");
});

test("staat een echte relatieve of https-link gewoon toe (allowlist mag geen valse positieven geven)", () => {
  const relative = sanitizeMassDescriptionHtml('<a href="/pagina">link</a>', BASE);
  assert.equal(relative, '<a href="/pagina">link</a>');
  const https = sanitizeMassDescriptionHtml('<a href="https://voorbeeld.nl">link</a>', BASE);
  assert.equal(https, '<a href="https://voorbeeld.nl">link</a>');
  const mailto = sanitizeMassDescriptionHtml('<a href="mailto:info@voorbeeld.nl">link</a>', BASE);
  assert.equal(mailto, '<a href="mailto:info@voorbeeld.nl">link</a>');
});

test("lost een relatief <img src> op tegen de MASS-basis-URL", () => {
  const out = sanitizeMassDescriptionHtml('<img src="/photos/l/00000003.jpg" alt="foto">', BASE);
  assert.equal(out, '<img src="https://mass.cultureelerfgoed.nl/photos/l/00000003.jpg" alt="foto">');
});

test("laat een absolute <img src> ongemoeid (geen dubbele basis-URL)", () => {
  const out = sanitizeMassDescriptionHtml('<img src="https://andere-bron.nl/foto.jpg" alt="x">', BASE);
  assert.ok(out.includes('src="https://andere-bron.nl/foto.jpg"'));
});

test("een ongeldige/onafgesloten tag verdwijnt niet stilletjes maar wordt als tekst getoond", () => {
  const out = sanitizeMassDescriptionHtml("prijs < 100 euro", BASE);
  assert.equal(out, "prijs &lt; 100 euro");
});

test("een '>' binnen een aanhalingsteken van een attribuutwaarde breekt de tag-parser niet", () => {
  const out = sanitizeMassDescriptionHtml('<a href="https://example.org/?a=1&b=2>3">link</a>', BASE);
  assert.ok(out.startsWith("<a href="));
  assert.ok(out.endsWith("</a>"));
});

test("comments verdwijnen volledig, ook als ze op een tag lijken", () => {
  const out = sanitizeMassDescriptionHtml("<p>voor</p><!-- <script>alert(1)</script> --><p>na</p>", BASE);
  assert.equal(out, "<p>voor</p><p>na</p>");
});

test("geneste tabellen (table/tbody/tr/th/td) blijven intact, class-attributen verdwijnen", () => {
  const out = sanitizeMassDescriptionHtml(
    '<table class="metavalues"><tbody><tr><th scope="row">Lengte</th><td>100 voet</td></tr></tbody></table>',
    BASE,
  );
  assert.equal(out, "<table><tbody><tr><th>Lengte</th><td>100 voet</td></tr></tbody></table>");
});

test("dubbel geneste script-tags blijven correct onderdrukt (skip-diepte klopt)", () => {
  const out = sanitizeMassDescriptionHtml("<script><script>alert(1)</script>alert(2)</script><p>na</p>", BASE);
  assert.equal(out, "<p>na</p>");
});

test("bestaande HTML-entiteiten in tekst blijven ongewijzigd staan", () => {
  const out = sanitizeMassDescriptionHtml("<p>Van &rsquo;t schip is niets meer vernomen &amp; niets teruggevonden.</p>", BASE);
  assert.equal(out, "<p>Van &rsquo;t schip is niets meer vernomen &amp; niets teruggevonden.</p>");
});

test("een echte voorbeeldomschrijving uit MASS wordt schoon herbouwd zonder inhoud te verliezen", () => {
  const html =
    '<h1 id="h-history">Historie</h1>\n<div lang="en"><p>Hendrika was a small frigate.</p> ' +
    '<figure class="img-wrapper"><img src="/photos/l/00000001.jpg" alt="Drawing"> ' +
    '<figcaption class="img-description">Drawing W.Boon.</figcaption></figure></div>\n' +
    '<h1 id="h-references">Referenties</h1>\n<div lang="en"><ul><li><a href="http://example.org/x.pdf">De ondergang (pdf).</a></li></ul></div>';
  const out = sanitizeMassDescriptionHtml(html, BASE);
  assert.ok(out.includes("<h1>Historie</h1>"));
  assert.ok(out.includes("<p>Hendrika was a small frigate.</p>"));
  assert.ok(out.includes('<img src="https://mass.cultureelerfgoed.nl/photos/l/00000001.jpg" alt="Drawing">'));
  assert.ok(out.includes("<figcaption>Drawing W.Boon.</figcaption>"));
  assert.ok(out.includes("<h1>Referenties</h1>"));
  assert.ok(out.includes('<a href="http://example.org/x.pdf">De ondergang (pdf).</a>'));
  assert.ok(!out.includes("<div"));
  assert.ok(!out.includes('id="'));
});
