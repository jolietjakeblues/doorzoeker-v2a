# Verticale slice 018: Scheepswrakken (MASS)

## Status

Gebouwd en live geverifieerd (19 augustus 2026). Onderzocht op verzoek van
de eigenaar: "Wat vind je ervan om deze data toe te voegen (met restrictie
stand tot 31-12-2025) - met locaties, afbeeldingen, verwijzingen, rapporten,
etc. de hele mikmak." Volgorde expliciet afgesproken: eerst onderzoek, dan
plan, dan pas bouwen - alle vier openstaande vragen zijn beantwoord vóór het
bouwen begon (zie "Beslissingen" hieronder).

## Aanleiding

De eigenaar wees op een nieuwe RCE-dataset:
`https://api.linkeddata.cultureelerfgoed.nl/datasets/rce/mass/sparql`
("MASS"). Dit is een heel ander soort erfgoed dan wat Doorzoeker nu toont:
geen rijksmonumenten of landarcheologie, maar **scheepswrakken** - een
natuurlijke, aanvullende categorie naast de bestaande archeologische
soorten.

De eigenaar heeft deze dataset zelf in december 2025 omgezet naar Linked
Open Data. Dat is een eenmalige conversie geweest; de brondata zelf
bestrijkt schepen uit alle eeuwen. Bij het tonen in Doorzoeker hoeft dus
niets gefilterd te worden op datum - alleen een kleine, vaste
bronvermelding "stand per 31-12-2025" is nodig (geen live filtering op
created/modified, dat zou juist een instabiel, driftend resultaat geven
naarmate brondata verder bewerkt wordt - zie de afstemming hierover in de
chat).

## Empirisch bevestigd (19 augustus 2026)

1. **Schaal: 2.587 scheepswrakken.** Klein genoeg om geen speciaal
   tweefasenpatroon nodig te hebben zoals bij de 112.184
   Onderzoeksgebieden uit slice 017 - een simpele CONTAINS-discoveryquery
   op naam duurde in de praktijk **~0,4 seconden**.
2. **Eigen vocabulaire, niet CEO.** De dataset gebruikt een aangepast
   `sdo:`-vocabulaire (`https://sdo.org/...`) dat oppervlakkig op
   schema.org lijkt maar dat niet is - dit is volledig losstaand van de
   CEO-ontologie die de rest van Doorzoeker gebruikt. Er bestaat dus geen
   herbruikbare query-/parserlaag; dit wordt een eigen module, net als
   `lib/rce/archaeology.ts` een eigen laag is t.o.v. `monuments.ts`.
3. **Kerndata is betrouwbaar en (bijna) volledig gevuld.** Op alle 2.587
   Vehicle-instanties: `sdo:name` (2x per record: met en zonder
   sterfjaar, bv. "Hendrika" / "Hendrika (+1850)"), `sdo:description`
   (2.586/2.587), `sdo:location`, `sdo:license`, `sdo:creator`, `sdo:url`.
   `schema:additionalType` (scheepstype) op 2.483/2.587 (96%).
4. **Locatie is een keten van twee resources, niet inline.**
   `Vehicle -sdo:location-> Place -sdo:geo-> GeoCoordinates
   {sdo:latitude, sdo:longitude}`. Alle 2.587 vehicles hebben een
   Place-resource, en alle 2.587 Place-resources hebben op hun beurt een
   geldige geo-coördinaat (100% dekking, geverifieerd). Een enkele
   property-path-query (`sdo:location/sdo:geo/(sdo:latitude|sdo:longitude)`)
   volstaat.
5. **Scheepstype is een bruikbaar facet.** 30+ onderscheiden waarden,
   goed verdeeld (grootste: Vrachtschip 301, Spiegelretourschip 266,
   Jacht 169, Fluit 155, Fregat 153 - geen enkel type domineert alles).
   Werkt qua bruikbaarheid vergelijkbaar met het bestaande
   Monumentaard/Functie-facet bij Rijksmonumenten.
6. **Geen apart beeldveld - afbeeldingen zitten ín de HTML-omschrijving.**
   `schema:image` bestaat wel als predicaat, maar met een verwaarloosbare
   dekking (2 van 2.587). De daadwerkelijke afbeeldingen zitten als
   `<img src="/photos/l/00000003.jpg">`-tags binnen de
   `sdo:description`-waarde, die zelf rijke HTML is
   (`rdf:HTML`-datatype: `<h1>`, `<p>`, `<figure>`, `<table>`, mix van
   Nederlands en Engels per record). Basis-URL voor die relatieve paden
   is `https://mass.cultureelerfgoed.nl` (geverifieerd: een voorbeeldpad
   geeft rechtstreeks een geldige JPEG terug, HTTP 200).
7. **Referenties/rapporten zijn óók alleen in de HTML** (een losse
   `<h1>Referenties</h1>`-sectie met een `<ul>` van links en citaten),
   niet als aparte RDF-resource/predicaat. Er is geen gestructureerd
   "rapport"-model om apart te bevragen.
8. **Licentie: CC BY-SA 4.0**, consistent op alle 2.587 records
   (`sdo:license` -> een CreativeWork-resource met naam + licentie-URL).
   Vergt zichtbare bronvermelding (naam + licentielink), niet alleen een
   generieke "Bron: RCE"-regel zoals nu bij CHO-data.
9. **Eén uitzonderingsrecord met ander vocabulaire.** Named graph
   `https://mass.cultureelerfgoed.nl/graph/3061` bevat één (1) los
   record ("Amsterdam-5") dat wél het echte `schema.org/*`-vocabulaire
   gebruikt (`schema:name`, `schema:dateModified`, `geo:hasGeometry`,
   enz.) i.p.v. het gebruikelijke `sdo:*`-patroon. Verwaarloosbaar
   (1 van 2.587) maar bevestigt dat de dataset niet 100% intern
   consistent is - normalisatie ervan is geen dagtaak, maar ook niet
   gratis.
10. **Chronologisch bereik is breed en legitiem, geen datafout.**
    `hasBeginTimeStamp`/`hasEndTimeStamp` op de Place-resource zijn
    **ongetypeerde stringliterals** (geen `xsd:integer`/`xsd:gYear`) -
    een naïeve `MIN()`/`MAX()` erop geeft lexicografische in plaats van
    numerieke uitkomsten (bv. "995" > "1800" als string). Met expliciete
    `xsd:integer(...)`-cast: bereik loopt van **-9000 tot 2000** - dit
    zijn echte, verspreide waarden (niet één dummy-uitschieter), en dekt
    zich met het scheepstype "Boomstamboot" (56 stuks, prehistorische
    boomstamkano's) naast de bekendere VOC-schepen. Legitiem breed
    bereik, geen datacorruptie - maar de dataset-brede sortering/filtering
    op jaar moet dus altijd via een expliciete cast, nooit direct op de
    ruwe string.

## Doel

Scheepswrakken als nieuwe, doorzoekbare en doorbladerbare erfgoedcategorie
toevoegen aan Doorzoeker, met locatie op de kaart, de volledige
(gesaneerde) omschrijving inclusief afbeeldingen, en een zichtbare
CC BY-SA-bronvermelding met "stand per 31-12-2025".

## Voorgestelde aanpak

1. **Nieuwe eigen module** `lib/rce/scheepswrakken.ts` (of vergelijkbare
   naam), analoog aan `lib/rce/archaeology.ts`: eigen discoveryquery's
   (op naam, mogelijk scheepstype), eigen detailquery, eigen parser -
   geen hergebruik van CEO-gerichte code, wel hergebruik van de generieke
   infrastructuur (`fetchSparql`, `runDiscoveryBranches`,
   `optionalSearch`/partialFailure-tracker, rate limiting, caching).
2. **Nieuw objecttype "Scheepswrak"** door de hele stack: `RceMonument`/
   `Item`-achtig model, eigen kleur/icoon op de kaart (punt, niet
   polygoon - er is geen wrakvorm-geometrie, alleen een enkel
   coördinaat), eigen filter in "Soort object", en scheepstype als
   losstaand facet (vergelijkbaar met Monumentaard).
3. **HTML-omschrijving saniteren en renderen**, inclusief de
   `<img>`-afbeeldingen (met `https://mass.cultureelerfgoed.nl` als
   basis-URL voor relatieve paden) - dit is voor Doorzoeker een
   **nieuw soort risico-oppervlak**: tot nu toe rendert de app uitsluitend
   platte tekst uit SPARQL-literalen, nooit ruwe HTML uit een externe
   bron. Vergt een bewuste sanitize-aanpak (whitelist van toegestane tags/
   attributen), geen kant-en-klare `dangerouslySetInnerHTML` zonder
   filtering.
4. **Referenties/rapporten blijven onderdeel van de gesaneerde HTML**
   (er is geen apart RDF-model om ze los te structureren) - de
   `<h1>Referenties</h1>`-sectie komt gewoon mee met de rest van de
   omschrijving.
5. **Vaste bronvermelding, geen live filtering.** Een korte, statische
   regel bij elk scheepswrak-record: "Bron: MASS (RCE), stand per
   31-12-2025 - licentie CC BY-SA 4.0" met link naar de licentie-URL.
   Geen `created`/`modified`-filtering in de query's zelf (zie
   "Aanleiding" hierboven).
6. **Geen tweefasenpatroon/precomputatie nodig** - schaal en
   querysnelheid rechtvaardigen een gewoon live discoverypatroon,
   consistent met de rest van Doorzoeker.

## Data-model (voorstel)

```ts
type Scheepswrak = {
  uri: string;
  naam: string;              // sdo:name (zonder sterfjaar-variant)
  scheepstype?: string;       // schema:additionalType
  omschrijvingHtml?: string;  // sdo:description, gesaneerd vóór render
  lat: number;
  lng: number;
  ontdekt?: string;           // schema:discovered (580/2587, ~22% dekking)
  licentieNaam: string;       // via sdo:license -> sdo:name
  licentieUrl: string;        // via sdo:license -> sdo:url
};
```

## Scope-afbakening voor deze slice

- Alleen de 2.586/2.587 records in het gebruikelijke `sdo:*`-patroon;
  het ene uitzonderingsrecord in `graph/3061` (ander vocabulaire) blijft
  bewust buiten scope - normalisatie daarvan is een aparte, latere
  beslissing als dat patroon vaker blijkt voor te komen.
- Geen live filtering/snapshot-mechaniek - alleen een statische
  bronvermelding, zoals afgestemd.
- Geen polygoon-geometrie voor wrakken (bestaat niet in de brondata) -
  alleen een puntmarker, net als een gewoon gebouwd Rijksmonument.
- Referenties/rapporten worden getoond zoals ze in de HTML staan, niet
  omgezet naar een eigen gestructureerde lijst (zou verzinnen zijn wat de
  brondata niet als zodanig aanbiedt).

## Beslissingen (19 augustus 2026, na overleg met de eigenaar)

1. **Categorienaam: "Scheepswrak(ken)"**, geen alternatief nodig.
2. **HTML-sanitatie-whitelist: akkoord**, ongewijzigd gebouwd zoals
   voorgesteld (`h1-h3, p, ul, ol, li, a[href], img[src|alt], figure,
   figcaption, strong, em, br, table, tbody, tr, th, td`).
3. **Scheepstype: eerst alleen in het detail, geen los filter-facet.**
   "Beginnen met detail" - een eigen "Soort object"-achtig facet is een
   latere uitbreiding als daar behoefte aan blijkt.
4. **Bronvermeldingstekst: akkoord**, letterlijk gebouwd zoals
   voorgesteld.

## Acceptatiecriteria

1. Scheepswrakken zijn doorzoekbaar op naam, net als de andere
   objectsoorten.
2. Een scheepswrak-detail toont: naam, scheepstype (indien aanwezig),
   locatie op de kaart, gesaneerde omschrijving met afbeeldingen en
   referenties, en de vaste bronvermelding met licentie.
3. Geen crash of onveilige HTML-injectie bij records met afwijkende of
   rommelige HTML in `sdo:description` (live steekproef nodig - de
   dataset is deels handmatig geschreven, dus niet gegarandeerd
   schoon).
4. Typecheck/lint/tests blijven groen; unit tests dekken de nieuwe
   query-builders, parser en de HTML-sanitatiefunctie met representatieve
   voorbeelden (inclusief een "rommelig HTML"-testgeval).
5. Live geverifieerd tegen minstens één bekend wrak (bv. "Hendrika") vóór
   opleveren.

## Gebouwd - wat er tijdens de bouw nog bijkwam

- **`lib/rce/scheepswrakken.ts`**: eigen, losstaande module (discoveryquery
  op naam + exacte MASS-ID-kortsluiting bij een numerieke term,
  detailquery, parser) - analoog aan `lib/rce/archaeology.ts`, geen
  hergebruik van CEO-gerichte code.
- **`runDiscoveryBranches` kreeg een optionele `endpoint`-parameter**
  (`lib/server/rce-adapter.ts`), doorgegeven aan zijn interne
  `fetchSparql`-aanroep - nodig omdat scheepswrakken-discovery tegen
  `MASS_ENDPOINT` moet, niet de standaard rce/cho-dienst die elke andere
  categorie gebruikt. Bestaande aanroepers blijven ongewijzigd (optioneel
  argument).
- **Scheepswrakken delen de "archaeology-b"-scopebucket** (grondsporen/
  vondsten/archeologische complexen) i.p.v. een eigen scope-waarde te
  krijgen - zelfde kostenprofiel (klein, snel), en voorkomt dat de
  client-side parallelle scope-fetches (`lib/rce-client.ts`) aangepast
  moesten worden.
- **`lib/server/html-sanitize.ts`**: een echte karakter-voor-karakter
  tokenizer (geen regex-op-de-hele-string, geen dependency) - zie de
  uitgebreide toelichting in het bestand zelf. Saniteert server-side,
  vóór de client de HTML ooit ziet. 17 unit tests, inclusief expliciete
  XSS-vectoren (`<script>`, `onclick=`, `javascript:`/`data:`-URL's,
  geneste strip-tags, `>` binnen aanhalingstekens).
- **Browse-all ("Bekijk alles: Scheepswrakken") bewust niet gebouwd** -
  buiten scope van deze slice (alleen zoeken op naam was gevraagd/
  afgesproken); een latere uitbreiding als daar behoefte aan blijkt.
- **"Bekijk in het Monumentenregister"-link had een aparte labeltekst
  nodig** (`app/HeritageDetailDialog.tsx`) - de generieke fallbacktekst
  paste niet bij een scheepswrak (geen monumentenregister-entry). Nu
  "Bekijk op MASS (RCE)", wijzend naar de eigen MASS-pagina van het wrak.

Live geverifieerd tegen "Hendrika" (MASS-ID 1): zoeken op naam,
scheepstype-facetteksten, kaartmarker (eigen teal kleur `#0a5c66`),
gesaneerde omschrijving met afbeelding (relatief `/photos/...`-pad correct
opgelost tegen `https://mass.cultureelerfgoed.nl`), referenties-sectie, en
de bronvermelding "Bron: MASS (RCE), stand per 31-12-2025. Licentie:
CC BY-SA 4.0." - allemaal zoals bedoeld. Volledige checksuite
(typecheck/lint/256 unit tests/60 e2e-tests, inclusief een nieuwe
e2e-test) groen.

## Klaar wanneer

Gehaald: alle vier beslissingen liggen vast, de categorie is gebouwd en
live geverifieerd tegen een bekend wrak ("Hendrika").
