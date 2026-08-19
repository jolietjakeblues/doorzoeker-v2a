# Security assessment — 17 augustus 2026

Uitgevoerd op expliciet verzoek van de eigenaar: een grondige, niet-ingehouden
beoordeling vanuit twee invalshoeken — (1) een red-team/aanvaller-mindset
tegen de live productiesite, en (2) een gestructureerde toetsing tegen
OWASP Top 10 (2021) en STRIDE. Elke bevinding is hieronder onderbouwd met een
bron (code, live testresultaat, of een externe advisory/CVE) zodat alles
verifieerbaar is. Waar iets niet met zekerheid is vast te stellen, staat dat
expliciet vermeld — er wordt niets verzonnen of aangenomen.

**Scope:** de Doorzoeker-webapp (`doorzoeker-v2a-standalone`), live op
`https://doorzoeker-v2a.jolietjakeblues64.workers.dev/`,
`https://doorzoekerfgoed.nl/` en `https://www.doorzoekerfgoed.nl/` (nieuw
domein, zojuist live gegaan). Cloudflare Workers, geen database, geen
gebruikersaccounts, alleen lezende toegang tot publieke RCE Linked Data.

**Methode:** codelezing (alle 8 API-routes, alle SPARQL-querybouwers, de
image-optimizer-worker, de Leaflet-kaartcomponent), `npm audit`, gerichte
live requests tegen de productiesite (laag volume, zie disclaimer onder
punt 6), en websearches voor actuele CVE's op de exacte geïnstalleerde
versies (niet op aannames).

**Update, later op dezelfde dag (17 augustus 2026):** punten 1, 4 en 5, en
een deel van 2 en 3, zijn na dit rapport gefixt in PR
`fix/security-assessment-hardening`. Details en regressietests staan in de
commitmessage en in `docs/te-doen.md`; de statuskolom hieronder is
bijgewerkt, de rest van dit document is het oorspronkelijke, ongewijzigde
onderzoeksverslag.

**Update, 19 augustus 2026 — restgat in punt 4 alsnog gevonden en
gefixt.** De 17-08-fix voor `searchByNumber` was correct, maar de tekst
bij punt 4 (regels 182-193 hieronder) claimt daarbij dat de zes
bijvangst-categorieën (`onderzoeksgebieden`, `archeologische-terreinen`,
`vondstlocaties`, `grondsporen`, `vondsten`, `archeologische-complexen`)
via `optionalSearch` al "gracefully degraderen" - dat klopt op hun
aanroepplek, maar niet volledig: geen van de zes gaf de
`partialFailure`-tracker door aan hun eigen interne
`runDiscoveryBranches`-aanroep. Faalden *alle* brontakken van zo'n
categorie (bv. een RCE 503), dan gaf de functie stil een lege lijst terug
zonder te throwen - `optionalSearch`'s catch werd nooit bereikt, de
tracker bleef op `partial:false`, en dat foute lege resultaat werd
vervolgens nog 5 minuten als geldig gecachet. Live gevonden via een
doorklik op een Vondstlocatie ("Oude Hoeven", CHO 6111048) die bleef
"0 resultaten" tonen ondanks een aantoonbaar correct en rechtstreeks
vindbaar CHO-nummer. Opgelost in
[PR #90](https://github.com/jolietjakeblues/doorzoeker-v2a/pull/90) door
`tracker` alsnog door te geven aan alle zes functies en hun eigen
`runDiscoveryBranches`-aanroep, met een regressietest in
`tests/rce-api.test.mjs`.

---

## Samenvatting — bevindingen op prioriteit

| # | Bevinding | Ernst | Status |
| --- | --- | --- | --- |
| 1 | Geen HTTPS-afdwinging: site volledig bereikbaar over onversleuteld `http://` | **Hoog** | Live bevestigd. **Opgelost 17-08:** redirect op Workerniveau (`worker/index.ts`) - los van een eventuele Cloudflare-zone-instelling, die nog gecontroleerd moet worden (zie open vraag 1). |
| 2 | Geen securityheaders (CSP, X-Content-Type-Options, X-Frame-Options/HSTS) op de eigen pagina's | **Middel-Hoog** | Al eerder bekend (securityreview 11-08-2026). **Deels opgelost 17-08:** X-Content-Type-Options, X-Frame-Options en HSTS toegevoegd op Workerniveau. CSP blijft open (vraagt maatwerk, te risicovol om blind toe te voegen). |
| 3 | Rate limiting alleen op `/api/rce/search`; 7 van 8 routes onbeperkt, met tot 5x SPARQL-amplificatie per request | **Middel** | Al eerder bekend. **Deels opgelost 17-08:** `complex-members`, `concept`, `onderzoeksgebied-verrijking` en `vondstlocatie-inhoud` hebben nu dezelfde limiter. Blijft per-isolate (niet globaal, zie punt 3 in het rapport) en `op-deze-dag`/`verras-me`/`terms/suggest` blijven bewust ongelimiteerd. |
| 4 | Numerieke zoekpad (`searchByNumber`) heeft geen fallback bij een falende deelquery — cascadeert naar een volledige 502 | **Middel** | Nieuw, vandaag ontdekt tijdens live testen. **Opgelost 17-08.** Restgat in de zes bijvangst-categorieën (tracker niet doorgegeven aan hun eigen `runDiscoveryBranches`) live gevonden en **opgelost 19-08** ([PR #90](https://github.com/jolietjakeblues/doorzoeker-v2a/pull/90)). |
| 5 | Geen minimumlengte op vrije-tekstzoekterm — 1-teken zoekopdrachten zijn duur en kunnen de time-out raken | **Laag-Middel** | Nieuw, vandaag ontdekt tijdens live testen. **Opgelost 17-08.** |
| 6 | `leaflet@1.9.4` heeft een gepubliceerde XSS (CVE-2025-69993) in `bindPopup()` | Kwetsbare dependency aanwezig, **niet exploiteerbaar in dit gebruik** | Geverifieerd veilig door codelezing |
| 7 | 3 hoge `npm audit`-meldingen (`image-size`, `nanoid`, via `vinext`) | Kwetsbare dependency aanwezig, **vermoedelijk alleen build-time bereikbaar** | Al eerder bekend, nu verder onderzocht. Geen veilige non-breaking fix beschikbaar, nog open. |
| 8 | React/RSC: React2Shell (CVE-2025-55182, CVSS 10.0) | **Vermoedelijk al gepatcht** op versienummer, geen bevestiging specifiek voor vinext gevonden | Nieuw onderzocht, blijft een open vraag |
| 9 | `@cloudflare/vite-plugin`-devserver-secretslek (CVE-2025-59427) | Al gepatcht (versie ruim boven de fix) | Geverifieerd veilig |
| 10 | SPARQL-injectie via vrije tekst of concept-URI's | **Niet gevonden** — consistente escaping/allowlisting | Geverifieerd veilig |

---

## 1. Live aanvallerstest: geen HTTPS-afdwinging

**Bevinding:** zowel `http://doorzoekerfgoed.nl/` als
`http://doorzoeker-v2a.jolietjakeblues64.workers.dev/` geven een directe
`200 OK` met de volledige pagina-inhoud terug over een onversleutelde
TCP-verbinding op poort 80 — geen 301/302-redirect naar `https://`, geen
`Location`-header. Rechtstreeks geverifieerd met `curl -v` (ruwe
verbindingslog, geen curl-eigenaardigheid):

```
* Established connection to doorzoekerfgoed.nl (188.114.97.0 port 80)
> GET / HTTP/1.1
< HTTP/1.1 200 OK
```

**Waarom dit ertoe doet:** een aanvaller met een man-in-the-middle-positie
(open wifi, gecompromitteerde router, DNS-spoofing) kan de pagina-inhoud
lezen én wijzigen voordat die de browser bereikt — bijvoorbeeld JavaScript
injecteren in een sessie waarin een bezoeker de URL zonder `https://` heeft
ingetikt of via een oude link binnenkomt. Omdat de site zich presenteert als
RCE/Rijksoverheid-erfgoeddienst, is dit een reëel vertrouwens- en
integriteitsrisico, ook al zijn er geen accounts of transacties om te
stelen.

**Vermoedelijke oorzaak:** dit is typisch een Cloudflare *zone*-instelling
("Always Use HTTPS" / een redirect-regel), niet iets dat in deze repository
zichtbaar is — ik kan dit dus niet bevestigen vanuit de code alleen.

**Vraag aan de eigenaar:** staat "Always Use HTTPS" (of een gelijkwaardige
redirect-regel) aan in het Cloudflare-dashboard voor beide zones
(`doorzoekerfgoed.nl` en de `workers.dev`-subdomeinen)? Zo niet, dat is de
snelste fix en vergt geen codewijziging.

---

## 2. Geen securityheaders op de eigen pagina's

**Bevinding:** live headercheck op de hoofdpagina toont geen
`Content-Security-Policy`, geen `X-Content-Type-Options`, geen
`X-Frame-Options`/`frame-ancestors`, geen `Strict-Transport-Security`:

```
HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
Server: cloudflare
```

Dit was al vastgelegd in `docs/security-en-stabilisatie-review.md` (11
augustus 2026, punt 7) en is dus geen nieuwe ontdekking, maar is vandaag
opnieuw live bevestigd en blijft open.

**Praktische impact hier specifiek:** zonder `X-Frame-Options`/
`frame-ancestors` kan de site in een `<iframe>` op een andere site worden
ingebed (clickjacking). Omdat Doorzoeker geen destructieve
gebruikersacties heeft (geen login, geen aankopen, geen data-mutaties) is
de praktische buit voor een clickjacking-aanval beperkt — er is niets
gevaarlijks om een gebruiker per ongeluk te laten aanklikken. Het ontbreken
van CSP is desondanks de belangrijkste resterende verdedigingslaag tegen
XSS via een toekomstige derde-partij-dependency of een fout die per ongeluk
`dangerouslySetInnerHTML` introduceert (nu nergens gebruikt, zie punt 10).

**Ter nuancering, wél al opgelost vandaag:** `metadata.referrer` staat sinds
vandaag expliciet op `strict-origin-when-cross-origin`
(`app/layout.tsx`) — dat is een `<meta name="referrer">`-tag, geen
HTTP-header, en dekt dus alleen het referrer-gedrag, niet CSP/HSTS/framing.

**Aanbeveling:** een CSP toevoegen vergt maatwerk vanwege Leaflet
(inline styles/style-elementen), PDOK-kaarttegels
(`service.pdok.nl`) en RCE-afbeeldingen. Kleinste eerste stap zonder CSP-
maatwerk: `X-Content-Type-Options: nosniff` en `X-Frame-Options: DENY` (of
`frame-ancestors 'none'` via een minimale CSP) toevoegen — die twee raken
geen enkele bestaande functionaliteit.

---

## 3. Rate limiting: 7 van 8 routes onbeperkt, met SPARQL-amplificatie

**Bevinding (bevestigd via codelezing van alle 8 routebestanden):** alleen
`/api/rce/search` heeft een limiter (30/minuut, en zoals hieronder
toegelicht ook die is zwak). De overige zeven routes hebben er geen:
`/api/rce/concept`, `/api/rce/complex-members`,
`/api/rce/onderzoeksgebied-verrijking`, `/api/rce/op-deze-dag`,
`/api/rce/verras-me`, `/api/rce/vondstlocatie-inhoud`,
`/api/terms/suggest`.

**Wat dit concreet mogelijk maakt (geteld vanuit de code, geen schatting):**

- Eén enkel request naar `/api/rce/search?q=<term>` (vrije tekst) triggert
  intern tot **8 kern-discoveryquery's + 9 categoriequery's = tot 17
  parallelle SPARQL-aanroepen** naar de RCE-dienst
  (`lib/server/rce-adapter.ts`, `searchByText`).
- Eén enkel request naar `/api/rce/vondstlocatie-inhoud?locatie=<uri>`
  triggert 3 klasse-query's + 1 tellingquery + minstens 1
  concept-resolutiequery = **minstens 5 parallelle SPARQL-aanroepen**, en
  deze route heeft *geen* limiter.
- De URI-parameters zijn weliswaar strikt met een regex gevalideerd (zie
  punt 10), maar die regex controleert alleen het *formaat*
  (`/^https:\/\/...\/\d+$/`), niet of het record daadwerkelijk bestaat. Een
  aanvaller kan dus willekeurige geldig-ogende nummers doorlopen en telkens
  een volledige fan-out van SPARQL-aanroepen tegen RCE veroorzaken, zonder
  ooit een echte trefferrecord nodig te hebben.

**Waarom dit meer is dan "onze site wordt traag":** dit is in de eerste
plaats een misbruikrisico *tegen de RCE-dienst zelf*, niet alleen tegen
Doorzoeker — deze app fungeert hier feitelijk als een ongelimiteerde
amplificatie-proxy richting een derde partij (de Rijksoverheid-dienst
waarvan de data wordt hergebruikt).

**Al bekend, niet nieuw:** dit stond al als S-02/S-03 in de securityreview
van 11 augustus; de precieze amplificatiefactor (tot 17x resp. 5x) is
vandaag voor het eerst expliciet gekwantificeerd.

**Aanbeveling:** minimaal de vier routes die een gebruikersgestuurde
URI-parameter accepteren (`complex-members`,
`onderzoeksgebied-verrijking`, `vondstlocatie-inhoud`, `concept`) van
dezelfde limiter voorzien als `/api/rce/search`, ook al is elke aanroep
individueel "veilig begrensd" — de amplificatiefactor an sich is het
risico, niet de invoervalidatie.

---

## 4. Nieuw ontdekt: numeriek zoekpad heeft geen fallback (live gereproduceerd)

Tijdens het live testen (zie disclaimer bij punt 6) faalde een simpele,
eerder betrouwbare zoekopdracht (`?q=36046`, een rijksmonumentnummer)
met **502** op een moment dat de RCE SPARQL-dienst merkbaar traag was
(rechtstreekse test tegen `api.linkeddata.cultureelerfgoed.nl` duurde
4,4s; een herhaalde poging op Doorzoeker duurde 14,9s, dicht tegen de
20s-timeout in `lib/server/sparql-client.ts`).

**Oorzaak, geverifieerd in de code:** in `searchRceMonuments`
(`lib/server/rce-adapter.ts`, het pad voor 1-6-cijferige nummers) wordt
`searchByNumber(...)` **niet** via de `optionalSearch()`-helper aangeroepen
zoals de zes overige categorieën in datzelfde `Promise.all` (`complexen`,
`terreinen`, `vondstlocaties`, `grondsporen`, `vondsten`,
`archeologischeComplexen` vallen bij een fout terug op een lege lijst;
`searchByNumber` niet). Faalt die ene aanroep (traag of tijdelijk
onbereikbaar), dan faalt de hele `Promise.all` en dus het hele verzoek met
502 — ook al waren de andere zes categorieën misschien allang klaar.

Dit is exact dezelfde klasse stille-fout-kwetsbaarheid als vandaag eerder
gefixt voor de vrije-tekstzoekopdracht (`SearchPartialFailure`-tracker,
PR #64) — alleen ontbreekt de bescherming hier voor het *primaire* pad
(numerieke lookup), dat wél al deels graceful degradeert voor de zes
bijvangst-categorieën maar niet voor de hoofdquery zelf.

**Aanbeveling:** `searchByNumber` in hetzelfde `Promise.all` van een eigen
timeout/degradatiestrategie voorzien, of expliciet documenteren dat dit
pad bewust "alles-of-niets" is (met een duidelijker foutmelding dan de
generieke 502) in plaats van dat het per ongeluk zo werkt.

---

## 5. Nieuw ontdekt: geen minimumlengte op de vrije-tekstzoekterm

**Bevinding (live gereproduceerd, meerdere herhalingen):**
`?q=a`, `?q=b`, `?q=xy` — allemaal 502 tijdens een periode van trage
RCE-respons. `app/api/rce/search/route.ts` valideert wel een
*maximumlengte* (`query.length > 120` → 400) maar geen minimum
(`!query` sluit alleen een lege string uit).

**Waarom dit een apart punt is, los van punt 4:** een zoekterm van 1
teken triggert een `CONTAINS(LCASE(...), LCASE("a"))`-filter over een zeer
groot deel van de RCE-graph, in potentie de duurste mogelijke
substring-zoekopdracht die het systeem toestaat. Gecombineerd met punt 3
(geen brede rate limiting) is dit een reëel kostenamplificatie-vector: een
aanvaller die herhaaldelijk 1-teken-zoekopdrachten stuurt, veroorzaakt
stelselmatig de duurste mogelijke queries tegen RCE, met de minste moeite.

**Aanbeveling:** een minimumlengte instellen (bijvoorbeeld 2 tekens, zoals
al gebeurt bij `/api/terms/suggest`) voor de vrije-tekstzoekopdracht.

---

## 6. Disclaimer live testen

Alle live tests hierboven zijn met bewust laag volume uitgevoerd (enkele
tot enkele tientallen requests, verspreid, geen geautomatiseerde
brute-force of load-test). Tijdens het testen bleek de RCE SPARQL-dienst
zelf periodiek traag (rechtstreeks gemeten: 4,4s–14,9s per aanroep) — ik heb
het testen daarom bewust vertraagd en beperkt om niet zelf bij te dragen
aan extra belasting van een dienst die al zichtbaar onder druk stond op dat
moment. Dit is dus geen door mij veroorzaakte uitval, maar het maakte
punt 4 en 5 wel des te makkelijker te reproduceren en te bewijzen.

---

## 7. SPARQL-injectie: systematisch nagelopen, niets gevonden

Elke plek in `lib/rce/*.ts` waar een waarde direct in een SPARQL
`<...>`-node wordt geïnterpoleerd (`grep "<\${" lib/rce/*.ts`, 30+
treffers) is nagelopen op herkomst:

- **Concept-URI's** (`veld`/`concept`-parameters): gevalideerd tegen
  `CONCEPT_URI_PATTERN` in `app/api/rce/concept/route.ts` (hergebruikt
  door `app/api/rce/search/route.ts`) —
  `/^https:\/\/data\.cultureelerfgoed\.nl\/term\/id\/(rn\/2|rn|cht|abr)\/[0-9a-fA-F-]+$/`,
  volledig geankerd, geen `>`-teken mogelijk.
- **CHO-object-URI's** (`complex`, `gebied`, `locatie`-parameters): elk
  eigen, volledig geankerde regex per route
  (`^https:\/\/linkeddata\.cultureelerfgoed\.nl\/cho-kennis\/id\/.../\d+$`).
- **Vrije tekst in string-literal-posities**: consequent door
  `escapeSparqlString()` gehaald (`lib/rce/sparql.ts`) vóór interpolatie —
  escaped backslash, aanhalingsteken en newlines.
- **Postcode** (REST-API-pad, geen SPARQL): apart geregexed
  (`/^\d{4}\s?[A-Za-z]{2}$/`) vóórdat die als queryparameter (niet als
  pad) wordt meegestuurd.
- **Batched `VALUES`-clausules** (`choUris.map(uri => `<${uri}>`)`): deze
  URI's komen altijd uit eerdere, eigen RCE-queryresultaten (dus
  server-gegenereerd, niet direct gebruikersinvoer) — het vertrouwen zit
  hier op de grens met de RCE-dienst zelf, niet op de eindgebruiker.

**Live poging:** een zoekterm met SPARQL-syntax (`" } UNION { SELECT * ...`)
gaf gewoon `{"results":[]}` terug — de invoer werd als lettertekst
behandeld, niet uitgevoerd. Geen foutmelding, geen upstream-detail
gelekt.

**Conclusie:** geen SPARQL-injectiepad gevonden. Dit is een expliciet
doordachte, consistent toegepaste aanpak (elke route heeft zelfs een eigen
codecommentaar dat de `<...>`-interpolatie en het risico benoemt).

---

## 8. Cross-site scripting (XSS): geen vector gevonden

- Geen enkel gebruik van `dangerouslySetInnerHTML`, `eval()` of
  `new Function()` in `app/`, `lib/` of `hooks/` (grep, 0 treffers).
- React escaped tekstuele content standaard; alle door RCE aangeleverde
  tekst (namen, omschrijvingen) gaat via gewone JSX-tekstinterpolatie.
- **Leaflet-kaart specifiek nagelopen** (relevant vanwege CVE-2025-69993,
  zie punt 9): `app/HeritageMap.tsx` gebruikt `bindTooltip()` en
  `L.divIcon({ html: ... })`, maar in beide gevallen wordt de inhoud
  opgebouwd via `document.createElement`/`textContent`/
  `document.createTextNode` — dus een echt DOM-element, nooit een
  HTML-string. Leaflet injecteert een DOM-element rechtstreeks (`appendChild`)
  in plaats van het als HTML-string te parsen, wat deze hele
  kwetsbaarheidsklasse (ongeacht de specifieke CVE) omzeilt.

---

## 9. Dependency-CVE's: per pakket nagelopen op de exacte geïnstalleerde versie

Geïnstalleerde versies (via `npm ls`/`package-lock.json`, niet de
`^`-range uit `package.json`):
`react@19.2.8`, `react-dom@19.2.8`, `react-server-dom-webpack@19.2.8`,
`leaflet@1.9.4`, `vinext@1.0.0-beta.5`, `wrangler@4.120.0`,
`@cloudflare/vite-plugin@1.51.1`.

### React / React Server Components — "React2Shell" (CVE-2025-55182, CVSS 10.0)

Een kritieke, actief in het wild misbruikte pre-auth RCE in de RSC
"Flight"-protocolverwerking, die begin december 2025 zo ernstig was dat
Cloudflare zelf tijdelijk een deel van het eigen netwerk platlegde om
noodmaatregelen door te voeren
([Rapid7](https://www.rapid7.com/blog/post/etr-react2shell-cve-2025-55182-critical-unauthenticated-rce-affecting-react-server-components/),
[AWS](https://aws.amazon.com/blogs/security/china-nexus-cyber-threat-groups-rapidly-exploit-react2shell-vulnerability-cve-2025-55182/)).
Kwetsbaar: `react-server-dom-webpack` 19.0.0, 19.1.0, 19.1.1, 19.2.0.
Gepatcht: 19.0.1, 19.1.2, **19.2.1** en hoger
([Vercel-advisory](https://vercel.com/changelog/cve-2025-55182)).

Dit project gebruikt **19.2.8** — ruim boven de gepatchte 19.2.1-grens.
**Op versienummer is dit dus gepatcht.**

**Wat ik niet kon bevestigen:** vinext is geen kale Next.js-installatie
maar een eigen herimplementatie rond dezelfde onderliggende
`react-server-dom-webpack`-package. Ik heb geen specifieke, onafhankelijke
bevestiging gevonden dat Cloudflare vinext's eigen RSC-laag is getoetst
tegen déze exacte CVE (wel dat vinext apart, door Vercel en door
onderzoeker Hacktron, is doorgelicht op *andere*, vinext-eigen
kwetsbaarheden — zie hieronder). Omdat de kwetsbare code in het
onderliggende package zat (niet in Next.js' routinglaag), is de kans groot
dat het gebruik van de gepatchte package voldoende is, maar ik wil dit
niet als 100% zekerheid presenteren zonder een vinext-specifieke bron.

**Vraag aan de eigenaar:** wil je dat ik dit verder uitzoek (bijvoorbeeld
via het `cloudflare/vinext`-securitylog op GitHub), of is de
versie-gebaseerde conclusie voldoende geruststelling?

### vinext-eigen kwetsbaarheden (los van React/Next.js-CVE's)

Onafhankelijke security-onderzoekers hebben vinext zelf doorgelicht:
Vercel meldde "2 kritiek, 2 hoog, 2 middel, 1 laag"
([bron: X/Twitter, Guillermo Rauch](https://x.com/rauchg/status/2026864132423823499)),
en onderzoeker Hacktron vond 45 kwetsbaarheden (24 bevestigd), waaronder
racecondities, "cross-request state pollution" en "unsafe global
fallbacks" ([Hacktron AI](https://www.hacktron.ai/blog/hacking-cloudflare-vinext)).
"Cross-request state pollution" is potentieel ernstig in een
Workers-omgeving waar één isolate meerdere gelijktijdige gebruikers
bedient — dat zou in theorie kunnen betekenen dat het antwoord voor de ene
bezoeker data van een andere bezoeker bevat.

**Wat ik niet kon vaststellen:** welke exacte vinext-versies deze
specifieke bevindingen betroffen, en of `1.0.0-beta.5` (de hier
geïnstalleerde versie) de fix al bevat. De gevonden bronnen noemen geen
concreet versienummer. Dit blijft dus een **open vraag**, niet een
bevestigde kwetsbaarheid — ik presenteer het bewust niet als "wel" of
"niet" gepatcht omdat ik dat niet kan onderbouwen.

**Vraag aan de eigenaar:** vinext is een pre-1.0-bètapakket van een
kernafhankelijkheid (het hele request-handling-framework). Wil je dat ik
uitzoek of er een changelog/CHANGELOG.md in `node_modules/vinext` staat
die deze fixes traceert, of vind je het acceptabel gezien de beperkte
schaal van dit project?

### `npm audit`: 3 hoge meldingen, vermoedelijk build-time-only

- `image-size` ≤2.0.2: DoS via oneindige lus bij ICNS/JXL/HEIF-parsing
  ([GHSA-w3rx-r6r6-pgpr](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr),
  [GHSA-5p2g-fcmc-qvqq](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq)).
- `nanoid` <3.3.18: oneindige lus bij `size: 0`
  ([GHSA-2v37-7h3g-55p8](https://github.com/advisories/GHSA-2v37-7h3g-55p8)).

Beide komen binnen via `vinext` als indirecte afhankelijkheid. Nagelopen
waar `image-size` binnen vinext wordt gebruikt
(`grep -rl image-size node_modules/vinext/dist`): alleen in
`dist/index.js` (CLI-entrypoint) en
`dist/server/metadata-route-build-data.js` (bouwt metadata-routes zoals
favicons tijdens `vinext build`) — **niet** in de bestanden die de live
Cloudflare Worker daadwerkelijk bedienen
(`app-router-entry`, `image-optimization.js`). De live
afbeeldingsoptimalisatie-endpoint (`/_vinext/image`, zie punt 11) gebruikt
Cloudflare's eigen `env.IMAGES`-binding, niet het npm-pakket `image-size`.

**Conclusie, met een slag om de arm:** deze twee DoS-kwetsbaarheden lijken
alleen bereikbaar tijdens `npm run build`/`vinext build` (dus voor een
ontwikkelaar of CI, met een kwaadaardig afbeeldingsbestand dat al in de
repo zou moeten staan), niet voor een anonieme bezoeker van de live site.
Ik kan dit niet met 100% zekerheid uitsluiten zonder de volledige
build-graph te traceren, maar de bestandslocaties wijzen daar sterk op.

**Aanbeveling:** desondanks oplossen zodra een niet-breaking fix
beschikbaar is (`npm audit fix` zonder `--force`, of een gerichte
`overrides`-regel in `package.json`) — al was het maar omdat het risico
lager wordt naarmate het al gepland stond (zie
`docs/te-doen.md`, codereview-punt 4).

### `wrangler` en `@cloudflare/vite-plugin`: al gepatcht

- Wrangler command-injection via `--commit-hash` bij `wrangler pages
  deploy`: gefixed in 4.59.1+
  ([GHSA-36p8-mvp6-cv38](https://github.com/cloudflare/workers-sdk/security/advisories/GHSA-36p8-mvp6-cv38)).
  Dit project: **4.120.0** — gepatcht. Bovendien alleen een risico bij
  gebruik van `wrangler pages deploy` met een aanvaller-gestuurde
  `--commit-hash`-waarde in een CI-omgeving, niet een live-site-risico.
- `@cloudflare/vite-plugin`-devserver lekt `.env`/`.dev.vars` naar elke
  bezoeker van de lokale dev-server: gefixed in 1.6.0
  ([GHSA-4pfg-2mw5-f8jx](https://github.com/cloudflare/workers-sdk/security/advisories/GHSA-4pfg-2mw5-f8jx)).
  Dit project: **1.51.1** — ruim gepatcht. Alleen relevant als de
  `npm run dev`-server ooit publiek werd blootgesteld (bijvoorbeeld via een
  gedeelde `cloudflared`-tunnel) tijdens een oudere, kwetsbare versie.

### Leaflet — CVE-2025-69993 (XSS via `bindPopup()`)

Kwetsbaar: alle versies t/m 1.9.4
([GHSA-h5cx-hfj5-x8v3](https://github.com/advisories/GHSA-h5cx-hfj5-x8v3),
[SentinelOne](https://www.sentinelone.com/vulnerability-database/cve-2025-69993/)).
Dit project: **1.9.4** — dus op versienummer kwetsbaar. Zoals in punt 8
toegelicht: de app gebruikt nergens `bindPopup()`, en de wél gebruikte
`bindTooltip()`/`divIcon`-aanroepen geven altijd een DOM-element mee, nooit
een HTML-string — de kwetsbare codepad wordt in de praktijk dus niet
geraakt. **Aanbeveling:** toch bijwerken zodra Leaflet een fix uitbrengt,
als hygiëne, niet als noodzaak.

---

## 10. STRIDE-doorloop

| Categorie | Bevinding |
| --- | --- |
| **Spoofing** | Geen authenticatie/accounts, dus geen identiteit om te spoofen. `cf-connecting-ip` (gebruikt voor rate limiting) wordt door Cloudflare's edge gezet en kan niet door de client worden vervalst. |
| **Tampering** | Geen HTTPS-afdwinging (punt 1) is hier het kernrisico: content kan onderweg gewijzigd worden. Binnen de app zelf: geen enkele plek waar clientinvoer ongefilterd wordt teruggeschreven of opgeslagen (geen database). |
| **Repudiation** | Server-side logging is bewust minimaal (alleen lengte van zoektermen, geen inhoud, geen IP in logs — vastgelegd in de securityreview van 11 augustus, punt S-04). Geen auditlog nodig zolang er geen schrijfacties zijn. |
| **Information disclosure** | Foutmeldingen zijn generiek (502, geen upstream-detail) — geverifieerd via `withRceErrorHandling`. Referrer-Policy is sinds vandaag expliciet beperkt (punt hierboven). Geen secrets in de repo of in de Worker-configuratie gevonden. |
| **Denial of service** | Het grootste aandachtsgebied hier: punten 3, 4 en 5 hierboven. Geen enkele gebruikersactie is destructief, dus dit is de reële dreigingscategorie voor deze app. |
| **Elevation of privilege** | Niet van toepassing: er zijn geen rollen of privileges — iedereen heeft dezelfde (lees-)toegang. |

---

## 11. Los nagelopen: de `/_vinext/image`-optimalisatie-endpoint (SSRF-check)

`worker/index.ts` registreert een live endpoint die afbeeldingen
optimaliseert. Dit patroon (een server die op verzoek een URL ophaalt) is
een klassieke SSRF-vector, dus expliciet nagelopen in de broncode van de
handler (`node_modules/vinext/dist/server/image-optimization.js`):

- De `url`-parameter moet beginnen met een enkele `/` en mag niet met `//`
  beginnen (voorkomt protocol-relative externe URL's).
- Backslashes worden eerst genormaliseerd naar forward slashes vóór die
  check — sluit een bekende bypass-truc uit waarbij `\\evil.com` een
  naïeve `startsWith("/")`-check omzeilt.
- Na resolutie tegen een dummy-origin (`https://localhost`) moet de
  origin exact gelijk blijven — een absolute externe URL faalt dus altijd.
- SVG's worden standaard geweigerd (`dangerouslyAllowSVG` staat niet aan
  in dit project) — sluit de bekende Next.js-SVG-XSS-klasse uit.

**Conclusie:** deze endpoint accepteert alleen relatieve, same-origin
paden en kan dus niet worden misbruikt om de Worker willekeurige externe of
interne URL's te laten ophalen. Dit is code van het vinext-framework zelf
(niet dit project se eigen code), maar wel actief onderdeel van het live
aanvalsoppervlak, dus expliciet geverifieerd in plaats van aangenomen.

---

## Openstaande vragen aan de eigenaar

1. Staat "Always Use HTTPS" (of een gelijkwaardige redirect) aan in het
   Cloudflare-dashboard voor `doorzoekerfgoed.nl` en de
   `workers.dev`-zone? (punt 1 — ik kan dit niet vanuit de repo zien.)
2. Wil je dat ik dieper uitzoek of vinext `1.0.0-beta.5` specifiek is
   getoetst tegen CVE-2025-55182 en tegen de door Vercel/Hacktron gemelde
   vinext-eigen kwetsbaarheden, of is de versie-gebaseerde inschatting
   hierboven voldoende? (punt 9)
3. Heb je ooit `npm run dev` publiek gedeeld (bijvoorbeeld via
   `cloudflared`) vóórdat `@cloudflare/vite-plugin` 1.6.0 uitkwam, met een
   `.dev.vars`/`.env` met echte secrets erin? (alleen relevant als
   nacontrole voor CVE-2025-59427 — nu zelf al gepatcht, dus alleen
   historisch relevant.)
4. Prioriteit: wil je dat ik nu al met fixen begin (bijvoorbeeld de
   minimumlengte op zoektermen, of `searchByNumber`'s ontbrekende
   fallback), of eerst dit rapport doornemen en zelf prioriteiten
   aangeven?
