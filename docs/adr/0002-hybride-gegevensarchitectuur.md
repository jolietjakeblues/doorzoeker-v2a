# ADR-0002: Hybride gegevensarchitectuur met verwisselbare adapters

- Status: voorgesteld
- Datum: 2026-08-06

## Context

De RCE biedt actuele Linked Data via opgeslagen REST-query's, SPARQL en
JSON-LD. Het Termennetwerk ontsluit gestandaardiseerde termen via GraphQL.
RCE-MCP biedt semantische hulpmiddelen en gevalideerde toegang voor AI-clients.

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
- Termennetwerk-adapter voor termen zoeken en selecteren;
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

