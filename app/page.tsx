"use client";

import { HeritageMap } from "./HeritageMap";
import { SiteHeader } from "./SiteHeader";
import { SearchHero } from "./SearchHero";
import { CardDescription, HeritageResultCard } from "./HeritageResultCard";
import { HeritageDetailFacts } from "./HeritageDetailFacts";
import {
  MONUMENT_REGISTER_BASE_URL,
  primaryIdentifier,
  statusLabel,
  typeBadge,
} from "@/lib/heritage-view-model";
import { useTermSuggestions } from "@/hooks/useTermSuggestions";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { useSelectedDetailEnrichment } from "@/hooks/useSelectedDetailEnrichment";
import { useSearchState } from "@/hooks/useSearchState";
import { useOpDezeDag } from "@/hooks/useOpDezeDag";

function countLabel(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export default function Home() {
  const {
    query,
    setQuery,
    active,
    view,
    setView,
    objectType,
    setObjectType,
    monumentAard,
    setMonumentAard,
    province,
    setProvince,
    municipality,
    setMunicipality,
    functionFilter,
    setFunctionFilter,
    matchSourceFilter,
    setMatchSourceFilter,
    excludedStatuses,
    toggleLegalStatus,
    clearExcludedStatuses,
    onlyGroenaanleg,
    setOnlyGroenaanleg,
    onlyMsp,
    setOnlyMsp,
    selected,
    setSelected,
    choose,
    filters,
    setFilters,
    remoteState,
    hasMore,
    loadingMore,
    baseResults,
    results,
    activeConceptUri,
    activeConceptVeld,
    executeSearch,
    executeConceptSearch,
    browseType,
    loadMore,
    reset,
  } = useSearchState();
  const {
    suggestions,
    suggestionsOpen,
    setSuggestionsOpen,
    activeSuggestion,
    setActiveSuggestion,
    commitSuggestion,
    handleQueryKeyDown,
  } = useTermSuggestions(query, active, setQuery);
  const { complexMembers, onderzoeksgebiedVerrijking } =
    useSelectedDetailEnrichment(selected);
  const opDezeDag = useOpDezeDag();
  useBodyScrollLock(Boolean(selected));
  const objectTypeResults =
    objectType === "Alle"
      ? baseResults
      : baseResults.filter((item) => item.objectType === objectType);
  const contextFunctions = [
    ...new Set(
      objectTypeResults
        .flatMap((item) => [
          ...(item.originalFunctionNames ?? []),
          ...(item.currentFunctionNames ?? []),
          item.kind,
        ])
        .filter((kind) => kind && kind !== "Functie niet opgenomen"),
    ),
  ].sort((a, b) => a.localeCompare(b, "nl"));
  const contextStatuses = [
    ...new Set(objectTypeResults.map((item) => statusLabel(item.objectType))),
  ];
  const contextMatchSources = [
    ...new Set(
      objectTypeResults
        .map((item) => item.matchSource)
        .filter((source): source is string => Boolean(source)),
    ),
  ];
  const includesRijksmonumenten = objectTypeResults.some(
    (item) => item.objectType === "Rijksmonument",
  );
  const contextProvinces = [
    ...new Set(objectTypeResults.map((item) => item.province).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b, "nl"));
  const contextMunicipalities = [
    ...new Set(
      objectTypeResults
        .filter((item) => province === "Alle" || item.province === province)
        .map((item) => item.municipality)
        .filter(Boolean),
    ),
  ].sort((a, b) => a.localeCompare(b, "nl"));
  // Architect-portfolio-koptekst (docs/vertical-slices/009-architect-portfolio.md):
  // geen aparte route of extra SPARQL-aanroep, alleen een rol-afleiding uit
  // de toch al meegestuurde gebeurtenissen-data van de huidige resultaten.
  const actorRoles =
    activeConceptVeld === "actor" && activeConceptUri
      ? [
          ...new Set(
            results
              .flatMap(
                (item) =>
                  item.gebeurtenissen?.flatMap((gebeurtenis) =>
                    gebeurtenis.actoren
                      .filter(
                        (actor) => actor.actorConceptUri === activeConceptUri,
                      )
                      .map((actor) => actor.rol),
                  ) ?? [],
              )
              .filter((rol): rol is string => Boolean(rol)),
          ),
        ]
      : [];
  const selectedIdentifier = selected ? primaryIdentifier(selected) : null;
  const selectedIdentifierRepeatsTitle = Boolean(
    selected &&
      selectedIdentifier &&
      selected.title.trim().toLocaleLowerCase("nl") ===
        `${selectedIdentifier.label} ${selectedIdentifier.value}`.toLocaleLowerCase(
          "nl",
        ),
  );

  return (
    <main>
      <SiteHeader onReset={reset} />
      <SearchHero
        query={query}
        setQuery={setQuery}
        suggestions={suggestions}
        suggestionsOpen={suggestionsOpen}
        setSuggestionsOpen={setSuggestionsOpen}
        activeSuggestion={activeSuggestion}
        setActiveSuggestion={setActiveSuggestion}
        commitSuggestion={commitSuggestion}
        handleQueryKeyDown={handleQueryKeyDown}
        remoteState={remoteState}
        onSearch={(term) => void executeSearch(term)}
        onBrowse={(kind) => void browseType(kind)}
      />
      {/* SearchHero owns the complete search introduction and combobox. */}
      <section className={`work ${!active ? "start" : ""}`}>
        <aside className={filters ? "show" : ""} aria-label="Zoekfilters">
          <div className="aside-title">
            <div>
              <small>VERFIJN</small>
              <h2>Filters</h2>
            </div>
            <button
              type="button"
              onClick={() => setFilters(false)}
              aria-label="Filters sluiten"
            >
              ×
            </button>
          </div>
          <fieldset>
            <legend>Soort object</legend>
            <details className="hint">
              <summary>Wat betekent dit?</summary>
              <p>
                Rijksmonument, Werelderfgoed, Gezicht, Complex en
                Onderzoeksgebied zijn vijf losse soorten object, geen varianten
                van hetzelfde. Werelderfgoed en Gezicht zijn gebieden waar de
                RCE verantwoordelijk voor is en die rijksmonumenten kunnen
                bevatten. Een Complex is zelf geen monument, maar een samenhang
                tussen meerdere rijksmonumenten. Een Onderzoeksgebied staat los
                van het monumentenregister.
              </p>
            </details>
            {[
              "Alle",
              "Rijksmonument",
              "Werelderfgoed",
              "Gezicht",
              "Complex",
              "Onderzoeksgebied",
            ].map((option) => (
              <label key={option}>
                <input
                  type="radio"
                  name="soort"
                  checked={objectType === option}
                  onChange={() => {
                    setObjectType(option);
                    setProvince("Alle");
                    setMunicipality("Alle");
                    clearExcludedStatuses();
                    if (option !== "Alle" && option !== "Rijksmonument") {
                      setMonumentAard("Alle");
                      setFunctionFilter("Alle");
                      setOnlyGroenaanleg(false);
                      setOnlyMsp(false);
                    }
                  }}
                />
                <span>{option === "Alle" ? "Alle soorten" : option}</span>
                <em>
                  {option === "Alle"
                    ? baseResults.length
                    : baseResults.filter((item) => item.objectType === option)
                        .length}
                </em>
              </label>
            ))}
          </fieldset>
          {includesRijksmonumenten &&
            (objectType === "Alle" || objectType === "Rijksmonument") && (
              <fieldset>
                <legend>Monumentaard</legend>
                <details className="hint">
                  <summary>Wat betekent dit?</summary>
                  <p>
                    Gebouwd of archeologisch geldt alleen voor Rijksmonumenten.
                    De andere soorten object hebben geen monumentaard.
                  </p>
                </details>
                {["Alle", "Gebouwd", "Archeologisch"].map((option) => (
                  <label key={option}>
                    <input
                      type="radio"
                      name="aard"
                      checked={monumentAard === option}
                      onChange={() => setMonumentAard(option)}
                    />
                    <span>
                      {option === "Alle" ? "Alle monumentaarden" : option}
                    </span>
                    <em>
                      {option === "Alle"
                        ? baseResults.filter(
                            (item) => item.objectType === "Rijksmonument",
                          ).length
                        : baseResults.filter(
                            (item) => item.monumentAard === option,
                          ).length}
                    </em>
                  </label>
                ))}
              </fieldset>
            )}
          {contextProvinces.length > 0 && (
            <fieldset>
              <legend>Provincie</legend>
              <label className="select-label">
                <span className="sr">Filter op provincie</span>
                <select
                  aria-label="Filter op provincie"
                  value={province}
                  onChange={(event) => {
                    setProvince(event.target.value);
                    setMunicipality("Alle");
                  }}
                >
                  <option value="Alle">
                    Alle provincies ({objectTypeResults.length})
                  </option>
                  {contextProvinces.map((option) => (
                    <option key={option} value={option}>
                      {option} (
                      {
                        objectTypeResults.filter(
                          (item) => item.province === option,
                        ).length
                      }
                      )
                    </option>
                  ))}
                </select>
              </label>
            </fieldset>
          )}
          {contextMunicipalities.length > 0 && (
            <fieldset>
              <legend>Gemeente / woonplaats</legend>
              <label className="select-label">
                <span className="sr">Filter op gemeente of woonplaats</span>
                <select
                  aria-label="Filter op gemeente of woonplaats"
                  value={municipality}
                  onChange={(event) => setMunicipality(event.target.value)}
                >
                  <option value="Alle">
                    Alle plaatsen (
                    {
                      objectTypeResults.filter(
                        (item) =>
                          province === "Alle" || item.province === province,
                      ).length
                    }
                    )
                  </option>
                  {contextMunicipalities.map((option) => (
                    <option key={option} value={option}>
                      {option} (
                      {
                        objectTypeResults.filter(
                          (item) =>
                            item.municipality === option &&
                            (province === "Alle" || item.province === province),
                        ).length
                      }
                      )
                    </option>
                  ))}
                </select>
              </label>
            </fieldset>
          )}
          {contextFunctions.length > 0 && (
            <fieldset>
              <legend>Functie</legend>
              <label className="select-label">
                <span className="sr">Filter op functie</span>
                <select
                  aria-label="Filter op functie"
                  value={functionFilter}
                  onChange={(event) => setFunctionFilter(event.target.value)}
                >
                  <option value="Alle">
                    Alle functies ({objectTypeResults.length})
                  </option>
                  {contextFunctions.map((option) => (
                    <option key={option} value={option}>
                      {option} (
                      {
                        objectTypeResults.filter((item) =>
                          [
                            item.kind,
                            ...(item.originalFunctionNames ?? []),
                            ...(item.currentFunctionNames ?? []),
                          ].includes(option),
                        ).length
                      }
                      )
                    </option>
                  ))}
                </select>
              </label>
            </fieldset>
          )}
          {contextMatchSources.length > 0 && (
            <fieldset>
              <legend>Gevonden via</legend>
              <details className="hint">
                <summary>Wat betekent dit?</summary>
                <p>
                  Matchbron laat zien via welk gegevensveld je zoekterm is
                  gevonden, bijvoorbeeld de functie, de omschrijving of de
                  plaats. Dat is niet per se de naam van het monument.
                </p>
              </details>
              <label className="select-label">
                <span className="sr">Filter op matchbron</span>
                <select
                  aria-label="Filter op matchbron"
                  value={matchSourceFilter}
                  onChange={(event) => setMatchSourceFilter(event.target.value)}
                >
                  <option value="Alle">Alle matchbronnen</option>
                  {contextMatchSources.map((option) => (
                    <option key={option} value={option}>
                      {option} (
                      {
                        objectTypeResults.filter(
                          (item) => item.matchSource === option,
                        ).length
                      }
                      )
                    </option>
                  ))}
                </select>
              </label>
            </fieldset>
          )}
          {objectType === "Alle" && contextStatuses.length > 1 && (
            <fieldset>
              <legend>Juridische status</legend>
              <details className="hint">
                <summary>Wat betekent dit?</summary>
                <p>
                  De status verschilt per soort object. Een Rijksmonument heeft
                  de status &ldquo;rijksmonument&rdquo;, Werelderfgoed en
                  Gezicht hebben hun eigen status, en een Complex of
                  Onderzoeksgebied is zelf geen aangewezen monument.
                </p>
              </details>
              {contextStatuses.map((label) => (
                <label key={label}>
                  <input
                    type="checkbox"
                    checked={!excludedStatuses.includes(label)}
                    onChange={() => toggleLegalStatus(label)}
                  />
                  <span>{label}</span>
                  <em>
                    {
                      baseResults.filter(
                        (item) => statusLabel(item.objectType) === label,
                      ).length
                    }
                  </em>
                </label>
              ))}
            </fieldset>
          )}
          {includesRijksmonumenten &&
            (objectTypeResults.some((item) => item.groenaanleg) ||
              objectTypeResults.some((item) => item.msp)) && (
              <fieldset>
                <legend>Kenmerken</legend>
                <details className="hint">
                  <summary>Wat betekent dit?</summary>
                  <p>
                    Historische aanleg (groenaanleg) betekent dat er een tuin-
                    of parkaanleg bij het monument hoort. Monumenten Selectie
                    Project verwijst naar een aanwijzingsronde van de RCE tussen
                    ongeveer 1997 en 2002, gericht op gebouwen uit 1850-1940.
                  </p>
                </details>
                {objectTypeResults.some((item) => item.groenaanleg) && (
                  <label>
                    <input
                      type="checkbox"
                      checked={onlyGroenaanleg}
                      onChange={(event) =>
                        setOnlyGroenaanleg(event.target.checked)
                      }
                    />
                    <span>Historische aanleg (groenaanleg)</span>
                    <em>
                      {
                        objectTypeResults.filter((item) => item.groenaanleg)
                          .length
                      }
                    </em>
                  </label>
                )}
                {objectTypeResults.some((item) => item.msp) && (
                  <label>
                    <input
                      type="checkbox"
                      checked={onlyMsp}
                      onChange={(event) => setOnlyMsp(event.target.checked)}
                    />
                    <span>Monumenten Selectie Project</span>
                    <em>
                      {objectTypeResults.filter((item) => item.msp).length}
                    </em>
                  </label>
                )}
              </fieldset>
            )}
          <button className="reset" type="button" onClick={reset}>
            Wis alle filters
          </button>
        </aside>
        <div className="results">
          <div className="toolbar">
            <div>
              <small>RESULTATEN</small>
              <h2 aria-live="polite">
                {activeConceptVeld === "actor" ? (
                  <>
                    {active}
                    <small>
                      {" "}
                      — {results.length} erfgoedobject
                      {results.length === 1 ? "" : "en"}
                      {actorRoles.length ? ` (${actorRoles.join(", ")})` : ""}
                    </small>
                  </>
                ) : (
                  <>
                    {results.length}{" "}
                    {results.length === 1 ? "resultaat" : "resultaten"}
                    {active ? ` voor “${active}”` : ""}
                  </>
                )}
              </h2>
            </div>
            <div>
              <button
                className="mobile-filter"
                type="button"
                onClick={() => setFilters(true)}
              >
                ☰ Filters
              </button>
              <span className="switch" aria-label="Weergave">
                <button
                  type="button"
                  className={view === "list" ? "on" : ""}
                  onClick={() => setView("list")}
                  aria-label="Lijstweergave"
                  aria-pressed={view === "list"}
                >
                  ☷
                </button>
                <button
                  type="button"
                  className={view === "map" ? "on" : ""}
                  onClick={() => setView("map")}
                  aria-label="Kaartweergave"
                  aria-pressed={view === "map"}
                >
                  ⌖
                </button>
              </span>
            </div>
          </div>
          {remoteState === "idle" ? (
            <>
              {opDezeDag && (
                <section className="op-deze-dag">
                  <small>OP DEZE DAG INGESCHREVEN</small>
                  <div className="cards">
                    <article>
                      <div
                        className={`tile ${typeBadge(opDezeDag).modifier}${opDezeDag.image ? " has-image" : ""}`.trim()}
                        style={
                          opDezeDag.image
                            ? { backgroundImage: `url(${opDezeDag.image.url})` }
                            : undefined
                        }
                      >
                        {opDezeDag.image ? (
                          <span className="tile-badge">
                            {typeBadge(opDezeDag).letter}
                          </span>
                        ) : (
                          <>
                            <b>{typeBadge(opDezeDag).letter}</b>
                            <small>RCE register</small>
                          </>
                        )}
                      </div>
                      <div className="copy">
                        <small>
                          {opDezeDag.kind}
                          <code>
                            RM {opDezeDag.monumentNumber ?? opDezeDag.id}
                          </code>
                        </small>
                        <h3>{opDezeDag.title}</h3>
                        <p className="address">
                          ● {opDezeDag.address}
                          {opDezeDag.postalCode || opDezeDag.place
                            ? `, ${opDezeDag.postalCode} ${opDezeDag.place}`
                            : ""}
                        </p>
                        <CardDescription text={opDezeDag.description} />
                        <span>
                          {opDezeDag.registrationDate
                            ? `Ingeschreven ${opDezeDag.registrationDate}`
                            : opDezeDag.period}
                        </span>
                      </div>
                      <button
                        className="open"
                        type="button"
                        onClick={() =>
                          void executeSearch(
                            opDezeDag.monumentNumber ?? opDezeDag.id,
                          )
                        }
                        aria-label={`Details van ${opDezeDag.title}`}
                      >
                        →
                      </button>
                    </article>
                  </div>
                </section>
              )}
              <div className="start-panel">
                <small>ZO WERKT HET</small>
                <h2>Wat deze zoekmachine doet</h2>
                <p>
                  Doorzoeker doorzoekt de actuele CHO-dataset van de Rijksdienst
                  voor het Cultureel Erfgoed en laat bij elk resultaat het
                  gegevensveld zien waarin de zoekterm is gevonden.
                </p>
                <div>
                  <article>
                    <b>01</b>
                    <h3>Zoek breed</h3>
                    <p>
                      Gebruik een nummer, plaats, functie, monumentaard of
                      omschrijving.
                    </p>
                  </article>
                  <article>
                    <b>02</b>
                    <h3>Matchbron per resultaat</h3>
                    <p>
                      Elk resultaat vermeldt de matchbron en de geregistreerde
                      waarde.
                    </p>
                  </article>
                  <article>
                    <b>03</b>
                    <h3>Controleer de bron</h3>
                    <p>
                      Bekijk functie, adres, geometrie, percelen en de canonieke
                      RCE-link.
                    </p>
                  </article>
                </div>
              </div>
            </>
          ) : remoteState === "loading" ? (
            <div className="empty">
              <b>…</b>
              <h3>RCE Linked Data doorzoeken</h3>
              <p>Een ogenblik; de officiële bron wordt geraadpleegd.</p>
            </div>
          ) : results.length === 0 ? (
            <div className="empty">
              <b>0</b>
              <h3>Geen erfgoedresultaten gevonden</h3>
              <p>Probeer een naam, nummer, plaats, functie of verwante term.</p>
              <button type="button" onClick={reset}>
                Nieuwe zoekopdracht
              </button>
            </div>
          ) : view === "list" ? (
            <div className="cards">
              {results.map((item) => (
                <HeritageResultCard
                  key={item.id}
                  item={item}
                  onOpen={setSelected}
                  onConceptSearch={(concept) =>
                    void executeConceptSearch(concept)
                  }
                />
              ))}
            </div>
          ) : (
            <div className="map-view">
              <HeritageMap
                items={results.filter((item) => item.lat && item.lng)}
                onSelect={(mapItem) => {
                  const item = results.find(
                    (candidate) => candidate.id === mapItem.id,
                  );
                  if (item) choose(item);
                }}
              />
              <div className="map-object-list">
                <h3>Objecten op deze kaart</h3>
                <ul>
                  {results
                    .filter((item) => item.lat && item.lng)
                    .map((item) => (
                      <li key={item.id}>
                        <button type="button" onClick={() => choose(item)}>
                          {item.title}
                        </button>
                      </li>
                    ))}
                </ul>
              </div>
            </div>
          )}
          {hasMore && remoteState === "success" && view === "list" && (
            <div className="more-results">
              <button
                type="button"
                onClick={() => void loadMore()}
                disabled={loadingMore}
              >
                {loadingMore
                  ? "Meer RCE-resultaten laden…"
                  : "Laad 25 volgende resultaten"}
              </button>
              <small>{baseResults.length} unieke erfgoedobjecten geladen</small>
            </div>
          )}
        </div>
      </section>
      {selected && (
        <div
          className="backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelected(null);
          }}
        >
          <aside
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
                  onConceptSearch={(concept) =>
                    void executeConceptSearch(concept)
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
      )}
    </main>
  );
}
