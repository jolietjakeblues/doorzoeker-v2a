# Status verticale slices

Gecontroleerd op 11 augustus 2026 tegen de statussecties van de afzonderlijke
documenten en de huidige testset. Slice 014 is er na deze laatste controle
nog bijgekomen.

| Slice | Onderwerp | Status |
| --- | --- | --- |
| 001 | Rijksmonumenten zoeken en bekijken | Geïmplementeerd, met bredere objectscope |
| 002 | Archeologisch onderzoek als eigen laag | Gebouwd en getest |
| 003 | Contextuele hulp | Gebouwd |
| 004 | Referentienetwerk-concepten | Eerste en latere conceptzoekstappen gebouwd; volledige conceptnavigatie niet gebouwd |
| 005 | Bibliotheek en literatuur | Gebouwd en live geverifieerd |
| 006 | Ruimtelijke relatie Rijksmonument en Werelderfgoed | Plan, niet gebouwd |
| 007 | Bouwgeschiedenis | Gebouwd en live geverifieerd |
| 008 | Vergelijkbare Rijksmonumenten | Fase 1 (functie) gebouwd; multidimensionale score nog plan |
| 009 | Architectportfolio | Gebouwd en live geverifieerd |
| 010 | Op deze dag | Gebouwd; cache verloopt veilig bij de volgende UTC-daggrens |
| 011 | In de buurt | Plan, niet gebouwd |
| 012 | Resultaten exporteren | Plan, niet gebouwd |
| 013 | Lange omschrijvingen inkorten | Gebouwd en live geverifieerd |
| 014 | "Verras me"-knop | Gebouwd, unit- en contracttests groen |

## Aandachtspunten

- Slice 004 is functioneel verder ontwikkeld dan de oorspronkelijke eerste
  schijf. De volledige thesaurusviewer en bredere/nauwere navigatie blijven
  buiten de huidige implementatie.
- Slice 006 vereist een ruimtelijke afleiding. De bron bevat geen directe
  relatie die zonder product- en performancekeuze kan worden aangesloten.
- Slice 008 moet eerst bepalen welke semantische dimensies “vergelijkbaar”
  maken en hoe diversiteit en uitlegbaarheid worden bewaakt.
- Slice 011 vereist een expliciete straal, maximum en prestatiemeting.
- Slice 012 vereist een besluit of alleen geladen resultaten of de volledige
  matchset worden geëxporteerd.

Deze index is documentatie. Hij stelt geen nieuwe uitvoervolgorde vast.
