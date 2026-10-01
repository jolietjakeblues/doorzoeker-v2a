# Hercontrole Doorzoeker

## Oordeel

De herstelronde verhelpt meerdere oorspronkelijke fouten, maar is nog niet afgerond. Drie problemen blijven aantoonbaar aanwezig. Alle 544 bestaande tests slagen; de aanvullende reproducties hieronder vallen buiten die tests.

Getest: lokale commit `dd647f70b357d31983420662c6d2b725947884f0` in `C:\AI\doorzoeker-v2a-standalone`. Vergeleken met `480b346`, inclusief herstelcommit `195752d`. Geen broncode gewijzigd. De al aanwezige, niet gevolgde map `review_15-09-2026` is ongemoeid gelaten.

## Resterende bevindingen

### P1: SERVICE binnen EXISTS passeert de beveiliging

[query-guard.ts:55](C:/AI/doorzoeker-v2a-standalone/lib/vraag/query-guard.ts:55)

De controle doorloopt alleen `patterns` en `where`. Een `EXISTS`-expressie bevat ook een querypatroon, maar dat pad wordt niet bezocht. Expressies in de SELECT-projectie worden evenmin onderzocht.

Reproductie:

```sparql
SELECT ?s WHERE {
  ?s ?p ?o
  FILTER EXISTS {
    SERVICE <https://example.invalid/sparql> { ?a ?b ?c }
  }
}
```

De echte uitvoerroute accepteert deze query, voegt `LIMIT 200` toe en stuurt hem door naar de gesimuleerde upstream. Ook een `EXISTS` in de SELECT-projectie passeert de helper. De rechtstreekse SERVICE-variant uit de eerste review wordt nu wel geweigerd.

**Gevolg:** de aangekondigde uitsluiting van federatieve queries is te omzeilen. Of een externe dienst die query daadwerkelijk uitvoert, is niet getest. Er is geen schadelijke query naar RCE verstuurd.

**Herstel:** doorloop de volledige parserboom, inclusief expressies in FILTER, BIND, SELECT, HAVING en ORDER BY. Voeg regressietests toe voor SERVICE binnen EXISTS en NOT EXISTS op meerdere posities.

### P1: ruimtelijke terugval verliest telling, projectie en oorspronkelijke limiet

[vraag-adapter.ts:170](C:/AI/doorzoeker-v2a-standalone/lib/server/vraag-adapter.ts:170) en [regel 199](C:/AI/doorzoeker-v2a-standalone/lib/server/vraag-adapter.ts:199)

De terugval vervangt de SELECT-projectie door `*`. Daarmee zijn geometrieën voor een eenvoudige lijstquery beschikbaar. Na de lokale filtering wordt de oorspronkelijke queryvorm echter niet hersteld. De adapter knipt altijd af op 200 rijen.

**Bevestigd met een gesimuleerde timeout en 250 geldige kandidaten binnen het gebied:**

- Een oorspronkelijke `COUNT(DISTINCT ?rm) AS ?aantal` levert 200 detailrijen terug, zonder kolom `aantal`.
- Een oorspronkelijke lijst met `LIMIT 5` levert eveneens 200 rijen terug.

Bij de telling valt de antwoordgenerator vervolgens terug op het aantal rijen, omdat `aantal` ontbreekt. Daardoor blijft een onjuist antwoord mogelijk ondanks het herstel van de gewone telprompt. Geprojecteerde aliassen en gegroepeerde tellingen vragen eveneens expliciete reconstructie.

**Herstel:** gebruik een aparte kandidatenquery, voer de ruimtelijke filtering uit en herstel daarna de oorspronkelijke aggregatie, projectie, deduplicatie, volgorde en limiet. Geef een duidelijke fout wanneer een queryvorm niet betrouwbaar lokaal kan worden herberekend.

### P2: begrenzen van LIMIT kan geldige SPARQL ongeldig maken

[query-guard.ts:94](C:/AI/doorzoeker-v2a-standalone/lib/vraag/query-guard.ts:94)

De helper leest de buitenste limiet via de parser, maar vervangt hem met een regex die vereist dat `LIMIT n` helemaal achteraan staat.

Geldige invoer:

```sparql
SELECT ?s WHERE { ?s ?p ?o } LIMIT 500 OFFSET 10
```

Uitvoer:

```sparql
SELECT ?s WHERE { ?s ?p ?o } LIMIT 500 OFFSET 10
LIMIT 200
```

Dezelfde fout treedt op bij `LIMIT 500 # comment`. De geïnstalleerde parser accepteert beide oorspronkelijke queries en verwerpt de herschreven versies.

**Gevolg:** een geldige bewerkte query faalt door de beveiligingsbewerking. De uitvoerroute controleert de syntax niet opnieuw na deze bewerking.

**Herstel:** wijzig de buitenste querylimiet structureel, met behoud van OFFSET, commentaar en eventuele afsluitende VALUES. Valideer ook de uiteindelijke query. Het oorspronkelijke subqueryvoorbeeld uit de review krijgt inmiddels wel correct een buitenste LIMIT.

## Status van de zes eerdere bevindingen

| Eerdere bevinding | Hercontrole |
|---|---|
| Onbegrensde uitvoerroute | Gedeeltelijk opgelost; SELECT-beperking en directe SERVICE-blokkade werken, EXISTS omzeilt de blokkade |
| Telling verward met aantal rijen | Opgelost voor reguliere telresultaten met `aantal`; ruimtelijke tellingen blijven apart problematisch |
| Ruimtelijke terugval meldt onterecht nul | Gedeeltelijk opgelost; eenvoudige projectie krijgt geometrieën, oorspronkelijke resultaatvorm wordt niet hersteld |
| Pagina 3 uit URL wordt niet hersteld | Oorspronkelijke tekstzoekreproductie opgelost; nieuwe browsertest slaagt |
| Oude resultaten verschijnen na reset | Oorspronkelijke reproductie opgelost; annulering en ongeldigmaking toegevoegd, browsertest slaagt |
| Subquery-LIMIT omzeilt buitenste limiet | Oorspronkelijke reproductie opgelost; nieuwe fout bij OFFSET/commentaar hierboven |

## Controles

| Controle | Resultaat |
|---|---|
| TypeScript | Geslaagd |
| ESLint | Geen fouten; dezelfde twee img-waarschuwingen |
| Productiebuild | Geslaagd |
| Unit- en API-tests | 453 geslaagd |
| HTML- en Worker-tests | 4 geslaagd |
| Chromium-browsertests | 87 geslaagd |
| Aanvullende reproducties | Drie resterende problemen bevestigd |

De browser- en API-tests gebruiken gesimuleerde antwoorden. De live publicatie en betaalde AI-keten zijn niet opnieuw gecontroleerd. Het oordeel geldt voor de genoemde lokale commit.

[Aanvullend reproductiescript](C:/Users/enterprise/Documents/ChatGPT/Doorzoeker/hercontrole-repro.mjs). Uitvoeren: `node hercontrole-repro.mjs`. Alle externe fetches zijn vervangen door mocks. Het script bevestigt het huidige gedrag; na herstel moeten de assertions voor de open bevindingen worden aangepast naar het gewenste gedrag.

**Advies:** herstel eerst de SERVICE-omweg en de ruimtelijke resultaatverwerking, daarna de LIMIT-herschrijving. Neem deze varianten op in de regressietests voordat je de review sluit.
