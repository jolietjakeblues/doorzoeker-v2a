# Doorzoeker V2

Doorzoeker V2 is een moderne zoek- en ontdekapplicatie voor cultureel
erfgoed. De applicatie combineert de RCE Linked Data-voorziening met het
Termennetwerk en kan RCE-MCP inzetten voor semantische en AI-ondersteunde
functies.

Deze repository is een schone herbouw. Er wordt geen code uit de historische
[Doorzoeker V1](https://github.com/jolietjakeblues/doorzoeker_v1) gekopieerd.

## Productdoel

Gebruikers moeten erfgoedinformatie kunnen vinden als zij precies weten wat ze
zoeken én relevante informatie kunnen ontdekken wanneer zij de juiste term,
classificatie of bron nog niet kennen.

De kern bestaat uit:

- vrij zoeken en gerichte filters;
- consistente presentatie van verschillende erfgoedobjecten;
- kaart- en lijstweergave;
- navigatie via gestandaardiseerde termen en semantische relaties;
- stabiele URI's als identiteit en herleidbare bronvermelding;
- deelbare zoekopdrachten en detailpagina's.

## Gegevensvoorzieningen

- **RCE Linked Data:** gezaghebbende object-, register- en kennisdata via REST,
  SPARQL en JSON-LD. Termsuggesties komen rechtstreeks uit RCE's eigen
  Referentienetwerk (de CHT- en ABR-thesauri, via dezelfde SPARQL-dienst) - niet
  via het externe Termennetwerk van Netwerk Digitaal Erfgoed, dat voor deze
  RCE-specifieke app een overbodige én (bij onderzoek) daadwerkelijk kapotte
  omweg bleek.
- **RCE-MCP:** queryontwikkeling, semantische uitleg en optionele
  AI-functionaliteit. MCP is niet de enige runtime-datalaag van de webapp.

## Huidige functionaliteit

De applicatie doorzoekt live RCE Linked Data en toont, naast rijksmonumenten,
ook Werelderfgoed, rijksbeschermde stads- en dorpsgezichten, Complexen (van
gebouwde rijksmonumenten) en archeologische Onderzoeksgebieden - dit laatste
een geheel eigen, van het monumentenregister losstaande dataset (zie
[`docs/vertical-slices/002-archeologisch-onderzoek.md`](docs/vertical-slices/002-archeologisch-onderzoek.md)):

1. zoeken op naam, adres, plaats, rijksmonumentnummer, woorden uit de
   formele omschrijving, of - voor onderzoeksgebieden - woonplaats en de
   vrije onderzoeksomschrijving;
2. filteren op monumentaard, provincie, gemeente/woonplaats, oorspronkelijke
   functie en matchbron;
3. resultaten tonen als lijst en op een kaart (met clustering; Werelderfgoed,
   Gezichten, archeologische terreinen en Onderzoeksgebieden als echte
   polygoon/multipolygoon, niet platgeslagen tot een punt);
4. een detailpagina met kerngegevens, beschrijving, functie, status, locatie,
   geometrie, kadastrale percelen en bron-URI's (Monumentenregister/UNESCO/
   Archis én RCE Linked Data);
5. verrijking met archeologische terreingegevens (Archis-monumentnummer,
   waardering), complexverbanden (hoofdobject/onderdeel, met doorklikbare
   ledenlijst per complex), een foto uit de RCE beeldbank (met licentie- en
   bronvermelding) en historische tuin-/parkaanleg (groenaanleg);
6. zoektoestand vastleggen in een deelbare URL;
7. termen gebruiken voor suggesties en gecontroleerde zoekverfijning.

Nog niet gebouwd: paginering boven de eerste 25 resultaten, en ruimtelijke
"ligt in"-relaties tussen monumenten en gezichten/werelderfgoed.

De functionele afbakening en acceptatiecriteria staan in
[`docs/vertical-slices/001-rijksmonumenten.md`](docs/vertical-slices/001-rijksmonumenten.md).

## Architectuur

Architectuurbesluiten worden als ADR's vastgelegd:

- [ADR-0001: schone herbouw](docs/adr/0001-schone-herbouw.md)
- [ADR-0002: hybride gegevensarchitectuur](docs/adr/0002-hybride-gegevensarchitectuur.md)
  (zie de "Implementatiestatus" daarin voor de huidige stand).

De technische spike is afgerond: de applicatie draait op vinext (Next.js App
Router-compatibele Vite-runtime) en Cloudflare Workers, met live RCE SPARQL-
en REST-aanroepen achter een eigen `/api/rce/search`-contract.

## Repositorystructuur

```text
app/                   Applicatieroutes en componenten
lib/                   Querybouw, parsing en de serveradapter naar RCE
worker/                Cloudflare Worker-entrypoint
public/                Publiek geserveerde afbeeldingen en iconen
tests/                 Geautomatiseerde tests
docs/
  adr/                 Architectuurbesluiten
  reference/           Ontwerp- en huisstijlbronnen
  vertical-slices/     End-to-end productdoorsneden
.github/workflows/     CI en Cloudflare Workers-publicatie
```

## Status

Live en in actief gebruik. Zie "Huidige functionaliteit" hierboven voor wat
werkt en wat nog ontbreekt.

## Cloudflare Workers

Een push naar `main` bouwt en deployt de applicatie automatisch naar
Cloudflare Workers via GitHub Actions
([`.github/workflows/deploy-workers.yml`](.github/workflows/deploy-workers.yml)).
Dit vereist de repository-secrets `CLOUDFLARE_API_TOKEN` en
`CLOUDFLARE_ACCOUNT_ID`. Handmatig bouwen en deployen kan met:

```sh
npm run deploy
```
