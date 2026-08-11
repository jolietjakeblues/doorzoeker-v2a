type ResultsToolbarProps = {
  active: string;
  actorSearch: boolean;
  actorRoles: string[];
  resultCount: number;
  view: "list" | "map";
  onOpenFilters: () => void;
  onViewChange: (view: "list" | "map") => void;
};

export function ResultsToolbar({
  active,
  actorSearch,
  actorRoles,
  resultCount,
  view,
  onOpenFilters,
  onViewChange,
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
              </small>
            </>
          ) : (
            <>
              {resultCount} {resultCount === 1 ? "resultaat" : "resultaten"}
              {active ? ` voor “${active}”` : ""}
            </>
          )}
        </h2>
      </div>
      <div>
        <button className="mobile-filter" type="button" onClick={onOpenFilters}>
          ☰ Filters
        </button>
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
          >
            ⌖
          </button>
        </span>
      </div>
    </div>
  );
}
