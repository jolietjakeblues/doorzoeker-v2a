import type { ReactNode } from "react";
import type { Item, MapViewport } from "@/lib/heritage-view-model";
import { HeritageMap } from "./HeritageMap";
import { HeritageResultCard } from "./HeritageResultCard";

type SearchResultsProps = {
  remoteState: "idle" | "loading" | "error" | "success";
  results: Item[];
  mapItems: Item[];
  mapViewport?: MapViewport;
  view: "list" | "map";
  hasMore: boolean;
  loadingMore: boolean;
  loadedCount: number;
  idleContent: ReactNode;
  onReset: () => void;
  onOpen: (item: Item) => void;
  onChoose: (item: Item) => void;
  onConceptSearch: (concept: { uri: string; label: string }) => void;
  onViewportChange: (viewport: MapViewport) => void;
  onLoadMore: () => void;
};

export function SearchResults({
  remoteState,
  results,
  mapItems,
  mapViewport,
  view,
  hasMore,
  loadingMore,
  loadedCount,
  idleContent,
  onReset,
  onOpen,
  onChoose,
  onConceptSearch,
  onViewportChange,
  onLoadMore,
}: SearchResultsProps) {
  return (
    <>
      {remoteState === "idle" ? (
        idleContent
      ) : remoteState === "loading" ? (
        <div className="search-loading" role="status" aria-live="polite">
          <div className="graph-traversal" aria-hidden="true">
            <span /><i /><span /><i /><span /><i /><span />
          </div>
          <h3>We zoeken in de RCE-bronnen</h3>
          <p>De eerste resultaten verschijnen hier zodra ze binnen zijn.</p>
          <div className="skeleton-cards" aria-hidden="true">
            {[0, 1, 2].map((index) => (
              <div className="skeleton-card" key={index}>
                <span className="skeleton-tile" />
                <div>
                  <span className="skeleton-line short" />
                  <span className="skeleton-line title" />
                  <span className="skeleton-line" />
                  <span className="skeleton-line medium" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : results.length === 0 ? (
        <div className="empty">
          <b>0</b>
          <h3>Geen erfgoedresultaten gevonden</h3>
          <p>Probeer een naam, nummer, plaats, functie of verwante term.</p>
          <button type="button" onClick={onReset}>Nieuwe zoekopdracht</button>
        </div>
      ) : view === "list" ? (
        <>
          <p className="results-help">
            Open een resultaat voor de kaart, relaties, brongegevens en gekoppelde begrippen.
          </p>
          <div className="cards">
            {results.map((item) => (
              <HeritageResultCard
                key={item.id}
                item={item}
                onOpen={onOpen}
                onConceptSearch={onConceptSearch}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="map-view">
          <HeritageMap
            items={mapItems}
            initialViewport={mapViewport}
            onViewportChange={onViewportChange}
            onSelect={(mapItem) => {
              const item = results.find((candidate) => candidate.id === mapItem.id);
              if (item) onChoose(item);
            }}
          />
          <div className="map-object-list">
            <h3>Objecten op deze kaart</h3>
            <ul>
              {mapItems.map((item) => (
                <li key={item.id}>
                  <button type="button" onClick={() => onChoose(item)}>{item.title}</button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {hasMore && remoteState === "success" && view === "list" && (
        <div className="more-results">
          <button type="button" onClick={onLoadMore} disabled={loadingMore}>
            {loadingMore ? "Meer RCE-resultaten laden…" : "Laad 25 volgende resultaten"}
          </button>
          <small>{loadedCount} unieke erfgoedobjecten geladen</small>
        </div>
      )}
    </>
  );
}
