# Status verticale slices

Gecontroleerd op 11 augustus 2026 tegen de statussecties van de afzonderlijke
documenten en de huidige testset. Slice 014 is er na deze laatste controle
nog bijgekomen; slices 015 en 016 op 14 augustus 2026, en slice 012 is op
diezelfde datum alsnog gebouwd. Slice 006 is op 18 augustus 2026 gebouwd
(live, per Rijksmonument, i.p.v. het oorspronkelijke offline-planontwerp);
slice 017 is op 19 augustus 2026 gepland én gebouwd (knop-en-
waarschuwing-UX, live geverifieerd tegen een Rijksmonument boven een
Romeins tempelcomplex).

| Slice | Onderwerp | Status |
| --- | --- | --- |
| 001 | Rijksmonumenten zoeken en bekijken | Geïmplementeerd, met bredere objectscope |
| 002 | Archeologisch onderzoek als eigen laag | Gebouwd en getest |
| 003 | Contextuele hulp | Gebouwd |
| 004 | Referentienetwerk-concepten | Eerste en latere conceptzoekstappen gebouwd; volledige conceptnavigatie niet gebouwd |
| 005 | Bibliotheek en literatuur | Gebouwd en live geverifieerd |
| 006 | Ruimtelijke relatie Rijksmonument ↔ Werelderfgoed/Gezicht | Gebouwd (live, lazy per geopend detail) |
| 007 | Bouwgeschiedenis | Gebouwd en live geverifieerd |
| 008 | Vergelijkbare Rijksmonumenten | Fase 1 (functie) gebouwd; multidimensionale score nog plan |
| 009 | Architectportfolio | Gebouwd en live geverifieerd |
| 010 | Op deze dag | Gebouwd; cache verloopt veilig bij de volgende UTC-daggrens |
| 011 | In de buurt | Plan, niet gebouwd |
| 012 | Resultaten exporteren | Gebouwd, unit- en e2e-tests groen |
| 013 | Lange omschrijvingen inkorten | Gebouwd en live geverifieerd |
| 014 | "Verras me"-knop | Gebouwd, unit- en contracttests groen |
| 015 | "Alle gekoppelde begrippen"-overzicht | Gebouwd, unit- en e2e-tests groen |
| 016 | "Ontdek een thema" (ontdekken zonder zoekterm, fase 1) | Gebouwd, e2e-test groen |
| 017 | Archeologische context bij een Rijksmonument (overlap met Onderzoeksgebied) | Gebouwd (knop + waarschuwing, geen lazy-patroon zoals slice 006) inclusief kaart met polygonen, live geverifieerd |
| 018 | Scheepswrakken (MASS-dataset) | Gebouwd en live geverifieerd (nieuwe, losstaande dataset/vocabulaire, met server-side HTML-sanitatie) |

## Aandachtspunten

- Slice 004 is functioneel verder ontwikkeld dan de oorspronkelijke eerste
  schijf. De volledige thesaurusviewer en bredere/nauwere navigatie blijven
  buiten de huidige implementatie.
- Slice 008 moet eerst bepalen welke semantische dimensies “vergelijkbaar”
  maken en hoe diversiteit en uitlegbaarheid worden bewaakt.
- Slice 011 vereist een expliciete straal, maximum en prestatiemeting.
- Slice 017: de onderliggende scan is te traag (15+s) voor het lazy-patroon
  dat slice 006 gebruikt, dus een bewust andere UX (knop + waarschuwing).
  Onderweg gebleken dat de exacte-overlap-query ook de GET-URL-lengtelimiet
  kon raken (414) - zelfde les als het oorspronkelijke Werelderfgoed-
  offlinescript - opgelost met POST voor die ene query.

Deze index is documentatie. Hij stelt geen nieuwe uitvoervolgorde vast.
