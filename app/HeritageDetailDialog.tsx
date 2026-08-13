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
import { HeritageRelationSections } from "./HeritageRelationSections";

type DetailEnrichment = ReturnType<typeof useSelectedDetailEnrichment>;

type HeritageDetailDialogProps = {
  selected: Item;
  dialogRef: RefObject<HTMLElement | null>;
  enrichment: DetailEnrichment;
  onClose: () => void;
  onSearch: ReturnType<typeof useSearchState>["executeSearch"];
  onConceptSearch: ReturnType<typeof useSearchState>["executeConceptSearch"];
};

export function HeritageDetailDialog({
  selected,
  dialogRef: detailDialogRef,
  enrichment,
  onClose,
  onSearch,
  onConceptSearch,
}: HeritageDetailDialogProps) {
  const { complexMembers } = enrichment;
  const selectedIdentifier = primaryIdentifier(selected);
  const selectedIdentifierRepeatsTitle = Boolean(
    selectedIdentifier &&
      selected.title.trim().toLocaleLowerCase("nl") ===
        `${selectedIdentifier.label} ${selectedIdentifier.value}`.toLocaleLowerCase("nl"),
  );
  return (
    <div
      className="backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
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
          onClick={onClose}
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
                void onConceptSearch(concept, field)
              }
              onObjectSearch={(number) => void onSearch(number)}
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
                                void onConceptSearch(
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
              selected.groenaanleg.categorie ||
              selected.groenaanleg.image) ? (
              <div>
                <dt>Historische aanleg</dt>
                <dd>
                  {[
                    selected.groenaanleg.typeAanleg,
                    selected.groenaanleg.categorie,
                  ]
                    .filter(Boolean)
                    .join(" — ")}
                  {selected.groenaanleg.image ? (
                    <p className="detail-image-credit">
                      <img
                        src={selected.groenaanleg.image.url}
                        alt={`Historische aanleg bij ${selected.title}`}
                        className="groenaanleg-foto"
                      />
                      <small>
                        Foto groenaanleg — RCE Beeldbank
                        {selected.groenaanleg.image.license
                          ? ` (${selected.groenaanleg.image.license})`
                          : ""}
                        {selected.groenaanleg.image.sourceUrl ? (
                          <>
                            {" "}
                            ·{" "}
                            <a
                              href={selected.groenaanleg.image.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              bron
                            </a>
                          </>
                        ) : (
                          ""
                        )}
                      </small>
                    </p>
                  ) : null}
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
          <HeritageRelationSections
            selected={selected}
            enrichment={enrichment}
            onSearch={onSearch}
            onConceptSearch={onConceptSearch}
          />
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
                          void onConceptSearch(
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
                                  void onConceptSearch(
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
