import type { RefObject } from "react";
import type { useSelectedDetailEnrichment } from "@/hooks/useSelectedDetailEnrichment";
import type { useSearchState } from "@/hooks/useSearchState";
import {
  MONUMENT_REGISTER_BASE_URL,
  primaryIdentifier,
  statusLabel,
  typeBadge,
  type Item,
} from "@/lib/heritage-view-model";
import { HeritageDetailFacts } from "./HeritageDetailFacts";
import { HeritageMap } from "./HeritageMap";

type DetailEnrichment = ReturnType<typeof useSelectedDetailEnrichment>;

type HeritageDetailDialogProps = {
  selected: Item;
  dialogRef: RefObject<HTMLElement | null>;
  enrichment: DetailEnrichment;
  onClose: () => void;
  onSearch: ReturnType<typeof useSearchState>["executeSearch"];
  onConceptSearch: ReturnType<typeof useSearchState>["executeConceptSearch"];
};

function countLabel(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function HeritageDetailDialog({
  selected,
  dialogRef: detailDialogRef,
  enrichment,
  onClose,
  onSearch,
  onConceptSearch,
}: HeritageDetailDialogProps) {
  const { complexMembers, onderzoeksgebiedVerrijking, vondstlocatieInhoud } = enrichment;
  const selectedIdentifier = primaryIdentifier(selected);
  const selectedIdentifierRepeatsTitle = Boolean(
    selectedIdentifier &&
      selected.title.trim().toLocaleLowerCase("nl") ===
        `${selectedIdentifier.label} ${selectedIdentifier.value}`.toLocaleLowerCase("nl"),
  );
  const setSelected = (item: Item | null) => { if (!item) onClose(); };
  const executeConceptSearch = onConceptSearch;
  const executeSearch = onSearch;

  return (
    <div
      className="backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setSelected(null);
      }}
    >
      <aside
        ref={detailDialogRef}
        className="detail"
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-title"
      >
        <button
          className="x"
          type="button"
          onClick={() => setSelected(null)}
          aria-label="Details sluiten"
        >
          ×
        </button>
        <div
          className={`detail-head ${typeBadge(selected).modifier}${selected.image ? " has-image" : ""}`.trim()}
          style={
            selected.image
              ? {
                  backgroundImage: `linear-gradient(0deg, #00000073, #00000073), url(${selected.image.url})`,
                }
              : undefined
          }
        >
          {selected.image ? (
            <span className="tile-badge large">
              {typeBadge(selected).letter}
            </span>
          ) : (
            <b>{typeBadge(selected).letter}</b>
          )}
          <small>{statusLabel(selected.objectType)}</small>
        </div>
        <div className="detail-copy">
          <p className="detail-guide">
            In dit venster: locatie, kenmerken, relaties en bronnen.
          </p>
          {!selectedIdentifierRepeatsTitle ? (
            <small>
              {selectedIdentifier?.label.toLocaleUpperCase("nl")}{" "}
              {selectedIdentifier?.value}
            </small>
          ) : null}
          <h2 id="detail-title">{selected.title}</h2>
          {selected.address !== "Adres niet opgenomen" ||
          selected.place ||
          selected.province ? (
            <p>
              {selected.address !== "Adres niet opgenomen"
                ? selected.address
                : null}
              {selected.address !== "Adres niet opgenomen" &&
              (selected.postalCode || selected.place) ? (
                <br />
              ) : null}
              {[selected.postalCode, selected.place]
                .filter(Boolean)
                .join(" ")}
              {selected.province ? `, ${selected.province}` : ""}
            </p>
          ) : null}
          <hr />
          <p>{selected.description}</p>
          {selected.objectType === "Complex" &&
          complexMembers &&
          complexMembers.complexUri === selected.linkedDataUrl &&
          complexMembers.members.some(
            (member) => member.lat != null && member.lng != null,
          ) ? (
            <div className="detail-map">
              <HeritageMap
                items={complexMembers.members.flatMap((member) =>
                  member.lat != null && member.lng != null
                    ? [
                        {
                          id: member.choUri,
                          title: member.name,
                          address: "",
                          place: "",
                          objectType: "Complex" as const,
                          lat: member.lat,
                          lng: member.lng,
                          wkt: member.wkt,
                          forceArea: true,
                        },
                      ]
                    : [],
                )}
                onSelect={() => {}}
                compact
              />
            </div>
          ) : selected.lat && selected.lng ? (
            <div className="detail-map">
              <HeritageMap items={[selected]} onSelect={() => {}} compact />
            </div>
          ) : null}
          <dl>
            <HeritageDetailFacts
              item={selected}
              onConceptSearch={(concept, field) =>
                void executeConceptSearch(concept, field)
              }
            />
            {selected.wkt && (
              <div>
                <dt>Geometrie</dt>
                <dd>
                  <details>
                    <summary>Toon ruwe WKT (WGS84)</summary>
                    <code>{selected.wkt}</code>
                  </details>
                </dd>
              </div>
            )}
            {selected.parcels?.length ? (
              <div>
                <dt>Kadastrale percelen</dt>
                <dd>
                  {selected.parcels.map((parcel) => (
                    <span
                      key={`${parcel.municipalityCode}-${parcel.section}-${parcel.parcelNumber}`}
                    >
                      {parcel.municipality} {parcel.section}{" "}
                      {parcel.parcelNumber}
                      {parcel.provinceCode
                        ? ` (${parcel.provinceCode})`
                        : ""}
                    </span>
                  ))}
                </dd>
              </div>
            ) : null}
            {selected.archaeologicalSites?.length ? (
              <div>
                <dt>Archeologisch terrein</dt>
                <dd>
                  {selected.archaeologicalSites.map((site, index) => (
                    <span key={site.archisMonumentnummer ?? index}>
                      {site.archisMonumentnummer
                        ? `Archis-monumentnummer ${site.archisMonumentnummer}`
                        : "Archis-monumentnummer onbekend"}
                      {site.waardering ? (
                        <>
                          {" "}
                          —{" "}
                          {site.waarderingConceptUri ? (
                            <button
                              type="button"
                              className="concept-link"
                              onClick={() =>
                                void executeConceptSearch(
                                  {
                                    uri: site.waarderingConceptUri!,
                                    label: site.waardering!,
                                  },
                                  "waardering",
                                )
                              }
                              title="Zoek alle rijksmonumenten met deze archeologische waardering"
                            >
                              {site.waardering}
                            </button>
                          ) : (
                            site.waardering
                          )}
                        </>
                      ) : (
                        ""
                      )}
                    </span>
                  ))}
                </dd>
              </div>
            ) : null}
            {selected.complexes?.length ? (
              <div>
                <dt>Onderdeel van complex</dt>
                <dd>
                  {selected.complexes.map((complex, index) => (
                    <span key={complex.complexnummer ?? index}>
                      {complex.complexnaam ||
                        (complex.complexnummer
                          ? `Complex ${complex.complexnummer}`
                          : "Complex")}
                      {complex.complexnummer && complex.complexnaam
                        ? ` (${complex.complexnummer})`
                        : ""}
                      {complex.role === "hoofdobject"
                        ? " — hoofdobject"
                        : ""}
                    </span>
                  ))}
                </dd>
              </div>
            ) : null}
            {selected.groenaanleg &&
            (selected.groenaanleg.typeAanleg ||
              selected.groenaanleg.categorie) ? (
              <div>
                <dt>Historische aanleg</dt>
                <dd>
                  {[
                    selected.groenaanleg.typeAanleg,
                    selected.groenaanleg.categorie,
                  ]
                    .filter(Boolean)
                    .join(" — ")}
                </dd>
              </div>
            ) : null}
            {selected.msp ? (
              <div>
                <dt>Monumenten Selectie Project</dt>
                <dd>
                  Aangewezen via het Monumenten Selectie Project (circa
                  1997-2002)
                </dd>
              </div>
            ) : null}
            <div>
              <dt>Bron</dt>
              <dd>
                {selected.official ? "RCE Linked Data" : "Voorbeelddata"}
              </dd>
            </div>
          </dl>
          {selected.image ? (
            <p className="detail-image-credit">
              <small>
                Foto
                {selected.image.title ? `: ${selected.image.title}` : ""} —
                RCE Beeldbank
                {selected.image.sourceUrl ? (
                  <>
                    {" "}
                    (
                    <a
                      href={selected.image.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      bron
                    </a>
                    )
                  </>
                ) : (
                  ""
                )}
                {selected.image.license ? (
                  <>
                    {" "}
                    ·{" "}
                    <a
                      href={selected.image.license}
                      target="_blank"
                      rel="noreferrer"
                    >
                      licentie
                    </a>
                  </>
                ) : (
                  ""
                )}
              </small>
            </p>
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
                      <a
                        href={complex.complexUri}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {complex.typeLabel ||
                          `Archeologisch complex ${complex.choNumber}`}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
              {onderzoeksgebiedVerrijking.vondstlocaties.length ? (
                <ul>
                  {onderzoeksgebiedVerrijking.vondstlocaties.map((vl) => (
                    <li key={vl.vlUri}>
                      <a href={vl.vlUri} target="_blank" rel="noreferrer">
                        {vl.locatienaam || `Vondstlocatie ${vl.choNumber}`}
                      </a>
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
                        <a href={complex.uri} target="_blank" rel="noreferrer">
                          {complex.type?.label || `Archeologisch complex ${complex.choNumber}`}
                        </a>
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
                          <a href={vondst.uri} target="_blank" rel="noreferrer">
                            {vondst.archisVondstnummer ? `Archis-vondst ${vondst.archisVondstnummer}` : `Vondst ${vondst.choNumber}`}
                          </a>
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
                        <a href={spoor.uri} target="_blank" rel="noreferrer">
                          {spoor.type?.label || `Grondsporen ${spoor.choNumber}`}
                        </a>
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
          {selected.literature?.length ? (
            <div className="map-object-list">
              <h3>Literatuur</h3>
              <ul>
                {selected.literature.map((ref) => (
                  <li key={ref.uri}>
                    {ref.sourceUrl ? (
                      <a
                        href={ref.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {ref.title}
                      </a>
                    ) : (
                      <span>{ref.title}</span>
                    )}
                    {ref.authors.length
                      ? ` — ${ref.authors.join(", ")}`
                      : ""}
                    {ref.year ? ` (${ref.year})` : ""}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {selected.gebeurtenissen?.length ? (
            <div className="map-object-list">
              <h3>Bouwgeschiedenis</h3>
              <ul>
                {selected.gebeurtenissen.map((gebeurtenis, index) => (
                  <li
                    key={`${gebeurtenis.naamConceptUri ?? gebeurtenis.naam}-${index}`}
                  >
                    {gebeurtenis.naamConceptUri ? (
                      <button
                        type="button"
                        className="concept-link"
                        onClick={() =>
                          void executeConceptSearch(
                            {
                              uri: gebeurtenis.naamConceptUri!,
                              label: gebeurtenis.naam,
                            },
                            "gebeurtenis",
                          )
                        }
                        title="Zoek alle rijksmonumenten met dit type gebeurtenis"
                      >
                        {gebeurtenis.naam}
                      </button>
                    ) : (
                      gebeurtenis.naam
                    )}
                    {gebeurtenis.beginDatum
                      ? ` — ${gebeurtenis.beginDatum.slice(0, 4)}${gebeurtenis.eindDatum && gebeurtenis.eindDatum.slice(0, 4) !== gebeurtenis.beginDatum.slice(0, 4) ? `–${gebeurtenis.eindDatum.slice(0, 4)}` : ""}`
                      : ""}
                    {gebeurtenis.actoren.length ? (
                      <>
                        {" "}
                        (
                        {gebeurtenis.actoren.map((actor, actorIndex) => (
                          <span key={`${actor.naam}-${actorIndex}`}>
                            {actorIndex > 0 ? ", " : ""}
                            {actor.actorConceptUri ? (
                              <button
                                type="button"
                                className="concept-link"
                                onClick={() =>
                                  void executeConceptSearch(
                                    {
                                      uri: actor.actorConceptUri!,
                                      label: actor.naam,
                                    },
                                    "actor",
                                  )
                                }
                                title="Zoek alle rijksmonumenten met deze actor"
                              >
                                {actor.naam}
                              </button>
                            ) : (
                              actor.naam
                            )}
                            {actor.rol ? ` — ${actor.rol}` : ""}
                          </span>
                        ))}
                        )
                      </>
                    ) : (
                      ""
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="detail-links">
            <a
              href={
                selected.sourceUrl ??
                `${MONUMENT_REGISTER_BASE_URL}${encodeURIComponent(selected.monumentNumber ?? selected.id)}`
              }
              target="_blank"
              rel="noreferrer"
            >
              {selected.objectType === "Werelderfgoed"
                ? "Bekijk op de UNESCO Werelderfgoedlijst"
                : selected.objectType === "Gezicht"
                  ? "Bekijk in het Archis-archief"
                  : selected.objectType === "Complex" ||
                      selected.objectType === "Archeologisch terrein" ||
                      selected.objectType === "Vondstlocatie" ||
                      selected.objectType === "Grondspoor" ||
                      selected.objectType === "Vondst" ||
                      selected.objectType === "Archeologisch complex" ||
                      selected.objectType === "Onderzoeksgebied"
                    ? "Bekijk in de RCE Linked Data"
                    : "Bekijk in het Monumentenregister"}{" "}
              <b>→</b>
            </a>
            {selected.linkedDataUrl &&
              selected.linkedDataUrl !== selected.sourceUrl && (
                <a
                  href={selected.linkedDataUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Bekijk in de RCE Linked Data <b>→</b>
                </a>
              )}
          </div>
          <blockquote>
            {selected.official
              ? "Gegevens uit de Linked Data Voorziening van de RCE."
              : "Voorbeeldrecord; nog niet alle gegevens zijn live gekoppeld."}
          </blockquote>
        </div>
      </aside>
    </div>
  );
}
