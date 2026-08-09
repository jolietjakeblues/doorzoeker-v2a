# RCE Linked Data: verkende graphs

Naast `graph/instanties-rce` (de graph die Doorzoeker als primaire bron
gebruikt) bestaan er op
`https://api.linkeddata.cultureelerfgoed.nl/datasets/rce/cho/sparql` meer named
graphs met relevante data. Onderzocht op 2026-08-07.

## `graph/image-1` (en `graph/image`) — beeldbank/foto's

**Geïntegreerd (2026-08-07).** ~91.834 `edm:ProvidedCHO`-records, gekoppeld aan
Rijksmonumenten via `edm:aggregatedCHO`. Per afbeelding:

- `foaf:depiction` — kant-en-klare thumbnail-URL (`images.memorix.nl/rce/thumb/640x480/{id}.jpg`)
- `dc:title` / `dc:description` — titel en beschrijving
- `dc:rights` — licentie-URI (Creative Commons), nodig voor correcte bronvermelding
- `edm:isShownAt` — link naar de RCE Beeldbank- of Wikimedia Commons-detailpagina
- `ceo:rijksmonumentnummer` — join-sleutel, direct bruikbaar

Gebouwd als verrijking (`lib/rce.ts`: `buildImageQuery`/`parseImageResults`) op
bestaande resultaten, niet als aparte doorzoekbare collectie — dat blijft
buiten scope, zie de "Niet in scope"-lijst in
[`001-rijksmonumenten.md`](../vertical-slices/001-rijksmonumenten.md). De
kaarttegel en detailpagina tonen de foto als achtergrond met een letter-badge
erover (M/A/W/G/C) en verplichte licentie-/bronvermelding.

## `graph/groenaanleg` — historische tuinen en parken

**Geïntegreerd (2026-08-07).** 1.403 Rijksmonumenten met tuin-/parkaanleg-
specifieke data:

- `heeftAanlegGeometrie` — een *aparte* geometrie voor de aanleg, los van de
  geometrie van het gebouw zelf (nog niet gebruikt — Doorzoeker toont alleen
  `heeftTypeAanleg`/`heeftCategorieGroenaanleg` als tekst, geen aparte kaartlaag)
- `heeftCategorieGroenaanleg` / `heeftCategorieGroenaanlegLegenda` — classificatie
- `heeftTypeAanleg` — type aanleg
- eigen thesaurus van 87 termen
- ook `foaf:depiction` (afbeelding) en `isOnderdeelVanComplex`

Overlapt met de bestaande Complex-feature: bijvoorbeeld rijksmonument/65314
("Rijnoord") is zowel complex-onderdeel als groenaanleg-record — live geverifieerd
op de detailpagina. Gebouwd als verrijking op de bestaande Rijksmonument-
detailweergave (`buildGroenaanlegQuery`/`parseGroenaanlegResults` in
`lib/rce.ts`), niet als apart "soort object".

## `graph/msp_indicatie` — betekenis uitgezocht (2026-08-08)

Eén boolean `ceo:msp_indicatie` op 13.988 Rijksmonumenten (gekoppeld via
`rijksmonumentnummer`), niet gedocumenteerd in de CEO-ontologie zelf; elke
steekproefwaarde was `true` (geen `false` gezien).

**MSP = Monumenten Selectie Project.** Een RCE-programma (samenwerking
Rijk/provincies/gemeenten) dat tussen ±1997 en 2002 een selectie maakte uit
de MIP-inventarisatie (Monumenten Inventarisatie Project, gebouwd erfgoed
1850-1940) om aan de rijksmonumentenlijst toe te voegen - ongeveer 9% van de
MIP-inventarisatie is destijds daadwerkelijk aangewezen. Bron: RCE-
catalogusbeschrijvingen bij het bijbehorende beeld- en werkarchief
([Beeldmateriaal MSP](https://catalogus.cultureelerfgoed.nl/Details/archive/110000101),
[Werkarchief MSP/MIP](https://catalogus.cultureelerfgoed.nl/Details/archive/110000240)).

Empirisch getoetst tegen de data ter bevestiging (niet alleen op de bronnen
vertrouwd): van de 13.988 gevlagde monumenten is 83% ingeschreven in het
Monumentenregister in exact 1997-2002 (3.289 in 2001, 3.174 in 2002, 1.583 in
2000, 1.575 in 1999, 1.020 in 1998, 951 in 1997), met een duidelijke piek en
uitloop naar 1994-1995 en 2003-2004 - consistent met een aanwijzingsproject
dat over enkele jaren wordt afgehandeld. `msp_indicatie` betekent dus:
*dit rijksmonument is via het Monumenten Selectie Project aangewezen*, en is
een "alleen-aanwezig-als-waar"-boolean (typisch RDF-modelleerpatroon:
afwezigheid van de triple ≠ expliciet `false`).

**Gebouwd (2026-08-08):** een filter ("Kenmerken" > "Monumenten Selectie
Project") en een detailregel ("Aangewezen via het Monumenten Selectie
Project (circa 1997-2002)"), analoog aan de bestaande groenaanleg-verrijking
en het bijbehorende filter. `buildMspIndicatieQuery`/`parseMspIndicatieResults`
in `lib/rce.ts`.

## `thesauri/referentienetwerk` - apart SPARQL-dataset, gedeeltelijke ABR-spiegel

`https://api.linkeddata.cultureelerfgoed.nl/datasets/thesauri/referentienetwerk/sparql`
is, net als `rce/bibliotheek`, een volledig los dataset (niet bereikbaar via
de `rce-cho`-MCP-tool, die alleen `rce/cho` bevraagt). Intern bij RCE ook wel
"Referentienetwerk 2" genoemd. 404.743 triples, 22.072 `skos:Concept`-
instanties plus een reeks specialistische subtypes onder het
`https://data.cultureelerfgoed.nl/id/rnce#`-namespace: `AbrConcept` (8.014),
`ArtefactAbr` (5.852), `TaxonConcept`/`PlantTaxonConcept`/`AnimalTaxonConcept`
(biologische taxonomie voor organische vondsten), `CeramicCategoryAbr`,
`MaterialAbr`, `PeriodAbr`, `DeventerObjectCode`/`DeventerWareCode` (het
Deventer-systeem voor aardewerkclassificatie), en geomorfologische concepten
(`LandvormConcept`/`ReliefConcept`, bv. "overstromingsvlakte", "Peelhorst").

**Empirisch bevestigd: gedeeltelijke spiegeling van de ABR-thesaurus**, geen
volledig aparte dataset. Concept `abr/00155b8e-07ca-4534-848b-a719e780de07`
("gladwandig aardewerk, Tienen:bord") bestaat identiek terug onder
`rn/2/00155b8e-...` - zelfde UUID, zelfde label, andere URI-prefix. Een CHT-
concept (`cht/296c96ac-...`) bestaat *niet* onder `rn/2/`, dus dit is
specifiek een ABR-spiegel, geen CHT-spiegel.

**Niet toegevoegd als derde termsuggestiebron** (bewuste keuze, geen
openstaande vraag): het grootste deel overlapt al met de reeds geïntegreerde
ABR-thesaurus (dubbele suggesties zonder meerwaarde), en de dataset bevat
naast echte vocabulairetermen ook actor-/collectiereferenties die geen
zoektermen zijn (bv. "Blokdijk, M. ; Noord-Brabant", "Post Wiersema, E. ;
Groningen II" - vermoedelijk namen van vondstmelders/onderzoekers per
provincie). Toevoegen zou de suggestiekwaliteit verlagen, niet verhogen.

**Wel potentieel bruikbaar als latere, aparte verrijking**: de niet-ABR
specialistische subsets (taxonomie, geomorfologie, Deventer-classificatie)
zijn nergens anders in Doorzoeker beschikbaar en zouden relevant kunnen zijn
voor de archeologiedomeinen (Vondsten/Grondsporen/Onderzoeksgebied) - nog
niet verder uitgezocht, geen concreet plan.

## `rce/bibliotheek` — apart SPARQL-dataset (taak #6, verkend 2026-08-09)

`https://api.linkeddata.cultureelerfgoed.nl/datasets/rce/bibliotheek/sparql`
is geen graph binnen `rce/cho`, maar een volledig los dataset (net als
`thesauri/referentienetwerk`, niet bereikbaar via de `rce-cho`-MCP-tool).

**Correctie op de eerdere aanname (2026-08-08): dit ís een
publicatiebibliotheek, geen autoriteitenbestand.** De eerdere inschatting
("wie meldde een vondst, welk archief beheert bronmateriaal") was gebaseerd
op alleen de klassentelling zonder de data zelf te bekijken. Live bevestigd:

- **320.652 `schema:Book`** (waarvan ook `schema:PublicationVolume`),
  **96.681 losse `schema:PublicationVolume`**, **12.283 `schema:BookSeries`**,
  **10.860 `schema:CreativeWork`** - dit is de RCE-bibliotheekcatalogus van
  archeologische en monumentenzorg-literatuur ("grijze literatuur":
  opgravingsrapporten, bureauonderzoeken, restauratieverslagen), niet een
  lijst van personen/organisaties. **233.835 `schema:Person`** en
  **87.955 `schema:Organization`** zijn auteurs/uitgevers van die boeken
  (`schema:author`/`schema:publisher`), geen aparte autoriteitenlaag.
- Elk Book heeft `schema:name` (titel), `schema:datePublished`,
  `schema:author`/`schema:publisher` (URI naar Person/Organization),
  `schema:spatial` (vrije plaatsnaam-labels, bv. "utrecht", "maartensdijk"),
  `schema:keywords` (soms vrije tekst, soms een echte CHT/ABR-concept-URI -
  dezelfde `data.cultureelerfgoed.nl/term/id/cht|abr/...`-URI's die
  Doorzoeker al gebruikt voor termsuggesties), `schema:sameAs` (link naar de
  publiek doorbladerbare `catalogus.cultureelerfgoed.nl/Details/fullCatalogue/<id>`).
- Bevat ook een eigen bibliografische controlevocabulaire (`skos:ConceptScheme`
  met codes als `COLL`/`COUNTY`/`DOCTYPE`/`GEOKEYW`/`PLACE`/`PROVINCE`/`ROLE`/
  `SUBJECT`/`TECHN` - klassieke MARC/AACR2-achtige veldwaarden) én dezelfde
  CHT/ABR-conceptschemes zelf gespiegeld (dus resolvebaar met de al
  bestaande CHT/ABR-thesaurusintegratie, geen nieuwe adapter nodig voor die
  keywords specifiek).

**Belangrijkste vondst: een harde join-sleutel terug naar Rijksmonumenten.**
Elk Book kan een of meer
`https://linkeddata.cultureelerfgoed.nl/def/ceo#rijksmonumentnummer`-triples
hebben - exact dezelfde eigenschap en waardevorm (`"18073"`) die
`rce-adapter.ts` overal al gebruikt als join-sleutel. Geen fuzzy matching
op plaatsnaam nodig. Live geverifieerd:
- 12.552 `ceo:rijksmonumentnummer`-triples op Book, verdeeld over 9.938
  unieke boeken en **6.511 unieke rijksmonumentnummers** (ca. 10% van alle
  rijksmonumenten heeft dus minstens één gekoppelde publicatie).
- Voorbeeld: rijksmonumentnummer 18073 (Laakmolen, 's-Gravenhage) →
  "De Laakmolen : de restauratie en nieuwbouw van de Laakmolen te
  's-Gravenhage" (1988), auteurs Ambachtsheer H.F. en Stal C.J.J.,
  `sameAs` → `catalogus.cultureelerfgoed.nl/Details/fullCatalogue/1131`.
- Fan-out is scheef verdeeld (net als bij de archeologiedomeinen): de
  meeste gekoppelde rijksmonumenten hebben 1-3 boeken, een klein aantal
  bekende/veel onderzochte monumenten heeft er tientallen (top gevonden:
  149 op één rijksmonumentnummer) - een cap per monument is dus nodig, niet
  alleen theoretisch.
- Performance: een gebatchte `VALUES`-query over 8 rijksmonumentnummers
  (patroon identiek aan de bestaande enrichment-queries in `rce-adapter.ts`)
  antwoordde in ~0,8s.

**Nog niet uitgezocht**: of `ArcheologischOnderzoeksgebied`/`ArcheologischComplex`
(die geen rijksmonumentnummer hebben) ook op een andere manier aan
bibliotheekrecords te koppelen zijn (bv. via `schema:spatial`-plaatsnaam of
een ander CEO-veld) - alleen `ceo:rijksmonumentnummer` is bevestigd als
CEO-namespace-eigenschap op Book, geen andere is gevonden bij een gerichte
`FILTER(CONTAINS(STR(?p), "cultureelerfgoed.nl/def/ceo"))`-check.

**Conclusie**: dit is een sterke kandidaat voor een verticale schijf,
opgebouwd volgens exact hetzelfde patroon als de bestaande verrijkingen
(afbeelding/groenaanleg/archeologisch terrein). Plan geschreven:
[`005-bibliotheek-literatuur.md`](../vertical-slices/005-bibliotheek-literatuur.md).
