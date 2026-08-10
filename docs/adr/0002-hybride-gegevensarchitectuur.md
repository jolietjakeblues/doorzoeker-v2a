# ADR-0002: Hybride gegevensarchitectuur met verwisselbare adapters

- Status: geaccepteerd
- Datum: 2026-08-06
- Bijgewerkt: 2026-08-10

## Context

De RCE publiceert object-, register-, bibliotheek-, beeld- en kennisdata over
meerdere Linked Data-datasets. Geen enkel endpoint is op zichzelf een complete
publiekszoekmachine. De objectdata gebruikt bovendien concept-URI's uit
Referentienetwerk 2, terwijl Bibliotheek en Beeldbank CHT gebruiken.

## Besluit

De webclient communiceert met een eigen, taakgerichte applicatie-API. Externe
datasets blijven achter afzonderlijke serveradapters:

- een CHO-adapter voor zoeken, objectdetails, relaties en geometrie;
- een Referentienetwerk-adapter voor RN2-concepten en woordsuggesties;
- een Bibliotheek-adapter voor publicaties die via Rijksmonumentnummer zijn
  gekoppeld;
- RCE-MCP als optioneel hulpmiddel voor onderzoek en beheer, niet als
  verplichte runtime-laag;
- eventueel later een zoekindex, maar alleen als metingen aantonen dat de
  live aanpak tekortschiet.

De termenadapter bevraagt voor de algemene CHO-zoekbalk uitsluitend vier
schema's binnen Referentienetwerk 2: Archeologisch Informatie Systeem,
Cultuurhistorische Object Informatie, Kennisregistratie en Monumenten
Registratie Systeem. Een suggestie is een tekstvoorstel. Alleen gecontroleerde
velden mogen een exacte conceptzoekroute gebruiken.

## Randvoorwaarden

- URI's blijven de canonieke identiteit van objecten en concepten.
- De browser kan geen willekeurige SPARQL-query doorsturen.
- Invoer die in een SPARQL-URI terechtkomt wordt tegen een vaste namespace of
  objectvorm gevalideerd.
- Upstream-aanroepen hebben een harde time-out en een begrensde resultset.
- Presentatiemodellen lekken geen endpoint-specifieke RDF-structuur naar de
  webclient.
- Caching en uitval van een verrijking mogen een gewone zoekopdracht niet
  onnodig blokkeren.

## Huidige routes

- `GET /api/rce/search`: tekstzoeken, bladeren en exacte conceptzoekacties;
- `GET /api/rce/concept`: RN2-conceptmetadata;
- `GET /api/rce/complex-members`: leden en geometrieën van een Complex;
- `GET /api/rce/onderzoeksgebied-verrijking`: archeologische complexen,
  vondstlocaties en aggregaten;
- `GET /api/rce/op-deze-dag`: dagelijkse Rijksmonumentselectie;
- `GET /api/terms/suggest`: RN2-woordsuggesties voor de CHO-zoekbalk.

De zoekroute gebruikt de gedeelde Cloudflare-cache waar die beschikbaar is,
een begrensde microcache per Worker-isolaat en best-effort rate limiting per
isolaat. Dat laatste is geen globale limiet; daarvoor is een Cloudflare
platformregel of Durable Object nodig. De overige routes gebruiken bewuste
HTTP-cacheheaders passend bij de veranderlijkheid van hun gegevens.

## Gevolgen

- De UI blijft onafhankelijk van wijzigingen in een afzonderlijk endpoint.
- CHO, RN2 en Bibliotheek kunnen samen één detailweergave vullen zonder hun
  verschillende identiteiten te verbergen.
- Live data en een eventuele eigen index kunnen later naast elkaar bestaan.
- Er blijft servercode nodig voor querybouw, mapping, caching,
  foutafhandeling en observability.
