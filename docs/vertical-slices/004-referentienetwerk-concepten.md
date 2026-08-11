# Verticale slice 004: Concept-URI's uit het RCE Referentienetwerk

## Status

Gebouwd en live geverifieerd (2026-08-09). Alle 8 stappen van de
voorgestelde eerste schijf (monumentaard) zijn geïmplementeerd:
`RceMonument.monumentAardConceptUri`, de nieuwe
`referentienetwerk-adapter.ts` (`resolveConcept`) op het aparte
`thesauri/referentienetwerk`-endpoint, `GET /api/rce/concept?uri=`,
`GET /api/rce/search?concept=` als exacte-URI-alternatief op `?q=`, en een
klikbaar monumentaard-label in zowel de resultatenkaart als het
detailpaneel dat `executeConceptSearch` aanroept. Live doorgeklikt tegen de
echte RCE-data: klikken op "Gebouwd" bij rijksmonument 26722 (concept-URI
`.../rn/2/fc966a68-...`) levert 25 uiteenlopende "onroerend
gebouwd"-monumenten op via een exacte match, niet via labeltekst. Zie
"Openstaande vragen" hieronder voor wat bewust nog niet is aangepakt.

**Fase 2 (archeologische waardering) gebouwd en live geverifieerd
(2026-08-10).** Na de live-bevestiging dat `heeftArcheologischeWaardering`
dezelfde `rn/2`-namespace gebruikt als monumentaard (zie "Openstaande
vragen"), is exact hetzelfde patroon toegepast op de waardering van een
gekoppeld ArcheologischTerrein: `ArcheologischTerrein.waarderingConceptUri`,
`buildArcheologischeWaarderingConceptQuery`, een gedeelde
`parseConceptSearchMatches` (hernoemd vanuit het monumentaard-specifieke
`parseMonumentAardConceptMatches`, want nu door twee velden gebruikt), en
een expliciete `veld`-parameter op `?concept=` (`monumentaard` of
`waardering`) zodat de route ondubbelzinnig weet welke van de twee
zoekfuncties aan te roepen - geen giswerk of dubbele round-trip. Klikbaar
gemaakt in de "Archeologisch terrein"-detailrij. Live geverifieerd tegen
rijksmonument 330373: klikken op "zeer hoge archeologische waarde
beschermd" levert 25 andere archeologische rijksmonumenten op met exact
diezelfde waardering-concept-URI. De toenmalige testset, typecheck en lint
slaagden bij implementatie.
Gecommit en gepusht (`965942a`).

## Principe

Het label is presentatie. De URI is identiteit.

**Fase 3 (zoekbalk) gebouwd op 2026-08-10.** Suggesties worden nu tegen de
CHO-instanties gecontroleerd. Bij werkelijk gebruik als functie,
monumentaard, vondsttype, materiaal, toestand of archeologisch complextype
toont Doorzoeker het aantal gekoppelde objecten en zoekt een klik exact op de
URI. Een term die wel in RN2 staat maar niet aantoonbaar in zo'n veld voorkomt,
blijft herkenbaar een tekstzoekopdracht. Daarmee helpt RN2 gericht, zonder een
misplaatst gevoel van volledigheid te geven.

**Fase 4 (functie-detailrij) gebouwd op 2026-08-11.** Live gebruik bracht een
inconsistentie aan het licht: de "Functie"-rij in het detailpaneel toonde
alleen platte tekst (`item.kind`), terwijl Monumentaard er sinds fase 1 al
een klikbare `concept-link`-knop van maakte - ook al bestond
`item.functionConcepts` al net zo lang (gebruikt door fase 3 en door
verticale slice 008). Nieuwe pure functie `primaryFunctionConcept()` in
`lib/heritage-view-model.ts` matcht het concept waarvan het label (na
opschoning) overeenkomt met het getoonde `item.kind` - nodig omdat
`item.kind` en `item.functionConcepts` uit twee verschillende query's komen
en dus niet gegarandeerd dezelfde volgorde hebben. Live geverifieerd tegen
rijksmonument 516158 (Nederlands-Hervormde Kerk, Kinderdijk): klikken op
"Kerk" levert 25 resultaten op via `?concept=...&veld=functie`, niet via
labeltekst.

## Aanleiding

De algemene CHO-zoekbalk gebruikt vier schema's uit Referentienetwerk 2 voor
woordsuggesties: Archeologisch Informatie Systeem, Cultuurhistorische Object
Informatie, Kennisregistratie en Monumenten Registratie Systeem. CHT hoort bij
Bibliotheek en Beeldbank; het losse ABR wordt intern niet gebruikt. RN2 is
rechtstreeks met de objectdata verweven via concept-URI's. Een gekozen
suggestie bewaart concept-URI, thesaurus-URI en thesaurusnaam. Voor
gecontroleerde CHO-veldroutes zoekt de zoekbalk exact op identiteit; overige
suggesties blijven tekstzoekopdrachten.

Gevolg: concept-URI's die al in de RCE-data aanwezig zijn worden niet
benut, classificaties worden gereduceerd tot strings, het verschil tussen
gelijknamige concepten gaat verloren, conceptrelaties en hiërarchieën
kunnen niet gebruikt worden, en er is geen navigatie van erfgoedobject naar
concept naar andere erfgoedobjecten met precies dat concept.

## Empirisch bevestigd (2026-08-09, vóór dit plan geschreven is)

Twee live SPARQL-checks tegen echte data, niet afgeleid uit documentatie:

1. **De classificatie-URI's die de live CEO-instantiedata daadwerkelijk
   gebruikt, wijzen naar `rn/2/...` (Referentienetwerk), niet naar
   `cht/...` of `abr/...`.** Voor rijksmonument 36046:
   - `heeftOorspronkelijkeFunctie/heeftFunctieNaam` → "Woonhuis(K)" =
     `https://data.cultureelerfgoed.nl/term/id/rn/2/b964b9ca-8f5a-42de-b96c-ce8320db9e95`
   - `heeftMonumentAard` → "onroerend gebouwd" =
     `https://data.cultureelerfgoed.nl/term/id/rn/2/fc966a68-8863-4970-a83e-110f96006c21`

   Dit betekent: het Referentienetwerk is niet "ook een bron" naast CHT/ABR,
   maar de daadwerkelijke identiteitslaag waarmee de CEO-data zelf is
   geclassificeerd. De eerdere aanname deze sessie (CHT/ABR zijn "de"
   thesauri, Referentienetwerk is een afgeleide spiegel) is hiermee
   weerlegd voor in elk geval functie en monumentaard.

2. **`rn/2`-concepten hebben een echt, bruikbaar `skos:inScheme` en
   `skos:broader`.** Het monumentaard-concept "onroerend gebouwd" heeft:
   - `skos:inScheme` → een ConceptScheme met `dct:title` "Cultuurhistorische
     Object Informatie" en `dct:description` "Referentie netwerk voor de
     Archis en MRS toepassingen bij de RCE";
   - `skos:broader` → een ander `rn/2`-concept (dus een echte hiërarchie,
     geen platte waardenlijst);
   - dat scheme heeft zelf 18 `skos:hasTopConcept`-relaties.

   Conclusie: het UI-idee "Classificatie: Romeinse tijd / Archeologisch
   informatiesysteem / URI: …" is met de bestaande data te bouwen, geen
   wensdenken.

3. **Belangrijke architecturale consequentie**: deze `rn/2`-concepten staan
   op een *apart* SPARQL-endpoint,
   `https://api.linkeddata.cultureelerfgoed.nl/datasets/thesauri/referentienetwerk/sparql`,
   niet op de `rce/cho`-dienst die de rest van Doorzoeker gebruikt. Een
   concept-URI ophalen (label, scheme, broader/narrower) vereist dus een
   federatieve lookup: het CHO-record komt van `rce/cho`, de
   conceptbeschrijving komt van `thesauri/referentienetwerk`. Dit is qua
   omvang vergelijkbaar met de nog niet gestarte `rce/bibliotheek`-adapter
   (taak #6) - een echte nieuwe live-afhankelijkheid, geen bijstelling van
   een bestaande query.

## Doel

Een geselecteerd Referentienetwerk-concept behoudt zijn URI door de
volledige zoek-, URL-, API- en resultaatflow heen, zodat exact op
identiteit gezocht kan worden in plaats van op toevallige labelgelijkenis.

## Waarom niet meteen breed uitrollen

- RN2-woordsuggesties blijven bestaan voor vrije tekstinvoer, beperkt tot de
  vier CHO-schema's. De preciezere laag wordt gebruikt voor velden die al een
  gecontroleerde concept-URI-route hebben.
- Niet elk veld is al gecontroleerd op welke URI-namespace het gebruikt
  (zie "Openstaande vragen" hieronder) - vooraf aannemen dat het
  Referentienetwerk is, is precies de fout die dit plan wil vermijden.
- Dit is het derde grote architectuurtraject deze periode, na de
  Termennetwerk→Referentienetwerk-switch en naast de nog uitgestelde
  `page.tsx`-opsplitsing. Bewust klein en geïsoleerd houden.

## Voorgestelde eerste verticale schijf: monumentaard

Kleinst mogelijke voetafdruk: 2-3 bekende waarden, al een bestaand
UI-filter (de radiogroep "Monumentaard"), en het volledige pad
(record → concept-URI → scheme → broader) is hierboven al geverifieerd te
werken. Functie is interessanter maar heeft veel meer waarden - te riskant
als eerste proef van een compleet nieuw stuk plumbing.

Stappen:

1. Pas `buildRceDetailsQuery`/`buildRceFacetsQuery` (of een gerichte
   aparte query) aan zodat naast `?aardLabel` ook de concept-URI wordt
   opgehaald (`?cho ceo:heeftMonumentAard ?aardConcept . ?aardConcept
   skos:prefLabel ?aardLabel .` in plaats van het huidige
   property-path-shortcut dat de tussenliggende URI wegmoffelt).
2. Voeg een `ConceptRef`-vorm toe aan `RceMonument`/`Item`:
   `monumentAardConcept?: { uri: string; label: string }`.
3. Nieuwe, aparte adapter `lib/server/referentienetwerk-adapter.ts` die
   tegen `thesauri/referentienetwerk/sparql` praat (eigen `fetchSparql`
   met dezelfde retry/timeout-aanpak als `sparql-client.ts`, want dit is
   een fysiek ander endpoint) - minimaal een `resolveConcept(uri)` die
   `prefLabel`, `inScheme` (URI + titel) en `broader` teruggeeft. Niet
   alle velden uit het oorspronkelijke voorstel (altLabels, narrower,
   related) in deze eerste stap.
4. Nieuwe route `GET /api/rce/concept?uri=<encoded-uri>`, met
   URI-validatie vooraf (alleen bekende namespaces `term/id/rn/2/`,
   `term/id/cht/`, `term/id/abr/`, zelfde patroon als de bestaande
   `COMPLEX_URI_PATTERN`/`GEBIED_URI_PATTERN` - nooit ongevalideerde
   input rechtstreeks als `<IRI>` in SPARQL).
5. `GET /api/rce/search?concept=<encoded-uri>` als alternatief op
   `?q=<tekst>`: exacte match op de concept-URI in plaats van
   `CONTAINS`-tekstzoeken op het label. Retourneert zowel de URI als het
   label per record (nooit alleen de URI tonen aan de gebruiker).
6. UI: het monumentaard-label in de resultatenlijst en detailpagina wordt
   klikbaar en start een exacte conceptzoekopdracht; optioneel tonen uit
   welk scheme het concept komt (het "Classificatie: X / Y"-idee), als
   uitbreiding van de bestaande contextuele-hulphints
   (`docs/vertical-slices/003-contextuele-hulp.md`).
7. Tests: bewijs dat conceptzoeken op URI werkt (twee monumenten met
   toevallig dezelfde labeltekst maar verschillende URI's moeten
   onderscheidbaar blijven), en dat vrije tekstzoeken ongewijzigd blijft
   werken naast deze nieuwe modus.
8. Pas na verificatie: hetzelfde patroon toepassen op andere
   classificaties (functie, type, archeologische classificaties) - elk
   pas nadat de property path voor dat specifieke veld eerst tegen de
   live data is gecontroleerd, niet aangenomen.

## Data-model

```ts
type ConceptRef = {
  uri: string;
  label: string;
  schemeUri?: string;
  schemeLabel?: string;
};
```

`RceMonument`/`Item` krijgen `monumentAardConcept?: ConceptRef` naast het
bestaande `monumentAard`-label (het label blijft bestaan voor de
bestaande filter-UI; de URI komt er additioneel bij, niets wordt
vervangen in deze eerste schijf).

## API-contract

- `GET /api/rce/search?concept=<encoded-uri>` - exacte conceptzoekopdracht,
  naast het bestaande `?q=<tekst>`. `concept` is semantisch leidend; een
  eventuele meegegeven `q` dient dan alleen als leesbaar label voor de UI
  (bijvoorbeeld in de URL-balk), niet als extra filter.
- `GET /api/rce/concept?uri=<encoded-uri>` - haalt label, scheme en
  broader op voor een los concept (voor toekomstige conceptnavigatie,
  fase 2).
- Beide routes valideren de URI server-side tegen een vaste lijst bekende
  namespaces vóór gebruik in SPARQL, zoals nu al gebeurt bij de
  complex-members- en onderzoeksgebied-verrijkingsroutes.

## Scope-afbakening voor deze slice

- Alleen monumentaard. Geen functie, type, archeologische classificaties
  of complextypen in deze eerste schijf - die volgen pas na aparte
  verificatie per veld.
- Geen bredere/nauwere/verwante conceptnavigatie in de UI (fase 2 uit het
  oorspronkelijke voorstel). Wel de onderliggende `resolveConcept`-functie
  alvast `broader` laten teruggeven, zodat fase 2 later niet opnieuw
  hoeft te onderzoeken of dat beschikbaar is (het is beschikbaar, zie
  hierboven).
- Geen vooraf indexeren van het volledige Referentienetwerk.
- Geen complete thesaurusviewer.
- Geen automatische aanname dat elk label een thesaurusconcept is.

## Niet in scope (nog niet besloten, apart te behandelen)

- Sequencing ten opzichte van de nog uitgestelde `page.tsx`-opsplitsing en
  taak #6 (`rce/bibliotheek`) - drie aparte architectuurtrajecten, bewust
  niet tegelijk aangepakt.
- Hoe gelijkwaardige of verwante begrippen uit CHT, ABR en RN2 in de interface
  aan elkaar getoond moeten worden; ze hebben ieder hun eigen canonieke URI en
  worden daarom niet stilzwijgend samengevoegd.

## Openstaande vragen

- **Beantwoord (2026-08-10), live geverifieerd tegen `rce/cho` én de
  Referentienetwerk-dienst**: `heeftType`/`heeftTypeNaam` en archeologische
  classificaties gebruiken wél dezelfde `rn/2`-namespace, maar via één
  extra indirectiestap bij `heeftType` (`?cho ceo:heeftType ?typeNode .
  ?typeNode ceo:heeftTypeNaam ?rn2Concept .` - `?typeNode` zelf is een
  CHO-lokale `cho-kennis/id/type/<id>`-proxy, geen thesaurusconcept; pas de
  waarde van `heeftTypeNaam` is het echte `rn/2`-concept). Geldt voor zowel
  Rijksmonument.heeftType, ArcheologischComplex.heeftType, als
  ArcheologischTerrein.heeftArcheologischeWaardering (dat laatste zonder de
  extra indirectiestap, rechtstreeks net als `heeftMonumentAard`). Elk van
  de drie geverifieerde concepten heeft ook een leesbaar `skos:inScheme`,
  en de schemes zijn exact de vier die de gebruiker al noemde als
  belangrijkste: Rijksmonument-`heeftType` → "Monumenten Registratie
  Systeem", ArcheologischComplex-`heeftType` → "Archeologisch Informatie
  Systeem", ArcheologischTerrein-`heeftArcheologischeWaardering` →
  "Cultuurhistorische Object Informatie" (zelfde scheme als monumentaard).
  Conclusie: het "eerst per veld verifiëren, niet aannemen"-principe uit
  deze slice werkt, en de aanname dat `rn/2` de universele
  classificatie-identiteitslaag is voor CEO blijkt na vier onafhankelijke
  velden (monumentaard, functie, type, archeologische waardering) steeds te
  kloppen - nog geen tegenvoorbeeld gevonden.
- Prestatie van de federatieve lookup (twee endpoints per verrijkte
  weergave) is nog niet gemeten - een timinglog (`rn.resolveConcept`) is
  inmiddels wel toegevoegd aan `referentienetwerk-adapter.ts` (2026-08-10,
  zelfde gedeelde `timed()`-helper als de andere adapters, nu verplaatst
  naar `sparql-client.ts`), dus de eerstvolgende keer dat deze route
  daadwerkelijk gebruikt wordt levert dat meteen een getal op.
- Een conceptzoekopdracht legt concept-URI en veld vast in de URL. Herladen en
  browser-terug/-vooruit herstellen daardoor dezelfde exacte zoekopdracht.
  Conceptresultaten zijn nog wel begrensd en hebben geen knop voor een
  volgende pagina; die beperking wordt in de interface niet als volledige
  thesaurusdekking gepresenteerd.
- `GET /api/rce/concept?uri=` (stap 4) is gebouwd en getest, maar wordt in
  deze schijf nog nergens vanuit de UI aangeroepen - dat komt pas in fase 2
  zodra scheme/broader daadwerkelijk getoond worden.

## Acceptatiecriteria

1. Een geselecteerd monumentaard-concept behoudt zijn URI tot en met de
   SPARQL-query.
2. `/api/rce/search?concept=<uri>` levert exact de rijksmonumenten met
   die concept-URI op, niet een labelmatch.
3. Twee (hypothetische) concepten met hetzelfde label maar verschillende
   URI's blijven onderscheidbaar in resultaten en tests.
4. Onbekende of niet-toegestane URI's worden nergens ongevalideerd in
   SPARQL geïnjecteerd.
5. Vrije tekstzoeken (`?q=`) blijft ongewijzigd werken.
6. Tests bewijzen dat op URI gezocht wordt, niet op het label (bijvoorbeeld
   door twee records met identiek label maar verschillend concept te
   mocken en te controleren dat alleen het juiste record terugkomt).

## Klaar wanneer

Monumentaard is klikbaar vanuit resultatenlijst en detailpagina, start een
exacte conceptzoekopdracht via `/api/rce/search?concept=...`, de nieuwe
Referentienetwerk-adapter en -route zijn gebouwd met dezelfde
beveiligings- en timeout/retry-aanpak als de bestaande adapters, en
typecheck/lint/test blijven groen.
