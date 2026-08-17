# Doorzoeker: erfgoed digitaal

[![CI](https://github.com/jolietjakeblues/doorzoeker-v2a/actions/workflows/ci.yml/badge.svg)](https://github.com/jolietjakeblues/doorzoeker-v2a/actions/workflows/ci.yml)

Doorzoeker maakt de Linked Data van de Rijksdienst voor het Cultureel Erfgoed
doorzoekbaar zonder alles terug te brengen tot Rijksmonumenten. De applicatie
laat verschillende soorten erfgoed als verschillende objecten zien en houdt de
bron-URI's bij de gegevens.

Doorzoeker is in publieke bèta, live op
[doorzoekerfgoed.nl](https://doorzoekerfgoed.nl). Een bug gevonden of een
suggestie? [Meld het via GitHub Issues](https://github.com/jolietjakeblues/doorzoeker-v2a/issues/new?template=bug_report.md).

Deze repository is een schone herbouw van Doorzoeker. Er is geen code uit
[Doorzoeker V1](https://github.com/jolietjakeblues/doorzoeker_v1) gekopieerd.

## Wat je kunt doorzoeken

- Rijksmonumenten, gebouwd en archeologisch;
- Werelderfgoed;
- rijksbeschermde stads- en dorpsgezichten, in de interface kortweg
  `Gezichten`;
- Complexen van gebouwde Rijksmonumenten;
- archeologische terreinen;
- archeologische vondstlocaties;
- archeologische grondsporen;
- archeologische onderzoeksgebieden.

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

Zie [Functionele dekking](docs/functionele-dekking.md) voor het precieze
onderscheid tussen zelfstandige objecten, gekoppelde lijsten en tellingen.

## Zoeken en begrippen

De algemene zoekbalk zoekt in aangesloten CHO-velden, waaronder nummer,
plaats, functie, type en omschrijving. Tekstzoekopdrachten kunnen volgende
pagina's van 25 resultaten laden.

Woordsuggesties komen uit vier schema's binnen Referentienetwerk 2:

- Archeologisch Informatie Systeem;
- Cultuurhistorische Object Informatie;
- Kennisregistratie;
- Monumenten Registratie Systeem.

Doorzoeker controleert per suggestie of die concept-URI werkelijk in een
ondersteund CHO-veld voorkomt. Is dat zo, dan toont de zoekbalk het aantal
gekoppelde objecten en zoekt een klik exact op de URI. Dit werkt voor functie,
monumentaard, vondsttype, materiaal, toestand en archeologisch complextype.
Een term zonder aangetoonde koppeling blijft zichtbaar een tekstzoekopdracht;
de thesaurus wordt dus niet voorgesteld als een volledige CHO-index. Ook
archeologische waardering, gebeurtenistype en actor zijn vanuit records exact
doorzoekbaar. Het losse ABR wordt niet gebruikt als interne CHO-begrippenlaag.
Bibliotheek en Beeldbank gebruiken CHT in hun eigen brondata.

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
- een Beeldbankfoto met bron en rechten;
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

- `rce/cho`: objecten, relaties, geometrie en een deel van de verrijkingen;
- `thesauri/referentienetwerk`: concepten en de vier gebruikte RN2-schema's;
- `rce/bibliotheek`: gekoppelde publicaties;
- RCE-MCP: hulpmiddel voor onderzoek en queryontwikkeling, geen verplichte
  runtime-laag van de webapp.

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
- `lib/rce/types.ts`, `geometry.ts` en `sparql.ts`: gedeelde basis.

Zie [Consolidatieplan](docs/consolidatieplan.md) voor de gemaakte grenzen en
[Beheerbesluiten](docs/beheerbesluiten.md) voor de uitgestelde major-updates
en de licentiekeuze.

## Nog niet gebouwd

- ruimtelijke `ligt in`-relaties tussen Rijksmonumenten en
  Werelderfgoed/Gezichten;
- de geometrie van historische groenaanleg als aparte kaartlaag;
- de functies uit verticale slices die uitdrukkelijk de status `Plan` hebben.

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
