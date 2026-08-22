# Te doen

Lopend to-do-document. Vastgelegd op 14 augustus 2026, na afronding van
PR's #55-#60 en twee reviews (functioneel + security) op `main`
(`463f5f4`). Aangevuld op 15 augustus 2026 (mobiel/toegankelijkheid,
`/accessibility-review`-bevindingen, drie zaterdag-fixes, en een
design critique). Wordt maandag verder opgepakt.

## Domeinnaam

15. ~~**Sitenaam wordt `doorzoekerfgoed.nl`.**~~ **Afgerond (17 augustus
    2026, bevestigd door de eigenaar).** `doorzoekerfgoed.nl` en
    `www.doorzoekerfgoed.nl` zijn live en gekoppeld aan de Cloudflare
    Worker (live geverifieerd tijdens de security assessment - zie
    `docs/security-assessment-2026-08-17.md`). `README.md` bevat geen
    hardcoded workers.dev-URL om bij te werken; gecontroleerd, geen
    andere hardcoded verwijzingen naar de oude workers.dev-URL gevonden
    in `.md`/`.ts`/`.tsx`/`.json`-bestanden buiten de historische
    sessiedocumentatie (die blijft ongewijzigd als tijdslijn).

## Kwaliteit en toegankelijkheid

1. **Mobiele weergave controleren.** Nog niet systematisch getest, alleen
   een steekproef op 375px-viewport tijdens de accessibility-review
   (geen horizontale overflow, zoekveld-font-size 17px voorkomt
   iOS-autozoom, mobiele filterknop rendert op juiste grootte zodra er
   resultaten zijn). Geen test op echte apparaten.
2. **`/accessibility-review` uitgevoerd (15 augustus 2026)**, live tegen
   `https://doorzoeker-v2a.jolietjakeblues64.workers.dev/`. Resultaat: 0
   kritiek, 2 major, 3 minor. Wat al goed zat: kleurcontrast ruim boven
   de norm overal geverifieerd, `html lang="nl"`, correcte
   `role="dialog"`/`aria-modal`/`aria-labelledby` met werkende focus-trap,
   zichtbare focusindicator bij echte Tab-navigatie, geen `<img>` zonder
   alt-tekst.
   - ~~**Kaarttoegankelijkheid (TD-27, major).**~~ **Opgelost (17 augustus
     2026).** Bevestigd: 31 Leaflet-markers (SVG `path`) zonder
     `tabindex`/`role` - volledig onbereikbaar via toetsenbord, onzichtbaar
     voor schermlezers als interactief element. `app/HeritageMap.tsx`:
     nieuwe `makeKeyboardAccessible()`-helper geeft elk interactief
     kaartelement (punt-markers, vorm-polygonen, clusterbadges) een
     `tabindex`, `role="button"`, `aria-label` en een `keydown`-handler die
     Enter/Spatie hetzelfde laat doen als een klik; nieuwe
     `:focus-visible`-outline in `app/globals.css`. Onderweg bleek dat
     Leaflet's eigen `L.Marker` (gebruikt voor clusterbadges) via
     `options.keyboard` al standaard een tabbare wrapper-`div` aanmaakt
     zonder Enter/Spatie te koppelen aan de klik-actie - de helper
     hergebruikt die bestaande wrapper (via `marker.getElement()`) in
     plaats van er een tweede, geneste tabstop naast te zetten. Live
     geverifieerd: precies één focusbare stop per marker/cluster, Enter en
     een echte muisklik geven identiek gedrag. Regressietest in
     `tests/e2e/rework.spec.ts`.
   - ~~**Geen skip-link (minor).**~~ **Opgelost (17 augustus 2026).**
     Toetsenbordgebruiker moest elke keer door 24 knoppen (Direct zoeken +
     Ontdek een thema + Bekijk alles) tabben voor de resultaten bereikbaar
     waren. Nieuwe `.skip-link` (`app/globals.css`, onzichtbaar tot focus)
     als eerste element in `<main>`, springt naar `#results`
     (`tabIndex={-1}` zodat de div zelf focus kan krijgen). E2e-test
     controleert dat de allereerste Tab-druk de link raakt.
   - ~~**Focus keert niet terug na sluiten detailvenster.**~~ **Vals
     positief, geen actie nodig.** Eerste test gebruikte een ruwe
     JS-`.click()` zonder voorafgaande focus, wat `previouslyFocused` in
     `useDialogFocus.ts` op `document.body` liet uitkomen. Herverificatie
     met een echte klik+toetsenbordinteractie bevestigt dat de bestaande
     focus-restore correct werkt (en de e2e-test "de detaildialoog houdt
     focus vast en herstelt hem na Escape" dekt dit al).
   - ~~**Knoppen onder de 44x44px-ondergrens (2.5.5, minor).**~~
     **Opgelost (15 augustus 2026).** Weergave-toggle, exportknoppen,
     thema-/nav-knoppen, filterrijen en de zoekveld-wis-knop zaten
     allemaal net onder 44px (meestal alleen in hoogte). CSS aangepast in
     `app/globals.css`; nieuwe e2e-test controleert dit voor de
     belangrijkste knoppen.
3. **Nieuwe doorklik-gaten, gemeld door de eigenaar (15 augustus 2026) -
   beide onderzocht en opgelost, zelfde dag:**
   - ~~Grondspoor-veld "Type" (bv. "grondverkleuring") is ook een
     concept-URI-gekoppeld begrip - zie CHO 10000187.~~ **Opgelost.** De
     concept-URI werd al opgehaald (`archaeologicalTypeConceptUri`) maar
     nergens gebruikt. Nieuw conceptveld `grondspoortype` door de hele
     stack (query, route, client, hook, UI); "Type grondspoor" is nu een
     `concept-link`-knop in `app/HeritageDetailFacts.tsx` en meegenomen in
     "Alle gekoppelde begrippen".
   - ~~"Archeologische waardering: hoge archeologische waarde" is een link
     - zie CHO 6042545.~~ **Echte bug gevonden en opgelost, niet alleen
     een bevestiging.** `buildArcheologischeWaarderingConceptQuery` matchte
     via `ceo:ligtInObject` naar een gekoppeld Rijksmonument - maar live
     geverifieerd: van de ~13.018 ArcheologischTerrein-instanties met een
     waardering hebben er maar ~1.812 (~14%) zo'n koppeling. CHO 6042545
     is één van de overige ~86%: waardering wél gezet, geen
     `ligtInObject`, dus de oude query gaf daar stilzwijgend 0 resultaten.
     Query matcht nu op het eigen CHO-nummer van het terrein (zelfde
     patroon als `searchByVerwervingConcept`); resultaten tonen voortaan
     het terrein zelf in plaats van een toevallig gekoppeld Rijksmonument.

4. **Nog twee doorklik-gaten, gemeld door de eigenaar (15 augustus 2026,
   via mobiele screenshots) - beide onderzocht en opgelost, zelfde dag:**
   - ~~"Type" bij een Rijksmonument (bv. "Bovenkruier", CHO 27601) staat
     als platte tekst, geen link.~~ **Opgelost.** `buildRceFacetsQuery`
     haalde alleen het label op (`.../heeftTypeNaam/skos:prefLabel`), de
     concept-URI werd genegeerd. Nieuw conceptveld `monumenttype` door de
     hele stack; "Type" is nu een `concept-link`-knop in
     `app/HeritageDetailFacts.tsx` en meegenomen in "Alle gekoppelde
     begrippen".
   - ~~De CHO-nummers naast archeologische-complextypen in "Wat hier is
     aangetroffen" (Vondstlocatie-detail) kloppen niet - moeten rn/2-URI's
     zijn.~~ **Opgelost.** De concept-URI van het type was al opgehaald
     (`complex.type.uri`, via `?object ceo:heeftType/ceo:heeftTypeNaam
     ?concept`) maar nooit gebruikt; de knop opende in plaats daarvan de
     losse complex-*instantie* op CHO-nummer, met dat instantienummer
     misleidend tussen haakjes vlak naast de typenaam gezet (leek een
     definitie van het type, was het niet). In `app/HeritageRelationSections.tsx`:
     het type is nu zelf een `concept-link` naar
     `veld=archeologischcomplextype` (zoekt alle complexen van dit type);
     de instantie blijft apart en duidelijk gelabeld opvraagbaar als
     "Complex {CHO-nummer}" (behoudt TD-33's doel: complexen met hetzelfde
     type onderscheidbaar houden).

5. ~~**"Bekijk bovenliggend object"-verwijzing bij een Vondstlocatie gaf soms
   0 resultaten, gemeld door de eigenaar (17 augustus 2026, CHO 10001066).**~~
   **Structurele oorzaak gevonden en opgelost, niet zomaar een toevalstreffer.**
   Die verwijzing (`onObjectSearch` in `HeritageDetailFacts.tsx`) doet een
   gewone vrije-tekstzoekopdracht op het CHO-nummer. Zo'n zoekopdracht splitst
   in `searchByText` (`lib/server/rce-adapter.ts`) in negen losse
   categoriequery's (Rijksmonument, Werelderfgoed, Vondstlocatie,
   Onderzoeksgebied, ...) die elk via `optionalSearch` bij een falen stil
   terugvallen op een lege lijst - één trage of tijdelijk onbereikbare
   RCE-SPARQL-tak (bv. de onderzoeksgebieden-tak) levert dus gewoon een
   "geldige" `200 OK` met (te) weinig of 0 resultaten op, zonder foutmelding.
   `app/api/rce/search/route.ts` cachete elk zulk antwoord vervolgens
   **onvoorwaardelijk** 5 minuten lang, zowel in de gedeelde Cloudflare
   Cache API als in de in-memory `responseCache` - dus één transiënte
   RCE-hapering zette een fout "0 resultaten" 5 minuten lang vast, gedeeld
   voor alle bezoekers, voor exact die zoekterm. Dit verklaart een reeks
   eerder moeilijk te reproduceren "0 resultaten"-meldingen. Live bevestigd:
   CHO 10001066 bestaat écht (Archeologisch onderzoeksgebied, Diemen), de
   SPARQL-query en de API-laag zelf waren correct - alleen de caching van
   een onvolledig antwoord was fout. Fix: nieuwe `SearchPartialFailure`-tracker
   die `optionalSearch()` op `true` zet bij een gefaalde categorie (en bij een
   gefaalde kern-discoverytak); de route slaat cachen dan over
   (`Cache-Control: no-store`, geen `responseCache.set`/Cache-API-`put`), zodat
   een volgende poging de gefaalde tak gewoon opnieuw probeert in plaats van
   tegen een vastgezette lege cache aan te lopen. Regressietests in
   `tests/rce-api.test.mjs` bewijzen zowel het probleem (test faalt zonder de
   fix) als dat een volledig geslaagde zoekopdracht normaal blijft cachen.
   **Bekende resterende beperking, niet in deze fix meegenomen:** een aantal
   categoriehelpers (`searchVondstlocaties`, `searchGrondsporen`,
   `searchVondsten`, `searchArcheologischeComplexen`,
   `searchArcheologischeTerreinen`) hebben zelf ook een `Promise.allSettled`
   over hun eigen discoverybronnen (bv. CHO-nummer vs. omschrijving vs.
   woonplaats) en laten een individueel gefaalde bron eveneens stil vallen
   zonder dat te melden aan de nieuwe tracker - dat raakt alleen de
   volledigheid van matches binnen zo'n categorie (niet de hele categorie),
   maar is dezelfde soort stille-fout-bug op een dieper niveau. **Update
   (TD-04, 17 augustus 2026): deze helpers gebruiken nu allemaal dezelfde
   gedeelde `runDiscoveryBranches`-helper - zie item 9 hieronder. Ze melden
   een individueel gefaalde bron nog steeds niet aan de partialFailure-
   tracker (alleen `searchByText`'s eigen kerndiscovery doet dat); dat deel
   van deze beperking blijft dus staan.**
6. ~~**Zelfde CHO-citaat-bug als item 5 hierboven, maar dan bij een
   Onderzoeksgebied's "Archeologisch onderzoek binnen dit gebied"-lijst,
   gemeld door de eigenaar (17 augustus 2026, CHO 2010285 en
   10030417).**~~ **Opgelost - miste bij de eerdere fix van dezelfde bug bij
   Vondstlocaties.** `OnderzoeksgebiedComplex` had alleen `typeLabel` (platte
   tekst); `buildOnderzoeksgebiedComplexenQuery` gebruikte het collapsed pad
   `heeftType/heeftTypeNaam/skos:prefLabel` en gooide de concept-URI weg. De
   UI toonde het CHO-nummer van de complex-*instantie* misleidend tussen
   haakjes naast de typenaam (leek een begrip-referentie, was het niet) -
   exact dezelfde bug als eerder gefixt voor `vondstlocatieInhoud.complexen`,
   maar deze aparte code-plek (`onderzoeksgebiedVerrijking.complexen`,
   eigen query/type/route) werd toen niet meegenomen. Live geverifieerd
   (CHO 2010285: complex 10000011 "niet opgehoogde, individuele huisplaats").
   Fix: query gesplitst in losse triples (`?typeConcept` + `?typeLabel`),
   `OnderzoeksgebiedComplex.typeLabel` vervangen door `type?: ArchaeologyConcept`,
   `fetchOnderzoeksgebiedVerrijking` resolvet nu ook schemes via
   `resolveConcepts`, en `HeritageRelationSections.tsx` toont het type als
   `concept-link` naar `archeologischcomplextype` met de instantie apart als
   "Complex {CHO-nummer}". **Les:** bij een volgend "overal"-gemeld
   patroonprobleem eerst alle code-plekken met hetzelfde SPARQL-pad
   doorzoeken (`grep heeftType/ceo:heeftTypeNaam/skos:prefLabel`), niet
   alleen de plek uit het eerste voorbeeld.
7. **Security assessment uitgevoerd (17 augustus 2026)** - red-team-
   invalshoek plus OWASP/STRIDE, volledig verslag in
   `docs/security-assessment-2026-08-17.md`. Twee nieuwe bevindingen,
   beide opgelost in dezelfde sessie:
   - ~~Site was over onversleuteld `http://` volledig bereikbaar, geen
     redirect naar `https://`.~~ **Opgelost.** Live geverifieerd met
     `curl -v` (echte TCP-verbinding, poort 80) op zowel
     `doorzoekerfgoed.nl` als de workers.dev-URL. Fix: redirect naar
     `https://` in `worker/index.ts`, als verdedigingslaag naast (niet in
     plaats van) een eventuele Cloudflare-zone-instelling die niet vanuit
     de repo te controleren is. ~~**Open vraag aan de eigenaar:** staat
     "Always Use HTTPS" aan in het Cloudflare-dashboard?~~ **Bevestigd
     door de eigenaar (18 augustus 2026): ja.**
   - ~~Numeriek zoekpad (`searchByNumber`) had geen fallback bij een
     falende deelquery.~~ **Opgelost.** Live gereproduceerd tijdens
     verhoogde RCE-latency (4-15s per aanroep): `?q=36046` faalde met 502,
     terwijl de zes bijvangst-categorieën in dezelfde `Promise.all` al wél
     via `optionalSearch` gracieus degradeerden. Hergebruikt dezelfde
     `SearchPartialFailure`-tracker van vandaag.
   - ~~Geen minimumlengte op de vrije-tekstzoekterm.~~ **Opgelost.**
     `?q=a` gaf live herhaaldelijk 502 tijdens RCE-traagheid - de duurst
     mogelijke CONTAINS/LCASE-scan. Minimaal 2 tekens voor vrije tekst;
     numerieke zoekopdrachten (ook 1 cijfer) blijven toegestaan, want die
     gebruiken een goedkope exacte match.
   - Zie ook punt 7 en 9 hierboven bij "Uit de securityreview" voor de
     twee al bekende bevindingen die deze assessment opnieuw bevestigde en
     nu (deels) oploste.
   - **Twee dingen kon ik niet met zekerheid vaststellen** (staat expliciet
     zo in het rapport): of vinext's eigen RSC-laag specifiek getoetst is
     tegen CVE-2025-55182 (React2Shell, CVSS 10.0 - wel gepatcht op
     versienummer: react-server-dom-webpack 19.2.8 > de 19.2.1-fixgrens),
     en of de door Vercel/Hacktron gemelde vinext-eigen kwetsbaarheden al
     zijn opgelost in de hier gebruikte bèta-versie (`1.0.0-beta.5`).
8. ~~**"Gemaal(M)", "Kapel(K1)" e.d. bleven onopgeschoond staan, gemeld
   door de eigenaar (17 augustus 2026).**~~ **Opgelost.** `toItem()` in
   `lib/heritage-view-model.ts` haalde `originalFunctionNames` wel door
   `displayFunctionName()` (strippen van een `(...)`-staart) maar
   `currentFunctionNames` niet - exact dezelfde soort asymmetrie als
   eerdere bugs deze sessie, nu tussen "oorspronkelijke" en "huidige
   functie" in plaats van tussen twee objectsoorten. `HeritageDetailFacts.tsx`
   compenseerde dit lokaal alleen in het detailpaneel; de filterlijst
   (`contextFunctions` in `app/page.tsx`) en de "gevonden via"-tekst bij
   zoekresultaten (`matchedText`, alleen gecheckt op matchSource
   `"oorspronkelijke functie"`, niet `"huidige functie"`) toonden de rauwe
   waarde nog wel. Beide nu gefixt bij de bron; de lokale compensatie in
   `HeritageDetailFacts.tsx` is overbodig en verwijderd. Neveneffect: de
   eigenaar meldde dat dezelfde functie soms dubbel in de filterlijst
   stond (bv. "Boerderij" én "Boerderij(M)") - dat loste zich vanzelf op
   doordat de dedup in `contextFunctions` nu op de opgeschoonde waarde
   werkt.
9. **TD-04/TD-05 opgepakt (17 augustus 2026), gedeeltelijk opgelost - zie
   `docs/analyse-2026-08-11.md` voor het volledige "wel/niet meegenomen"-
   overzicht.** Twee gerichte, mechanische verbeteringen, geen volledige
   unificatie (dat zou objectsoorten kunstmatig tot één model reduceren,
   precies wat TD-04's eigen analyse afraadt):
   - **TD-04:** het "loop ranked discovery-brontakken af, laat een falende
     tak individueel vallen" patroon stond 6-7 keer bijna-identiek herhaald
     in `lib/server/rce-adapter.ts`. Samengevoegd tot één
     `runDiscoveryBranches`-helper. Daarbij bleek `searchArcheologischOnderzoek`
     als enige nog `Promise.all` te gebruiken in plaats van `allSettled` -
     één falende van zijn 3 brontakken liet daardoor de hele
     onderzoeksgebieden-categorie verdwijnen. Echte bug, meteen gefixt en
     afgedekt met een regressietest in `tests/rce-api.test.mjs`.
   - **TD-05:** de `ConceptField`-unie (14 waarden) stond onafhankelijk 4
     keer herhaald in `lib/heritage-view-model.ts`,
     `app/api/rce/search/route.ts` en `lib/rce-client.ts`. Samengevoegd tot
     één bron van waarheid (`CONCEPT_FIELDS` + `isConceptField`). Daarbij
     bleek `parseUrlState`'s eigen allowlist maar 9 van de 14 velden te
     herkennen - `stijl`, `bouwkundigestaat`, `verwerving`,
     `grondspoortype` en `monumenttype` misten, dus een gedeelde link met
     zo'n conceptzoekopdracht herstelde na page reload niet. Echte bug,
     meteen gefixt en afgedekt met een regressietest in
     `tests/heritage-view-model.test.mjs`.
   - **Nadrukkelijk niet meegenomen:** een generieke SPARQL-querybuilder-
     generator voor de 14 conceptvelden, een generieke discovery-
     querygenerator per objectsoort, en het samenvoegen van de 3
     onafhankelijke paginering/LIMIT-schema's. Zie
     `docs/analyse-2026-08-11.md` voor de onderbouwing per punt.
10. **UX-review opgepakt (17 augustus 2026)**, gebaseerd op een externe
    review van de live site. Vijf gerichte verbeteringen, in één PR:
    - `app/SearchHero.tsx`: `DIRECT_SEARCHES` van 9 naar 4 voorbeelden
      (`36046`, `Utrecht`, `moutmolen`, `Kinderdijk`), elk bewust een eigen
      zoekingang (nummer/plaats/functie/naam) demonstrerend in plaats van
      een willekeurige testgeval-greep. Label "Direct zoeken" hernoemd naar
      "Probeer bijvoorbeeld" - duidelijker dat dit voorbeelden zijn, geen
      aparte zoekmodus.
    - `app/SearchFilters.tsx`: de uitleg bij een gedeeltelijk geladen
      resultatenset ("+"-teken) ingekort van een lange technische zin naar
      "Filters gelden voor de geladen resultaten. '12+' betekent dat er nog
      meer kunnen zijn."
    - `app/HeritageResultCard.tsx`: de matchcontext ("Gevonden via ...")
      stond verstopt als een generieke kenmerken-chip tussen monumentaard/
      juridische status/periode - nu een eigen, prominent element direct
      onder de titel/adresregel, vóór de beschrijving. Beschrijvingslimiet
      verkort van 300 naar 200 tekens voor een scanbaardere resultatenlijst.
    - `app/HeritageDetailDialog.tsx`: de generieke uitlegzin "In dit
      venster: locatie, kenmerken, relaties en bronnen." verwijderd
      (voegde na de eerste keer lezen niets meer toe) en vervangen door een
      compacte, consequent aanwezige "Brongegevens"-sectie (dataset,
      primaire identifier, object-URI) onderaan het detailpaneel - maakt de
      belofte van de startpagina ("vaste URI's, herleidbare bronnen")
      tastbaar in plaats van alleen een korte "Bron"-regel tussen de
      overige kenmerken.
    - Nadrukkelijk niet meegenomen (expliciet buiten scope van deze review-
      batch, niet zomaar overgeslagen): visuele identiteit, objecttypen,
      conceptzoeking, URL-state en lijst/kaartstructuur, de overige
      startpagina-secties (Ontdek een thema/Bekijk alles), en het bredere
      "Gemeente/woonplaats"-semantiekpunt uit dezelfde review (vraagt eerst
      uitzoeken of de onderliggende data beide betekenissen draagt).
11. **Voorbereiding bèta-publicatie (17 augustus 2026).** Nieuwe
    `app/SiteFooter.tsx`, onderaan elke pagina:
    - Korte, feitelijke privacyvermelding: bezoekers-IP gaat naar PDOK
      (kaarttegels) en de RCE-beeldbank (afbeeldingen) zodra de kaart of
      een foto bekeken wordt; Doorzoeker zelf verzamelt geen
      persoonsgegevens en gebruikt geen tracking-cookies.
    - Feedbacklink naar een nieuw GitHub-issuetemplate
      (`.github/ISSUE_TEMPLATE/bug_report.md`), zodat bèta-testers ergens
      terechtkunnen om een bug of suggestie te melden - die mogelijkheid
      ontbrak volledig.
    - ~~Een zichtbare "Beta"-badge in de UI zelf.~~ **Opgelost.** Nieuwe
      `app/BetaBadge.tsx`: een diagonaal "Bèta"-lint rechtsboven op de
      pagina (`position: absolute` binnen `main`, `pointer-events: none`
      zodat het nooit klikken blokkeert), met een kleinere variant onder
      520px viewportbreedte. Live gecontroleerd op desktop- en
      mobielformaat.
    - **Cloudflare Web Analytics: geen actie nodig.** De eigenaar zette
      het aan in het dashboard en zag geen token - dat klopt: bij een
      domein dat al via Cloudflare's proxy loopt (noodzakelijk voor een
      custom domain op een Worker) injecteert Cloudflare de
      meetscript-tag zelf aan de edge ("automatische installatie"), er is
      niets in de repo aan te passen. Data verschijnt pas in het
      dashboard na wat echte paginabezoeken.
    - Concept-introbericht voor de eerste bèta-testers vastgelegd in
      `docs/beta-intro-bericht.md` (wat Doorzoeker is, waar feedback op
      gewenst is, hoe te melden, bekende beperkingen) - door de eigenaar
      zelf te versturen naar wie hij uitnodigt.

## Uit de codereview

1. ~~**Export verliest linked-data-identiteit.**~~ **Opgelost (17 augustus
   2026).** `lib/export.ts` bevatte geen bron-URI, CHO-nummer,
   identifier-type; `monumentnummer` viel terug op `item.id`, dus die
   kolom kon verschillende soorten identifiers bevatten. Vier kolommen
   toegevoegd aan zowel CSV als GeoJSON-`properties`: `object_uri`
   (`linkedDataUrl` met `sourceUrl` als terugval - zelfde keuze als de
   "Brongegevens"-sectie in `HeritageDetailDialog`), `cho_nummer`
   (`item.objectNumber`), `primaire_identifier` en `identifier_type`
   (hergebruikt de al bestaande `primaryIdentifier()`-helper, dezelfde
   die de UI ook gebruikt - geen nieuwe logica). GeoJSON-Features krijgen
   bovendien een stabiele top-level `id` (de bron-URI), weggelaten
   wanneer een item geen enkele URI heeft. Regressietests in
   `tests/export.test.mjs`.
2. ~~**Export kan onvolledig zijn zonder dat te vermelden.**~~ **Volledig
   opgelost (deel 1: 17 augustus 2026 eerder; deel 2: 17 augustus 2026,
   vandaag).** Bij `hasMore` wordt alleen de geladen/gefilterde set
   geëxporteerd. Eerder al opgelost: de exportknoppen in
   `app/ResultsToolbar.tsx` vermelden expliciet hoeveel resultaten
   geëxporteerd worden ("Exporteer 25 resultaten als CSV"). **Nu ook in
   het bestand zelf:** `itemsToCsv`/`itemsToGeoJson` krijgen een
   `hasMore`-parameter (doorgegeven vanuit `app/page.tsx`). Bij CSV komt
   er een extra rij ná de data met alleen kolom 1 gevuld (een
   voorloopregel zou naïeve "eerste rij is header"-parsers in de war
   brengen); bij GeoJSON een top-level `metadata: { compleet: false,
   opmerking: "..." }`-lid naast `type`/`features` (onbekende leden
   worden door GeoJSON-consumenten genegeerd, zelfde vrijheid als `bbox`
   gebruikt). Regressietests in `tests/export.test.mjs` en een nieuwe
   e2e-test die een echt gedownload bestand controleert.
3. ~~**CSV-formule-injectie.**~~ **Opgelost (15 augustus 2026).**
   `csvField()` in `lib/export.ts` escaped wel `"`, `,` en `\n`, maar
   neutraliseerde geen leidende `=`, `+`, `-` of `@`. Een
   `neutralizeFormula()`-stap zet zo'n waarde vooraf een voorloop-apostrof
   voor, met regressietests voor `=HYPERLINK(...)`, `+SUM(1,1)`,
   `-2+3`, `@command`, en een controle dat een streepje ergens *midden*
   in de tekst (niet leidend) onaangeroerd blijft.
4. ~~**Drie hoge npm-audit-meldingen** (bevestigd via `npm audit`): twee
   DoS-advisories in `image-size` (via `vinext`), één in `nanoid`. Niet
   blind `npm audit fix --force` gebruiken - npm stelt een oudere
   `vinext`-versie voor. Gerichte upgrade of override onderzoeken en
   daarna build, beeldoptimalisatie en deployment controleren.~~
   **Documentatiedrift, geen echt openstaand punt (gevonden 18 augustus
   2026).** Dit was al opgelost in PR #76 ("Los 3 hoge npm-audit-
   meldingen op: gerichte vinext/plugin-rsc-upgrade i.p.v. npm audit fix
   --force"), maar deze regel bleef als open item in dit document staan.
   Herbevestigd: `npm audit` geeft nu 0 kwetsbaarheden, `image-size`
   komt niet meer voor in de dependency-boom (`npm ls image-size --all`
   is leeg), `nanoid` staat op de veilige `3.3.18`. Geen actie nodig.
5. ~~**Kaarttoegankelijkheid (TD-27).**~~ **Opgelost (17 augustus 2026).**
   Zie item 2 hierboven onder "Kwaliteit en toegankelijkheid" voor de
   volledige beschrijving van de fix.
6. ~~**Testscript bouwt eerst (TD-31).**~~ **Opgelost (17 augustus 2026).**
   `npm test` (`package.json`) begon nog steeds met een volledige `vinext
   build`, wat gericht testen vertraagde en buildcontrole met
   unitcontrole vermengde. Van de 16 testbestanden hebben er maar 2
   (`rendered-html.test.mjs`, `worker-security.test.mjs`) daadwerkelijk
   `dist/server/index.js` nodig (geverifieerd via `grep -l "dist/"
   tests/*.test.mjs`) - de overige 14 testen source-bestanden rechtstreeks.
   Nieuwe `test:unit`-script draait alleen die 14, zonder build (210
   tests in ~5s zonder een voorafgaande `vinext build`); nieuwe
   `test:build` draait de 2 build-afhankelijke bestanden zelfstandig
   (bouwt zelf, dus los uitvoerbaar). `npm test` blijft ongewijzigd van
   gedrag (bouwt één keer, test dezelfde 16 bestanden, geen wijziging aan
   CI nodig) maar roept nu `test:unit` aan i.p.v. de losse bestandenlijst
   te herhalen.

## Uit de design critique (15 augustus 2026)

Live tegen `https://doorzoeker-v2a.jolietjakeblues64.workers.dev/`, via
DOM/CSS-inspectie (geen screenshots beschikbaar in die sessie). Volledige
critique met alle metingen staat in de sessietranscriptie van 15 augustus;
hieronder de drie prioriteiten.

12. ~~**`.concept-link`-knoppen hebben geen resting-state kleur.**~~
    **Opgelost (PR #68, 17 augustus 2026, vóór deze sessie al gemerged -
    hier pas achteraf gecorrigeerd na een check door de eigenaar dat dit
    document verouderd was).** `.concept-link` in `app/globals.css` heeft
    nu `color: var(--rce-blue)` als resting state, consistent met elk
    ander interactief element. Live in de code geverifieerd.
13. ~~**H1 op de startpagina heeft dezelfde regelafstand-ratio als lopende
    tekst.**~~ **Opgelost (PR #68).** `.hero h1` heeft nu
    `line-height: 1.15` in plaats van de globale body-ratio (1,6×). Live
    in de code geverifieerd.
14. ~~**Twee incompatibele knop-hoekstijlen naast elkaar.**~~ **Opgelost
    (PR #68).** "Verras me" hoorde qua functie bij de primaire actieknoppen
    ("Doorzoek RCE") en is nu scherp (0px radius) in plaats van rond,
    consistent met die knoppenfamilie; de conventie staat toegelicht in
    een code-comment bij `.hero nav button`. Live in de code
    geverifieerd.

Kleinere observaties uit dezelfde critique: ~~secundaire tekstkleur is
inconsistent (grijs bij hero-intro/`dt`-labels, zwart bij de adresregel
op resultaatkaarten - één kleurtoken voor secundaire tekst gebruiken)~~
**opgelost (17 augustus 2026)** - `.copy .address` gebruikte
`var(--ink)`, nu `var(--muted)` net als de rest. De drie navigatierijen
(Direct zoeken/Ontdek een thema/Bekijk alles) hebben nog steeds
identiek visueel gewicht ondanks verschillende functies (geen aparte
actie, alleen genoteerd).

## Uit de securityreview

7. ~~**Securityheaders ontbreken.**~~ **Deels opgelost (17 augustus
   2026).** `next.config.ts` was vrijwel leeg - geen CSP,
   `X-Content-Type-Options: nosniff`, `X-Frame-Options`/`frame-ancestors`
   of HSTS. Nu gezet op Worker-niveau (`worker/index.ts`, niet
   `next.config.ts` - onzeker of vinext's `headers()`-config daadwerkelijk
   wordt gerespecteerd, dus rechtstreeks op elke respons toegepast):
   `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
   `Strict-Transport-Security: max-age=31536000` (bewust zonder
   `includeSubDomains`, zie code-comment). **Blijft open:** een CSP -
   vraagt maatwerk vanwege Leaflet, PDOK-kaarttegels en RCE-afbeeldingen,
   te risicovol om blind toe te voegen zonder live te kunnen testen dat
   de kaart/afbeeldingen niet breken.
8. **Rate limiting is niet globaal (al bekend als S-03).** De limiet van
   30/min leeft per Worker-isolate; beschermt niet hard tegen verspreide
   scraping of belasting van de RCE-endpoints. Al vastgelegd in
   `docs/security-en-stabilisatie-review.md` - geen nieuwe blootstelling,
   blijft desondanks open. (Dit geldt nu ook voor de vier routes uit punt 9
   hieronder - zelfde soort limiter, zelfde beperking.)
9. ~~**Niet alle routes hebben een limiter.**~~ **Deels opgelost (17
   augustus 2026).** Bevestigd: van de 8 API-routes had alleen
   `/api/rce/search` rate limiting. `docs/security-assessment-2026-08-17.md`
   kwantificeerde het amplificatierisico concreet (tot 17x parallelle
   SPARQL-aanroepen bij vrije tekst, 5+ bij `vondstlocatie-inhoud`) - de
   eerdere aanname dat exacte URI-validatie voldoende bescherming bood
   (zie `docs/api-beleid.md`) ging alleen over de *vorm* van de invoer,
   niet over hoeveel keer een geldig-ogend nummer opgevraagd kan worden.
   `complex-members`, `concept`, `onderzoeksgebied-verrijking` en
   `vondstlocatie-inhoud` hebben nu dezelfde 30/min-limiter als
   `/api/rce/search`, via een nieuwe gedeelde helper
   (`lib/server/route-rate-limit.ts`, ook de zoekroute zelf hergebruikt
    'm nu). **Blijft bewust ongelimiteerd:** `/api/rce/op-deze-dag` en
   `/api/rce/verras-me` (geen gebruikersinvoer, dus geen
   amplificatie-hendel), `/api/terms/suggest` (eigen 2-80-tekensgrens en
   gedeelde succescache).
10. **Externe afbeeldingen en kaarttegels (PDOK, RCE).** Bezoekers-IP en
    mogelijk referrerinformatie gaan naar die derde partijen. Privacy-
    /informatiebeveiligingspunt, geen klassieke kwetsbaarheid.
    ~~Voorstel: een beperkte `Referrer-Policy` instellen~~ **opgelost
    (17 augustus 2026)** - `metadata.referrer` in `app/layout.tsx` staat nu
    expliciet op `strict-origin-when-cross-origin` (was voorheen impliciet
    de browserdefault, nergens vastgelegd). **Opgelost** - de externe
    bronnen (PDOK, RCE-beeldbank) staan al expliciet genoemd in
    `app/SiteFooter.tsx`; deze todo-regel liep achter op de code (gecheckt
    20 augustus 2026).
11. **Logging bewaken bij toekomstige uitbreiding.** Nu beheerst (de
    zoekroute logt alleen de lengte van de zoekterm, niet de inhoud).
    Aandachtspunt voor later: als volledige zoekvragen, URI's of
    IP-adressen worden toegevoegd, kunnen logs persoonsgegevens of
    gebruikersinteresses gaan bevatten.

## Nog openstaand uit eerdere sessies (niet uit deze review, ter herinnering)

- ~~**#22**: analyseren van de verwarring tussen de horizontale "Bekijk
  alles"-balk en het verticale filterpaneel.~~ **Bleek al opgelost (21
  augustus 2026), ontdekt tijdens het bespreken ervan met de eigenaar.**
  Mentaal model bevestigd: boven bepaalt de zoekopdracht/collectie, links
  filtert binnen wat al geladen is. Live gecontroleerd vóór er iets
  gebouwd werd: `browseType()` in `hooks/useSearchState.ts` zet bij een
  klik op bv. "Rijksmonumenten" in de balk al `setObjectType(...)` mee,
  dus het "Soort object"-filter in het paneel toont meteen "Rijksmonument"
  geselecteerd, inclusief de bijbehorende Monumentaard/Kenmerken
  (msp/groenaanleg)-velden - precies het gedrag dat de oorspronkelijke
  melding wilde. Deze regel liep gewoon achter op de code (TD-09 in
  het echt, ontdekt tijdens hetzelfde gesprek over TD-08/TD-09).
- **TD-06, resterend deel**: echte globale tellingen per facet (of
  minimaal een totaalaantal) via server-side aggregatie - de #33-stap
  loste alleen de eerlijkheid over per-batch tellingen op, niet de
  onderliggende beperking zelf.
- **Verticale slice 011**: "In de buurt" (geolocatie-gebaseerd ontdekken)
  - plan, niet gebouwd.
- ~~**Verticale slice 017**~~ **Afgerond (19 augustus 2026).** Archeologische
  context bij een Rijksmonument (overlap met een Onderzoeksgebied, bv.
  rijksmonument 14948 in Elst dat boven een Romeins tempelcomplex staat) -
  knop + waarschuwing + doorklikbare lijst, dezelfde dag uitgebreid met een
  kaart die het Rijksmonument en de gevonden Onderzoeksgebieden samen als
  polygonen toont. De kaart rende direct ná oplevering als een smalle
  verticale streep (in een dt/dd-veldrij voor korte tekstwaarden); de
  eerste fix daarvoor bleek per ongeluk nooit gemerged (zie de
  procesnotitie hieronder) en het probleem werd daardoor eerst verkeerd
  gediagnosticeerd als een Leaflet-timingrace. Uiteindelijk hersteld door
  de echte, orphaned fix alsnog te cherry-picken op een correct
  geverifieerde `main`. Live tweemaal onafhankelijk geverifieerd onder
  koude netwerklatency, zie
  `docs/vertical-slices/017-archeologische-context-onderzoeksgebied.md`.
- **Procesnotitie: twee keer een orphaned commit door na een PR-merge nog
  naar diezelfde branch te pushen (19 augustus 2026).** Zowel de
  layoutfix-code+docs (na PR #89) als de partialFailure-fixdocs (na
  PR #90) werden gepusht ná het mergen van hun PR, en kwamen daardoor
  nooit in `main` terecht - de PR-status was niet gecontroleerd vóór het
  pushen. Vanaf nu: vóór elke push naar een bestaande branch eerst
  `gh pr view <nr> --json state` checken, en een nieuwe branch altijd
  expliciet op `origin/<basis>` baseren (niet op een lokale branch-ref,
  die stil achter kan lopen - exact dit gebeurde ook nog eens bij het
  herstellen van de layoutfix zelf).
- ~~**Zes archeologie-zoekcategorieën cachen "0 resultaten" na een volledig
  gefaalde RCE-tak.**~~ **Opgelost (19 augustus 2026), live gevonden via
  een doorklik op Vondstlocatie "Oude Hoeven" die bleef 0 resultaten
  tonen ondanks een correct CHO-nummer.** Restgat in de fix uit de
  securityreview van 17-08-2026 (punt 4): de zes bijvangst-categorieën
  gaven hun `partialFailure`-tracker wel door aan `optionalSearch` op hun
  aanroepplek, maar niet aan hun eigen interne `runDiscoveryBranches`-
  aanroep, dus een categorie die op *alle* brontakken faalde (RCE 503)
  werd stilletjes en 5 minuten lang als geldig leeg resultaat gecachet.
  Zie `docs/security-assessment-2026-08-17.md` (update 19-08) en
  [PR #90](https://github.com/jolietjakeblues/doorzoeker-v2a/pull/90).
- **TD-04, TD-05**: gedeeltelijk opgelost op 17 augustus 2026 (gedeelde
  `runDiscoveryBranches`-helper + `CONCEPT_FIELDS`-bron van waarheid, met
  twee echte bugs onderweg gevonden en gefixt) - zie item 9 hierboven en
  `docs/analyse-2026-08-11.md` voor wat wél en wat nadrukkelijk niet is
  meegenomen.
- **TD-08, TD-09**: moduleomvang die tests breed maakt, documentatie/
  implementatiestatus die uit elkaar kan lopen - nog open, zie
  `docs/analyse-2026-08-11.md`.
- **TD-10**: TypeScript 7 en ESLint 10 (major-upgrades) staan als open
  Dependabot-PR's, bewust uitgesteld - besluitvoorstel in
  `docs/beheerbesluiten.md`.
- **A-08 t/m A-13**: thesaurusviewer, bredere/nauwere begrippen,
  visueel onderscheid term/bronrecord, universeel navigeerbaar-
  predicaatpatroon, inline uitklapbare resultaatgroepen, aparte
  tegelweergave - allemaal nog alleen geanalyseerd (v1-vergelijking),
  geen van alle gepland of gebouwd. Geverifieerd (17 augustus 2026): geen
  van deze componenten bestaat in `app/`.
- ~~**TD-11/A-06-status in `docs/analyse-2026-08-11.md` klopte niet.**~~
  **Opgelost (17 augustus 2026), gevonden tijdens een to-do-doorloop met
  de eigenaar.** Het TD-register en de analyselijst zeiden nog "Open"/
  "nog niet uitgevoerd" voor de licentiekeuze, terwijl de sectie erboven
  én `docs/beheerbesluiten.md` al sinds 11 augustus zeggen dat dit
  opgelost is (MIT). Precies het soort documentatiedrift dat TD-09 zelf
  beschrijft - nu gecorrigeerd.
- ~~**TD-29: ADR-0002's routelijst mist `/api/rce/verras-me`.**~~
  **Opgelost (17 augustus 2026).** `docs/adr/0002-hybride-gegevensarchitectuur.md`
  somde alle 7 andere `/api/*`-routes op maar niet deze, al sinds
  `codereview-2026-08-13.md` bekend en nooit meegenomen in dit document.
  Geverifieerd tegen de daadwerkelijke routes in `app/api/` (8 stuks) vóór
  het toevoegen.

## Brainstorm vervolgideeën (18 augustus 2026, ná de bèta-release)

Losse ideeën uit een gesprek met de eigenaar, de dag na de publieke
bèta-release. Bewust nog niet gebouwd of zelfs verkend - puur vastgelegd
zodat ze niet verloren gaan. Volgorde is geen prioriteit.

**Eerst opgepakt (bevestigd door de eigenaar): de kaart, vóór de thesaurus.**
De kaart-cluster is concreter en kleiner (zie hieronder, "verticale slice
006/011" en groenaanleg-kaartlaag in de bestaande "Nog openstaand"-lijst
hierboven). De thesaurus (A-08 t/m A-13) is bewust gepland vóór de
*officiële* release, niet vóór deze bèta - te groot en te vaag om er nu
tussendoor te doen, verdient een eigen planningstraject zoals TD-04/05
kreeg.

- **Wikidata-koppeling via rijksmonumentnummer.** De CHO-data bevat geen
  rechtstreekse `owl:sameAs`-koppeling naar Wikidata; een link zou een
  losse lookup vereisen. Nog te verifiëren welke Wikidata-property het
  rijksmonumentnummer vasthoudt. Voorbeelden van de eigenaar:
  <https://www.wikidata.org/wiki/Q11721989> en
  <https://www.wikidata.org/wiki/Q17464661>.
- **SKOS-matchrelaties benutten, niet alleen `skos:exactMatch`.** De
  thesauri bevatten ook `skos:closeMatch`, `skos:related`,
  `skos:broadMatch` en `skos:narrowMatch`. Toepassing: bv. een architect-
  of actorconcept koppelen aan een equivalent elders (RKDartists,
  Wikidata).
- **Vrije-tekstzoeken op meerdere willekeurige woorden.** Nu wordt in de
  praktijk op één woord gezocht, of op een vaste twee-woorden-frase die
  toevallig naast elkaar in de tekst staat. Gewenst: zoeken op twee
  willekeurige woorden die ergens (niet per se naast elkaar) in dezelfde
  tekst voorkomen - een echte multi-term AND-zoekopdracht. **Nadrukkelijk
  geen thesaurus-synoniemexpansie** ("kerk" ook laten matchen op
  "kerkhof") - dat was een eerdere, onjuiste aanname bij het vastleggen
  van dit idee; expliciet gecorrigeerd door de eigenaar.
- ~~**Tekst toevoegen over het belang van Linked Open Data voor
  Doorzoeker.**~~ **Opgelost (18 augustus 2026).** Nieuwe, publieke
  `public/achtergrond.html` - een losstaande, statische pagina (geen deel
  van de React-app), bereikbaar via een nieuwe "Achtergrond"-link in de
  gele balk (ook op mobiel, waar de rest van die regel al verborgen was).
  Op B2-niveau: wat Linked Open Data is en waarom Doorzoeker het gebruikt,
  wat de RCE Linked Data Voorziening en de CEO-ontologie zijn, hoe
  Doorzoeker zoekt (vrije tekst vs. exact op begrip), de rol van de MCP
  tijdens het bouwen (nadrukkelijk geen runtime-onderdeel), en de
  geschiedenis van Doorzoeker 1 (Fubineva, 2013-2014, interactieontwerp
  door Enference, in opdracht van RCE; RNA = Referentienetwerk
  Architectuur als toenmalige linked-data-achtige infrastructuur voor
  thesauri, rijksmonumenten en Archis) - met vier historische
  screenshots die de eigenaar zelf aanleverde. Een dankwoord en links naar
  andere documenten (GitHub) sluiten de pagina af. Voldoet aan WCAG 2.1:
  skip-link, correcte kopjeshiërarchie, landmarks, alt-tekst op elke
  afbeelding, focus-zichtbaarheid, geen horizontale overflow op mobiel -
  stuk voor stuk live gecontroleerd, niet aangenomen. Opmaak hergebruikt
  bewust dezelfde klassen/kleurtokens als `app/globals.css` (govbar,
  header, skip-link, site-footer) voor visuele consistentie met de rest
  van de site. Regressietests in `tests/e2e/rework.spec.ts`.
- **Kleine extra (18 augustus 2026, "gimmick"):** de blauwe bullet bij
  "Live gekoppeld aan RCE Linked Data" in `app/SiteHeader.tsx` is nu groen
  (`var(--success)`) met een zachte, herhalende puls
  (`header-live-pulse`) in plaats van een statische stip - bevroren onder
  `prefers-reduced-motion` (WCAG 2.2.2/2.3.1: geen harde knipper, wel een
  pauzeerbare/onderdrukbare animatie).
- **Nog te verkennen RCE-graphs als mogelijke nieuwe databronnen** - nog
  helemaal niet onderzocht wat erin zit, dat is de eerstvolgende stap
  (niet vandaag) vóór er iets over gebouwd wordt:
  - los van `rce/cho`: `Archaeological-Knowledge-Bank`, `histgeo`,
    `Bebouwde-omgeving-referentienetwerk`;
  - binnen `rce/cho`: `actorenrol`, `linies`, `buitenplaatsen`.
  - **`gezicht_hvdl` en `werelderfgoed_hvdl` onderzocht en uitgebreid (20
    augustus 2026):** beide graphs waren al deels aangesloten (alleen
    `wordtGetoondOp`/type/jaar). Toegevoegd: `oppervlakteInHectare` voor
    beide (blijkt bij empirische controle NIET rechtstreeks op het
    Gezicht/Werelderfgoed-subject te staan maar op de gekoppelde
    Geometrie-node - vandaar het pad
    `ceo:heeftGeometrie/ceo:oppervlakteInHectare`, niet
    `ceo:oppervlakteInHectare`), en voor Gezicht ook
    `inProceduredatumGezicht`, `begrenzingsdatumGezicht`,
    `intrekkingsdatumGezicht` (rechtstreeks op het Gezicht-subject, wel
    correct zoals eerst aangenomen). Zie `lib/rce/monuments.ts`
    (`buildGezichtQuery`/`buildWerelderfgoedQuery`).
  - **`archiefdagen` en "OmschrijvingenOnderwerp" onderzocht en aangesloten
    (20 augustus 2026):** `OmschrijvingenOnderwerp` is geen eigen graph
    maar de property `ceox:heeftOmschrijvingOnderwerp` (namespace
    `https://linkeddata.cultureelerfgoed.nl/def/ceox#`) binnen de
    `archiefdagen`-graph, die de bestaande formele omschrijving
    (`ceo:heeftOmschrijving`, al opgehaald voor elk Rijksmonument) koppelt
    aan één of meer ABR-conceptlabels (sparse: 1.166 van alle
    omschrijvingen, 67% daarvan met precies 1 concept, tot 14 bij één
    record). Toegevoegd aan `buildRceDetailsQuery` als display-only veld
    "Onderwerp (uit omschrijving)" (nog geen doorklikbaar concept-zoekveld
    zoals de andere `CONCEPT_FIELDS` - dat is een goedkope, mechanische
    vervolgstap mocht daar behoefte aan blijken). **Endpoint-eigenaardigheid
    empirisch gevonden:** een `GRAPH`-blok genest in een `OPTIONAL` die zelf
    weer in de buitenste `GRAPH <instanties-rce>` zit gaf stil 0 resultaten
    terug; als los zusterblok op het hoogste `WHERE`-niveau werkt de join
    wel (zelfde soort quirk als de bestaande `geof:sfWithin`-in-UNION-notitie
    bij `buildGezichtLidmaatschapQuery`, zie code-comment).
    **Correctie (21 augustus 2026):** de aanname hierboven dat
    "OmschrijvingenOnderwerp" alleen de property was, niet een eigen graph,
    was fout - gemeld door de eigenaar met de exacte graph-URI
    (`https://linkeddata.cultureelerfgoed.nl/graph/OmschrijvingenOnderwerp`).
    Die graph bestaat wél apart, is veel rijker (142.720 koppelingen, 3.492
    losse begrippen: 3.403 CHT, 87 ABR, 2 RN) en overlapt met `archiefdagen`
    zonder er een strikte deelverzameling van te zijn (129
    (omschrijving,begrip)-paren zitten alléén in `archiefdagen`).
    `buildRceDetailsQueryBody` bevraagt nu beide graphs via `UNION` i.p.v.
    alleen `archiefdagen`, en elk concept toont zijn herkomstthesaurus (CHT/
    ABR/RN, afgeleid uit het URI-padsegment) naast het label, bijvoorbeeld
    "kanalen (CHT)". Zie `lib/rce/monuments.ts`.
- ~~**Badge-letter botst tussen objectsoorten.**~~ **Opgelost (21 augustus
  2026, PR #99, samen met het loslaten van de RCE-huisstijl).** Gemeld
  door de eigenaar op 20 augustus 2026 tijdens het zoeken op "logger":
  `typeBadge()` in `lib/heritage-view-model.ts` gaf dezelfde letter aan
  meerdere objectsoorten (`S`: Grondspoor/Scheepswrak, `V`:
  Vondstlocatie/Vondst, en een derde die pas tijdens het uitzoeken naar
  boven kwam: `A`: Archeologisch complex/archeologisch Rijksmonument).
  Scheepswrak miste bovendien een eigen `.tile.wreck`-kleur en viel terug
  op de kale Rijksmonument-achtergrond. Opgelost: Vondstlocatie → `L`,
  Scheepswrak → `R` (met eigen tegelkleur `#0a5c66`), en op expliciet
  verzoek van de eigenaar ("Het zijn Rijksmonumenten -> M") deelt een
  archeologisch Rijksmonument nu weer gewoon de `M` van een gebouwd
  Rijksmonument - alleen de tegelkleur (`sand`) maakt nog onderscheid.
- **Scheepstype nog niet doorzoekbaar op tekst (gemeld door de eigenaar,
  20 augustus 2026: "schoener ed. dat zou toch moeten lukken op
  'tekst'").** `SCHEEPSWRAK_SOURCES` in `lib/rce/scheepswrakken.ts` heeft
  maar één discovery-branch (`sdo:name`) plus de exacte MASS-ID-kortsluiting
  bij een numerieke term - een bewuste scope-keuze uit
  018-mass-scheepswrakken.md ("beslissing 3: eerst alleen het detail
  bouwen, geen apart scheepstype-facet"). Een zoekterm als "schoener" of
  "logger" matcht dus nu alleen als dat woord toevallig in de náám van het
  wrak staat, niet als het het `schema:additionalType` is.
  Empirisch gecontroleerd (20 augustus 2026): `schema:additionalType` is
  gevuld voor 2.483 van de 2.587 scheepswrakken (96%), over 134
  verschillende typen - ruim voldoende gevuld om als volwaardige
  discovery-bron toe te voegen, zelfde patroon als de bestaande
  `DISCOVERY_SOURCES`-branches bij Rijksmonumenten
  (`buildRceDiscoveryQueries`). "Schoener" (42) en "Logger" (30, zie de
  badge-letter-melding hierboven) zijn allebei ruim vertegenwoordigd.
  Nog niet gebouwd, staat op de lijst.
- ~~**Klik op "Kerken" (Ontdek een thema) faalde met "De RCE Linked
  Data-service is momenteel niet bereikbaar".**~~ **Opgelost (21 augustus
  2026).** Gemeld door de eigenaar tijdens live gebruik. Met `wrangler
  tail` op productie meegekeken: de conceptzoekopdracht naar het brede
  RN2-functiebegrip "Kerken" (2310 gekoppelde rijksmonumenten) raakte de
  standaard 20s-timeout (`TimeoutError`, "The operation was aborted due to
  timeout") terwijl de RCE-bron zelf gewoon bereikbaar was - dezelfde
  tail-sessie ving ook een ongerelateerde zoekopdracht ("vuurijzer") met
  deelquery's van 9-13 seconden in plaats van milliseconden, wat op
  tijdelijke trage RCE-respons wijst, niet op een codefout. Twee
  maatregelen: (1) `searchByConceptMatchQuery` en de vier losstaande
  concept-match-functies (verwerving, waardering, grondspoortype, vondsten,
  archeologisch-complextype) krijgen nu een langere timeout
  (`CONCEPT_MATCH_TIMEOUT_MS`, 35s, `lib/server/rce-adapter.ts`) voor hun
  eerste, mogelijk brede matchquery - de vervolgquery's blijven op de
  standaardtimeout, want die werken altijd op een begrensde slice van
  maximaal 25 nummers. (2) `withRceErrorHandling` onderscheidt nu een
  `TimeoutError` van een echte connectiviteitsfout: 504 in plaats van 502,
  met "Deze zoekopdracht duurt op dit moment ongewoon lang bij de RCE-bron"
  in plaats van "niet bereikbaar" (`lib/server/route-error-handling.ts`).
  De client kreeg een nieuwe `RemoteState`-waarde `"timeout"` (apart van
  `"error"`, `hooks/useSearchRequest.ts`) met een eigen, minder alarmerende
  amberkleur (`--warning`, `app/globals.css`) i.p.v. rood.
- ~~**Een gefaalde zoekcategorie (bv. Scheepswrak via de losstaande
  MASS-dienst) was volledig stil - "0 scheepswrakken" was niet te
  onderscheiden van "geen enkel scheepswrak kon geladen worden".**~~
  **Opgelost (21 augustus 2026).** Gemeld door de eigenaar bij het zoeken op
  "schoener": 11 vondsten wél zichtbaar, 0 scheepswrakken, geen enkel
  signaal dat de MASS-dienst tijdelijk had gefaald terwijl de andere 9
  categorieën gewoon doorkwamen. De server hield dit al bij
  (`SearchPartialFailure.partial`, gebruikt om zo'n onvolledig antwoord niet
  te cachen) maar stuurde het nooit naar de client door. `SearchPartialFailure`
  in `lib/server/rce-adapter.ts` kreeg er `failedCategories: string[]` bij -
  `optionalSearch` vertaalt zijn event-label (bv. `"search.scheepswrakken"`)
  naar de naam zoals die al in het "Soort object"-filter staat (`"Scheepswrak"`)
  via `FAILED_CATEGORY_LABELS`. De route (`app/api/rce/search/route.ts`)
  stuurt dit mee in de respons; `searchRceMonuments` in `lib/rce-client.ts`
  voegt de categorieën van alle vier parallelle scope-aanroepen (core/
  heritage/archaeology-a/archaeology-b) samen, met een category-per-scope-
  fallback (`SCOPE_CATEGORIES`) voor het zeldzamere geval dat een hele
  scope-aanroep afwijst in plaats van gewoon 200 met een deels lege
  categorie. `SearchResults.tsx` toont dit als een amberkleurige melding
  boven de (verder complete) resultaten: "Scheepswrak kon niet worden
  geladen. Andere resultaten hierbeneden zijn wel compleet."
- ~~**Een compacte kaart (monument, complex, archeologische context) had
  geen enkele manier om uit te zoomen.**~~ **Opgelost (21 augustus 2026).**
  Gemeld door de eigenaar: "Ik moet toch de omgeving van een monument of
  complex kunnen zien." Oorzaak gevonden in `app/HeritageMap.tsx`:
  `zoomControl: !compact` zette de +/--knoppen helemaal uit voor elke
  compacte kaart, bovenop scrollwheel-zoom die daar al bewust uitstond (om
  paneelscroll niet te kapen). Een compacte kaart met één punt (`fitBounds`
  op een punt zonder oppervlak) opent bovendien al op maxZoom (19) - zonder
  zoomknoppen was er dus letterlijk geen enkele manier om uit te zoomen en
  de omgeving te zien. `zoomControl` staat nu altijd aan; scrollwheel-zoom
  blijft bewust uit voor compacte kaarten. Nieuwe e2e-test controleert dat
  de uitzoomknop op een detailkaart zichtbaar en bruikbaar is.

## Uit een externe review (21 augustus 2026)

Twee bevindingen live herbevestigd (niet aangenomen) vóór opname hieronder.
Nog niet opgepakt, staan op de lijst:

- **Een brede vrije-tekstzoekopdracht kan de serverzijdige timeout nog
  raken.** Live herhaald: `q=Utrecht&scope=core` gaf 504 na 20,1 seconden.
  De timeoutverlenging uit de "Kerken"-fix (`CONCEPT_MATCH_TIMEOUT_MS`, zie
  hierboven) geldt alleen voor de conceptmatch-functies
  (`searchByConceptMatchQuery` en de vier losstaande varianten), niet voor
  `searchByText`'s eigen discoverybranches - die blijven op de standaard
  20s. Openstaande vraag: dezelfde verlenging ook daar toepassen (risico:
  langer een Worker-invocation vasthouden, en de eerder gevonden
  subrequest-limiet bij scope="all" lost een langere timeout sowieso niet
  op), of eerst per categorie meten welke tak structureel traag is.
- **Het Werelderfgoed-overzicht (`browse=werelderfgoed`) stuurt onnodig
  grote antwoorden.** Live herhaald: 4,04 MB voor 18 objecten. Oorzaak
  gevonden: de volledige, ongegeneraliseerde WKT-geometrie zit al in het
  lijstantwoord (`Hollandse Waterlinies` alleen al 2,6 MB aan WKT-tekst) -
  nodig voor de kaartweergave, maar overkill voor een lijstweergave of als
  een gebruiker nog niet eens de kaart heeft geopend. Openstaande vraag:
  geometrie pas lazy ophalen bij het openen van de kaartweergave, of een
  vereenvoudigde/gegeneraliseerde geometrie in het lijstantwoord en de
  volledige vorm pas bij het detail.

Overige punten uit dezelfde review, ter info (geen nieuwe bevinding, al
bekend of al opgepakt): README liep achter op CHT/ABR en Scheepswrakken
(opgelost, zie de documentatie-PR van dezelfde dag); geen Content-Security-
Policy-header (bekend, zie `docs/security-assessment-2026-08-17.md`); nog
geen test op een echt mobiel apparaat (staat al hierboven, "Mobiele
weergave controleren"); `useSearchState`/de centrale adapter zijn groot
(bekend, zie TD-03/TD-04 in `docs/analyse-2026-08-11.md`).

## Regressie: "Probeer bijvoorbeeld" en "Ontdek een thema" traag/kapot (22 augustus 2026)

Gemeld door de eigenaar: *"zoeken met 'Probeer bijvoorbeeld:' en 'ontdek
een thema:' is echt stuk [...] Het heeft altijd gewerkt. en best wel
snel."* - terecht geen genoegen genomen met een verklaring van "langzame
RCE"; opnieuw onderzocht en een echte, zelf geïntroduceerde regressie
gevonden.

- ~~**`buildRceDetailsQueryBody` (de gedeelde, gebatchte detailquery
  achter élke zoekresultatenpagina) bevatte sinds 21 augustus 2026 een
  UNION over de archiefdagen- en OmschrijvingenOnderwerp-graphs
  (142.720 triples) plus een GROUP_CONCAT-aggregaat, gebatcht over tot
  25 rijksmonumenten tegelijk.**~~ **Opgelost, zie
  [PR #115](https://github.com/jolietjakeblues/doorzoeker-v2a/pull/115).**
  Voor rijk beschreven records (bv. een kerk met tot 195 CHT-begrippen)
  maakte die combinatie de query onevenredig duur. Live bevestigd vóór en
  ná de fix tegen het productie-endpoint: `q=36046` 8,6s → 2,4s;
  conceptzoekopdracht "Kerken" 504-timeout na 20,4s → 548ms (25
  resultaten). Onderwerpconcepten worden nu, net als complexleden/ligtIn/
  archeologische context, lazy per record opgehaald zodra een gebruiker
  een Rijksmonument-detail daadwerkelijk opent (nieuwe
  `/api/rce/omschrijving-onderwerp`-route, ~200ms ook voor het rijkste
  record).

Tijdens hetzelfde onderzoek plakte de eigenaar een tweede, gedetailleerde
externe code review met vijf bevindingen. Drie zijn al opgepakt:

- ~~**P0: de URL-sanitizer (`lib/server/html-sanitize.ts`) was te omzeilen
  via HTML-entity-encoding** (bv. `javascript&#58;alert(1)` - de browser
  decodeert dit pas ná de sanitizer-check).~~ **Opgelost, zie
  [PR #114](https://github.com/jolietjakeblues/doorzoeker-v2a/pull/114).**
  Eerst decoderen, dán toetsen; overgestapt van een blocklist naar een
  allowlist (http/https/mailto voor links, http/https voor afbeeldingen).
  6 nieuwe regressietests.

~~**P1: een falende `core`-scope blokkeert de andere drie scopes
volledig.**~~ **Opgelost, zie
[PR #116](https://github.com/jolietjakeblues/doorzoeker-v2a/pull/116).**
`searchRceMonuments` (`lib/rce-client.ts`) wachtte eerst `core` af
vóórdat de overige scopes (`heritage`/`archaeology-a`/`archaeology-b`)
via `Promise.allSettled` gestart werden - bij een `core`-timeout werden
de andere drie dus nooit eens aangeroepen, ook al hadden ze zelfstandig
kunnen slagen. Alle scopes starten nu gelijktijdig; alleen als élke scope
faalt wordt nog een fout getoond.

Twee resterende punten uit die review, nog niet opgepakt, staan op de
lijst (reviewer-advies: idealiter vóór de v0.5.0 Beta-publicatie):

- **P1: paginering (pagina 2+) dekt alleen de `core`-scope - bevestigd
  als een echte bug, niet alleen een ontwerpkeuze (22 augustus 2026,
  live in de code geverifieerd vóór opname hieronder).** Voor de drie
  `heritage`-categorieën (Werelderfgoed/Gezicht/Complex) klopt de
  bestaande code-comment wél dat dit bewust is: hun queries hebben geen
  `LIMIT`, en met resp. 18/472/~4.200 instanties totaal levert een
  zoekterm hier realistisch nooit veel treffers op. Maar de zeven
  categorieën in `archaeology-a`/`archaeology-b` (Onderzoeksgebied,
  Archeologisch terrein, Vondstlocatie, Grondspoor, Vondst, Archeologisch
  complex, Scheepswrak) kappen hun eigen matches wél degelijk intern af
  op 25 (`mergeDiscoveryMatches(...).slice(0, 25)` in elke helper-functie
  in `lib/server/rce-adapter.ts`), en die scopes worden sowieso alleen op
  pagina 1 aangeroepen (`page === 1 && ...`-gate in `searchByText`) -
  zonder eigen paginering is alles voorbij de 25e match van zo'n
  categorie permanent en onopgemerkt onbereikbaar. Geen hypothetisch
  scenario: elders in dit document staat al vastgelegd dat "schoener" 42
  scheepswrakken oplevert - 17 daarvan zouden dus nu al buiten bereik
  vallen zodra de aangekondigde scheepstype-tekstzoekfunctie gebouwd
  wordt. **Bewust uitgesteld naar v0.5.1 Beta** (zelfde advies als de
  reviewer): een correcte fix vraagt paginering per scope (server +
  client, zie `hooks/useSearchState.ts`'s `loadMore()`) - een grotere,
  eigen architecturale wijziging, geen kleine aanpassing zoals de overige
  punten uit deze review.
- **P2: inconsistente samenvoegsleutel tussen de eerste pagina
  (`item.sourceUrl || monumentNature:monumentNumber` in
  `rce-client.ts`) en `loadMore()` (`item.monumentNumber ?? item.id` in
  `hooks/useSearchState.ts`).** `monumentNumber` is niet globaal uniek
  (bv. een MASS-scheepswrak-ID kan botsen met een rijksmonumentnummer) -
  een latere `loadMore()`-pagina zou zo stilzwijgend een ongerelateerd
  eerder resultaat kunnen overschrijven. Voorstel: één gedeelde
  `resultIdentity(item)`-helper.
- **P2: `loadMore()` faalt stil.** Bij een fout doet `loadMore()` alleen
  `setHasMore(false)` - de "laad meer"-knop verdwijnt zonder foutmelding
  of retry-optie, niet te onderscheiden van "alle resultaten geladen".
