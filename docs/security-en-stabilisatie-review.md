# Security- en stabilisatiereview

Datum: 11 augustus 2026.

Status: inventarisatie. Er zijn geen routewijzigingen uitgevoerd.

## Publieke routes

| Route | Invoervalidatie | Cache | Rate limiting | Foutgedrag | Bevinding |
| --- | --- | --- | --- | --- | --- |
| `/api/rce/search` | Zoeklengte, pagina 1-20, allowlists voor browse, scope, veld en concept-URI | Lokale microcache plus Cache API, 300 seconden | 30 per minuut, best effort per isolate | 400, 429 en 502 met logging | Sterkste bescherming, maar limiter is niet globaal |
| `/api/rce/concept` | Allowlist voor bekende termnamespaces | 3600 seconden gedeeld | Geen | 400, 404 en 502 met logging | Actor-URI valideert, maar deze route kan die bron niet oplossen |
| `/api/rce/complex-members` | Exact CHO-complex-URI-patroon | 300 seconden gedeeld | Geen | 400 en 502 met logging | Invoer veilig begrensd |
| `/api/rce/onderzoeksgebied-verrijking` | Exact CHO-onderzoeksgebied-URI-patroon | 300 seconden gedeeld | Geen | 400 en 502 met logging | Invoer veilig begrensd |
| `/api/rce/vondstlocatie-inhoud` | Exact CHO-vondstlocatie-URI-patroon | 300 seconden gedeeld | Geen | 400 en 502 met logging | Invoer veilig begrensd |
| `/api/rce/op-deze-dag` | Geen gebruikersinvoer | Vast 21600 seconden gedeeld | Geen | 502 met logging | TTL kan over UTC-middernacht lopen; lege respons heeft geen expliciete cachepolicy |
| `/api/terms/suggest` | Minimaal 2 en maximaal 80 tekens | Lokale map, 300 seconden; succes-MISS heeft gedeelde cacheheaders | Geen | Valt open terug naar lege suggesties | Hits en uitval hebben geen consistente `Cache-Control`; lokale map is per isolate |

## Securitybevindingen

### S-01: SPARQL-invoer is gericht begrensd

Routes die URI's in SPARQL gebruiken accepteren alleen bekende namespaces en
exacte CHO-patronen. De zoekroute gebruikt allowlists voor conceptvelden,
browsecollecties en scopes. Dit beperkt injectierisico.

### S-02: rate limiting beschermt alleen de zoekroute

Andere routes kunnen eveneens dure upstreamquery's uitvoeren. Het ontbreken
van een limiter is niet automatisch een kwetsbaarheid, maar het beleid is nu
niet routebreed vastgelegd.

### S-03: de huidige limiter is per Worker-isolate

De code documenteert deze beperking correct. De map wordt bij meer dan 5000
identiteiten volledig gewist. Dit begrenst geheugen, maar creëert een moment
waarop alle lokale limieten tegelijk verdwijnen. Voor globale afdwinging is
platformondersteuning of gedeelde state nodig.

### S-04: foutmeldingen lekken geen upstreamdetails naar de gebruiker

Routes loggen de technische fout server-side en sturen een algemene 502 terug.
Dit is passend. Controleer wel dat logs geen zoekinhoud of persoonsgegevens
gaan bevatten wanneer observability later wordt uitgebreid.

## Stabilisatiebevindingen

### ST-01: “Op deze dag” is niet kalenderdagveilig gecachet

Een vaste gedeelde TTL van zes uur kan na UTC-middernacht tijdelijk het record
van de vorige dag leveren. Bereken later de TTL tot de gekozen daggrens of
varieer de cachekey per datum.

### ST-02: lege en foutresponsen hebben niet overal bewust cachegedrag

De lege “Op deze dag”-respons en uitval van termsuggesties krijgen geen
expliciete cachepolicy. Leg per route vast of leegte en tijdelijke uitval wel
of niet gedeeld gecachet mogen worden.

### ST-03: lokale caches ruimen niet periodiek op

De zoekcache en termcache verwijderen het oudste ingevoegde item bij hun
maximum. Verlopen waarden blijven tot een volgende lookup of overschrijding
staan. De structuren zijn wel begrensd tot respectievelijk 500 en 250 entries.

### ST-04: cachepolicy is verspreid over routes

TTL's en headers staan lokaal in iedere route. Een gedeelde policytabel of
kleine helper kan afwijkingen zichtbaarder maken, zolang routes hun eigen
inhoudelijke TTL houden.

## Voorstel voor latere uitvoering

1. Leg per route kosten, gewenste limiter en cachepolicy vast.
2. Maak “Op deze dag” kalenderdagveilig en test de daggrens.
3. Geef lege en tijdelijke foutresponsen bewuste headers.
4. Voeg tests toe voor limietreset, cachehit, cachemiss en verlopen entries.
5. Beslis daarna pas of een platformlimiter nodig is.
