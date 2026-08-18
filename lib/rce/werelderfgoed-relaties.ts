import relaties from "../../data/werelderfgoed-rijksmonumenten.json" with { type: "json" };

// Verticale slice 006: de RCE-brondata modelleert geen ruimtelijke "ligt
// in"-relatie tussen Rijksmonument en Werelderfgoed (empirisch uitgesloten,
// zie docs/vertical-slices/006-werelderfgoed-ligt-in.md). De relatie is wel
// geometrisch te berekenen, maar te traag voor een live opzoeking (14+s voor
// één Werelderfgoed-gebied). Daarom wordt dit offline, eenmalig berekend
// door scripts/generate-werelderfgoed-relaties.mjs en hier als statisch
// bestand geïmporteerd - geen SPARQL-aanroep, geen nieuwe enrich.*-fase.
export type WerelderfgoedLidmaatschap = { werelderfgoednummer: string; naam: string };
export type WerelderfgoedRelaties = Record<string, WerelderfgoedLidmaatschap[]>;

// Array per rijksmonumentnummer, niet een los object: een Rijksmonument zou
// in theorie (nog niet empirisch tegengekomen) binnen meer dan één
// Werelderfgoed-gebied kunnen vallen.
const WERELDERFGOED_RELATIES = relaties as WerelderfgoedRelaties;

// Puur functioneel en los van de geïmporteerde data, zodat dit met een
// kleine, ingebakken voorbeeld-dataset unit te testen is (zie
// tests/werelderfgoed-relaties.test.mjs) zonder het echte, gegenereerde
// bestand te hoeven namaken in een test.
export function findWerelderfgoedLidmaatschap(
  relaties: WerelderfgoedRelaties,
  monumentNumber: string | undefined,
): WerelderfgoedLidmaatschap[] | undefined {
  if (!monumentNumber) return undefined;
  return relaties[monumentNumber];
}

export function lookupWerelderfgoedLidmaatschap(monumentNumber: string | undefined): WerelderfgoedLidmaatschap[] | undefined {
  return findWerelderfgoedLidmaatschap(WERELDERFGOED_RELATIES, monumentNumber);
}
