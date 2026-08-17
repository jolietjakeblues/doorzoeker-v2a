# Security- en stabilisatiereview

Datum: 11 augustus 2026. Bijgewerkt 17 augustus 2026 na
`docs/security-assessment-2026-08-17.md` (rate limiting op vier extra
routes, minimumlengte op vrije tekst, HTTPS-afdwinging en basisheaders op
Workerniveau) - zie dat document voor de volledige onderbouwing.

Status: uitgevoerd. De stabilisatiepunten en het routebrede limiterbesluit zijn
op 11 augustus 2026 vastgelegd.

## Publieke routes

| Route | Invoervalidatie | Cache | Rate limiting | Foutgedrag | Bevinding |
| --- | --- | --- | --- | --- | --- |
| `/api/rce/search` | Zoeklengte (min. 2 tekens voor vrije tekst, numeriek mag korter), pagina 1-20, allowlists voor browse, scope, veld en concept-URI | Lokale microcache plus Cache API, 300 seconden | 30 per minuut, best effort per isolate | 400, 429 en 502 met logging | Sterkste bescherming, maar limiter is niet globaal |
| `/api/rce/concept` | Allowlist voor bekende termnamespaces | 3600 seconden gedeeld | 30 per minuut, best effort per isolate (17-08-2026) | 400, 404 en 502 met logging | Actor-URI valideert, maar deze route kan die bron niet oplossen |
| `/api/rce/complex-members` | Exact CHO-complex-URI-patroon | 300 seconden gedeeld | 30 per minuut, best effort per isolate (17-08-2026) | 400 en 502 met logging | Invoer veilig begrensd |
| `/api/rce/onderzoeksgebied-verrijking` | Exact CHO-onderzoeksgebied-URI-patroon | 300 seconden gedeeld | 30 per minuut, best effort per isolate (17-08-2026) | 400 en 502 met logging | Invoer veilig begrensd |
| `/api/rce/vondstlocatie-inhoud` | Exact CHO-vondstlocatie-URI-patroon | 300 seconden gedeeld | 30 per minuut, best effort per isolate (17-08-2026) | 400 en 502 met logging | Invoer veilig begrensd |
| `/api/rce/op-deze-dag` | Geen gebruikersinvoer | Succes tot volgende UTC-dag; leeg maximaal 300 seconden | Geen | 502 met logging en `no-store` | Kalenderdagveilig; succes, leegte en uitval hebben expliciet cachegedrag |
| `/api/terms/suggest` | Minimaal 2 en maximaal 80 tekens | Lokale map en gedeelde succescache, 300 seconden | Geen | Valt open terug naar lege suggesties met `no-store` | Hits en misses delen dezelfde cachepolicy; lokale map is per isolate |

De vier nieuw gelimiteerde routes delen de aanpak (en de "niet globaal"-
beperking S-03 hieronder) via `lib/server/route-rate-limit.ts` - één
gedeelde implementatie in plaats van vier eigen kopieën. `/api/rce/op-deze-dag`
en `/api/terms/suggest` blijven bewust ongelimiteerd: de eerste heeft geen
gebruikersinvoer (geen aanvalsoppervlak om te vermenigvuldigen), de tweede
heeft al zijn eigen 2-80-tekensbegrenzing en een gedeelde succescache.

## Securitybevindingen

### S-01: SPARQL-invoer is gericht begrensd

Routes die URI's in SPARQL gebruiken accepteren alleen bekende namespaces en
exacte CHO-patronen. De zoekroute gebruikt allowlists voor conceptvelden,
browsecollecties en scopes. Dit beperkt injectierisico.

### S-02: limiterbeleid is per route vastgelegd

`docs/api-beleid.md` legt per route querykosten, cache en limiterbesluit vast.
De overige routes krijgen nu geen limiter door hun exacte invoer, begrensde
query's en gedeelde cache. Termsuggesties worden heroverwogen als metingen
bronbelasting of misbruik tonen.

### S-03: de huidige limiter is per Worker-isolate

De code documenteert deze beperking correct. Bij 5000 identiteiten ruimt de
limiter eerst verlopen vensters op. Blijft de map vol, dan verdwijnt alleen de
oudste client. Hierdoor vervallen niet langer alle lokale limieten tegelijk.
De Cloudflare-binding is eveneens lokaal per Cloudflare-locatie. Zonder
account- of API-sleutel ontbreekt bovendien een geschikte stabiele sleutel.
Daarom is bewust besloten die binding nu niet toe te voegen.

### S-04: foutmeldingen lekken geen upstreamdetails naar de gebruiker

Routes loggen de technische fout server-side en sturen een algemene 502 terug.
Dit is passend. Controleer wel dat logs geen zoekinhoud of persoonsgegevens
gaan bevatten wanneer observability later wordt uitgebreid.

## Stabilisatiebevindingen

### ST-01: “Op deze dag” is kalenderdagveilig gecachet, opgelost

De route berekent de gedeelde TTL tot de volgende UTC-middernacht. Een
succesvol resultaat kan daardoor niet na de gekozen daggrens in de gedeelde
cache blijven staan.

### ST-02: lege en foutresponsen hebben bewust cachegedrag, opgelost

De lege “Op deze dag”-respons krijgt een gedeelde TTL van maximaal vijf
minuten, begrensd door de UTC-daggrens. Upstreamfouten en niet-zoekbare invoer
krijgen `no-store`. Hits en misses van termsuggesties gebruiken dezelfde
gedeelde succespolicy van vijf minuten.

### ST-03: lokale caches ruimen verlopen waarden op, opgelost

De zoekcache en termcache verwijderen bij een geldig verzoek eerst alle
verlopen waarden. Daarna geldt nog steeds de vaste bovengrens van
respectievelijk 500 en 250 entries.

### ST-04: cachepolicy staat in één beleidsmodule, opgelost

De semantische policies voor zoekresultaten, relaties, conceptdetails en
termsuggesties staan in `lib/server/http-cache.ts`. De dynamische daggrens van
“Op deze dag” gebruikt dezelfde headerfunctie, maar berekent zijn eigen TTL.
Routes houden zo hun inhoudelijke keuze zonder losse headerteksten en
TTL-getallen te herhalen.

## Vervolg

De review bevat geen open stabilisatieactie meer. Heroverweeg limitering zodra
observability misbruik of structurele bronbelasting aantoont, of wanneer een
stabiele gebruikersidentiteit beschikbaar komt.
