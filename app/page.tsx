"use client";

import { useMemo } from "react";
import { HeritageDetailDialog } from "./HeritageDetailDialog";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import { BetaBadge } from "./BetaBadge";
import { SearchHero } from "./SearchHero";
import { ResultsToolbar } from "./ResultsToolbar";
import { SearchFilters } from "./SearchFilters";
import { SearchResults } from "./SearchResults";
import { StartContent } from "./StartContent";
import { statusLabel } from "@/lib/heritage-view-model";
import { exportFileName, itemsToCsv, itemsToGeoJson } from "@/lib/export";
import { useTermSuggestions } from "@/hooks/useTermSuggestions";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { useSelectedDetailEnrichment } from "@/hooks/useSelectedDetailEnrichment";
import { useSearchState } from "@/hooks/useSearchState";
import { useOpDezeDag } from "@/hooks/useOpDezeDag";
import { useVerrasMe } from "@/hooks/useVerrasMe";
import { useDialogFocus } from "@/hooks/useDialogFocus";

export default function Home() {
  const {
    query,
    setQuery,
    active,
    view,
    setView,
    mapViewport,
    setMapViewport,
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
    retry,
    hasMore,
    loadingMore,
    baseResults,
    groenaanlegCount,
    mspCount,
    results,
    activeConceptUri,
    activeConceptVeld,
    selectTermSuggestion,
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
  } = useTermSuggestions(query, active, (suggestion) => {
    if (suggestion.conceptField) {
      void executeConceptSearch(suggestion, suggestion.conceptField);
      return;
    }
    selectTermSuggestion(suggestion);
  });
  const { complexMembers, onderzoeksgebiedVerrijking, vondstlocatieInhoud, vergelijkbareRijksmonumenten, ligtIn } =
    useSelectedDetailEnrichment(selected);
  const opDezeDag = useOpDezeDag();
  const verrasMe = useVerrasMe();
  useBodyScrollLock(Boolean(selected));
  const detailDialogRef = useDialogFocus(Boolean(selected), () =>
    setSelected(null),
  );
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
  const mapItems = useMemo(
    () => results.filter((item) => item.lat && item.lng),
    [results],
  );
  // Puur client-side: de gefilterde resultatenlijst staat al in `results`,
  // geen serveraanroep nodig. Zie docs/vertical-slices/012-resultaten-exporteren.md.
  function exportResults(format: "csv" | "geojson") {
    const content =
      format === "csv"
        ? itemsToCsv(results, hasMore)
        : JSON.stringify(itemsToGeoJson(results, hasMore));
    const blob = new Blob([content], {
      type: format === "csv" ? "text/csv;charset=utf-8" : "application/geo+json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = exportFileName(format);
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <main>
      <BetaBadge />
      <a href="#results" className="skip-link">
        Direct naar resultaten
      </a>
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
        onDiscoverTheme={(uri, label) =>
          void executeConceptSearch({ uri, label }, "functie")
        }
        onRetry={retry}
      />
      {/* SearchHero owns the complete search introduction and combobox. */}
      <section className={`work ${!active ? "start" : ""}`}>
        <SearchFilters
          open={filters}
          baseResults={baseResults}
          objectTypeResults={objectTypeResults}
          hasMore={hasMore}
          objectType={objectType}
          monumentAard={monumentAard}
          province={province}
          municipality={municipality}
          functionFilter={functionFilter}
          matchSourceFilter={matchSourceFilter}
          excludedStatuses={excludedStatuses}
          onlyGroenaanleg={onlyGroenaanleg}
          onlyMsp={onlyMsp}
          includesRijksmonumenten={includesRijksmonumenten}
          contextProvinces={contextProvinces}
          contextMunicipalities={contextMunicipalities}
          contextFunctions={contextFunctions}
          contextMatchSources={contextMatchSources}
          contextStatuses={contextStatuses}
          groenaanlegCount={groenaanlegCount}
          mspCount={mspCount}
          onClose={() => setFilters(false)}
          onObjectTypeChange={setObjectType}
          onMonumentAardChange={setMonumentAard}
          onProvinceChange={setProvince}
          onMunicipalityChange={setMunicipality}
          onFunctionChange={setFunctionFilter}
          onMatchSourceChange={setMatchSourceFilter}
          onToggleStatus={toggleLegalStatus}
          onClearStatuses={clearExcludedStatuses}
          onOnlyGroenaanlegChange={setOnlyGroenaanleg}
          onOnlyMspChange={setOnlyMsp}
          onReset={reset}
        />
        <div className="results" id="results" tabIndex={-1}>
          <ResultsToolbar
            active={active}
            actorSearch={activeConceptVeld === "actor"}
            actorRoles={actorRoles}
            resultCount={results.length}
            hasMore={hasMore}
            view={view}
            disableMapView={mapItems.length === 0}
            onOpenFilters={() => setFilters(true)}
            onViewChange={setView}
            onExport={exportResults}
          />

          <SearchResults
            remoteState={remoteState}
            results={results}
            mapItems={mapItems}
            mapViewport={mapViewport}
            view={view}
            hasMore={hasMore}
            loadingMore={loadingMore}
            loadedCount={baseResults.length}
            idleContent={
              <StartContent
                item={opDezeDag}
                onOpen={setSelected}
                verrasMeItem={verrasMe.item}
                verrasMeLoading={verrasMe.loading}
                onVerrasMe={verrasMe.trigger}
              />
            }
            onReset={reset}
            onOpen={setSelected}
            onChoose={choose}
            onConceptSearch={(concept) => void executeConceptSearch(concept)}
            onViewportChange={setMapViewport}
            onLoadMore={() => void loadMore()}
          />
        </div>
      </section>
      {selected && (
        <HeritageDetailDialog
          selected={selected}
          dialogRef={detailDialogRef}
          enrichment={{ complexMembers, onderzoeksgebiedVerrijking, vondstlocatieInhoud, vergelijkbareRijksmonumenten, ligtIn }}
          onClose={() => setSelected(null)}
          onSearch={executeSearch}
          onConceptSearch={executeConceptSearch}
        />
      )}
      <SiteFooter />
    </main>
  );
}
