# Te doen

Lopend to-do-document. Vastgelegd op 14 augustus 2026, na afronding van
PR's #55-#60 en twee reviews (functioneel + security) op `main`
(`463f5f4`). Aangevuld op 15 augustus 2026 (mobiel/toegankelijkheid,
`/accessibility-review`-bevindingen, drie zaterdag-fixes, en een
design critique). Wordt maandag verder opgepakt.

## Domeinnaam (volgende week)

15. **Sitenaam wordt `doorzoekerfgoed.nl`.** Registratie is gestart bij
    zowel Cloudflare als Strato (15 augustus 2026) - nog niet afgerond,
    nog geen DNS/Worker-koppeling. Zodra de registratie rond is: custom
    domain koppelen aan de Cloudflare Worker, `README.md`/deploydocs
    bijwerken (nu nog `doorzoeker-v2a.jolietjakeblues64.workers.dev`),
    en controleren of er ergens hardcoded verwijzingen naar de oude
    workers.dev-URL staan.

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
   - **Geen skip-link (minor, blijft open).** Toetsenbordgebruiker moet
     elke keer door 24 knoppen (Direct zoeken + Ontdek een thema + Bekijk
     alles) tabben voor de resultaten/filters bereikbaar zijn.
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
   maar is dezelfde soort stille-fout-bug op een dieper niveau. Nog niet
   gefixt.

## Uit de codereview

1. **Export verliest linked-data-identiteit.** `lib/export.ts` (CSV en
   GeoJSON) bevat geen bron-URI, CHO-nummer, identifier-type of URI's van
   gekoppelde concepten; `monumentnummer` valt terug op `item.id`, dus
   die kolom kan verschillende soorten identifiers bevatten. Voorstel uit
   de review: kolommen `object_uri`, `cho_nummer`, `primaire_identifier`,
   `identifier_type` toevoegen, plus een stabiele Feature-`id` (bron-URI)
   in GeoJSON.
2. **Export kan onvolledig zijn zonder dat te vermelden.** Bij `hasMore`
   wordt alleen de geladen/gefilterde set geëxporteerd; het bestand zelf
   bevat geen waarschuwing daarover (de UI-melding verdwijnt zodra het
   bestand wordt doorgestuurd). Kleinste oplossing uit de review: expliciet
   benoemen hoeveel resultaten worden geëxporteerd (bv. "Exporteer 25
   geladen resultaten" op de knop).
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

Kleinere observaties uit dezelfde critique (geen aparte actie, alleen
genoteerd): secundaire tekstkleur is inconsistent (grijs bij hero-intro/
`dt`-labels, zwart bij de adresregel op resultaatkaarten - één
kleurtoken voor secundaire tekst gebruiken); de drie navigatierijen
(Direct zoeken/Ontdek een thema/Bekijk alles) hebben identiek visueel
gewicht ondanks verschillende functies.

## Uit de securityreview

7. **Securityheaders ontbreken.** `next.config.ts` is vrijwel leeg
   (bevestigd) - geen CSP, `X-Content-Type-Options: nosniff`,
   `Referrer-Policy`, `Permissions-Policy`, `frame-ancestors` of HSTS.
   Een CSP vraagt maatwerk vanwege Leaflet, PDOK-kaarttegels en
   RCE-afbeeldingen. Cloudflare kan een deel buiten de repo instellen,
   maar dat is nu niet aantoonbaar in de repo zelf.
8. **Rate limiting is niet globaal (al bekend als S-03).** De limiet van
   30/min leeft per Worker-isolate; beschermt niet hard tegen verspreide
   scraping of belasting van de RCE-endpoints. Al vastgelegd in
   `docs/security-en-stabilisatie-review.md` - geen nieuwe blootstelling,
   blijft desondanks open.
9. **Niet alle routes hebben een limiter.** Bevestigd: van de 8
   API-routes heeft alleen `/api/rce/search` rate limiting. De overige
   zeven (`complex-members`, `concept`, `onderzoeksgebied-verrijking`,
   `op-deze-dag`, `verras-me`, `vondstlocatie-inhoud`, `terms/suggest`)
   niet. Voorstel: eerst per route meten (verzoekvolume, cache-hitratio,
   time-outs, upstreamstatussen, queryduur), dan gericht een
   platformlimiet toevoegen waar metingen misbruik aantonen.
10. **Externe afbeeldingen en kaarttegels (PDOK, RCE).** Bezoekers-IP en
    mogelijk referrerinformatie gaan naar die derde partijen. Privacy-
    /informatiebeveiligingspunt, geen klassieke kwetsbaarheid. Voorstel:
    een beperkte `Referrer-Policy` instellen en externe bronnen vastleggen
    in de privacyinformatie.
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
- **TD-04, TD-05, TD-08, TD-09**: querybouw/parsing-duplicatie per
  objectsoort, ontbrekend algemeen contract voor navigeerbare
  predicaatwaarden, moduleomvang die tests breed maakt, documentatie/
  implementatiestatus die uit elkaar kan lopen - alle nog open, zie
  `docs/analyse-2026-08-11.md`.
- **TD-10**: TypeScript 7 en ESLint 10 (major-upgrades) staan als open
  Dependabot-PR's, bewust uitgesteld - besluitvoorstel in
  `docs/beheerbesluiten.md`.
- **A-08 t/m A-13**: thesaurusviewer, bredere/nauwere begrippen,
  visueel onderscheid term/bronrecord, universeel navigeerbaar-
  predicaatpatroon, inline uitklapbare resultaatgroepen, aparte
  tegelweergave - allemaal nog alleen geanalyseerd (v1-vergelijking),
  geen van alle gepland of gebouwd.
