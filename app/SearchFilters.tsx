import { statusLabel, type Item } from "@/lib/heritage-view-model";

type SearchFiltersProps = {
  open: boolean;
  baseResults: Item[];
  objectTypeResults: Item[];
  objectType: string;
  monumentAard: string;
  province: string;
  municipality: string;
  functionFilter: string;
  matchSourceFilter: string;
  excludedStatuses: string[];
  onlyGroenaanleg: boolean;
  onlyMsp: boolean;
  includesRijksmonumenten: boolean;
  contextProvinces: string[];
  contextMunicipalities: string[];
  contextFunctions: string[];
  contextMatchSources: string[];
  contextStatuses: string[];
  groenaanlegCount: number;
  mspCount: number;
  onClose: () => void;
  onObjectTypeChange: (value: string) => void;
  onMonumentAardChange: (value: string) => void;
  onProvinceChange: (value: string) => void;
  onMunicipalityChange: (value: string) => void;
  onFunctionChange: (value: string) => void;
  onMatchSourceChange: (value: string) => void;
  onToggleStatus: (value: string) => void;
  onClearStatuses: () => void;
  onOnlyGroenaanlegChange: (value: boolean) => void;
  onOnlyMspChange: (value: boolean) => void;
  onReset: () => void;
};

export function SearchFilters({
  open, baseResults, objectTypeResults, objectType, monumentAard, province,
  municipality, functionFilter, matchSourceFilter, excludedStatuses,
  onlyGroenaanleg, onlyMsp, includesRijksmonumenten, contextProvinces,
  contextMunicipalities, contextFunctions, contextMatchSources, contextStatuses,
  groenaanlegCount, mspCount, onClose, onObjectTypeChange,
  onMonumentAardChange, onProvinceChange, onMunicipalityChange,
  onFunctionChange, onMatchSourceChange, onToggleStatus, onClearStatuses,
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
        De aantallen hieronder gaan over de resultaten die nu zijn geladen.
      </p>
      <fieldset>
        <legend>Soort object</legend>
        <details className="hint">
          <summary>Wat betekent dit?</summary>
          <p>
            Rijksmonument, Werelderfgoed, Gezicht, Complex, Archeologisch
            terrein, Vondstlocatie, Grondspoor, Vondst, Archeologisch complex en Onderzoeksgebied zijn losse soorten object, geen varianten
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
          "Archeologisch terrein",
          "Vondstlocatie",
          "Grondspoor",
          "Vondst",
          "Archeologisch complex",
          "Onderzoeksgebied",
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
                onClearStatuses();
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
                  onChange={() => onMonumentAardChange(option)}
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
                onProvinceChange(event.target.value);
                onMunicipalityChange("Alle");
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
              onChange={(event) => onMunicipalityChange(event.target.value)}
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
              onChange={(event) => onFunctionChange(event.target.value)}
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
              onChange={(event) => onMatchSourceChange(event.target.value)}
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
              Gezicht hebben hun eigen status. Een archeologisch terrein
              heeft een archeologische waardering; dat is niet automatisch
              een wettelijke bescherming. Een Complex of Onderzoeksgebied
              is zelf geen aangewezen monument.
            </p>
          </details>
          {contextStatuses.map((label) => (
            <label key={label}>
              <input
                type="checkbox"
                checked={!excludedStatuses.includes(label)}
                onChange={() => onToggleStatus(label)}
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
        (groenaanlegCount > 0 || mspCount > 0) && (
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
            {groenaanlegCount > 0 && (
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
                  {groenaanlegCount}
                </em>
              </label>
            )}
            {mspCount > 0 && (
              <label>
                <input
                  type="checkbox"
                  checked={onlyMsp}
                  onChange={(event) => onOnlyMspChange(event.target.checked)}
                />
                <span>Monumenten Selectie Project</span>
                <em>{mspCount}</em>
              </label>
            )}
          </fieldset>
        )}
      <button className="reset" type="button" onClick={onReset}>
        Wis alle filters
      </button>
    </aside>
  );
}
