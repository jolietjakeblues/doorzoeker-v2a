# Security- en stabilisatiereview

Datum: 11 augustus 2026.

Status: inventarisatie, met ST-01 en ST-02 opgelost op 11 augustus 2026.

## Publieke routes

| Route | Invoervalidatie | Cache | Rate limiting | Foutgedrag | Bevinding |
| --- | --- | --- | --- | --- | --- |
| `/api/rce/search` | Zoeklengte, pagina 1-20, allowlists voor browse, scope, veld en concept-URI | Lokale microcache plus Cache API, 300 seconden | 30 per minuut, best effort per isolate | 400, 429 en 502 met logging | Sterkste bescherming, maar limiter is niet globaal |
| `/api/rce/concept` | Allowlist voor bekende termnamespaces | 3600 seconden gedeeld | Geen | 400, 404 en 502 met logging | Actor-URI valideert, maar deze route kan die bron niet oplossen |
| `/api/rce/complex-members` | Exact CHO-complex-URI-patroon | 300 seconden gedeeld | Geen | 400 en 502 met logging | Invoer veilig begrensd |
| `/api/rce/onderzoeksgebied-verrijking` | Exact CHO-onderzoeksgebied-URI-patroon | 300 seconden gedeeld | Geen | 400 en 502 met logging | Invoer veilig begrensd |
| `/api/rce/vondstlocatie-inhoud` | Exact CHO-vondstlocatie-URI-patroon | 300 seconden gedeeld | Geen | 400 en 502 met logging | Invoer veilig begrensd |
| `/api/rce/op-deze-dag` | Geen gebruikersinvoer | Succes tot volgende UTC-dag; leeg maximaal 300 seconden | Geen | 502 met logging en `no-store` | Kalenderdagveilig; succes, leegte en uitval hebben expliciet cachegedrag |
| `/api/terms/suggest` | Minimaal 2 en maximaal 80 tekens | Lokale map en gedeelde succescache, 300 seconden | Geen | Valt open terug naar lege suggesties met `no-store` | Hits en misses delen dezelfde cachepolicy; lokale map is per isolate |

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

De code documenteert deze beperking correct. Bij 5000 identiteiten ruimt de
limiter eerst verlopen vensters op. Blijft de map vol, dan verdwijnt alleen de
oudste client. Hierdoor vervallen niet langer alle lokale limieten tegelijk.
Voor globale afdwinging blijft platformondersteuning of gedeelde state nodig.

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

### ST-04: cachepolicy is verspreid over routes

TTL's en headers staan lokaal in iedere route. Een gedeelde policytabel of
kleine helper kan afwijkingen zichtbaarder maken, zolang routes hun eigen
inhoudelijke TTL houden.

## Voorstel voor latere uitvoering

1. Leg per route kosten, gewenste limiter en cachepolicy vast.
2. Beslis of een platformlimiter nodig is.
