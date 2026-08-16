import type { useSearchState } from "@/hooks/useSearchState";
import type { useSelectedDetailEnrichment } from "@/hooks/useSelectedDetailEnrichment";
import type { ConceptField, Item } from "@/lib/heritage-view-model";

type DetailEnrichment = ReturnType<typeof useSelectedDetailEnrichment>;
type Concept = { uri: string; label: string };

type HeritageRelationSectionsProps = {
  selected: Item;
  enrichment: DetailEnrichment;
  onSearch: ReturnType<typeof useSearchState>["executeSearch"];
  onConceptSearch: (concept: Concept, field?: ConceptField) => void;
};

function countLabel(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function HeritageRelationSections({
  selected,
  enrichment,
  onSearch,
  onConceptSearch,
}: HeritageRelationSectionsProps) {
  const { complexMembers, onderzoeksgebiedVerrijking, vondstlocatieInhoud, vergelijkbareRijksmonumenten } = enrichment;
  return (
    <>
{selected.objectType === "Rijksmonument" &&
      vergelijkbareRijksmonumenten &&
      vergelijkbareRijksmonumenten.conceptUri === selected.functionConcepts?.[0]?.uri &&
      (vergelijkbareRijksmonumenten.items.length || vergelijkbareRijksmonumenten.error) ? (
        <div className="map-object-list">
          <h3>Vergelijkbare rijksmonumenten</h3>
          {vergelijkbareRijksmonumenten.error ? (
            <p>
              Vergelijkbare rijksmonumenten konden niet worden geladen.
              Probeer het later opnieuw.
            </p>
          ) : (
            <>
              <p><small>Zelfde functie: {vergelijkbareRijksmonumenten.conceptLabel}</small></p>
              <ul>
                {vergelijkbareRijksmonumenten.items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => void onSearch(item.monumentNumber ?? item.id)}
                    >
                      {item.title}
                    </button>
                    {item.place ? ` — ${item.place}` : ""}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      ) : null}
      {selected.objectType === "Complex" &&
      complexMembers &&
      complexMembers.complexUri === selected.linkedDataUrl &&
      (complexMembers.members.length || complexMembers.error) ? (
        <div className="map-object-list">
          <h3>Onderdelen van dit complex</h3>
          {complexMembers.error ? (
            <p>
              Onderdelen van dit complex konden niet worden geladen.
              Probeer het later opnieuw.
            </p>
          ) : (
            <ul>
              {complexMembers.members.map((member) => (
                <li key={member.choUri}>
                  <button
                    type="button"
                    onClick={() =>
                      void onSearch(member.monumentNumber)
                    }
                  >
                    {member.name}
                    {member.isHoofdobject ? " — hoofdobject" : ""}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
      {selected.objectType === "Onderzoeksgebied" &&
      onderzoeksgebiedVerrijking &&
      onderzoeksgebiedVerrijking.gebiedUri ===
        selected.linkedDataUrl ? (
        <div className="map-object-list">
          <h3>Archeologisch onderzoek binnen dit gebied</h3>
          {onderzoeksgebiedVerrijking.complexen.length ? (
            <ul>
              {onderzoeksgebiedVerrijking.complexen.map((complex) => (
                <li key={complex.complexUri}>
                  <button
                    type="button"
                    onClick={() => void onSearch(complex.choNumber)}
                  >
                    {complex.typeLabel ||
                      `Archeologisch complex ${complex.choNumber}`}
                  </button>
                  {complex.typeLabel ? (
                    <small> (CHO {complex.choNumber})</small>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
          {onderzoeksgebiedVerrijking.vondstlocaties.length ? (
            <ul>
              {onderzoeksgebiedVerrijking.vondstlocaties.map((vl) => (
                <li key={vl.vlUri}>
                  <button
                    type="button"
                    onClick={() => void onSearch(vl.choNumber)}
                  >
                    {vl.locatienaam || `Vondstlocatie ${vl.choNumber}`}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <p>
            {onderzoeksgebiedVerrijking.error
              ? "Archeologisch onderzoek binnen dit gebied kon niet worden geladen. Probeer het later opnieuw."
              : onderzoeksgebiedVerrijking.vondstlocatieTotaal
                ? `${countLabel(onderzoeksgebiedVerrijking.vondstlocatieTotaal, "vondstlocatie", "vondstlocaties")}${onderzoeksgebiedVerrijking.vondstlocatieTotaal > onderzoeksgebiedVerrijking.vondstlocaties.length ? ` (eerste ${onderzoeksgebiedVerrijking.vondstlocaties.length} getoond)` : ""}, ${countLabel(onderzoeksgebiedVerrijking.grondsporenTotaal, "grondspoor", "grondsporen")}, ${countLabel(onderzoeksgebiedVerrijking.vondstenTotaal, "vondst", "vondsten")}${onderzoeksgebiedVerrijking.complexenViaVondstlocatieTotaal ? ` en ${countLabel(onderzoeksgebiedVerrijking.complexenViaVondstlocatieTotaal, "archeologisch complex", "archeologische complexen")}` : ""} binnen dit gebied.`
                : "Geen gekoppeld archeologisch onderzoek gevonden voor dit gebied."}
          </p>
        </div>
      ) : null}
      {selected.objectType === "Vondstlocatie" &&
      vondstlocatieInhoud &&
      vondstlocatieInhoud.locatieUri === selected.linkedDataUrl ? (
        <div className="map-object-list">
          <h3>Wat hier is aangetroffen</h3>
          <p>
            {vondstlocatieInhoud.error
              ? "Wat hier is aangetroffen kon niet worden geladen. Probeer het later opnieuw."
              : `${countLabel(vondstlocatieInhoud.complexenTotaal, "archeologisch complex", "archeologische complexen")}, ${countLabel(vondstlocatieInhoud.vondstenTotaal, "vondstgroep", "vondstgroepen")} en ${countLabel(vondstlocatieInhoud.grondsporenTotaal, "grondspoorgroep", "grondspoorgroepen")}.`}
          </p>
          {vondstlocatieInhoud.complexen.length ? (
            <>
              <h4>Archeologische complexen</h4>
              <ul>
                {vondstlocatieInhoud.complexen.map((complex) => (
                  <li key={complex.uri}>
                    {complex.type ? (
                      <>
                        <button
                          type="button"
                          className="concept-link"
                          onClick={() => onConceptSearch(complex.type!, "archeologischcomplextype")}
                          title="Zoek alle archeologische complexen van dit type"
                        >
                          {complex.type.label}
                        </button>
                        {complex.type.schemes?.length ? <small> ({complex.type.schemes.map((scheme) => scheme.label).join(" · ")})</small> : null}
                        {" — "}
                      </>
                    ) : null}
                    <button type="button" onClick={() => void onSearch(complex.choNumber)}>
                      {complex.type ? `Complex ${complex.choNumber}` : `Archeologisch complex ${complex.choNumber}`}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {vondstlocatieInhoud.vondsten.length ? (
            <>
              <h4>Vondsten</h4>
              <ul>
                {vondstlocatieInhoud.vondsten.map((vondst) => {
                  // "stijl" heeft (nog) geen exacte conceptzoekroute in de
                  // app (geen ConceptField, geen backend-ondersteuning) -
                  // blijft daarom platte tekst, in tegenstelling tot type,
                  // materiaal en toestand die dat al wel hebben.
                  const begrippen: { concept: typeof vondst.types[number]; field?: ConceptField }[] = [
                    ...vondst.types.map((concept) => ({ concept, field: "vondsttype" as const })),
                    ...vondst.materialen.map((concept) => ({ concept, field: "materiaal" as const })),
                    ...vondst.stijlen.map((concept) => ({ concept, field: undefined })),
                    ...(vondst.toestand ? [{ concept: vondst.toestand, field: "toestand" as const }] : []),
                  ];
                  return (
                    <li key={vondst.uri}>
                      <button type="button" onClick={() => void onSearch(vondst.choNumber)}>
                        {vondst.archisVondstnummer ? `Archis-vondst ${vondst.archisVondstnummer}` : `Vondst ${vondst.choNumber}`}
                      </button>
                      {vondst.aantal ? ` — ${countLabel(vondst.aantal, "exemplaar", "exemplaren")}` : ""}
                      {begrippen.length ? (
                        <small>
                          {" — "}
                          {begrippen.map((entry, index) => (
                            <span key={`${entry.concept.uri}-${index}`}>
                              {index ? " · " : ""}
                              {entry.field ? (
                                <button type="button" className="concept-link" onClick={() => onConceptSearch(entry.concept, entry.field)}>
                                  {entry.concept.label}
                                </button>
                              ) : (
                                entry.concept.label
                              )}
                              {entry.concept.schemes?.length ? ` (${entry.concept.schemes.map((scheme) => scheme.label).join(", ")})` : ""}
                            </span>
                          ))}
                        </small>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </>
          ) : null}
          {vondstlocatieInhoud.grondsporen.length ? (
            <>
              <h4>Grondsporen</h4>
              <ul>
                {vondstlocatieInhoud.grondsporen.map((spoor) => (
                  <li key={spoor.uri}>
                    <button type="button" onClick={() => void onSearch(spoor.choNumber)}>
                      {spoor.type?.label || `Grondsporen ${spoor.choNumber}`}
                    </button>
                    {spoor.aantal ? ` — ${countLabel(spoor.aantal, "spoor", "sporen")}` : ""}
                    {spoor.type?.schemes?.length ? <small>{spoor.type.schemes.map((scheme) => scheme.label).join(" · ")}</small> : null}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {vondstlocatieInhoud.complexenTotaal > vondstlocatieInhoud.complexen.length || vondstlocatieInhoud.vondstenTotaal > vondstlocatieInhoud.vondsten.length || vondstlocatieInhoud.grondsporenTotaal > vondstlocatieInhoud.grondsporen.length ? (
            <p><small>Per onderdeel worden maximaal 25 records getoond.</small></p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
