# Rework-bevindingen

Dit is de korte lijst met fouten die tijdens het handmatig testen zijn gevonden.
Ze worden pas opgepakt wanneer ze aan de beurt zijn, zodat lopend Rework-werk
niet wordt onderbroken.

## Open

- **Groenaanleg blijft actief na een vervolgzoekactie met nul treffers.**
  Reproductie: open rijksmonument `517912`, kies de architect, kies daarna
  `Goirle` en klik linksonder op `Groenaanleg`. De zoekopdracht levert nul
  resultaten op, maar het filter blijft zichtbaar terwijl er niets meer te
  selecteren is.

## Afgerond en gecontroleerd

- De interface en resultaatkaarten behandelen Rijksmonumenten, complexen,
  gebieden en Werelderfgoed als verschillende erfgoedtypen.
- Filters tonen alleen keuzes die bij het gekozen objecttype passen. De
  tellingen zijn duidelijk aangeduid als tellingen binnen de geladen
  resultaten.
- Zoekopdracht, filters, pagina, gekozen object, weergave en kaartpositie zijn
  via de URL opnieuw te openen.
- Een gekozen thesaurusterm behoudt zijn canonieke URI en bron in de gedeelde
  URL, ook wanneer de zoekactie zelf als gewone tekstzoekopdracht wordt
  uitgevoerd.
- De zoekbalk bevraagt CHT, ABR én Referentienetwerk 2 als thesaurusbronnen.
  Bij RN2 blijft ook het concrete `skos:inScheme` bewaard en zichtbaar; RN2 is
  tegelijk de identiteitslaag waarmee delen van de objectdata zijn gekoppeld.
- Browser-terug en -vooruit herstellen eerdere zoekopdrachten. Kleine
  wijzigingen binnen een zoekopdracht, zoals filteren of de kaart verschuiven,
  blijven binnen dezelfde geschiedenisstap.
- Het detailpaneel sluit met Escape, houdt de toetsenbordfocus binnen het
  paneel en zet de focus na sluiten terug.
- De primaire zoek-, filter-, detail- en kaartflows draaien als browsertests in
  CI.
