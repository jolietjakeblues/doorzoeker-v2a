# ADR-0002: Hybride gegevensarchitectuur met verwisselbare adapters

- Status: geaccepteerd
- Datum: 2026-08-06
- Bijgewerkt: 2026-09-14 (routelijst en schema-aantal geactualiseerd, MASS/
  Muurschilderingen/beeldbank-IIIF en "Stel een vraag" toegevoegd - zie
  "Uitbreiding: Stel een vraag" onderaan). Bijgewerkt 2026-09-15: eerste
  externe, niet-RCE datakoppeling toegevoegd (`/api/rce/wikidata`).

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
- een MASS-adapter voor scheepswrakken - een losstaande dataset met een
  eigen `schema.org`-vocabulaire, geen CEO (toegevoegd 20-08-2026);
- een Muurschilderingen-adapter - eveneens een losstaande dataset, geen CEO
  (toegevoegd 09-09-2026);
- RCE-MCP als optioneel hulpmiddel voor onderzoek en beheer, niet als
  verplichte runtime-laag - sinds 28-08-2026 óók actief gebruikt tijdens het
  genereren van een SPARQL-query in "Stel een vraag", zie onderaan;
- sinds 15-09-2026: een lazy Wikidata-koppeling (`/api/rce/wikidata`) - de
  EERSTE keer dat Doorzoeker een extern, niet-RCE linked-data-endpoint
  aanroept (`query.wikidata.org`, niet `linkeddata.cultureelerfgoed.nl`).
  Zelfde randvoorwaarden als de overige lazy-verrijkingen hieronder (harde
  timeout, mag een gewone zoekopdracht niet blokkeren, faalt naar `null`
  i.p.v. de rest van het detail te breken);
- eventueel later een zoekindex, maar alleen als metingen aantonen dat de
  live aanpak tekortschiet.

De termenadapter bevraagt voor de algemene CHO-zoekbalk sinds 21 augustus
2026 nog maar twee schema's binnen Referentienetwerk 2: Archeologisch
Informatie Systeem en Monumenten Registratie Systeem (Cultuurhistorische
Object Informatie en Kennisregistratie leverden geen bruikbare CHO-
suggesties op). Een suggestie is een tekstvoorstel. Alleen gecontroleerde
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

- `GET /api/rce/search`: tekstzoeken, bladeren en exacte conceptzoekacties
  (paginering dekt sinds 14-09-2026 ook de archeologiecategorieën, niet
  alleen de Rijksmonument-scope);
- `GET /api/rce/concept`: RN2-conceptmetadata;
- `GET /api/rce/complex-members`: leden en geometrieën van een Complex;
- `GET /api/rce/onderzoeksgebied-verrijking`: archeologische complexen,
  vondstlocaties en aggregaten;
- `GET /api/rce/vondstlocatie-inhoud`: begrensde vondsten, grondsporen en
  archeologische complexen met RN2-herkomst;
- `GET /api/rce/archeologische-context`: archeologische onderzoeksgebieden
  die overlappen met een Rijksmonument;
- `GET /api/rce/ligt-in`: ruimtelijke `ligt in`-relatie met Werelderfgoed/
  Gezicht, live berekend per geopend Rijksmonument-detail;
- `GET /api/rce/omschrijving-onderwerp`: CHT/ABR-begrippen gekoppeld aan de
  formele omschrijving, lazy per geopend Rijksmonument-detail;
- `GET /api/rce/werelderfgoed-geometrie`: geometrie van een Werelderfgoed-
  of Gezicht-gebied, lazy bij het openen van de kaartweergave;
- `GET /api/rce/rijksmonument`: exacte, klasse-gebonden lookup op
  `ceo:rijksmonumentnummer` (`class:Rijksmonument`) - geen fan-out naar
  andere objectsoorten zoals de vrije zoekbalk bij een kaal getal wel doet;
- `GET /api/rce/wikidata`: koppeling naar het Wikidata-item van een
  Rijksmonument via property P359, lazy per geopend detail - de EERSTE
  route die een extern, niet-RCE linked-data-endpoint aanroept (zie
  Randvoorwaarden hieronder);
- `GET /api/rce/op-deze-dag`: dagelijkse Rijksmonumentselectie;
- `GET /api/rce/verras-me`: willekeurige Rijksmonumentselectie op klik;
- `GET /api/terms/suggest`: RN2-woordsuggesties voor de CHO-zoekbalk;
- `POST /api/vraag/genereer-sparql`, `POST /api/vraag/uitvoeren`,
  `POST /api/vraag/antwoord`: de "Stel een vraag"-assistent (zie
  "Uitbreiding: Stel een vraag" onderaan) - een ander risicoprofiel dan de
  overige routes (LLM-kosten), daarom een eigen naamsruimte en een eigen,
  strenger rate limit.

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

## Uitbreiding: Stel een vraag (toegevoegd 28-08-2026 t/m 08-09-2026)

De `/api/vraag/*`-routes wijken af van de rest van dit ADR: in plaats van
een RCE-dataset rechtstreeks te bevragen, praat de server hier eerst met een
externe LLM (de Anthropic Messages API) om een vraag in gewone taal naar
SPARQL te vertalen, voert die SPARQL daarna uit tegen dezelfde
`rce/cho`-dienst als de rest van de applicatie (via dezelfde
`fetchSparql`-laag, dus dezelfde time-out- en foutafhandelingsgaranties),
en vraagt de LLM tot slot om het resultaat in leesbaar Nederlands samen te
vatten. Bij het genereren van de query krijgt de LLM via Anthropic's
MCP-connector ook toegang tot de eigenaars eigen `rce-cho`-MCP-server voor
concept-/URI-resolutie - dezelfde server die ook als algemeen
onderzoekshulpmiddel dient (zie de datasetlijst hierboven), hier voor het
eerst ook een actieve runtime-afhankelijkheid, met een automatische
terugval naar de statische kennisbank in `lib/vraag/prompts.ts` als die
server niet bereikbaar is.

Dit voegt een nieuwe randvoorwaarde toe aan dit ADR: **een LLM-aanroep is
geen vervanging van de validatie/time-out/foutafhandelingsgaranties
hierboven, maar staat ervóór** - de door de LLM gegenereerde query
doorloopt dezelfde postprocessing (`lib/vraag/postprocess.ts`: prefixen,
LIMIT-plafond, bracket-balancering) en dezelfde `fetchSparql`-laag als elke
andere query in de applicatie, en een deterministische, gratis
volledigheids- en syntaxcontrole (`lib/vraag/semantic-validator.ts`,
`lib/vraag/syntax-validator.ts`) kan vóór uitvoering één corrigerende
hergeneratie vragen. De browser voert zelf nog steeds geen willekeurige
SPARQL uit; de (mogelijk door de gebruiker bewerkte) query gaat via
`/api/vraag/uitvoeren`, niet rechtstreeks naar RCE.
