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

## `thesauri/referentienetwerk` — Referentienetwerk 2

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

**Gericht geïntegreerd als suggestiebron.** De algemene CHO-zoekbalk bevraagt
niet heel RN2, maar uitsluitend Archeologisch Informatie Systeem,
Cultuurhistorische Object Informatie, Kennisregistratie en Monumenten
Registratie Systeem. Het losse ABR wordt niet gebruikt: voor archeologische
CHO-koppelingen gebruikt de RCE het Archeologisch Informatie Systeem binnen
RN2. ABR- en RN2-URI's kunnen dezelfde UUID hebben, maar zijn daarmee niet
dezelfde URI. Een gekozen suggestie blijft een tekstzoekopdracht; alleen
gecontroleerde velden zoeken exact op de RN2-concept-URI.

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

## Ruimtelijke "ligt in"-relatie Rijksmonument ↔ Werelderfgoed/Gezicht — verkend (2026-08-10)

Uit de README's "nog niet gebouwd"-lijst: staat een Rijksmonument fysiek
binnen een Werelderfgoed- of Gezicht-gebied? Live onderzocht op
`rce/cho`, geen apart dataset dit keer.

**Geen gemodelleerde eigenschap - exhaustief uitgesloten, niet alleen een
steekproef.** `ligtInObject` (de property die al ArcheologischTerrein aan
een Rijksmonument koppelt) heeft als domein/bereik in de ontologie de
generieke `CultuurhistorischObject`-superklasse, dus in theorie zou hij
ook Rijksmonument → Werelderfgoed/Gezicht kunnen koppelen. Een exacte
`COUNT(*)` over de volle graaf levert **0** op voor beide combinaties, en
een bredere check op *elke* eigenschap (niet alleen `ligtInObject`) tussen
een Rijksmonument en een Werelderfgoed- of Gezicht-instantie levert ook
niets op. De enige inkomende relaties die Werelderfgoed/Gezicht wél
hebben (`Kennisregistratie`/`Naam` via `heeftBetrekkingOp`) zijn
metadata-/naamregistraties, geen ruimtelijke koppeling. Conclusie: er is
geen kant-en-klare property om op te zoeken; dit is puur een geometrische
vraag.

**Geometrisch wél mogelijk - de SPARQL-dienst ondersteunt GeoSPARQL.**
`geof:sfWithin(?rmWkt, ?gebiedWkt)` werkt en geeft correcte resultaten:
tegen de polygoon van Werelderfgoed "Molens bij Kinderdijk-Elshout"
(wenr 818) levert dit precies de verwachte molens en het Wisboomgemaal op
(rijksmonumentnummers 30541-30556 e.a.), niet een toevallige of lege set.

**Maar te traag voor een live opzoeking op de huidige schaal.** Dezelfde
`sfWithin`-check tegen die ene Kinderdijk-polygoon, maar dan zonder een
plaatsnaam-voorfilter (dus over de volle ~62K Rijksmonumenten-graaf),
duurde **14,2 seconden** voor een enkel Werelderfgoed-doel. Werelderfgoed
telt 18 instanties (vergelijkbare kosten zouden dus al enkele minuten
totaal kosten, eenmalig te doen), maar Gezicht telt 472 instanties -
brute-force tegen alle 472 zou onwerkbaar lang duren zonder een
bounding-box-voorfilter om het aantal kandidaat-Rijksmonumenten eerst drastisch te
verkleinen.

**Conclusie / vervolg indien opgepakt**: geen live per-zoekopdracht- of
per-detailpagina-berekening bouwen (te traag, zou de bestaande
enrichment-timingbudgetten ver overschrijden). Wel haalbaar als eenmalige
offline batch: voor de 18 Werelderfgoed-instanties (klein, stabiel aantal
- verandert zelden) de bijbehorende rijksmonumentnummers vooraf berekenen
en als klein statisch bestand meeleveren met de app, in plaats van elke
keer live te bevragen. Gezicht (472 instanties) zou eerst een
bounding-box-voorfilter nodig hebben om diezelfde aanpak haalbaar te
maken - niet onderzocht hoeveel dat de tijd per Gezicht zou terugbrengen.
Plan geschreven voor de Werelderfgoed-helft (offline batch, geen live
berekening): [`006-werelderfgoed-ligt-in.md`](../vertical-slices/006-werelderfgoed-ligt-in.md).
Gezicht blijft bewust buiten deze eerste schijf.

## `ceo:heeftGebeurtenis` — bouwgeschiedenis, actoren en meerdere adressen (verkend 2026-08-10)

Gebruikersvraag: "bij Rijksmonumenten is meer data beschikbaar, soms meer
adressen, soms een datering en actor (via heeftGebeurtenis)". Live
onderzocht op `rce/cho`, geen apart dataset. Belangrijkste les vooraf:
**de ontologie zegt niet altijd wat de data doet** - hieronder twee keer
concreet aangetoond.

### Padstructuur (empirisch bevestigd, niet uit de ontologie alleen)

```
Rijksmonument --heeftGebeurtenis--> Gebeurtenis
  --heeftGebeurtenisNaam--> skos:Concept (rn/2-namespace, resolvebaar)
  --heeftDatering--> Datering
      --heeftBeginDatering--> BeginDatering (CHO-lokale proxy) --ceo:datum--> xsd:date, bv. "1850-01-01"
      --heeftEindDatering--> EindDatering (proxy) --ceo:datum--> xsd:date
      --heeftBetrouwbaarheid / heeftIndicatieNauwkeurigheid--> skos:Concept (rn/2, bv. "onbekend"/"globaal")
  --heeftActorEnRol--> ActorEnRol
      --heeftActor--> platte tekst-literal in graph/instanties-rce,
                       maar resolvebare concept-URI in graph/actorenrol
                       (zelfde ActorEnRol-subject-URI!) - zie hieronder
      --heeftRol--> idem: literal in instanties-rce, URI in graph/actorenrol
```

`heeftGebeurtenisNaam` volgt het bekende patroon: een echte, resolvebare
`rn/2`-concept-URI. Top-4 gebeurtenistypen (aantal *gebeurtenissen*, niet
monumenten): "vervaardiging" (20.037), "niet bepaald" (9.888),
"verbouwing" (2.653), "restauratie" (295) - een bruikbare, klikbare
bouwgeschiedenis-classificatie, exact hetzelfde patroon als monumentaard/
waardering.

**`ceo:datum` op de begin-/einddatering-proxy is een gewone `xsd:date`-
literal** (bv. "1850-01-01") - geen concept-opzoeking nodig voor de
datering zelf. **Let op (2026-08-10, tijdens de "op deze dag"-verkenning
voor `010-op-deze-dag.md`): deze dag/maand is vrijwel altijd "01-01"** -
alle 21.292 gecontroleerde `heeftBeginDatering`-waarden hadden exact die
maand-dag. Dit is een jaarnauwkeurige precisie-conventie, geen echte
bouwdatum - gebruik dit veld dus nooit voor iets dat op de exacte dag/maand
vertrouwt (bv. een "op deze dag"-widget); `ceo:datumInschrijvingInMonumentenregister`
(al gebruikt als `registrationDate`) heeft wél een echte, gespreide
maand-dag-verdeling en is daarvoor de juiste bron. De
`heeftBetrouwbaarheid`/`heeftIndicatieNauwkeurigheid`-concepten
("onbekend"/"globaal") zijn losse precisie-indicatoren op hetzelfde
Datering-object, geen deel van de datumketen zelf - dit werd in een
eerste (te snelle) query per ongeluk door elkaar gehaald door
`?dateringNode ?p ?o` te vlak te bevragen; opsplitsen naar de losse
properties gaf de juiste, ontrafelde structuur.

### Correctie op een eerste, te snelle conclusie: `heeftActor`/`heeftRol` zíjn te resolven - via een aparte graph

**Eerste inschatting (achterhaald, hieronder gecorrigeerd na een tip van
de gebruiker om specifiek naar `graph/actorenrol` te kijken):** de
ontologie declareert `rdfs:range skos:Concept` voor beide properties,
maar een query op `graph/instanties-rce` alleen toont platte
tekst-literals - `heeftActor` → `"Kramer, Hendrik ; Stad Leeuwarden"`
(naam + provincie/stad als één string), `heeftRol` →
`"architect / bouwkundige / constructeur"`. Dat leek een
ontologie-afwijking, maar is het niet.

**Werkelijke structuur: `graph/instanties-rce` bevat een gedenormaliseerde
kopie, `graph/actorenrol` de resolvebare identiteit.** Dezelfde
ActorEnRol-subject-URI (bv.
`https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/actorenrol/55555`)
bestaat in **beide** named graphs op hetzelfde `rce/cho`-endpoint:

- in `graph/instanties-rce` (waar Doorzoeker al standaard op zoekt):
  `heeftActor`/`heeftRol` zijn platte literals, zoals hierboven;
- in de **aparte** `graph/actorenrol` (9.867 `ActorEnRol`- en 4.053
  `skos:Concept`-instanties): diezelfde subject-URI heeft `heeftActor`/
  `heeftRol` als échte concept-URI's onder de
  `https://data.cultureelerfgoed.nl/term/id/rn/<uuid>`-namespace (let op:
  `rn/`, **niet** `rn/2/` - een verwante maar andere namespace dan de
  Referentienetwerk-2-concepten die de rest van dit document gebruikt).
  Die concepten hebben zelf weer een `skos:prefLabel` die exact het
  literal uit `instanties-rce` reproduceert (`"Kramer, Hendrik ; Stad
  Leeuwarden"`) - dus dezelfde weergavetekst, nu met een echte identiteit
  erachter.

Met een extra `GRAPH <graph/actorenrol> { ?ar ceo:heeftActor ?actorUri }`
naast de bestaande `graph/instanties-rce`-patronen (gejoined op dezelfde
`?ar`-URI) is de actor dus wél als concept-URI op te halen. Live geverifieerd:
**6.979 van de 18.615 Rijksmonumenten met een Gebeurtenis (~37,5%) hebben
zo'n resolvebare actor-URI.** Het `"Naam ; Provincie"`-stringformaat blijft
overigens wel identiek aan de niet-ABR-actorreferenties uit de
Referentienetwerk-2-dataset (bv. "Blokdijk, M. ; Noord-Brabant") - een
algemene RCE-notatieconventie voor personen/organisaties zonder aparte
naamregistratie, nu dus in *twee* aparte plekken met dezelfde vorm
teruggevonden.

`heeftRol` resolveert via dezelfde route naar een eigen concept-URI, maar
het is een klein, generiek vocabulaire (rollen als "architect",
"aannemer", "beeldhouwer") - klikken daarop zou een enorme, weinig
zeggende resultatenset opleveren. Alleen de **actor**-URI is dus
interessant als klikbare identiteit, niet de rol.

### Omvang en scheefheid

- **18.615 van de ~62.000 Rijksmonumenten (~30%) hebben minstens één
  Gebeurtenis** - een aanzienlijk deel, groter dan groenaanleg (1.403) of
  literatuur (6.511), in de buurt van msp_indicatie (13.988).
- Van de 32.873 Gebeurtenis-instanties heeft maar **11.581 (~35%) ook
  daadwerkelijk een `heeftActorEnRol`** - actor/rol is dus vaker afwezig
  dan aanwezig, zelfs wanneer er wel een gebeurtenis geregistreerd is.
- **Meerdere BAG-adressen per Rijksmonument komen voor, en kunnen extreem
  schever verdeeld zijn dan verwacht**: rijksmonumentnummer 77667 heeft
  **513** `heeftBasisregistratieRelatie/heeftBAGRelatie`-verwijzingen,
  67413 heeft er 486, 66204 heeft er 301 (vermoedelijk grote ensembles/
  gebouwencomplexen met veel losse adreseenheden). Een eventuele
  "toon alle adressen"-functie heeft dus, net als literatuur eerder,
  sowieso een cap nodig - dit is geen randgeval maar een reëel scenario.

### Conclusie

Bouwgeschiedenis (gebeurtenistype + datum) is een sterke, schone
kandidaat voor een vertical-slice-verrijking - zelfde klikbare-concept-
patroon als monumentaard/waardering, met een echte `xsd:date` erbij, op
~30% van de Rijksmonumenten. **Actor is, na de correctie hierboven, ook
klikbaar te maken** (~37,5% van de Gebeurtenis-monumenten heeft een
resolvebare actor-URI via `graph/actorenrol`) - een architect/aannemer
aanklikken en alle andere rijksmonumenten vinden waar diezelfde actor aan
werkte, exact dezelfde "label is presentatie, URI is identiteit"-lijn als
monumentaard/waardering, nu toegepast op personen/organisaties in plaats
van classificaties. Rol blijft bewust niet klikbaar (te generiek
vocabulaire, weinig zeggende resultaten). Adressen tonen vereist een cap
vanwege de geobserveerde uitschieters (500+), en blijft buiten scope.
**Gebouwd en live geverifieerd (2026-08-10)**:
[`007-bouwgeschiedenis.md`](../vertical-slices/007-bouwgeschiedenis.md).
