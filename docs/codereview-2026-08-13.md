# Codereview Doorzoeker v2a, 13 augustus 2026

## Status

Onafhankelijke, volledige codereview op verzoek van de eigenaar, los van de
zelfanalyse in `docs/analyse-2026-08-11.md`. Dit document herhaalt TD-01 t/m
TD-11 niet, maar vervolgt de nummering (TD-12 en verder) waar deze review
concretere of nieuwe bevindingen oplevert. Onderzocht:

- pad: `C:\AI\doorzoeker_rce\doorzoeker-v2a`;
- branch: `main`, actueel met `origin/main`;
- typecheck: geslaagd (`tsc --noEmit`, 0 fouten);
- lint: geslaagd (`eslint .`, 0 meldingen);
- unit- en contracttests: 166 geslaagd, 0 mislukt;
- Playwright-interactietests: 20 geslaagd, 0 mislukt.

**Repo-correctie (13 augustus 2026):** deze review en de P0-fixes hieronder
zijn eerst per ongeluk uitgevoerd tegen `github.com/jolietjakeblues/
doorzoeker_v2` (zonder streepje), een andere, verouderde repo dan de echte
`github.com/jolietjakeblues/doorzoeker-v2a` waar dit werk hoort. Dat is
gecorrigeerd: de `origin`-remote van deze werkmap wijst nu naar
`doorzoeker-v2a`, en alle P0-fixes zijn opnieuw geverifieerd en toegepast
tegen de actuele `main` van de juiste repo (die intussen zelf ook was
doorontwikkeld, o.a. met "Vergelijkbare rijksmonumenten").

## Wat goed is

Voordat de bevindingen volgen: de codebase is in goede staat om vanuit
verder te werken. Sterk aanwezig:

- strikte TypeScript zonder `any`-ontsnappingen;
- consistente adapterarchitectuur (ADR-0002) met een harde grens tussen
  browser en SPARQL — geen route laat ongevalideerde invoer in een
  SPARQL-`<...>`-node terechtkomen;
- een ongewoon eerlijke documentatiecultuur: eerdere analyses corrigeren
  zichzelf expliciet in plaats van foute claims te laten staan;
- een groeiende testset die querybouw, parsing en cachegedrag echt toetst,
  niet alleen happy-path renders.

De bevindingen hieronder zijn dus verbeteringen op een gezonde basis, geen
signaal dat de basis zwak is.

## Belangrijkste bevindingen (geprioriteerd)

### P0 — correctheidsfouten met zichtbaar of onzichtbaar fout gedrag

**Status (bijgewerkt 13 augustus 2026): TD-12 t/m TD-16 zijn opgelost op
branch `fix/p0-race-conditions-en-datalek`.** Elke fix is eerst vastgelegd
met een falende test (bewezen falend zonder de fix, groen met de fix),
daarna gericht opgelost. Typecheck, lint, 170 unit-/contracttests (was 166)
en alle 23 Playwright-interactietests (was 20) slagen.

**TD-12: `loadMore` omzeilt het abort/sequence-systeem — races vervuilen resultaten**

`hooks/useSearchState.ts:400-433`. Elke andere zoekactie in dit bestand
gaat via `beginRequest()` (abort + sequence-id, zie `useSearchRequest.ts`).
`loadMore` niet: de fetch op regel 416 krijgt geen `AbortSignal` en wordt
nooit tegen `request.isCurrent()` gecontroleerd. Start een gebruiker een
nieuwe zoekopdracht vlak nadat die op "Laad 25 volgende resultaten" heeft
geklikt, dan blijft de oude load-more-fetch gewoon doorlopen. Bij afronding
merget hij zijn resultaten alsnog in `remoteResults` en overschrijft hij
`resultPage`/`hasMore` — beide net gereset door de nieuwe zoekopdracht.
Zichtbaar gevolg: items van een oude, ongerelateerde zoekopdracht
verschijnen tussen de resultaten van een nieuwe.

**Risico:** hoog — dit is een stille datacorruptie in de resultatenlijst,
geen crash, dus moeilijk op te merken zonder gerichte test.
**Voorstel:** `loadMore` door dezelfde `beginRequest()`/`isCurrent()`-weg
laten lopen als de andere zoekpaden.

**TD-13: filterreset raced met URL-herstel bij laden**

`hooks/useSearchState.ts:160-166` vs. `:435-458`. Bij het laden van een URL
met `?groenaanleg=1` roept `restoreUrlState` `executeSearch(...)` async aan
en zet daarna synchroon `setOnlyGroenaanleg(true)`. Op dat moment is
`baseResults` nog leeg, dus `groenaanlegCount` is 0. De effect op regel 160
(`setTimeout(..., 0)`) ziet `onlyGroenaanleg && groenaanlegCount === 0` en
zet het filter meteen weer uit, ruim vóór het echte netwerkantwoord
binnenkomt. Een gedeelde of bewaarde URL met dit filter verliest het
filter stil bij het laden.

**Risico:** hoog — een gedeelde deep link doet zichtbaar iets anders dan
bedoeld, zonder foutmelding.
**Voorstel:** de "leeg-filter-reset"-effect pas laten draaien nadat de
eerste zoekopdracht is afgerond, niet op een vaste timeout van 0ms.

**TD-14: gedeelde `LIMIT 500` over drie samengevoegde collecties kan een hele categorie laten verdwijnen**

`lib/rce/archaeology.ts` (`buildVondstlocatieInhoudQuery`, `parseVondstlocatieInhoudResults`).
De query unionde ArcheologischComplex, Grondsporen en Vondsten met één
`ORDER BY ?klasse ?choi LIMIT 500` over triples (niet over losse objecten —
elk concept-getypeerd veld vermenigvuldigt rijen). Doordat `?klasse`
alfabetisch sorteert (ArcheologischComplex < Grondsporen < Vondsten),
verdwenen bij een vondstlocatie met genoeg complexen/grondsporen-rijen de
Vondsten-rijen volledig uit deze query — terwijl
`buildVondstlocatieInhoudTellingQuery` (een aparte, onbegrensde query) wél
een correct, positief totaal bleef tonen.

**Risico:** hoog — de UI toonde dan bijvoorbeeld "3 vondsten" met een lege
vondstenlijst: niet te onderscheiden van een echte bug voor QA of gebruiker.
**Opgelost:** aparte, per-klasse query met eigen `LIMIT 200`, samengevoegd
door de nieuwe `mergeVondstlocatieInhoud`.

**TD-15: "Verras me" sluit dagen 29-31 van elke maand structureel uit**

`lib/server/rce-adapter.ts` (`fetchVerrasMe`) koos
`day = 1 + Math.floor(Math.random() * 28)`. "Op deze dag" (`fetchOpDezeDag`)
doorloopt de échte kalender en dekt dus wél elke dag van het jaar. Dit was
geen gedocumenteerde productkeuze — het was een stille inconsistentie
tussen twee functies die bewust hetzelfde queryonderliggende patroon delen.

**Risico:** middel — geen crash, maar een deel van de collectie was via
"Verras me" nooit te zien, terwijl dat wel de bedoeling van de knop is.
**Opgelost:** dagkeuze baseert nu op het werkelijke aantal dagen in de
gekozen maand (`randomMaandDag`, met 2024 als schrikkeljaar-referentie voor
29 februari).

**TD-16: heropenen van een detail na herladen werkte alleen via tekstzoeken**

`hooks/useSearchState.ts`. `pendingSelectedId.current` werd alleen door
`executeSearch`'s succeshandler teruggelezen om `selected` te heropenen,
niet door `browseType` of `executeConceptSearch`. Een gedeelde URL als
`?browse=rijksmonument&object=<id>` of `?concept=...&veld=...&object=<id>`
herstelde de lijst bij laden, maar heropende het detailvenster niet.

**Risico:** middel — een gedeelde detaillink werkte voor 1 van de 3
zoekingangen, stil voor de andere 2.
**Opgelost:** gedeelde `applyPendingSelection`-helper, nu aangeroepen door
alle drie de zoekpaden.

### P1 — falen dat onzichtbaar is voor de gebruiker

**Status (bijgewerkt 13 augustus 2026): in uitvoering op branch
`fix/p1-zichtbaarheid-van-falen`.**

**TD-17: detail-verrijking faalt onzichtbaar**

`hooks/useSelectedDetailEnrichment.ts`. Bij een netwerkfout op complexleden,
onderzoeksgebied-verrijking of vondstlocatie-inhoud zet de `.catch`
dezelfde lege-array-state als een echte "niets hier"-respons.
`HeritageRelationSections.tsx` laat de sectie dan gewoon weg. In
tegenstelling tot de hoofdzoekopdracht (die een expliciete foutstatus
toont) ziet een tijdelijke storing er hier voor de gebruiker identiek uit
als "dit complex heeft geen leden" — geen herkenbare fout, geen
retry-mogelijkheid.

**Risico:** middel — geen datacorruptie, maar structureel misleidende UI
bij elke tijdelijke storing op deze lazy-endpoints.
**Voorstel:** foutstatus expliciet onderscheiden van lege-maar-geldige
respons, net als bij de hoofdzoekopdracht.

**TD-18: `wktToLatLng` was kwetsbaar op precies het scenario waar de code om is gebouwd**

`lib/rce/geometry.ts` (`boundingBoxFootprint`) gebruikte
`Math.max(...lngs)`/`Math.min(...lngs)` met de spread-operator.
`lib/rce/monuments.ts` documenteert expliciet dat sommige
Werelderfgoed-polygonen (Waddenzee, Hollandse Waterlinies) "megabytes" aan
WKT beslaan en dat er bewust niet wordt afgekapt om `wktToLatLng` correct
te houden. Een ring met veel meer dan ~100.000 coördinatenparen riskeerde
een `RangeError: Maximum call stack size exceeded` in V8 — exact het geval
dat de omliggende code bewust probeert te ondersteunen.

**Risico:** middel — lage kans, hoge impact (een paginacrash in plaats van
een nette val-terug naar "geen coördinaten") en precies op het
grootste/belangrijkste record in de collectie.
**Opgelost:** `boundingBoxFootprint` reduceert nu met een lus in plaats van
spread; geregeld met een gerichte test op een ring van 200.000 punten
(empirisch bevestigd dat de oude implementatie daar al op crasht).

### P2 — typeveiligheidsgaten die bij de volgende wijziging toeslaan

**TD-19: `monumentNature` is een stringly-typed veld met twee rollen, zonder gedeelde union**

Een Rijksmonument gebruikt dit veld voor het echte SKOS-`monumentaard`-label;
de overige objectsoorten gebruiken het als intern, vast discriminatie-label.
Deze letterlijke strings staan los geschreven in meerdere bestanden. Een
typefout of hernoeming compileert schoon en breekt stil de classificatie in
de UI.

**TD-20: `Item` herdefinieert `ArchaeologyConcept` handmatig in plaats van te importeren**

`lib/heritage-view-model.ts` typt archeologische conceptvelden als een
anonieme inline-vorm in plaats van het al bestaande gedeelde type te
hergebruiken. Compileert nu schoon, maar een toekomstig nieuw veld bereikt
de UI-laag dan stil niet.

**TD-21: berekende facetdata wordt nergens gebruikt**

`hooks/useFilteredResults.ts` berekent `functions`/`provinces`/
`municipalities`/`matchSources`, maar `app/page.tsx` gebruikt in plaats
daarvan een lokale, licht afwijkende herimplementatie. Twee
implementaties van hetzelfde, één ervan dood.

### P3 — echte, generieke duplicatie (geen domeinverschil verhullen)

**TD-22: matchscore-formule letterlijk 7x gekopieerd** in de
discovery-parsers van `lib/rce/monuments.ts` en `lib/rce/archaeology.ts`.

**TD-23: elke API-route herhaalt dezelfde try/catch/502-boilerplate.**

**TD-24: prop-alias-shims blijven staan** in `SearchFilters`,
`HeritageDetailDialog` en `HeritageRelationSections` na de page.tsx-splitsing.

**TD-25: drie plekken met identieke "cap grootte, verwijder oudste"-cachelogica**
(zoekroute, termsuggestieroute, rate limiter).

**TD-26: `fetchOpDezeDag`/`fetchVerrasMe` dupliceren dezelfde aanvalslus** —
zie ook TD-15 hierboven.

### P4 — toegankelijkheid

**TD-27: kaartmarkers en clusters zijn niet met het toetsenbord te bedienen.**
`app/HeritageMap.tsx`: `role="button"`/`aria-label` aanwezig, maar geen
`tabIndex`/`keydown`-handler.

### P5 — documentatie en proces

**TD-28: verticale slice 008 — documenten spraken elkaar tegen, oorzaak gevonden**

`docs/analyse-2026-08-11.md` claimde dat "Vergelijkbare rijksmonumenten"
gebouwd en live geverifieerd was; `docs/vertical-slices/008-...md` en de
status-index spraken dit tegen. Oorzaak: het werk stond op dat moment op
een niet-gemergde branch. **Inmiddels opgelost:** de functie is intussen
wél op `main` gemerged (zichtbaar in `hooks/useSelectedDetailEnrichment.ts`
en `HeritageRelationSections.tsx` als `vergelijkbareRijksmonumenten`); de
documentatiestatus moet nog met de huidige code in overeenstemming worden
gebracht.

**TD-29: ADR-0002's routelijst mist `/api/rce/verras-me`** — niet
opnieuw geverifieerd na de repo-correctie, mogelijk inmiddels aangevuld.

**TD-30: Playwright-interactietests kunnen niets tegenhouden** wanneer
`continue-on-error: true` staat op de interaction-job en `deploy-workers.yml`
geen `test:e2e` draait vóór deployen.

**TD-31: alle unit-/contracttests hangen achter een volledige productiebuild**
via `npm run build && node --test ...` in `package.json`.

**TD-32: meerdere lokale/remote branches met mogelijk niet-gemergd werk** —
zie ook de repo-correctie hierboven; branches verdienen een expliciete
triage in plaats van stil te blijven staan.

## Voorgesteld verbetertraject

1. **Correctheid (TD-12 t/m TD-16):** opgelost, zie boven.
2. **Zichtbaarheid van falen (TD-17, TD-18):** in uitvoering.
3. **Typeveiligheid (TD-19 t/m TD-21):** nog te doen.
4. **Opschonen duplicatie (TD-22 t/m TD-26):** nog te doen.
5. **Toegankelijkheid (TD-27):** nog te doen.
6. **Documentatie en proces (TD-28 t/m TD-32):** deels achterhaald door de
   repo-correctie; TD-28's documentatiestatus behoeft een update.

Elke fase eindigt met typecheck, lint, unit-/contracttests en Playwright
groen.

## Nog te analyseren (productbeslissingen, geen losse bugfix)

Deze punten zijn bewust niet als losse TD-fix opgepakt: het zijn
UX-/productkeuzes die eerst gezamenlijk doorgesproken moeten worden voordat
er gebouwd wordt.

- **Verwarring tussen de horizontale "Bekijk alles"-balk en het verticale
  filterpaneel.** Een gebruiker verwachtte dat een klik in de balk (bv.
  "Rijksmonumenten") ook de filters in het paneel zou aanpassen (bv.
  msp/groenaanleg beschikbaar maken). Nader te analyseren of dit twee
  bewust gescheiden ingangen zijn die beter uitgelegd moeten worden, of dat
  ze feitelijk zouden moeten samenvallen.
  **Deelfix (P1, ditzelfde traject):** de Kenmerken-filters (groenaanleg/msp)
  verdwenen voorheen volledig uit het paneel zodra de teller op de geladen
  pagina 0 was, wat het "dit kenmerk bestaat niet"-misverstand versterkte.
  Ze blijven nu zichtbaar met hun werkelijke (mogelijk 0) telling. De
  onderliggende oorzaak - dat elke telling en elk filter alleen over de nu
  geladen batch van 25 gaat, niet globaal - is nog niet opgelost; zie de
  observatie hieronder voor een tweede symptoom daarvan.
  **Extra observatie (2026-08-13):** hetzelfde geldt voor "Laad 25 volgende
  resultaten" in combinatie met een functie-filter (bv. Rijksmonumenten →
  functie "Werk-woonhuis"). De knop haalt telkens 25 nieuwe, ongefilterde
  monumenten op en filtert die daarna pas client-side, dus een klik levert
  meestal maar een handjevol extra treffers op in plaats van tot 25
  passende. Een gebruiker verwacht dat "volgende 25" 25 (of minder, indien
  minder beschikbaar) resultaten toevoegt die aan het actieve filter
  voldoen.
- **Getalzoekopdrachten matchen momenteel alleen `ceo:rijksmonumentnummer`
  voor Rijksmonumenten** (`searchByNumber` in
  `lib/server/rce-adapter.ts`), terwijl elk ander objectsoort (complex,
  archeologisch terrein, vondstlocatie, grondspoor, vondst, archeologisch
  complex) bij een numerieke zoekopdracht wél ook op
  `ceo:cultuurhistorischObjectnummer` matcht. Ontdekt doordat een geldig
  CHO-nummer ("71286", Rijksmonument "Herenhuis Tolsedijk",
  rijksmonumentnummer 519471) 0 resultaten opleverde.
  **Update (P1, ditzelfde traject):** opgelost - numerieke zoekopdrachten
  matchen nu ook op CHO-nummer voor Rijksmonumenten, gelabeld via
  matchSource "CHO-nummer (rijksmonument)".
  Simpelweg CHO-nummer ook laten meematchen voor Rijksmonumenten riskeert
  echter verwarring: hetzelfde numerieke getal kan toevallig zowel een
  geldig rijksmonumentnummer voor het ene object als een geldig CHO-nummer
  voor een heel ander object zijn, waardoor niet-gerelateerde resultaten
  door elkaar heen getoond worden. Twee mogelijke richtingen, nader te
  bepalen:
  1. Eén numeriek zoekveld dat op meerdere velden matcht, met duidelijke
     labeling per resultaat van welk veld de match veroorzaakte (zoals nu al
     gebeurt voor complexnummer/CHO-nummer bij de archeologische soorten).
  2. Aparte, getypeerde zoekvelden per nummersoort (rijksmonumentnummer,
     CHO-nummer, Archis2-nummer, ...) zodat een gebruiker expliciet kiest
     welk veld bedoeld is.
