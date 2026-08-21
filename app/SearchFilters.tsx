import { statusLabel, type Item } from "@/lib/heritage-view-model";

// Zolang er nog meer te laden is (hasMore), is elke telling hieronder een
// ondergrens - er kunnen bij de nog niet geladen resultaten extra matches
// voor deze optie zitten. De "+" maakt dat verschil zichtbaar zonder een
// aparte SPARQL COUNT-query per facet te introduceren.
function formatCount(count: number, hasMore: boolean) {
  return hasMore ? `${count}+` : String(count);
}

type SearchFiltersProps = {
  open: boolean;
  baseResults: Item[];
  objectTypeResults: Item[];
  hasMore: boolean;
  objectType: string;
  monumentAard: string;
  province: string;
  municipality: string;
  functionFilter: string;
  matchSourceFilter: string;
  excludedCategories: string[];
  onlyGroenaanleg: boolean;
  onlyMsp: boolean;
  includesRijksmonumenten: boolean;
  contextProvinces: string[];
  contextMunicipalities: string[];
  contextFunctions: string[];
  contextMatchSources: string[];
  contextCategories: string[];
  groenaanlegCount: number;
  mspCount: number;
  onClose: () => void;
  onObjectTypeChange: (value: string) => void;
  onMonumentAardChange: (value: string) => void;
  onProvinceChange: (value: string) => void;
  onMunicipalityChange: (value: string) => void;
  onFunctionChange: (value: string) => void;
  onMatchSourceChange: (value: string) => void;
  onToggleCategory: (value: string) => void;
  onClearCategories: () => void;
  onOnlyGroenaanlegChange: (value: boolean) => void;
  onOnlyMspChange: (value: boolean) => void;
  onReset: () => void;
};

export function SearchFilters({
  open, baseResults, objectTypeResults, hasMore, objectType, monumentAard, province,
  municipality, functionFilter, matchSourceFilter, excludedCategories,
  onlyGroenaanleg, onlyMsp, includesRijksmonumenten, contextProvinces,
  contextMunicipalities, contextFunctions, contextMatchSources, contextCategories,
  groenaanlegCount, mspCount, onClose, onObjectTypeChange,
  onMonumentAardChange, onProvinceChange, onMunicipalityChange,
  onFunctionChange, onMatchSourceChange, onToggleCategory, onClearCategories,
  onOnlyGroenaanlegChange, onOnlyMspChange, onReset,
}: SearchFiltersProps) {
  return (
    <aside className={open ? "show" : ""} aria-label="Zoekfilters">
      <div className="aside-title">
        <div>
          <small>VERFIJN</small>
          <h2>Filters</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Filters sluiten"
        >
          ×
        </button>
      </div>
      <p className="filter-scope">
        Filters gelden voor de geladen resultaten.
        {hasMore ? " \"12+\" betekent dat er nog meer kunnen zijn." : ""}
      </p>
      <fieldset>
        <legend>Soort object</legend>
        <details className="hint">
          <summary>Wat betekent dit?</summary>
          <p>
            Rijksmonument, Werelderfgoed, Gezicht, Complex, Archeologisch
            terrein, Vondstlocatie, Grondspoor, Vondst, Archeologisch complex,
            Onderzoeksgebied en Scheepswrak zijn losse soorten object, geen
            varianten van hetzelfde. Werelderfgoed en Gezicht zijn gebieden
            waar de RCE verantwoordelijk voor is en die rijksmonumenten
            kunnen bevatten. Een Complex is zelf geen monument, maar een
            samenhang tussen meerdere rijksmonumenten. Een Onderzoeksgebied
            staat los van het monumentenregister. Een Scheepswrak komt uit
            een aparte RCE-dataset (MASS), niet uit het monumentenregister.
          </p>
        </details>
        {[
          "Alle",
          "Rijksmonument",
          "Werelderfgoed",
          "Gezicht",
          "Complex",
          "Archeologisch terrein",
          "Vondstlocatie",
          "Grondspoor",
          "Vondst",
          "Archeologisch complex",
          "Onderzoeksgebied",
          "Scheepswrak",
        ].map((option) => (
          <label key={option}>
            <input
              type="radio"
              name="soort"
              checked={objectType === option}
              onChange={() => {
                onObjectTypeChange(option);
                onProvinceChange("Alle");
                onMunicipalityChange("Alle");
                onClearCategories();
                if (option !== "Alle" && option !== "Rijksmonument") {
                  onMonumentAardChange("Alle");
                  onFunctionChange("Alle");
                  onOnlyGroenaanlegChange(false);
                  onOnlyMspChange(false);
                }
              }}
            />
            <span>{option === "Alle" ? "Alle soorten" : option}</span>
            <em>
              {formatCount(
                option === "Alle"
                  ? baseResults.length
                  : baseResults.filter((item) => item.objectType === option)
                      .length,
                hasMore,
              )}
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
                  onChange={() => onMonumentAardChange(option)}
                />
                <span>
                  {option === "Alle" ? "Alle monumentaarden" : option}
                </span>
                <em>
                  {formatCount(
                    option === "Alle"
                      ? baseResults.filter(
                          (item) => item.objectType === "Rijksmonument",
                        ).length
                      : baseResults.filter(
                          (item) => item.monumentAard === option,
                        ).length,
                    hasMore,
                  )}
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
                onProvinceChange(event.target.value);
                onMunicipalityChange("Alle");
              }}
            >
              <option value="Alle">
                Alle provincies ({formatCount(objectTypeResults.length, hasMore)})
              </option>
              {contextProvinces.map((option) => (
                <option key={option} value={option}>
                  {option} (
                  {formatCount(
                    objectTypeResults.filter(
                      (item) => item.province === option,
                    ).length,
                    hasMore,
                  )}
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
              onChange={(event) => onMunicipalityChange(event.target.value)}
            >
              <option value="Alle">
                Alle plaatsen (
                {formatCount(
                  objectTypeResults.filter(
                    (item) =>
                      province === "Alle" || item.province === province,
                  ).length,
                  hasMore,
                )}
                )
              </option>
              {contextMunicipalities.map((option) => (
                <option key={option} value={option}>
                  {option} (
                  {formatCount(
                    objectTypeResults.filter(
                      (item) =>
                        item.municipality === option &&
                        (province === "Alle" || item.province === province),
                    ).length,
                    hasMore,
                  )}
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
              onChange={(event) => onFunctionChange(event.target.value)}
            >
              <option value="Alle">
                Alle functies ({formatCount(objectTypeResults.length, hasMore)})
              </option>
              {contextFunctions.map((option) => (
                <option key={option} value={option}>
                  {option} (
                  {formatCount(
                    objectTypeResults.filter((item) =>
                      [
                        item.kind,
                        ...(item.originalFunctionNames ?? []),
                        ...(item.currentFunctionNames ?? []),
                      ].includes(option),
                    ).length,
                    hasMore,
                  )}
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
              onChange={(event) => onMatchSourceChange(event.target.value)}
            >
              <option value="Alle">Alle matchbronnen</option>
              {contextMatchSources.map((option) => (
                <option key={option} value={option}>
                  {option} (
                  {formatCount(
                    objectTypeResults.filter(
                      (item) => item.matchSource === option,
                    ).length,
                    hasMore,
                  )}
                  )
                </option>
              ))}
            </select>
          </label>
        </fieldset>
      )}
      {objectType === "Alle" && contextCategories.length > 1 && (
        <fieldset>
          <legend>Objectsoort uitsluiten</legend>
          <details className="hint">
            <summary>Wat betekent dit?</summary>
            <p>
              Dit is geen juridische status - Doorzoeker toont hier alleen
              een preciezere naam per objectsoort (bijvoorbeeld
              &ldquo;Archeologisch onderzoeksgebied&rdquo; in plaats van
              &ldquo;Onderzoeksgebied&rdquo;). De echte juridische status
              van de RCE kent maar drie waarden - rijksmonument,
              voorbeschermd en geen rijksmonument - en wordt hier niet
              getoond. Vink een soort uit om die uit de resultaten te
              verbergen.
            </p>
          </details>
          {contextCategories.map((label) => (
            <label key={label}>
              <input
                type="checkbox"
                checked={!excludedCategories.includes(label)}
                onChange={() => onToggleCategory(label)}
              />
              <span>{label}</span>
              <em>
                {formatCount(
                  baseResults.filter(
                    (item) => statusLabel(item.objectType) === label,
                  ).length,
                  hasMore,
                )}
              </em>
            </label>
          ))}
        </fieldset>
      )}
      {includesRijksmonumenten && (
        <fieldset>
          <legend>Kenmerken</legend>
          <details className="hint">
            <summary>Wat betekent dit?</summary>
            <p>
              Historische aanleg (groenaanleg) betekent dat er een tuin-
              of parkaanleg bij het monument hoort. Monumenten Selectie
              Project verwijst naar een aanwijzingsronde van de RCE tussen
              ongeveer 1997 en 2002, gericht op gebouwen uit 1850-1940. Een
              telling van 0 hieronder betekent niet dat dit kenmerk niet
              bestaat voor Rijksmonumenten - het komt alleen niet voor bij
              de resultaten die nu zijn geladen.
            </p>
          </details>
          <label>
            <input
              type="checkbox"
              checked={onlyGroenaanleg}
              onChange={(event) =>
                onOnlyGroenaanlegChange(event.target.checked)
              }
            />
            <span>Historische aanleg (groenaanleg)</span>
            <em>
              {formatCount(groenaanlegCount, hasMore)}
            </em>
          </label>
          <label>
            <input
              type="checkbox"
              checked={onlyMsp}
              onChange={(event) => onOnlyMspChange(event.target.checked)}
            />
            <span>Monumenten Selectie Project</span>
            <em>{formatCount(mspCount, hasMore)}</em>
          </label>
        </fieldset>
      )}
      <button className="reset" type="button" onClick={onReset}>
        Wis alle filters
      </button>
    </aside>
  );
}
