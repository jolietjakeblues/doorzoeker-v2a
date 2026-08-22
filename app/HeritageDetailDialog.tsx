import type { RefObject } from "react";
import type { useSelectedDetailEnrichment } from "@/hooks/useSelectedDetailEnrichment";
import type { ArcheologischeContextState, useArcheologischeContext } from "@/hooks/useArcheologischeContext";
import type { useSearchState } from "@/hooks/useSearchState";
import {
  linkedConcepts,
  MONUMENT_REGISTER_BASE_URL,
  primaryIdentifier,
  statusLabel,
  truncateAtWordBoundary,
  typeBadge,
  type Item,
} from "@/lib/heritage-view-model";
import { wktToLatLng } from "@/lib/rce";
import { HeritageDetailFacts } from "./HeritageDetailFacts";
import { HeritageMap } from "./HeritageMap";
import { HeritageRelationSections } from "./HeritageRelationSections";

type DetailEnrichment = ReturnType<typeof useSelectedDetailEnrichment>;

type HeritageDetailDialogProps = {
  selected: Item;
  dialogRef: RefObject<HTMLElement | null>;
  enrichment: DetailEnrichment;
  archeologischeContext: ReturnType<typeof useArcheologischeContext>;
  onClose: () => void;
  onSearch: ReturnType<typeof useSearchState>["executeSearch"];
  onConceptSearch: ReturnType<typeof useSearchState>["executeConceptSearch"];
};

export function HeritageDetailDialog({
  selected,
  dialogRef: detailDialogRef,
  enrichment,
  archeologischeContext,
  onClose,
  onSearch,
  onConceptSearch,
}: HeritageDetailDialogProps) {
  const { complexMembers, ligtIn, omschrijvingOnderwerp, werelderfgoedGeometrie } = enrichment;
  const ligtInLoaded = ligtIn && ligtIn.monumentNumber === selected.monumentNumber ? ligtIn : undefined;
  const omschrijvingOnderwerpLoaded =
    omschrijvingOnderwerp && omschrijvingOnderwerp.choUri === selected.linkedDataUrl
      ? omschrijvingOnderwerp
      : undefined;
  // selected.wkt is al gevuld als dit item via tekstzoeken binnenkwam - dan
  // is er niets lazy geladen en valt dit terug op selected zelf.
  const werelderfgoedGeometrieLoaded =
    werelderfgoedGeometrie && werelderfgoedGeometrie.choUri === selected.linkedDataUrl
      ? werelderfgoedGeometrie
      : undefined;
  const selectedWithGeometry =
    selected.objectType === "Werelderfgoed" && werelderfgoedGeometrieLoaded?.wkt
      ? { ...selected, wkt: werelderfgoedGeometrieLoaded.wkt }
      : selected;
  const archeologischeContextState: ArcheologischeContextState =
    archeologischeContext.state.status !== "idle" &&
    archeologischeContext.state.monumentNumber !== selected.monumentNumber
      ? { status: "idle" }
      : archeologischeContext.state;
  const allLinkedConcepts = linkedConcepts(selected);
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
              <HeritageMap items={[selectedWithGeometry]} onSelect={() => {}} compact />
            </div>
          ) : null}
          <dl>
            <HeritageDetailFacts
              item={selected}
              omschrijvingOnderwerpConcepten={omschrijvingOnderwerpLoaded?.concepten}
              onConceptSearch={(concept, field) =>
                void onConceptSearch(concept, field)
              }
              onObjectSearch={(number) => void onSearch(number)}
            />
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
                      {complex.complexnummer ? (
                        <button
                          type="button"
                          className="concept-link"
                          onClick={() =>
                            void onSearch(complex.complexnummer!)
                          }
                        >
                          {complex.complexnaam ||
                            `Complex ${complex.complexnummer}`}
                        </button>
                      ) : (
                        complex.complexnaam || "Complex"
                      )}
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
            {ligtInLoaded?.werelderfgoed.length ? (
              <div>
                <dt>Onderdeel van Werelderfgoed</dt>
                <dd>
                  {ligtInLoaded.werelderfgoed.map((werelderfgoed, index) => (
                    <span key={werelderfgoed.werelderfgoednummer ?? index}>
                      <button
                        type="button"
                        className="concept-link"
                        onClick={() => void onSearch(werelderfgoed.naam)}
                      >
                        {werelderfgoed.naam}
                      </button>
                    </span>
                  ))}
                </dd>
              </div>
            ) : null}
            {ligtInLoaded?.gezicht.length ? (
              <div>
                <dt>Ligt in Rijksbeschermd gezicht</dt>
                <dd>
                  {ligtInLoaded.gezicht.map((gezicht, index) => (
                    <span key={gezicht.gezichtsnummer ?? index}>
                      <button
                        type="button"
                        className="concept-link"
                        onClick={() => void onSearch(gezicht.naam)}
                      >
                        {gezicht.naam}
                      </button>
                    </span>
                  ))}
                </dd>
              </div>
            ) : null}
            {selected.objectType === "Rijksmonument" &&
            selected.monumentAard === "Gebouwd" ? (
              <div>
                <dt>Archeologische context</dt>
                <dd>
                  {archeologischeContextState.status === "idle" ? (
                    <>
                      <button
                        type="button"
                        className="concept-link"
                        onClick={archeologischeContext.zoek}
                      >
                        Zoek archeologische context
                      </button>
                      <br />
                      <small>
                        Dit doorzoekt 112.000+ archeologische
                        onderzoeksgebieden en kan tot ~20 seconden duren.
                      </small>
                    </>
                  ) : null}
                  {archeologischeContextState.status === "loading" ? (
                    <small>
                      Doorzoekt 112.000+ archeologische
                      onderzoeksgebieden... Dit kan tot ~20 seconden duren.
                    </small>
                  ) : null}
                  {archeologischeContextState.status === "error" ? (
                    <>
                      <small>
                        Archeologische context kon niet worden geladen.
                      </small>
                      <br />
                      <button
                        type="button"
                        className="concept-link"
                        onClick={archeologischeContext.zoek}
                      >
                        Probeer opnieuw
                      </button>
                    </>
                  ) : null}
                  {archeologischeContextState.status === "done" &&
                  archeologischeContextState.gebieden.length ? (
                    <small>
                      {archeologischeContextState.gebieden.length === 1
                        ? "1 archeologisch onderzoeksgebied gevonden"
                        : `${archeologischeContextState.gebieden.length} archeologische onderzoeksgebieden gevonden`}
                      , zie hieronder.
                    </small>
                  ) : archeologischeContextState.status === "done" ? (
                    <small>
                      Geen archeologische context gevonden in de directe
                      omgeving.
                    </small>
                  ) : null}
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
          </dl>
          {selected.objectType === "Scheepswrak" && selected.omschrijvingHtml ? (
            <div className="map-object-list">
              <h3>Over dit scheepswrak</h3>
              {/* omschrijvingHtml is server-side gesaneerd (lib/server/
                  html-sanitize.ts) vóórdat het ooit de client bereikt - hier
                  alleen nog renderen, niet nogmaals vertrouwen als veilig
                  zonder die stap. */}
              <div
                className="scheepswrak-omschrijving"
                dangerouslySetInnerHTML={{ __html: selected.omschrijvingHtml }}
              />
              <p className="detail-image-credit">
                <small>
                  Bron: MASS (RCE), stand per 31-12-2025. Licentie:{" "}
                  {selected.licentieUrl ? (
                    <a href={selected.licentieUrl} target="_blank" rel="noreferrer">
                      CC BY-SA 4.0
                    </a>
                  ) : (
                    "CC BY-SA 4.0"
                  )}
                  .
                </small>
              </p>
            </div>
          ) : null}
          {archeologischeContextState.status === "done" &&
          archeologischeContextState.gebieden.length ? (
            <div className="map-object-list">
              <h3>Archeologische context</h3>
              <div className="detail-map">
                <HeritageMap
                  items={[
                    {
                      id: selected.id,
                      title: selected.title,
                      address: selected.address,
                      place: selected.place,
                      objectType: "Rijksmonument",
                      monumentAard: selected.monumentAard,
                      lat: selected.lat,
                      lng: selected.lng,
                      wkt: selected.wkt,
                      forceArea: true,
                    },
                    ...archeologischeContextState.gebieden.flatMap(
                      (gebied) => {
                        // gebied.wkt komt over het netwerk binnen (en kan uit een
                        // oudere cache-periode stammen waarin dit veld nog niet
                        // bestond) - dus ondanks het TS-type hier defensief
                        // controleren voordat wktToLatLng erop los gaat.
                        if (!gebied.wkt) return [];
                        const coords = wktToLatLng(gebied.wkt);
                        if (!coords) return [];
                        return [
                          {
                            id: gebied.onderzoeksgebiedUri,
                            title: `Onderzoeksgebied ${gebied.choNummer}`,
                            address: "",
                            place: gebied.omschrijving
                              ? truncateAtWordBoundary(gebied.omschrijving, 80)
                              : "",
                            objectType: "Onderzoeksgebied" as const,
                            lat: coords.lat,
                            lng: coords.lng,
                            wkt: gebied.wkt,
                          },
                        ];
                      },
                    ),
                  ]}
                  onSelect={() => {}}
                  compact
                />
              </div>
              <ul>
                {archeologischeContextState.gebieden.map((gebied) => (
                  <li key={gebied.onderzoeksgebiedUri}>
                    <button
                      type="button"
                      className="concept-link"
                      onClick={() => void onSearch(gebied.choNummer)}
                    >
                      {`Onderzoeksgebied ${gebied.choNummer}`}
                    </button>
                    {gebied.omschrijving ? (
                      <>
                        {" — "}
                        {truncateAtWordBoundary(gebied.omschrijving, 150)}
                      </>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
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
          {allLinkedConcepts.length ? (
            <div className="map-object-list">
              <h3>Alle gekoppelde begrippen</h3>
              <p>
                <small>
                  Elk begrip hieronder is een doorklik naar alle
                  erfgoedobjecten met precies datzelfde begrip.
                </small>
              </p>
              <ul>
                {allLinkedConcepts.map((concept) => (
                  <li key={`${concept.field}-${concept.uri}`}>
                    <button
                      type="button"
                      className="concept-link"
                      onClick={() =>
                        void onConceptSearch(
                          { uri: concept.uri, label: concept.label },
                          concept.field,
                        )
                      }
                      title={`Zoek alle erfgoedobjecten met ${concept.group.toLowerCase()}: ${concept.label}`}
                    >
                      {concept.group}: {concept.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="map-object-list">
            <h3>Brongegevens</h3>
            <dl>
              <div>
                <dt>Dataset</dt>
                <dd>{selected.official ? "RCE Linked Data" : "Voorbeelddata"}</dd>
              </div>
              {selectedIdentifier ? (
                <div>
                  <dt>Primaire identifier</dt>
                  <dd>
                    {selectedIdentifier.label} {selectedIdentifier.value}
                  </dd>
                </div>
              ) : null}
              {selected.linkedDataUrl ?? selected.sourceUrl ? (
                <div>
                  <dt>Object-URI</dt>
                  <dd>
                    <code>{selected.linkedDataUrl ?? selected.sourceUrl}</code>
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>
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
                  ? "Bekijk in de RCE Kennisbank"
                  : selected.objectType === "Scheepswrak"
                    ? "Bekijk op MASS (RCE)"
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
