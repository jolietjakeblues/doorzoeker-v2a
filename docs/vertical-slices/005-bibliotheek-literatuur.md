# Verticale slice 005: Literatuur uit de RCE-bibliotheek

## Status

Gebouwd en live geverifieerd (2026-08-10). Alle 6 stappen van de
voorgestelde eerste schijf zijn geïmplementeerd: nieuwe
`lib/server/bibliotheek-adapter.ts` (`buildLiteratuurQuery`/
`parseLiteratuurResults`/`fetchLiteratuur`) tegen het aparte
`rce/bibliotheek`-endpoint, `LiteratureRef` op `RceMonument`/`Item`, een
zesde parallelle `enrich.literatuur`-lookup in `rce-adapter.ts`, en een
"Literatuur"-lijst in het detailpaneel. Live doorgeklikt tegen de echte
RCE-data op het testgeval uit de verkenning: rijksmonument 18073
(Laakmolen) toont "De Laakmolen : de restauratie en nieuwbouw van de
Laakmolen te 's-Gravenhage" met beide auteurs, jaartal 1988 en een
werkende link naar de publieke catalogus. `enrich.literatuur` antwoordde
in 403ms, vergelijkbaar met de andere verrijkingen (185-360ms) - geen
outlier.

## Aanleiding

Taak #6 stond als open verkenningsvraag: is `rce/bibliotheek` iets voor
Doorzoeker? De eerdere aanname (2026-08-08, gebaseerd op alleen een
klassentelling) was dat dit een autoriteitenbestand van personen/
organisaties was - "wie meldde een vondst, welk archief beheert
bronmateriaal". Verdere verkenning (2026-08-09, dit keer met echte
voorbeeldrecords, niet alleen tellingen) weerlegt dat: het is een
publicatiebibliotheek (grijze literatuur: opgravingsrapporten,
bureauonderzoeken, restauratieverslagen), en de personen/organisaties zijn
gewoon auteurs en uitgevers van die publicaties.

## Empirisch bevestigd (2026-08-09)

Live SPARQL-checks tegen
`https://api.linkeddata.cultureelerfgoed.nl/datasets/rce/bibliotheek/sparql`
(een volledig los dataset, net als `thesauri/referentienetwerk` niet
bereikbaar via de `rce-cho`-MCP-tool):

1. **Klassen**: 320.652 `schema:Book` (ook getypeerd als
   `schema:PublicationVolume`), 96.681 losse `PublicationVolume`, 12.283
   `BookSeries`, 233.835 `schema:Person`, 87.955 `schema:Organization` (de
   laatste twee: auteurs/uitgevers, `schema:author`/`schema:publisher`).
2. **Elk Book heeft**: `schema:name` (titel), `schema:datePublished`,
   `schema:author`/`schema:publisher` (URI naar Person/Organization),
   `schema:spatial` (vrije plaatsnaam-labels), `schema:keywords` (soms
   vrije tekst, soms een echte CHT/ABR-concept-URI - dezelfde
   `data.cultureelerfgoed.nl/term/id/cht|abr/...`-namespace die Doorzoeker
   al gebruikt voor termsuggesties), `schema:sameAs` (link naar de publiek
   doorbladerbare `catalogus.cultureelerfgoed.nl/Details/fullCatalogue/<id>`).
3. **Harde join-sleutel naar Rijksmonumenten, geen fuzzy matching nodig**:
   Book kan een of meer
   `https://linkeddata.cultureelerfgoed.nl/def/ceo#rijksmonumentnummer`-triples
   dragen - exact dezelfde eigenschap en waardevorm (`"18073"`) die
   `rce-adapter.ts` overal al gebruikt. Dit is de enige CEO-namespace-
   eigenschap op Book (bevestigd via een gerichte
   `FILTER(CONTAINS(STR(?p), "cultureelerfgoed.nl/def/ceo"))`-check - geen
   vergelijkbaar veld voor ArcheologischOnderzoeksgebied/-Complex
   gevonden).
4. **Omvang en verdeling**: 12.552 `ceo:rijksmonumentnummer`-triples op
   Book, verdeeld over 9.938 unieke boeken en **6.511 unieke
   rijksmonumentnummers** (~10% van alle rijksmonumenten heeft dus
   minstens één gekoppelde publicatie). Voorbeeld: rijksmonumentnummer
   18073 (Laakmolen, 's-Gravenhage) → "De Laakmolen : de restauratie en
   nieuwbouw van de Laakmolen te 's-Gravenhage" (1988), auteurs
   Ambachtsheer H.F. en Stal C.J.J., `sameAs` →
   `catalogus.cultureelerfgoed.nl/Details/fullCatalogue/1131`.
5. **Fan-out is scheef verdeeld**, net als bij de archeologiedomeinen: de
   meeste gekoppelde rijksmonumenten hebben 1-3 boeken, een klein aantal
   veel onderzochte monumenten heeft er tientallen (top gevonden: 149 op
   één rijksmonumentnummer). Een cap per monument is dus geen theoretische
   voorzorg.
6. **Performance**: een gebatchte `VALUES`-query over 8
   rijksmonumentnummers (zelfde patroon als de bestaande
   `buildRceFacetsQuery`/`buildImageQuery`-batching) antwoordde in ~0,8s.

## Doel

Op de detailpagina van een Rijksmonument met minstens één gekoppelde
publicatie, een "Literatuur"-sectie tonen met titel, auteur(s), jaartal en
een link naar de publieke RCE-catalogus - dezelfde soort verrijking als de
bestaande archeologisch-terrein-, complex- en groenaanleg-secties.

## Waarom niet meteen breed

- Alleen `ceo:rijksmonumentnummer` is bevestigd als join-sleutel. Of
  ArcheologischOnderzoeksgebied/-Complex, Werelderfgoed of Gezicht ook op
  een andere manier te koppelen zijn (bv. via `schema:spatial`-plaatsnaam)
  is niet onderzocht en zou fuzzy matching vereisen - een heel andere,
  onzekerdere aanpak dan de harde ID-match die voor Rijksmonumenten al
  bevestigd is.
- De `schema:keywords`-koppeling naar bestaande CHT/ABR-concept-URI's is
  een leuke bonusvondst maar een aparte uitbreiding (zou de al bestaande
  thesaurus-resolvelogica kunnen hergebruiken) - niet nodig voor een eerste
  bruikbare versie.
- Auteursnaam-datakwaliteit is rommelig (tijdens verkenning gezien:
  sommige subjecten zijn tegelijk als `schema:Person` én
  `schema:Organization` getypeerd) - geen poging doen dit te normaliseren
  of te disambigueren, gewoon de naam tonen zoals die er staat.

## Voorgestelde eerste verticale schijf

1. Nieuwe, aparte adapter `lib/server/bibliotheek-adapter.ts` die tegen
   `rce/bibliotheek/sparql` praat, via `fetchSparql(query, signal,
   endpoint)` (dezelfde parametrisatie die al voor de
   Referentienetwerk-adapter is toegevoegd aan `sparql-client.ts`, dus
   geen nieuwe fetch/retry/timeout-logica nodig).
2. Eén gebatchte query per zoekresultatenpagina (`VALUES ?rmnr { ... }`,
   zelfde batchgrootte als de bestaande facet-/afbeeldingsquery's): haalt
   per boek `?rmnr`, `?boek`, `naam`, `datePublished`, alle `author`-namen
   en `sameAs` op. Geen `GROUP BY`/`GROUP_CONCAT` in SPARQL (dat zou de
   1:N auteur-relatie en de losse `sameAs`-link per titel verliezen) -
   groeperen en cappen (zie hieronder) gebeurt in JS, net als
   `parseComplexResults`/`parseArcheologischTerreinResults` dat nu al
   doen.
3. Client-side per rijksmonumentnummer: sorteer op `datePublished`
   (nieuwste eerst) en cap op een klein aantal (voorstel: 5) - voorkomt dat
   het geobserveerde uitschieter-geval (149 publicaties op één monument)
   de detailpagina onbruikbaar maakt.
4. Nieuw type `LiteratureRef` op `RceMonument`/`Item` (zie datamodel
   hieronder), gevuld via een nieuwe parallelle `enrichMonuments`-lookup in
   `rce-adapter.ts` (`enrich.literatuur`, zelfde timing-wrapper-patroon als
   de andere verrijkingen).
5. UI: nieuwe "Literatuur"-rij in het detailpaneel (`app/page.tsx`), een
   lijst van titel + auteur(s) + jaartal, elke titel doorklikbaar naar de
   `sourceUrl` (de publieke catalogus), zelfde stijl als de bestaande
   `map-object-list`-lijsten (complexleden, onderzoeksgebied-vondsten).
6. Tests: unit tests voor de nieuwe querybouw/parse-functies
   (`buildLiteratuurQuery`/`parseLiteratuurResults` of vergelijkbare namen)
   naar het patroon van `tests/rce.test.mjs`, plus verificatie dat capping
   en sortering werken zoals bedoeld.

## Data-model

```ts
type LiteratureRef = {
  uri: string;
  title: string;
  year?: string;
  authors: string[];
  sourceUrl?: string; // schema:sameAs - publieke catalogus.cultureelerfgoed.nl-link
};
```

`RceMonument`/`Item` krijgen `literature?: LiteratureRef[]` naast de
bestaande verrijkingsvelden (`parcels`, `archaeologicalSites`, `complexes`,
`groenaanleg`, ...) - hetzelfde patroon, niets vervangt iets bestaands.

## API-contract

Geen nieuwe publieke route. Literatuur wordt onderdeel van het bestaande
`/api/rce/search`-resultaatcontract (`RceMonument`/`Item` krijgt een extra
veld), exact zoals groenaanleg en `msp_indicatie` nu ook werken - niet zoals
de Referentienetwerk-concepten (taak #10), die wél een eigen route kregen
omdat daar een losse, op-URI-gerichte lookup nodig was. Hier is de
verrijking altijd een 1-op-veel bijlage bij een toch al opgehaald
Rijksmonument-record, dus past de bestaande enrichment-aanpak beter.

## Scope-afbakening voor deze slice

- Alleen Rijksmonument (de enige bevestigde join-sleutel). Geen
  Onderzoeksgebied, Complex, Werelderfgoed of Gezicht in deze eerste
  schijf.
- Cap op 5 publicaties per monument, geen paginering of "toon alles"-optie.
- Geen auteursnaam-normalisatie, geen aparte Person/Organization-weergave.
- Geen gebruik van de `schema:keywords`-koppeling naar CHT/ABR-concepten.
- Geen doorzoekbare eigen "bibliotheek"-collectie of los "soort object" -
  zelfde afbakening als eerder voor de beeldbank gekozen in
  [`001-rijksmonumenten.md`](001-rijksmonumenten.md).

## Openstaande vragen (besloten tijdens bouw, 2026-08-10)

- **Cap-strategie**: client-side gekozen (alle rijen voor de batch ophalen,
  daarna per rijksmonumentnummer sorteren en tot 5 cappen in JS) - simpeler
  en consistent met de bestaande adapter-stijl. Nog niet vergeleken op
  resultaatgrootte bij een batch waarin toevallig meerdere
  "149-publicaties"-uitschieters tegelijk zitten (bij de huidige batchgrootte
  van 25 monumenten per pagina een theoretisch, niet praktisch geobserveerd
  risico).
- **Sortering**: op `datePublished` aflopend (nieuwste eerst) - ontbrekende
  jaartallen sorteren via stringvergelijking naar het einde. Niet expliciet
  met de gebruiker afgestemd, wel de meest voor de hand liggende keuze en
  eenvoudig om later te wijzigen.
- **Ontbrekend jaartal**: de UI toont dan gewoon titel + auteur(s) zonder
  `(jaartal)`-suffix, geen placeholder-tekst.

## Acceptatiecriteria

1. Een Rijksmonument-detailpagina toont een "Literatuur"-sectie zodra er
   minstens één gekoppelde publicatie is (rijksmonumentnummer 18073 als
   live testgeval).
2. Titel, auteur(s), jaartal (indien aanwezig) en een link naar de publieke
   catalogus worden getoond per publicatie.
3. Rijksmonumenten zonder literatuur tonen geen lege sectie.
4. Capping voorkomt dat een monument met tientallen publicaties (het
   geobserveerde uitschieter-geval: 149) de detailpagina onbruikbaar maakt.
5. Bestaande zoek-/filterfunctionaliteit en -performance blijven
   ongewijzigd - de nieuwe lookup draait parallel aan de bestaande
   verrijkingen, niet serieel ervoor.

## Klaar wanneer

Literatuur is zichtbaar op de detailpagina van elk Rijksmonument met
minstens één gekoppelde publicatie, via een nieuwe `bibliotheek-adapter.ts`
met dezelfde retry/timeout-aanpak als de bestaande adapters, en
typecheck/lint/test blijven groen.
