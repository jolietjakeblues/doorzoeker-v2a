# ADR-0002: Hybride gegevensarchitectuur met verwisselbare adapters

- Status: geaccepteerd
- Datum: 2026-08-06

## Context

De RCE biedt actuele Linked Data via opgeslagen REST-query's, SPARQL en
JSON-LD, inclusief het eigen Referentienetwerk (de CHT- en ABR-thesauri) als
gestandaardiseerde termenbron. RCE-MCP biedt semantische hulpmiddelen en
gevalideerde toegang voor AI-clients.

Geen van deze voorzieningen vormt op zichzelf automatisch een complete
publiekszoekmachine met voorspelbare vrije tekst, facetten, relevantie,
responstijden en bescherming tegen dure queries.

## Besluit

De webclient communiceert met een eigen applicatie-API. Die API biedt stabiele,
taakgerichte contracten voor zoeken, facetten, kaartresultaten, details en
termsuggesties.

Externe voorzieningen worden achter afzonderlijke adapters geplaatst:

- RCE REST-adapter voor bekende, vaste lookups;
- RCE SPARQL-adapter voor relaties en vragen waarvoor geen passende vaste query
  bestaat;
- Termen-adapter voor termen zoeken en selecteren, rechtstreeks tegen RCE's
  eigen Referentienetwerk-thesauri (zie Implementatiestatus);
- optionele RCE-MCP-adapter voor AI- en beheerfuncties;
- optionele zoekindex-adapter voor snelle vrije tekst en facetten.

De eerste spike gebruikt live RCE-data. Een eigen zoekindex wordt pas ingevoerd
als metingen aantonen dat relevantie, facetten of responstijden dat vereisen.

## Randvoorwaarden

- URI's zijn de canonieke identiteit van resources en termen.
- Antwoorden bevatten bronvermelding en, waar zinvol, actualiteitsinformatie.
- Willekeurige SPARQL van browsergebruikers wordt niet doorgestuurd.
- Query's hebben limieten, time-outs, caching en observability.
- Presentatiemodellen lekken geen endpoint-specifieke RDF- of JSON-structuur
  naar de webclient.

## Gevolgen

- De UI blijft onafhankelijk van wijzigingen in externe API's.
- Live data en een eventuele eigen index kunnen naast elkaar bestaan.
- Er is extra backendcode nodig voor mapping, caching en foutafhandeling.
- De noodzaak van een zoekindex blijft een meetbare, uitgestelde beslissing.

## Implementatiestatus

Sinds 2026-08-07 gebruikt de webclient uitsluitend eigen taakgerichte
contracten: `GET /api/rce/search` voor zoeken/browsen, `GET
/api/rce/complex-members` voor de (pas op aanvraag geladen) ledenlijst van een
Complex, en `GET /api/rce/onderzoeksgebied-verrijking` voor de (eveneens pas
op aanvraag geladen) archeologische verrijking van een Onderzoeksgebied.
Queryopbouw, RCE REST- en SPARQL-aanroepen en mapping draaien in de
serveradapter. Alle drie de routes valideren invoer (de complex- en
onderzoeksgebied-routes staan uitsluitend een URI toe die aan een vast
patroon voldoet, om SPARQL-injectie in de geïnterpoleerde `<...>`-node uit te
sluiten), begrenzen verzoeken per client, hanteren een harde
upstream-timeout, gebruiken de Cloudflare-cache en publiceren
timinginformatie voor observability.

**Termen-adapter herzien (2026-08-08).** `GET /api/terms/suggest` praatte
aanvankelijk met het externe Termennetwerk (GraphQL,
`termennetwerk-api.netwerkdigitaalerfgoed.nl`) - een sectorbreed
verzamelpunt waar RCE's eigen Referentienetwerk-thesauri (CHT, ABR, ...) ook
naartoe worden doorgezet, voor kruisbevraging tussen meerdere organisaties.
Voor een RCE-specifieke app als Doorzoeker is die omweg naar een downstream
kopie onnodig; erger nog, bij onderzoek bleek de GraphQL-query een
onopgemerkte bug te bevatten (een niet-gealiast `terms`-veld dat botst tussen
twee union-varianten), waardoor de live dienst elke aanroep met HTTP 400
afwees en termsuggesties allang stilzwijgend leeg terugkwamen. De
termen-adapter bevraagt sindsdien de CHT- en ABR-thesaurigraphs rechtstreeks
via dezelfde SPARQL-dienst als de rest van de app (`buildChtTermSuggestQuery`/
`buildAbrTermSuggestQuery` in `lib/rce.ts`) - geen externe
netwerkafhankelijkheid meer, en de brondata in plaats van een kopie.

De serverroute vereist de Vinext Cloudflare Worker-runtime. De statische
GitHub Pages-export is om die reden verwijderd; de applicatie draait
sindsdien uitsluitend op Cloudflare Workers, gebouwd en gedeployed via
GitHub Actions (`.github/workflows/deploy-workers.yml`).
