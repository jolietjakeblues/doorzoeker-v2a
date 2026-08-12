import type { useSearchState } from "@/hooks/useSearchState";
import type { useSelectedDetailEnrichment } from "@/hooks/useSelectedDetailEnrichment";
import type { Item } from "@/lib/heritage-view-model";

type DetailEnrichment = ReturnType<typeof useSelectedDetailEnrichment>;

type HeritageRelationSectionsProps = {
  selected: Item;
  enrichment: DetailEnrichment;
  onSearch: ReturnType<typeof useSearchState>["executeSearch"];
};

function countLabel(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function HeritageRelationSections({
  selected,
  enrichment,
  onSearch: executeSearch,
}: HeritageRelationSectionsProps) {
  const { complexMembers, onderzoeksgebiedVerrijking, vondstlocatieInhoud, vergelijkbareRijksmonumenten } = enrichment;
  return (
    <>
{selected.objectType === "Rijksmonument" &&
      vergelijkbareRijksmonumenten &&
      vergelijkbareRijksmonumenten.conceptUri === selected.functionConcepts?.[0]?.uri &&
      vergelijkbareRijksmonumenten.items.length ? (
        <div className="map-object-list">
          <h3>Vergelijkbare rijksmonumenten</h3>
          <p><small>Zelfde functie: {vergelijkbareRijksmonumenten.conceptLabel}</small></p>
          <ul>
            {vergelijkbareRijksmonumenten.items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => void executeSearch(item.monumentNumber ?? item.id)}
                >
                  {item.title}
                </button>
                {item.place ? ` — ${item.place}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {selected.objectType === "Complex" &&
      complexMembers &&
      complexMembers.complexUri === selected.linkedDataUrl &&
      complexMembers.members.length ? (
        <div className="map-object-list">
          <h3>Onderdelen van dit complex</h3>
          <ul>
            {complexMembers.members.map((member) => (
              <li key={member.choUri}>
                <button
                  type="button"
                  onClick={() =>
                    void executeSearch(member.monumentNumber)
                  }
                >
                  {member.name}
                  {member.isHoofdobject ? " — hoofdobject" : ""}
                </button>
              </li>
            ))}
          </ul>
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
                    onClick={() => void executeSearch(complex.choNumber)}
                  >
                    {complex.typeLabel ||
                      `Archeologisch complex ${complex.choNumber}`}
                  </button>
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
                    onClick={() => void executeSearch(vl.choNumber)}
                  >
                    {vl.locatienaam || `Vondstlocatie ${vl.choNumber}`}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <p>
            {onderzoeksgebiedVerrijking.vondstlocatieTotaal
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
            {countLabel(vondstlocatieInhoud.complexenTotaal, "archeologisch complex", "archeologische complexen")}, {countLabel(vondstlocatieInhoud.vondstenTotaal, "vondstgroep", "vondstgroepen")} en {countLabel(vondstlocatieInhoud.grondsporenTotaal, "grondspoorgroep", "grondspoorgroepen")}.
          </p>
          {vondstlocatieInhoud.complexen.length ? (
            <>
              <h4>Archeologische complexen</h4>
              <ul>
                {vondstlocatieInhoud.complexen.map((complex) => (
                  <li key={complex.uri}>
                    <button type="button" onClick={() => void executeSearch(complex.choNumber)}>
                      {complex.type?.label || `Archeologisch complex ${complex.choNumber}`}
                    </button>
                    {complex.type?.schemes?.length ? <small>{complex.type.schemes.map((scheme) => scheme.label).join(" · ")}</small> : null}
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
                  const begrippen = [...vondst.types, ...vondst.materialen, ...vondst.stijlen, ...(vondst.toestand ? [vondst.toestand] : [])];
                  return (
                    <li key={vondst.uri}>
                      <button type="button" onClick={() => void executeSearch(vondst.choNumber)}>
                        {vondst.archisVondstnummer ? `Archis-vondst ${vondst.archisVondstnummer}` : `Vondst ${vondst.choNumber}`}
                      </button>
                      {vondst.aantal ? ` — ${countLabel(vondst.aantal, "exemplaar", "exemplaren")}` : ""}
                      {begrippen.length ? (
                        <small> — {begrippen.map((concept) => `${concept.label}${concept.schemes?.length ? ` (${concept.schemes.map((scheme) => scheme.label).join(", ")})` : ""}`).join(" · ")}</small>
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
                    <button type="button" onClick={() => void executeSearch(spoor.choNumber)}>
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
