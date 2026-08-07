# Doorzoeker V2

Doorzoeker V2 wordt een moderne zoek- en ontdekapplicatie voor cultureel
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
  SPARQL en JSON-LD.
- **Termennetwerk:** zoeken en selecteren van gestandaardiseerde termen via de
  GraphQL API.
- **RCE-MCP:** queryontwikkeling, semantische uitleg en optionele
  AI-functionaliteit. MCP is niet de enige runtime-datalaag van de webapp.

## Eerste verticale slice

De eerste werkende doorsnede richt zich op rijksmonumenten:

1. zoeken op naam, adres, plaats en rijksmonumentnummer;
2. filteren op locatie, juridische status, monumentaard en oorspronkelijke
   functie;
3. resultaten tonen als lijst en op een kaart;
4. een detailpagina met kerngegevens, beschrijving, functie, status, locatie,
   geometrie en bron-URI;
5. zoektoestand vastleggen in een deelbare URL;
6. termen gebruiken voor suggesties en gecontroleerde zoekverfijning.

De functionele afbakening en acceptatiecriteria staan in
[`docs/vertical-slices/001-rijksmonumenten.md`](docs/vertical-slices/001-rijksmonumenten.md).

## Architectuur

Architectuurbesluiten worden als ADR's vastgelegd:

- [ADR-0001: schone herbouw](docs/adr/0001-schone-herbouw.md)
- [ADR-0002: hybride gegevensarchitectuur](docs/adr/0002-hybride-gegevensarchitectuur.md)

Een technologiestack wordt gekozen nadat een kleine technische spike de
RCE-query's, resultaatvormen, prestaties en kaartdata heeft gevalideerd.

## Repositorystructuur

```text
app/                   Applicatieroutes en componenten
public/                Publiek geserveerde afbeeldingen en iconen
tests/                 Geautomatiseerde tests
docs/
  adr/                 Architectuurbesluiten
  reference/           Ontwerp- en huisstijlbronnen
  vertical-slices/     End-to-end productdoorsneden
.github/workflows/     CI en Cloudflare Workers-publicatie
```

## Status

Initiatiefase. De scope en architectuur worden momenteel vastgesteld.

## Cloudflare Workers

Een push naar `main` bouwt en deployt de applicatie automatisch naar
Cloudflare Workers via GitHub Actions
([`.github/workflows/deploy-workers.yml`](.github/workflows/deploy-workers.yml)).
Dit vereist de repository-secrets `CLOUDFLARE_API_TOKEN` en
`CLOUDFLARE_ACCOUNT_ID`. Handmatig bouwen en deployen kan met:

```sh
npm run deploy
```
