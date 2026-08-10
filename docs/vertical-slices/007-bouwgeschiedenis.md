# Verticale slice 007: Bouwgeschiedenis via `ceo:heeftGebeurtenis`

## Status

Gebouwd en live geverifieerd (2026-08-10). Alle onderdelen zijn
geïmplementeerd: `buildGebeurtenissenQuery`/`parseGebeurtenissenResults`
(met de geneste actorenrol-join), een zevende parallelle
`enrich.gebeurtenissen`-lookup, `buildGebeurtenisConceptQuery`/
`buildActorConceptQuery` met de nieuwe `veld=gebeurtenis`/`veld=actor`-
waarden op `/api/rce/search?concept=`, en de "Bouwgeschiedenis"-lijst in
het detailpaneel. Live geverifieerd tegen rijksmonument 517912: toont
"vervaardiging" (1934, klikbaar) en twee "niet bepaald"-gebeurtenissen met
klikbare actoren "Bedaux, Jos" en "Studentengilde, Brabantse" (beide
architect). Klikken op "Bedaux, Jos" levert 4 andere rijksmonumenten op
met exact diezelfde actor-concept-URI. `enrich.gebeurtenissen` antwoordde
in 156-457ms, geen outlier naast de andere verrijkingen. Querybouw, parsing
en de exacte actor-/gebeurtenisroutes zijn met regressietests afgedekt.

Onderweg is een eerste conclusie dat actor/rol niet klikbaar te maken
zouden zijn achterhaald na een gerichte tip van de gebruiker om
`graph/actorenrol` te bekijken - actor bleek wél een resolvebare
concept-URI te hebben, alleen niet in de graph die Doorzoeker al
gebruikte. Zie "Empirisch bevestigd" hieronder voor de details - en de
bredere les: bij een RCE-verkenning altijd alle relevante named graphs
checken, niet alleen `graph/instanties-rce`.

## Aanleiding

Rijksmonument-records bevatten soms een geregistreerde bouwgeschiedenis:
wanneer het object is vervaardigd, verbouwd of gerestaureerd, en door wie.
Doorzoeker toont dit nu nergens - alleen `registrationDate` (de datum van
inschrijving in het Monumentenregister, een heel ander gegeven dan
wanneer het object daadwerkelijk gebouwd is).

## Empirisch bevestigd (2026-08-10)

Padstructuur (empirisch uitgezocht, niet uit de ontologie alleen af te
leiden - zie de reference-doc voor de volledige toelichting):

```
Rijksmonument --heeftGebeurtenis--> Gebeurtenis   [graph/instanties-rce]
  --heeftGebeurtenisNaam--> skos:Concept (rn/2-namespace, resolvebaar)
  --heeftDatering--> Datering
      --heeftBeginDatering--> proxy --ceo:datum--> xsd:date
      --heeftEindDatering--> proxy --ceo:datum--> xsd:date
      --heeftBetrouwbaarheid / heeftIndicatieNauwkeurigheid--> skos:Concept (precisie, bv. "onbekend"/"globaal")
  --heeftActorEnRol--> ActorEnRol (zelfde subject-URI in twee graphs!)
      in graph/instanties-rce:  heeftActor/heeftRol --> platte tekst-literal
      in graph/actorenrol:      heeftActor/heeftRol --> skos:Concept (rn/<uuid>-namespace, resolvebaar)
```

1. **Gebeurtenistype is een echte, resolvebare `rn/2`-concept-URI**, zelfde
   patroon als monumentaard/waardering. Top-4 (aantal gebeurtenissen, niet
   monumenten): "vervaardiging" (20.037), "niet bepaald" (9.888),
   "verbouwing" (2.653), "restauratie" (295).
2. **Actor ís resolvebaar, maar via een aparte graph.** Een query op
   alleen `graph/instanties-rce` (waar Doorzoeker al standaard zoekt)
   geeft voor `heeftActor`/`heeftRol` platte tekst-literals
   (`"Kramer, Hendrik ; Stad Leeuwarden"` /
   `"architect / bouwkundige / constructeur"`). Maar dezelfde
   `ActorEnRol`-subject-URI bestaat óók in de aparte `graph/actorenrol`
   (9.867 ActorEnRol- en 4.053 skos:Concept-instanties), waar diezelfde
   properties wél een echte concept-URI geven (namespace
   `data.cultureelerfgoed.nl/term/id/rn/<uuid>` - let op: `rn/`, niet
   `rn/2/`). Met een extra `GRAPH`-join op die tweede graph (zelfde
   `?ar`-URI) is de actor dus wél als identiteit op te halen. **6.979 van
   de 18.615 Rijksmonumenten met een Gebeurtenis (~37,5%) hebben zo'n
   resolvebare actor-URI.** `heeftRol` resolveert via dezelfde route naar
   een eigen concept-URI, maar is een klein, generiek vocabulaire
   ("architect", "aannemer", ...) - niet interessant om klikbaar te
   maken (te brede, weinig zeggende resultaten).
3. **Omvang**: 18.615 van de ~62.000 Rijksmonumenten (~30%) hebben
   minstens één Gebeurtenis. Van de 32.873 Gebeurtenis-instanties heeft
   ~35% ook een `heeftActorEnRol` (waarvan dus ~38% daarvan, oftewel de
   6.979 hierboven, ook een resolvebare actor-URI heeft).
4. **Fan-out is beperkt**: maximaal 19 Gebeurtenissen op één
   rijksmonumentnummer (geobserveerd) - een stuk minder scheef dan
   literatuur (149) of het losse adressenvraagstuk (513), maar een cap
   blijft verstandig.
5. `ceo:datum` op de begin-/einddatering-proxy is een gewone `xsd:date`
   (bv. "1850-01-01") - geen aparte conceptopzoeking nodig voor de datum
   zelf.

## Doel

Op de detailpagina van een Rijksmonument met minstens één geregistreerde
Gebeurtenis, een "Bouwgeschiedenis"-sectie tonen: het type gebeurtenis
(klikbaar), de datering indien aanwezig, en de betrokken actor(en) met hun
rol - de actor zelf ook klikbaar wanneer een resolvebare URI beschikbaar
is (bv. "vind alle andere rijksmonumenten waar deze architect aan
werkte"), de rol niet.

## Waarom niet meteen breed

- `heeftGebeurtenisNaam` en (via de aparte `graph/actorenrol`) `heeftActor`
  zijn de twee bevestigde, klikbare concept-URI's. `heeftRol` blijft NIET
  klikbaar - het resolveert wel naar een concept, maar het is zo'n klein,
  generiek vocabulaire dat een klik erop een enorme, weinig zeggende
  resultatenset zou opleveren.
- De precisie-indicatoren (`heeftBetrouwbaarheid`/
  `heeftIndicatieNauwkeurigheid`) voegen ruis toe zonder duidelijke
  meerwaarde voor een eerste schijf - "datering globaal" is minder
  belangrijk dan de datering zelf.
- Meerdere BAG-adressen (dezelfde verkenning, andere vondst) is een apart,
  anders gevormd probleem (tot 513 adressen op één monument) met een
  eigen cap-strategie - hoort niet in deze schijf thuis.
- `heeftGebeurtenis` heeft in de ontologie het generieke
  `CultuurhistorischObject` als domein, dus zou in theorie ook op
  Werelderfgoed/Gezicht/Complex/Onderzoeksgebied kunnen voorkomen - niet
  gecontroleerd. Deze schijf beperkt zich tot Rijksmonument, ongeacht het
  antwoord op die vraag (zie "Openstaande vragen").

## Voorgestelde eerste verticale schijf

1. Nieuwe querybouw/parse-functies in `lib/rce.ts`
   (`buildGebeurtenissenQuery`/`parseGebeurtenissenResults`), gebatchd op
   CHO-URI net als de bestaande archeologisch-terrein-/groenaanleg-
   verrijking. De query bevraagt zowel `graph/instanties-rce` (Gebeurtenis,
   type, datering, ActorEnRol met de platte actor/rol-literals als
   fallback) als, via een tweede `GRAPH`-patroon op dezelfde `?ar`-URI,
   `graph/actorenrol` (de resolvebare actor-concept-URI, optioneel). Eén
   rij per (gebeurtenis, actor)-combinatie (net als de literatuur-adapter
   dat al doet voor boek/auteur), dus groeperen en sorteren gebeurt in JS,
   niet in SPARQL.
2. Nieuw type `Gebeurtenis` op `RceMonument`/`Item` (zie datamodel
   hieronder), gevuld via een zevende parallelle `enrichMonuments`-lookup
   in `rce-adapter.ts` (`enrich.gebeurtenissen`).
3. Cap op 10 gebeurtenissen per monument (ruim boven het geobserveerde
   maximum van 19 zou geen cap nodig hebben, maar een kleine cap blijft
   verstandige voorzorg tegen toekomstige uitschieters). Sortering:
   chronologisch oplopend op `beginDatum` (een geschiedenis leest van oud
   naar nieuw) - events zonder datum onderaan.
4. Concept-zoekopdracht voor het gebeurtenistype: exact hetzelfde patroon
   als de fase 2-uitbreiding voor archeologische waardering - nieuwe
   `buildGebeurtenisConceptQuery`/`searchByGebeurtenisConcept`, een derde
   waarde (`gebeurtenis`) voor de bestaande `veld`-parameter op
   `GET /api/rce/search?concept=`.
5. Concept-zoekopdracht voor de actor: een vierde `veld`-waarde (`actor`).
   De query moet, anders dan de andere drie, over twee graphs heen zoeken:
   `graph/actorenrol` voor de match op de actor-concept-URI (`?ar
   ceo:heeftActor <uri>`), dan terug naar `graph/instanties-rce` om via
   `heeftGebeurtenis/heeftActorEnRol = ?ar` de bijbehorende
   rijksmonumentnummers te vinden - een nieuw querypatroon (federatie
   binnen hetzelfde `rce/cho`-endpoint, niet tussen twee aparte
   endpoints zoals bij Referentienetwerk/bibliotheek), maar wel
   binnen één en dezelfde SPARQL-aanroep op te lossen.
6. UI: nieuwe "Bouwgeschiedenis"-lijst in het detailpaneel (zelfde
   `map-object-list`-stijl als literatuur), per gebeurtenis: het klikbare
   type, de datering (indien aanwezig), en per actor de naam (klikbaar
   wanneer een concept-URI beschikbaar is, anders platte tekst) plus de
   rol als platte tekst.
7. Tests: unit tests voor de nieuwe query/parse-functies (groepering,
   sortering, capping, met en zonder resolvebare actor-URI - naar het
   patroon van de literatuur-tests), route-niveau tests voor zowel
   `veld=gebeurtenis` als `veld=actor`-dispatch, live browserverificatie.

## Data-model

```ts
type GebeurtenisActor = { naam: string; rol?: string; actorConceptUri?: string };
type Gebeurtenis = {
  naam: string;
  naamConceptUri?: string;
  beginDatum?: string; // ISO yyyy-mm-dd, uit ceo:datum
  eindDatum?: string;
  actoren: GebeurtenisActor[];
};
```

`RceMonument`/`Item` krijgen `gebeurtenissen?: Gebeurtenis[]`, naast de
bestaande verrijkingsvelden - niets vervangt iets bestaands.

## API-contract

Geen nieuwe route. `GET /api/rce/search?concept=<uri>&veld=gebeurtenis`
en `GET /api/rce/search?concept=<uri>&veld=actor` als derde en vierde
waarde naast de bestaande `monumentaard`/`waardering` op de al bestaande
`veld`-parameter (zie
[`004-referentienetwerk-concepten.md`](004-referentienetwerk-concepten.md)).
De bouwgeschiedenis zelf wordt, net als literatuur, een extra veld op het
bestaande `/api/rce/search`-resultaatcontract - geen aparte enrichment-
route.

## Scope-afbakening voor deze slice

- Alleen Rijksmonument. Of `heeftGebeurtenis` ook op andere soorten object
  voorkomt is niet gecontroleerd en wordt in deze schijf niet
  meegenomen.
- `heeftGebeurtenisNaam` en `heeftActor` (via `graph/actorenrol`) worden
  klikbaar. `heeftRol` blijft platte tekst, bewust niet klikbaar - te
  generiek vocabulaire, geen zinvolle klik-resultaten.
- Geen precisie-indicatoren (`heeftBetrouwbaarheid`/
  `heeftIndicatieNauwkeurigheid`) in deze eerste schijf.
- Geen "meerdere adressen"-functie - apart vraagstuk, eigen (grotere)
  cap-strategie nodig, geen plan hier.
- Geen normalisatie of ontdubbeling van actor-strings of -concepten (bv.
  dezelfde architect die via een net iets andere concept-URI of
  schrijfvariant nogmaals voorkomt) - tonen en doorzoeken zoals de
  brondata het aanlevert.

## Openstaande vragen

- Wat te tonen wanneer zowel `beginDatum` als `eindDatum` ontbreken (komt
  voor, samen met het "niet bepaald"-gebeurtenistype)? Voorstel: alleen
  type + eventuele actor tonen, geen datumtekst of placeholder.
- Komt `heeftGebeurtenis` ook voor op Werelderfgoed/Gezicht/Complex/
  Onderzoeksgebied (het domein in de ontologie is generiek
  `CultuurhistorischObject`)? Niet gecontroleerd - relevant voor een
  eventuele latere uitbreiding, niet blokkerend voor deze Rijksmonument-
  only eerste schijf.
- Sortering van gebeurtenissen zonder `beginDatum` binnen de
  chronologische lijst - onderaan geplaatst is de voorlopige keuze, niet
  met de gebruiker afgestemd.
- Performance van de dubbele-graph-join voor actor (`graph/instanties-rce`
  + `graph/actorenrol` in één query, dan bij een klik nogmaals in de
  omgekeerde richting voor `veld=actor`) is nog niet gemeten - relevant
  omdat dit een nieuw querypatroon is (federatie binnen één endpoint via
  twee named graphs), niet identiek aan de al gemeten batches elders.

## Acceptatiecriteria

1. Een Rijksmonument-detailpagina toont een "Bouwgeschiedenis"-sectie
   zodra er minstens één geregistreerde Gebeurtenis is.
2. Het gebeurtenistype is klikbaar en start een exacte
   conceptzoekopdracht (`veld=gebeurtenis`) die alleen rijksmonumenten met
   precies die concept-URI teruggeeft.
3. Datering (indien aanwezig) wordt per gebeurtenis getoond; actor(en) met
   rol worden getoond, en de actornaam is klikbaar (`veld=actor`) wanneer
   er een resolvebare concept-URI beschikbaar is - anders gewoon platte
   tekst, geen kapotte of ontbrekende weergave.
4. Capping voorkomt dat een monument met veel gebeurtenissen (max
   geobserveerd: 19) de detailpagina onbruikbaar maakt.
5. Bestaande zoek-/filterfunctionaliteit en -performance blijven
   ongewijzigd.
6. Typecheck/lint/test blijven groen.

## Klaar wanneer

Bouwgeschiedenis is zichtbaar op de detailpagina van elk Rijksmonument met
minstens één geregistreerde Gebeurtenis, het gebeurtenistype én (waar
resolvebaar) de actor zijn klikbaar en starten een exacte
conceptzoekopdracht via hetzelfde `veld`-mechanisme als monumentaard/
waardering, en typecheck/lint/test blijven groen.
