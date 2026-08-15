# Te doen

Lopend to-do-document. Vastgelegd op 14 augustus 2026, na afronding van
PR's #55-#60 en twee reviews (functioneel + security) op `main`
(`463f5f4`). Aangevuld op 15 augustus 2026 (mobiel/toegankelijkheid,
`/accessibility-review`-bevindingen, en drie zaterdag-fixes). Wordt
maandag verder opgepakt.

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
3. **Nieuwe doorklik-gaten, gemeld door de eigenaar (15 augustus 2026, nog
   niet geverifieerd of geïmplementeerd):**
   - Grondspoor-veld "Type" (bv. "grondverkleuring") is ook een
     concept-URI-gekoppeld begrip - zie CHO 10000187 in de live RCE-data.
   - Bevestiging (geen nieuwe koppeling, maar een concreet
     voorbeeldrecord): "Archeologische waardering: hoge archeologische
     waarde" is een link - zie CHO 6042545. Navragen of dit al werkt via
     de bestaande waardering-doorklik of dat dit specifieke object/pad
     nog ontbreekt.

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
