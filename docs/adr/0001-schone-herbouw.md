# ADR-0001: Doorzoeker V2 wordt een schone herbouw

- Status: geaccepteerd
- Datum: 2026-08-06

## Context

Doorzoeker V1 is gebouwd met .NET Framework 4.5, ASP.NET MVC 4, AngularJS 1.2,
directe SOLR-query's en de niet-open component RNA Remote. Deze stack en
koppelingen zijn niet geschikt als basis voor een nieuw productieplatform.

V1 bevat wel waardevolle productkennis over facetten, resultaatgroepering,
kaartweergave, thesaurusnavigatie en de presentatie van begrippen en
bronrecords.

## Besluit

V2 wordt in een afzonderlijke repository vanaf een lege codebasis ontwikkeld.
Er wordt geen applicatiecode, deployable binary of dependency uit V1
overgenomen.

V1 wordt gebruikt als bron voor:

- requirements en historische ontwerpbesluiten;
- terminologie en gebruikersscenario's;
- algoritmische referentie, bijvoorbeeld kaartclustering;
- regressiescenario's die functioneel nog relevant zijn.

## Gevolgen

- V1 en V2 hebben een ondubbelzinnige levenscyclus.
- Oude security- en dependencyrisico's komen niet ongemerkt in V2 terecht.
- Gewenst gedrag moet expliciet opnieuw worden gespecificeerd en getest.
- Historische functionaliteit wordt alleen overgenomen wanneer deze opnieuw is
  gevalideerd tegen huidige gebruikersbehoeften en databronnen.

