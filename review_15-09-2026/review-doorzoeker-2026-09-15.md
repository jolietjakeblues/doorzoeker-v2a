# Review Doorzoeker

Datum: 15 september 2026. Review van code en werking, zonder broncodewijzigingen.

## Conclusie

Doorzoeker heeft een bruikbare architectuur en veel geautomatiseerde controles. Alle 521 bestaande tests slagen. Toch bevestigen aanvullende controles zes fouten. Pak vooral de uitvoerroute en de betrouwbaarheid van de vraagantwoorden aan. Een geslaagde HTTP-aanroep betekent daar nu niet altijd dat de inhoud klopt.

## Reikwijdte en versie

- Lokaal project: `C:\AI\doorzoeker-v2a-standalone`.
- Geteste commit: `e3a7ba9be478c643aea50f304c43bbd721cd9c09`.
- GitHub HEAD tijdens de review: `480b34666c377e1785015150a967991cc4c8f0b7`.
- De vier bestanden waarop de zes bevindingen betrekking hebben, zijn inhoudelijk gelijk op beide commits. De volledige GitHub-versie is niet afzonderlijk gebouwd of getest.
- Bekeken: zoek- en URL-state, API-routes, adapters, SPARQL-verwerking, geometrie, Worker, bouwconfiguratie, CI en bestaande tests.
- De browsertests en aanvullende reproducties gebruiken gesimuleerde API-antwoorden. Er zijn geen betaalde Anthropic-aanroepen of schadelijke queries naar externe diensten verstuurd.
- Dit is een gerichte code- en functionele review, geen volledige penetratietest of controle van alle brondata.

## Bevindingen

P1 betekent: met voorrang oplossen. P2 betekent: concrete fout voor een volgende herstelronde.

### 1. P1: uitvoerroute dwingt geen veilige, begrensde SPARQL af

Locatie: [uitvoeren/route.ts, regel 24](C:/AI/doorzoeker-v2a-standalone/app/api/vraag/uitvoeren/route.ts:24).

De route controleert alleen of `query` een niet-lege string van maximaal 20.000 tekens is. Daarna gaat de invoer direct naar het RCE-endpoint. De validatie en begrenzing uit de generatiestap beschermen deze rechtstreeks aanroepbare route niet.

**Bevestigd:** een `SELECT` met `SERVICE <https://example.invalid/sparql>` en zonder `LIMIT` gaat ongewijzigd door naar de gesimuleerde upstream. De route geeft 200 terug.

**Gevolg:** bezoekers kunnen het bedoelde queryprofiel en de rijlimiet omzeilen. Welke federatieve of andere opdrachten RCE daadwerkelijk uitvoert, hangt af van de beveiliging van dat endpoint. Toegang tot interne systemen is niet aangetoond.

**Oplossing:** parseer iedere uitvoerquery, ook bewerkte queries. Sta alleen de benodigde leesqueryvormen toe, blokkeer of beperk `SERVICE` en datasetkeuzes, en begrens de buitenste resultatenset. Gebruik daarnaast een begrensde responsegrootte. Laat de generatiestap en uitvoerroute dezelfde controles gebruiken.

### 2. P1: antwoordprompt verwart een telling met het aantal resultaatrijen

Locatie: [vraag-adapter.ts, regel 182](C:/AI/doorzoeker-v2a-standalone/lib/server/vraag-adapter.ts:182) en [regel 199](C:/AI/doorzoeker-v2a-standalone/lib/server/vraag-adapter.ts:199).

`total = bindings.length` telt rijen. Een `COUNT`-query geeft doorgaans één rij met het werkelijke aantal in `aantal`.

**Bevestigd:** bij een resultaat met `aantal = 42` bevat de prompt de instructie: `Noem dan het totaal (1)`. De JSON bevat tegelijkertijd 42.

**Gevolg:** de assistent krijgt tegenstrijdige informatie en kan een onjuist aantal noemen. Het precieze live modelantwoord is niet getest; de fout in de invoer staat vast. Een telling per provincie heeft hetzelfde onderscheid tussen aantal groepen en aantal objecten.

**Oplossing:** geef de antwoordgenerator de querymodus en expliciete telwaarden mee. Onderscheid een losse telling, gegroepeerde telling en begrensde lijst. Noem het aantal opgehaalde lijstregels niet automatisch het totale aantal treffers.

### 3. P1: ruimtelijke terugval kan bestaande treffers als nul presenteren

Locatie: [vraag-adapter.ts, regel 155](C:/AI/doorzoeker-v2a-standalone/lib/server/vraag-adapter.ts:155).

De terugval verwijdert het ruimtelijke filter en verruimt `LIMIT`, maar voegt de benodigde geometrievariabelen niet toe aan `SELECT`. De lokale filterfunctie verwacht deze geometrieën wel in iedere resultaatrij. Een gewone lijstquery kan alleen `?rm` en `?nummer` selecteren. Een telling geeft alleen een aggregaat terug.

**Bevestigd:** na een gesimuleerde timeout levert de tweede query één monument zonder geprojecteerde geometrie. De lokale filterfunctie verwijdert de rij. De adapter retourneert succesvol een lege lijst.

**Gevolg:** een technische beperking wordt een inhoudelijk onjuist antwoord: geen treffers. Het aantal overgeslagen rijen verschijnt alleen in de serverlog.

**Oplossing:** maak een aparte kandidatenquery die objectidentiteit en beide geometrieën teruggeeft. Filter daarna lokaal en herstel vervolgens de oorspronkelijke projectie, deduplicatie, telling en limiet. Meld onvolledigheid of een fout wanneer een betrouwbare berekening niet mogelijk is.

### 4. P2: vervolgpagina uit een gedeelde URL wordt niet hersteld

Locatie: [useSearchState.ts, regel 485](C:/AI/doorzoeker-v2a-standalone/hooks/useSearchState.ts:485).

De URL-parser leest `pagina`, maar `restoreUrlState` gebruikt dit veld niet. De zoek- en browsefuncties beginnen weer bij pagina 1. Vervolgens overschrijft de URL-synchronisatie de oorspronkelijke pagina-informatie.

**Bevestigd in Chromium:** `/?q=Goirle&pagina=3` vraagt uitsluitend pagina 1 aan. De browser verwijdert daarna `pagina=3` uit de URL.

**Gevolg:** herladen, delen en browsergeschiedenis verliezen eerder geladen resultaten. Een geselecteerd object op een vervolgpagina kan daardoor ook niet terugkomen.

**Oplossing:** laad bij herstel de pagina's tot de gevraagde pagina, met behoud van de bestaande annulering en objectselectie. Wacht met het vervangen van de URL totdat herstel klaar is.

### 5. P2: reset annuleert een lopende zoekopdracht niet

Locatie: [useSearchState.ts, regel 509](C:/AI/doorzoeker-v2a-standalone/hooks/useSearchState.ts:509).

`reset()` leegt de schermstate, maar annuleert de actieve fetch niet en maakt het aanvraagnummer niet ongeldig. Het antwoord van de oude aanvraag slaagt daardoor nog steeds voor `isCurrent()`.

**Bevestigd in Chromium:** start een vertraagde zoekopdracht en klik direct op `Terug naar de startpagina`. Na ontvangst van het antwoord verschijnt het oude monument alsnog, terwijl de URL `/` blijft.

**Gevolg:** de startpagina toont oude zoekresultaten en scherm en URL spreken elkaar tegen.

**Oplossing:** voeg een expliciete annuleer-/ongeldigmaakfunctie toe aan de aanvraaghook en roep die vanuit reset aan. Reset daarbij ook de toestand van een lopende vervolgpagina.

### 6. P2: een LIMIT in een subquery omzeilt de buitenste limiet

Locatie: [postprocess.ts, regel 151](C:/AI/doorzoeker-v2a-standalone/lib/vraag/postprocess.ts:151).

`capListLimit` zoekt de eerste tekstuele `LIMIT`. Dat kan de limiet van een subquery zijn. Een begrensde subquery betekent niet dat de buitenste query begrensd is: aanvullende relaties kunnen het aantal rijen weer vermenigvuldigen.

**Bevestigd:** `SELECT ?s WHERE { { SELECT ?s WHERE { ?s ?p ?o } LIMIT 5 } ?s ?p2 ?o2 }` blijft ongewijzigd. Een buitenste `LIMIT 200` ontbreekt.

**Gevolg:** ook automatisch gegenereerde queries kunnen meer rijen opleveren dan de bedoelde grens. Dit probleem blijft bestaan als alleen de ontbrekende controle op de uitvoerroute wordt toegevoegd met dezelfde helper.

**Oplossing:** pas de buitenste query aan via een parserstructuur. Gebruik dezelfde aanpak bij het verruimen van limieten voor de ruimtelijke terugval.

## Uitgevoerde controles

| Controle | Uitkomst |
|---|---|
| TypeScript | Geslaagd |
| ESLint | Geen fouten; twee waarschuwingen over gewone img-elementen |
| Productiebuild | Geslaagd |
| Unit- en API-contracttests | 432 geslaagd |
| Gerenderde HTML en Worker-beveiliging | 4 geslaagd |
| Bestaande Chromium-interactietests | 85 geslaagd |
| Aanvullende API-/queryreproducties | Vier problemen bevestigd met mocks |
| Aanvullende browserreproducties | URL-herstel en resetprobleem bevestigd |

De afbeeldingwaarschuwingen staan in `HeritageDetailDialog.tsx:387` en `StartContent.tsx:84`. Dit zijn op zichzelf geen aangetoonde functionele fouten.

## Live werking

- De [startpagina](https://doorzoekerfgoed.nl/) gaf HTTP 200, gemeten op circa 0,6 seconde voor het HTTP-verzoek. Dit is geen meting van volledige browserlaadtijd.
- De [zoekopdracht op 14948](https://doorzoekerfgoed.nl/api/rce/search?q=14948&scope=core&page=1) gaf HTTP 200 na circa 20 seconden, met twee resultaten en `failedCategories: ["Rijksmonument", "Vondst"]`.
- Dat tweede antwoord is onvolledig. Deze ene meting onderbouwt geen uitspraak over structurele beschikbaarheid, maar laat wel zien waarom het zichtbaar melden van gedeeltelijke uitval nodig is.
- De live AI-keten, de productie-instellingen van Cloudflare en alle externe databronnen zijn niet volledig doorgelicht.

## Architectuur en onderhoud

**Wat goed is:** domeinmodules scheiden de erfgoedtypen; adapters houden bronaanroepen buiten de presentatie; concepten behouden hun URI en bron; verrijking gebeurt deels pas na het openen van details. Er bestaan controles voor annulering, gedeeltelijke uitval, HTML-sanering, export, kaartbediening en toetsenbordgebruik. CI en het publicatieproces voeren de bestaande controles uit.

**Waar verbetering nodig is:** de vraagfunctie gebruikt veel tekstuele herschrijvingen van SPARQL. Daardoor kunnen syntactisch geldige queries inhoudelijk veranderen of beschermingsregels omzeilen. Verplaats zulke bewerkingen naar de bestaande parser. Laat een inhoudelijke validatie ook na een herstelpoging opnieuw beslissen of uitvoering verantwoord is.

De zoekhook bundelt veel samenhangende state. Dat is begrijpelijk, maar resetten en herstellen moeten dezelfde aanvraagregels volgen als zoeken. De gevonden fouten wijzen vooral op ontbrekende tests voor overgangen tussen toestanden.

Exact conceptzoeken heeft daarnaast een functionele beperking: het stopt bij de begrensde eerste set en ondersteunt geen vervolgpagina. Behandel dit expliciet als beperkte dekking, zeker wanneer een termsuggestie een groter totaal toont.

De rate limiter noemt zichzelf terecht een lokale benadering per Worker-instance. Uit de broncode volgt geen wereldwijd kostenplafond voor de AI-functie. Controleer hiervoor apart de productie-instellingen; die zijn niet tijdens deze review opgevraagd.

## Aanpak

1. Begrens en valideer alle queries op de uitvoerroute. Los tegelijk de subquery-LIMIT-fout op.
2. Herstel tellingen en ruimtelijke terugval. Voeg tests toe met echte telstructuren, ontbrekende projecties en gegroepeerde resultaten.
3. Herstel URL-paginering en reset-annulering. Neem de twee browserreproducties op als regressietests.
4. Test daarna een kleine vaste set echte RCE-vragen en zoekopdrachten. Beoordeel behalve statuscodes ook volledigheid en betekenis van antwoorden.

## Reproductiebestanden

- [API- en querycontroles](C:/Users/enterprise/Documents/ChatGPT/Doorzoeker/review-repro.mjs): voer uit met `node review-repro.mjs` vanuit de reviewmap. Alle externe fetches zijn vervangen door mocks.
- [Browsercontroles](C:/Users/enterprise/Documents/ChatGPT/Doorzoeker/review-browser.mjs): verwacht een lokale ontwikkelserver op poort 3002. Alle `/api/`-antwoorden zijn gesimuleerd.
- [Scherm na reset](C:/Users/enterprise/Documents/ChatGPT/Doorzoeker/review-reset.png).

De scripts bevestigen het huidige foutgedrag. Na een oplossing moeten de assertions worden omgedraaid naar het gewenste gedrag. De broncode in jouw project is niet gewijzigd; build- en testuitvoer is wel aangemaakt.

