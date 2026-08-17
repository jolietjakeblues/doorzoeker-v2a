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
   - **Kaarttoegankelijkheid (TD-27, blijft open, major).** Bevestigd: 31
     Leaflet-markers (SVG `path`) zonder `tabindex`/`role` - volledig
     onbereikbaar via toetsenbord, onzichtbaar voor schermlezers als
     interactief element.
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
     de repo te controleren is. **Open vraag aan de eigenaar:** staat
     "Always Use HTTPS" aan in het Cloudflare-dashboard?
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
    - **Bewust nog niet meegenomen:** een zichtbare "Beta"-badge in de UI
      zelf (exacte tekst/plek nog niet afgestemd met de eigenaar), en
      Cloudflare Web Analytics (moet eerst handmatig aangezet worden in
      het Cloudflare-dashboard, buiten bereik van de repo).

## Uit de codereview

1. **Export verliest linked-data-identiteit.** `lib/export.ts` (CSV en
   GeoJSON) bevat geen bron-URI, CHO-nummer, identifier-type of URI's van
   gekoppelde concepten; `monumentnummer` valt terug op `item.id`, dus
   die kolom kan verschillende soorten identifiers bevatten. Voorstel uit
   de review: kolommen `object_uri`, `cho_nummer`, `primaire_identifier`,
   `identifier_type` toevoegen, plus een stabiele Feature-`id` (bron-URI)
   in GeoJSON.
2. ~~**Export kan onvolledig zijn zonder dat te vermelden.**~~ **Deels
   opgelost (17 augustus 2026).** Bij `hasMore` wordt alleen de geladen/
   gefilterde set geëxporteerd; het bestand zelf bevat geen waarschuwing
   daarover (de UI-melding verdwijnt zodra het bestand wordt doorgestuurd).
   Kleinste oplossing uit de review toegepast: de exportknoppen in
   `app/ResultsToolbar.tsx` vermelden nu expliciet hoeveel resultaten
   geëxporteerd worden ("Exporteer 25 resultaten als CSV"). **Blijft
   open:** dit staat alleen op de knop, niet in het bestand zelf (bv. een
   metadatarij of GeoJSON-`properties`) - iemand die het bestand los
   doorstuurt ziet de "nog niet alles geladen"-context niet meer.
3. ~~**CSV-formule-injectie.**~~ **Opgelost (15 augustus 2026).**
   `csvField()` in `lib/export.ts` escaped wel `"`, `,` en `\n`, maar
   neutraliseerde geen leidende `=`, `+`, `-` of `@`. Een
   `neutralizeFormula()`-stap zet zo'n waarde vooraf een voorloop-apostrof
   voor, met regressietests voor `=HYPERLINK(...)`, `+SUM(1,1)`,
   `-2+3`, `@command`, en een controle dat een streepje ergens *midden*
   in de tekst (niet leidend) onaangeroerd blijft.
4. **Drie hoge npm-audit-meldingen** (bevestigd via `npm audit`): twee
   DoS-advisories in `image-size` (via `vinext`), één in `nanoid`. Niet
   blind `npm audit fix --force` gebruiken - npm stelt een oudere
   `vinext`-versie voor. Gerichte upgrade of override onderzoeken en
   daarna build, beeldoptimalisatie en deployment controleren.
5. **Kaarttoegankelijkheid (TD-27, blijft open).** Kaartmarkers/clusters
   zijn niet volledig toetsenbordbedienbaar; `role="button"` zonder
   focus-/toetsenbordgedrag maakt een Leaflet-cluster nog geen bruikbare
   knop.
6. **Testscript bouwt eerst (TD-31, blijft open).** `npm test` start nog
   steeds met een volledige `vinext build`, wat gericht testen vertraagt
   en buildcontrole met unitcontrole vermengt. Voorstel: opsplitsen in
   `test:unit`, `build`, `check`, `test:e2e`.

## Uit de design critique (15 augustus 2026)

Live tegen `https://doorzoeker-v2a.jolietjakeblues64.workers.dev/`, via
DOM/CSS-inspectie (geen screenshots beschikbaar in die sessie). Volledige
critique met alle metingen staat in de sessietranscriptie van 15 augustus;
hieronder de drie prioriteiten.

12. **`.concept-link`-knoppen hebben geen resting-state kleur.** De
    kern-interactie van de app (klik op een begrip → exacte
    zoekopdracht - overal in "Alle gekoppelde begrippen" en losse
    detailvelden) erft zwarte tekstkleur en wordt pas blauw bij `:hover`.
    Op touch/toetsenbord (geen hover) is er dus geen kleursignaal dat het
    klikbaar is, alleen de onderstreping. Geef `.concept-link` in
    `app/globals.css` een expliciete resting-state kleur
    (`var(--rce-blue)`), consistent met elk ander interactief element.
13. **H1 op de startpagina heeft dezelfde regelafstand-ratio als lopende
    tekst.** `font-size: 40px` met `line-height: 64px` (1,6×, exact de
    globale body-ratio). Een display-kop met zoveel lucht oogt losser en
    minder "ontworpen". Strakkere `line-height` (~1,1-1,2×) specifiek
    voor `.hero h1`.
14. **Twee incompatibele knop-hoekstijlen naast elkaar.** Scherp (0px
    radius: "Doorzoek RCE", weergave-toggle, exportknoppen) versus
    volledig rond (20-22px: "Direct zoeken"/"Ontdek een thema"-pills,
    "Verras me"), zonder duidelijke regel wanneer welke gebruikt wordt.
    Eén conventie per actietype kiezen en consequent toepassen.

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
    de browserdefault, nergens vastgelegd). **Blijft open:** externe
    bronnen vastleggen in de privacyinformatie (geen code-taak).
11. **Logging bewaken bij toekomstige uitbreiding.** Nu beheerst (de
    zoekroute logt alleen de lengte van de zoekterm, niet de inhoud).
    Aandachtspunt voor later: als volledige zoekvragen, URI's of
    IP-adressen worden toegevoegd, kunnen logs persoonsgegevens of
    gebruikersinteresses gaan bevatten.

## Nog openstaand uit eerdere sessies (niet uit deze review, ter herinnering)

- **#22**: analyseren van de verwarring tussen de horizontale "Bekijk
  alles"-balk en het verticale filterpaneel (productbeslissing, nog niet
  besproken).
- **TD-06, resterend deel**: echte globale tellingen per facet (of
  minimaal een totaalaantal) via server-side aggregatie - de #33-stap
  loste alleen de eerlijkheid over per-batch tellingen op, niet de
  onderliggende beperking zelf.
- **Verticale slice 006**: ruimtelijke relatie Rijksmonument en
  Werelderfgoed/Gezichten - plan, niet gebouwd.
- **Verticale slice 011**: "In de buurt" (geolocatie-gebaseerd ontdekken)
  - plan, niet gebouwd.
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
  geen van alle gepland of gebouwd.
