type ResultsToolbarProps = {
  active: string;
  actorSearch: boolean;
  actorRoles: string[];
  resultCount: number;
  hasMore: boolean;
  view: "list" | "map";
  disableMapView: boolean;
  onOpenFilters: () => void;
  onViewChange: (view: "list" | "map") => void;
  onExport: (format: "csv" | "geojson") => void;
  onReset: () => void;
};

export function ResultsToolbar({
  active,
  actorSearch,
  actorRoles,
  resultCount,
  hasMore,
  view,
  disableMapView,
  onOpenFilters,
  onViewChange,
  onExport,
  onReset,
}: ResultsToolbarProps) {
  return (
    <div className="toolbar">
      <div>
        <small>RESULTATEN</small>
        <h2 aria-live="polite">
          {actorSearch ? (
            <>
              {active}
              <small>
                {" "}- {resultCount} erfgoedobject{resultCount === 1 ? "" : "en"}
                {actorRoles.length ? ` (${actorRoles.join(", ")})` : ""}
                {hasMore ? " — nog niet alles geladen" : ""}
              </small>
            </>
          ) : (
            <>
              {resultCount} {resultCount === 1 ? "resultaat" : "resultaten"}
              {active ? ` voor “${active}”` : ""}
              {hasMore ? (
                <small> — nog niet alles geladen</small>
              ) : (
                ""
              )}
            </>
          )}
        </h2>
      </div>
      <div>
        <button className="reset" type="button" onClick={onReset}>
          Wis alle filters
        </button>
        <button className="mobile-filter" type="button" onClick={onOpenFilters}>
          ☰ Filters
        </button>
        {resultCount > 0 && (
          <span className="export" aria-label="Exporteer resultaten">
            <button type="button" onClick={() => onExport("csv")}>
              Exporteer {resultCount} {resultCount === 1 ? "resultaat" : "resultaten"} als CSV
            </button>
            <button type="button" onClick={() => onExport("geojson")}>
              Exporteer {resultCount} {resultCount === 1 ? "resultaat" : "resultaten"} als GeoJSON
            </button>
          </span>
        )}
        <span className="switch" aria-label="Weergave">
          <button
            type="button"
            className={view === "list" ? "on" : ""}
            onClick={() => onViewChange("list")}
            aria-label="Lijstweergave"
            aria-pressed={view === "list"}
          >
            ☷
          </button>
          <button
            type="button"
            className={view === "map" ? "on" : ""}
            onClick={() => onViewChange("map")}
            aria-label="Kaartweergave"
            aria-pressed={view === "map"}
            disabled={disableMapView}
            title={
              disableMapView
                ? "Geen van deze resultaten heeft een eigen locatie op de kaart"
                : undefined
            }
          >
            ⌖
          </button>
        </span>
      </div>
    </div>
  );
}
