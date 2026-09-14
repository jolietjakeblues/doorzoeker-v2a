# Doorzoeker: erfgoed digitaal

[![CI](https://github.com/jolietjakeblues/doorzoeker-v2a/actions/workflows/ci.yml/badge.svg)](https://github.com/jolietjakeblues/doorzoeker-v2a/actions/workflows/ci.yml)

Doorzoeker maakt de Linked Data van de Rijksdienst voor het Cultureel Erfgoed
doorzoekbaar zonder alles terug te brengen tot Rijksmonumenten. De applicatie
laat verschillende soorten erfgoed als verschillende objecten zien en houdt de
bron-URI's bij de gegevens.

Doorzoeker is in publieke bèta, live op
[doorzoekerfgoed.nl](https://doorzoekerfgoed.nl). Een bug gevonden of een
suggestie? [Meld het via GitHub Issues](https://github.com/jolietjakeblues/doorzoeker-v2a/issues/new?template=bug_report.md).

Deze repository is een schone herbouw van Doorzoeker. De originele [Doorzoeker](https://github.com/Joppe-A/rce-doorzoeker) is gebouwd door Fubineva in 2013/2014 (interactieontwerp door Enference) in opdracht van RCE.

## Wat je kunt doorzoeken

- Rijksmonumenten, gebouwd en archeologisch;
- Werelderfgoed;
- rijksbeschermde stads- en dorpsgezichten, in de interface kortweg
  `Gezichten`;
- Complexen van gebouwde Rijksmonumenten;
- archeologische terreinen;
- archeologische vondstlocaties;
- archeologische grondsporen;
- archeologische onderzoeksgebieden;
- scheepswrakken (MASS-dataset);
- muurschilderingen (Muurschilderingendatabase).

Archeologie bestaat uit meer dan onderzoeksgebieden en monumenten. Bij
Rijksmonumenten toont Doorzoeker de archeologische terreinen die daar in de
bron expliciet aan gekoppeld zijn, met Archis-monumentnummer en waardering.
Andere archeologische terreinen hebben geen Rijksmonumentrelatie en zijn nu
als zelfstandige Archis-objecten doorzoekbaar op nummer, naam, plaats,
omschrijving en waardering. De publieke CHO-graph publiceert voor deze klasse
geen eigen WKT-geometrie; daarom belooft Doorzoeker daar geen terreinvlak.
Vondstlocaties zijn zelfstandig doorzoekbaar op hun CHO-nummer, Archis-nummers,
locatienaam, plaats, omschrijving en verwervingswijze. Hun detailweergave
toont begrensde lijsten van archeologische complexen, vondstgroepen en
grondspoorgroepen. De bijbehorende RN2-concepten bewaren hun URI en alle
gevonden conceptschema's. Binnen onderzoeksgebieden toont de detailweergave
archeologische complexen, maximaal 25 gekoppelde vondstlocaties en totalen
voor vondsten, grondsporen en complexen die via vondstlocaties zijn gekoppeld.
Grondsporen zijn daarnaast zelfstandig vindbaar op CHO-nummer, omschrijving,
woonplaats en type. Het detail toont het aantal, de bovenliggende vondstlocatie
en de bron van het typebegrip binnen Referentienetwerk 2. De publieke
CHO-dataset levert voor deze records momenteel geen geometriekoppeling; daarom
verschijnen ze niet op een verzonnen kaartpositie.
Vondsten zijn zelfstandig vindbaar op CHO- of Archis-vondstnummer,
omschrijving, woonplaats, vondsttype, materiaal en toestand. Type, materiaal
en toestand zijn in het detail aanklikbaar: Doorzoeker zoekt dan exact op de
RN2-URI. Zo vindt een klik op `messing` alleen vondsten die werkelijk met dat
materiaalconcept zijn geclassificeerd.
Een archeologisch complex is daarbij een
inhoudelijke duiding, zoals een nederzetting of grafveld; het is niet hetzelfde
als een Complex van gebouwde Rijksmonumenten. Archeologische complexen zijn
zelfstandig vindbaar op CHO-nummer, omschrijving, woonplaats en RN2-type. Het
detail toont alle gepubliceerde oudercontexten: vondstlocatie, archeologisch
terrein en/of onderzoeksgebied.
Scheepswrakken komen uit de losstaande MASS-dataset (`rce/mass`, een eigen
`schema.org`-vocabulaire, geen CEO) en zijn zelfstandig vindbaar op naam en
scheepstype, met een exacte MASS-nummerlookup bij een numerieke term. Het
detail toont scheepstype, een gesaneerde omschrijving met afbeeldingen, het
ontdekt-jaar (indien aanwezig) en een vaste bronvermelding met licentie; er
is geen `Bekijk alles`-browsemodus voor deze categorie.
Muurschilderingen komen uit de eveneens losstaande Muurschilderingendatabase
en zijn zelfstandig vindbaar op gebouwnaam, plaats en maker, met een exacte
rijksmonumentnummerlookup. Het gebouw is het primaire object; heeft het geen
eigen kaartcoördinaat, dan toont Doorzoeker de rijksmonument-centroid als
fallback in plaats van het object van de kaart te laten verdwijnen. Nog geen
afbeeldingen (licentie voor beeldmateriaal nog niet bevestigd door RCE) en
geen `Bekijk alles`-browsemodus.

Zie [Functionele dekking](docs/functionele-dekking.md) voor het precieze
onderscheid tussen zelfstandige objecten, gekoppelde lijsten en tellingen.

## Zoeken en begrippen

De algemene zoekbalk zoekt in aangesloten CHO-velden, waaronder nummer,
plaats, functie, type en omschrijving. Tekstzoekopdrachten kunnen volgende
pagina's van 25 resultaten laden.

Woordsuggesties komen uit twee bronnen. Ten eerste twee CHO-relevante
schema's binnen Referentienetwerk 2:

- Archeologisch Informatie Systeem;
- Monumenten Registratie Systeem.

(Cultuurhistorische Object Informatie en Kennisregistratie leverden geen
bruikbare CHO-suggesties op en zijn eruit gehaald.) Doorzoeker controleert
per RN2-suggestie of die concept-URI werkelijk in een ondersteund CHO-veld
voorkomt. Is dat zo, dan toont de zoekbalk het aantal gekoppelde objecten en
zoekt een klik exact op de URI. Dit werkt voor functie, monumentaard,
vondsttype, materiaal, toestand en archeologisch complextype. Ook
archeologische waardering, gebeurtenistype en actor zijn vanuit records exact
doorzoekbaar.

Ten tweede CHT- en ABR-begrippen die daadwerkelijk aan een formele
Rijksmonument-omschrijving gekoppeld zijn (niet de volledige thesaurus - dat
zou duizenden termen zonder zoekresultaat suggereren). Zo'n suggestie toont
zijn bron (Cultuurhistorische Thesaurus of Archeologisch Basisregister) en
zoekt, net als een RN2-term zonder aangetoonde koppeling, op tekst. Dezelfde
koppeling levert op de detailpagina van een Rijksmonument het veld
"Onderwerp (uit omschrijving)" op: elk concept toont daar zijn
herkomstthesaurus (CHT, ABR of RN) naast het label.

## Stel een vraag

Naast doorzoeken kan Doorzoeker ook een vraag in gewone taal beantwoorden,
via de losse pagina `/vraag`. Claude zet de vraag om in een SPARQL-query
(zichtbaar en bewerkbaar vóór uitvoering), voert die uit tegen dezelfde RCE
Linked Data als de rest van de applicatie, en vat het resultaat in
leesbaar Nederlands samen. Twee modi: een lijst van monumenten of alleen een
telling. Bij het genereren gebruikt Claude ook de eigenaars eigen
`rce-cho`-MCP-server voor concept-/URI-resolutie (bv. om "Utrechtse
Heuvelrug" niet per ongeluk als gemeente Utrecht te laten meetellen), met
een automatische terugval naar de statische kennisbank als die server niet
bereikbaar is. Een lokale ruimtelijke berekening vangt op wanneer een
ruimtelijke SPARQL-vergelijking op de RCE-Virtuoso-dienst zelf vastloopt, en
een deterministische volledigheids- en syntaxcontrole vraagt Claude één keer
om een correctie als de query een deel van de vraag lijkt te missen. Deze
functie is geen vervanging van doorzoeken, maar een derde manier om dezelfde
brondata te bereiken - naast Doorzoeker zelf en de RCE-MCP-server.

## Kaart en geometrie

De kaart ondersteunt `Point`, `Polygon` en `MultiPolygon`. Polygonen behouden
hun afzonderlijke ringen en gaten; MultiPolygonen worden niet tot één punt
platgeslagen. Punten worden op de kaart geclusterd.

Een Complex staat op de gewone resultatenkaart als marker bij het hoofdobject.
Na openen toont de compacte detailkaart de verzameling geometrieën van de
opgehaalde leden. Er wordt geen nieuwe geometrische union berekend: de
bronvormen van de onderdelen blijven afzonderlijk herkenbaar.

## Details en verrijking

Afhankelijk van het objecttype toont Doorzoeker onder meer:

- register- en locatiegegevens;
- oorspronkelijke en huidige functies;
- kadastrale percelen;
- een Beeldbankfoto met bron en rechten, met een "Vergroten"-knop die - waar
  de RCE-beeldbank een IIIF Image API-endpoint publiceert - een inzoombare
  weergave opent;
- historische groenaanleg en MSP-indicatie;
- complexverbanden en een doorklikbare ledenlijst;
- literatuur uit de RCE-bibliotheek;
- bouwgeschiedenis, gebeurtenissen en actoren;
- archeologische terreinen, complexen, vondstlocaties en tellingen.

Filters, pagina, kaartpositie, gekozen object en bekende conceptidentiteit
worden in de URL bewaard. Browser-terug en -vooruit herstellen eerdere
zoekopdrachten.

De grote collecties onder `Bekijk alles` — Rijksmonumenten, Archeologische
terreinen, Onderzoeksgebieden, Vondstlocaties, Archeologische complexen,
Vondsten en Grondsporen — halen steeds 25 objecten op. Met
`Laad 25 volgende resultaten` kan de gebruiker verder bladeren zonder een
hele grote collectie in één keer bij de RCE op te vragen.

## Gegevensvoorzieningen

Doorzoeker bevraagt rechtstreeks de
[RCE Linked Data Voorziening](https://linkeddata.cultureelerfgoed.nl/) via
SPARQL. De objecten en hun relaties zijn gemodelleerd volgens de
[CEO-ontologie](https://linkeddata.cultureelerfgoed.nl/def/ceo)
(Cultureel Erfgoed Ontologie) - de namespace die in iedere querybuilder onder
`lib/rce/` als `ceo:` terugkomt.

- `rce/cho`: objecten, relaties, geometrie, thesaurusgekoppelde
  omschrijvingsbegrippen (CHT/ABR) en een deel van de verrijkingen;
- `thesauri/referentienetwerk`: concepten en de twee gebruikte RN2-schema's;
- `rce/bibliotheek`: gekoppelde publicaties;
- `rce/mass`: scheepswrakken - een losstaande dataset met een eigen
  `schema.org`-vocabulaire, geen CEO;
- `rce/Muurschilderingen`: muurschilderingen - eveneens een losstaande
  dataset, geen CEO;
- `images.memorix.nl` (de RCE-beeldbank): naast de gewone thumbnail-URL ook
  een IIIF Image API-endpoint, gebruikt voor de inzoombare fotoweergave;
- RCE-MCP (`rce-cho-mcp`, door de eigenaar zelf gebouwd en gehost): naast
  hulpmiddel voor onderzoek en queryontwikkeling ook actief gebruikt tijdens
  het genereren van een SPARQL-query in "Stel een vraag" hierboven, via
  Anthropic's MCP-connector - optioneel, niet-blokkerend (automatische
  terugval als de server niet bereikbaar is).

"Stel een vraag" praat daarnaast met de Anthropic Messages API (Claude) om
een vraag in gewone taal naar SPARQL te vertalen en het resultaat samen te
vatten - de enige plek in de applicatie die een externe LLM aanroept, en
dus ook de enige plek met een substantieel kostenprofiel per gebruikersactie.

De browser praat alleen met taakgerichte routes onder `/api`. Willekeurige
SPARQL wordt niet vanuit de browser doorgestuurd. De serveradapters verzorgen
validatie, time-outs, mapping, caching en foutafhandeling.

## Architectuur

`app/page.tsx` orkestreert de zoekpagina. Presentatie staat in losse
componenten voor startinhoud, filters, resultaten, toolbar en details. De
hooks scheiden URL-herstel, request-lifecycle, filtering en detailverrijking.

`lib/rce.ts` is de publieke exportlaag. De RCE-logica is per domein verdeeld:

- `lib/rce/monuments.ts`: gebouwd erfgoed en percelen;
- `lib/rce/archaeology.ts`: archeologische objecten en relaties;
- `lib/rce/terms.ts` en `lib/rce/concepts.ts`: thesauri en exacte conceptzoeking;
- `lib/rce/enrichment.ts`: beeld, groenaanleg, MSP, gebeurtenissen en Op deze dag;
- `lib/rce/scheepswrakken.ts`: scheepswrakken (MASS, losstaand van CEO);
- `lib/rce/muurschilderingen.ts`: muurschilderingen (eigen dataset,
  losstaand van CEO);
- `lib/rce/iiif.ts`: afleiding van een IIIF-endpoint uit een
  Beeldbankfoto-URL, voor de inzoombare fotoweergave;
- `lib/rce/types.ts`, `geometry.ts` en `sparql.ts`: gedeelde basis.

`app/vraag/page.tsx` en `app/VraagScherm.tsx` vormen de losse "Stel een
vraag"-pagina; `lib/vraag/` en `lib/server/vraag-adapter.ts` de eigen
domeinlogica en server-adapter daarachter - een apart subsysteem met een
eigen risicoprofiel (LLM-kosten, een externe Anthropic-aanroep) en dus een
eigen, strenger rate limit dan de rest van de applicatie.

Zie [Consolidatieplan](docs/consolidatieplan.md) voor de gemaakte grenzen en
[Beheerbesluiten](docs/beheerbesluiten.md) voor de uitgestelde major-updates
en de licentiekeuze.

## Nog niet gebouwd

- de geometrie van historische groenaanleg als aparte kaartlaag;
- de functies uit verticale slices die uitdrukkelijk de status `Plan` hebben;
- afbeeldingen bij muurschilderingen (licentie nog niet bevestigd door RCE);
- de IIIF Presentation API voor Beeldbankfoto's (metadata naast de foto,
  bv. via een viewer als Tify) - moet de leverancier van de beeldbank zelf
  aanzetten, buiten wat Doorzoeker zelf kan regelen.

## Documentatie

- [Functionele dekking](docs/functionele-dekking.md)
- [ADR-0001: schone herbouw](docs/adr/0001-schone-herbouw.md)
- [ADR-0002: hybride gegevensarchitectuur](docs/adr/0002-hybride-gegevensarchitectuur.md)
- [Verkende RCE Linked Data-graphs](docs/reference/rce-linked-data-graphs.md)
- [Verticale slices](docs/vertical-slices)

## Ontwikkelen

```sh
npm install
npm run dev
```

Controles:

```sh
npm run typecheck
npm run lint
npm test
npm run test:e2e
```

`npm test` bouwt eerst (`vinext build`) en draait dan alle unit- en
contracttests. Voor snelle iteratie op een enkele test tijdens het
ontwikkelen, zonder te wachten op een build:

```sh
npm run test:unit
```

Alleen de twee testbestanden die het gebouwde Worker-bestand nodig hebben
(`tests/rendered-html.test.mjs`, `tests/worker-security.test.mjs`) draaien
via `npm run test:build`, dat zelf ook eerst bouwt.

## Publiceren

De applicatie wordt gebouwd met vinext en draait op Cloudflare Workers. Een
push naar `main` kan via `.github/workflows/deploy-workers.yml` publiceren,
mits `CLOUDFLARE_API_TOKEN` en `CLOUDFLARE_ACCOUNT_ID` als repository-secrets
zijn ingesteld. Handmatig bouwen en publiceren kan met:

```sh
npm run deploy
```

## Hoe dit gebouwd is

Doorzoeker wordt ontwikkeld met Claude Code als codeerassistent. Elke
wijziging komt binnen als een pull request; er wordt nooit rechtstreeks naar
`main` gecommit en niets merget automatisch. De eigenaar beoordeelt en merget
elke PR zelf, altijd na een groene CI-run (typecheck, lint, unit-tests, de
volledige Playwright-interactietestsuite). De volledige ontwikkel- en
besluitgeschiedenis is publiek na te lezen in [`docs/`](docs), inclusief een
uitgevoerde [security-assessment](docs/security-assessment-2026-08-17.md) en
toegankelijkheidsreview.

## Licentie

De broncode van deze repository valt onder de [MIT-licentie](LICENSE). Dit
geldt alleen voor de broncode: de RCE Linked Data die de applicatie bevraagt
valt onder het eigen hergebruiksbeleid van de RCE/Kadaster, zie
[Beheerbesluiten](docs/beheerbesluiten.md).

## Dank

Met dank aan Dirk, Kees, Hans en Joppe voor de ideeën en inspiratie.

---

*"The future is unwritten."*  
— Joe Strummer

---
