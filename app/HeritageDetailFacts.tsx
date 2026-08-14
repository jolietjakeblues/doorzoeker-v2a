import { displayFunctionName, functionConceptForLabel, primaryFunctionConcept, statusLabel, type ConceptField, type Item } from "@/lib/heritage-view-model";

type Concept = { uri: string; label: string };

function ChoNumber({ value }: { value: string }) {
  return (
    <div>
      <dt>CHO-nummer</dt>
      <dd>
        {value}{" "}
        <details className="hint-inline">
          <summary>Wat is dit?</summary>
          <p>
            Het CHO-nummer is het nummer van dit record in de Linked Data van de
            RCE. Het staat los van bijvoorbeeld een monumentnummer.
          </p>
        </details>
      </dd>
    </div>
  );
}

function Status({ item }: { item: Item }) {
  return (
    <div>
      <dt>Soort erfgoed</dt>
      <dd>{statusLabel(item.objectType)}</dd>
    </div>
  );
}

export function HeritageDetailFacts({
  item,
  onConceptSearch,
  onObjectSearch,
}: {
  item: Item;
  onConceptSearch: (concept: Concept, field?: ConceptField) => void;
  onObjectSearch: (number: string) => void;
}) {
  const common = (
    <>
      <Status item={item} />
      <ChoNumber value={item.objectNumber} />
    </>
  );

  if (item.objectType !== "Rijksmonument") {
    return (
      <>
        {common}
        {item.legalStatus ? (
          <div>
            <dt>Juridische status</dt>
            <dd>{item.legalStatus}</dd>
          </div>
        ) : null}
        {item.objectType === "Complex" && item.complexMemberCount ? (
          <div>
            <dt>Omvang</dt>
            <dd>
              {item.complexMemberCount} rijksmonument
              {item.complexMemberCount === 1 ? "" : "en"}
            </dd>
          </div>
        ) : null}
        {item.objectType === "Archeologisch terrein" && item.archaeologicalValuation ? (
          <div>
            <dt>Archeologische waardering</dt>
            <dd>
              {item.archaeologicalValuationConceptUri ? (
                <button
                  type="button"
                  className="concept-link"
                  onClick={() =>
                    onConceptSearch(
                      { uri: item.archaeologicalValuationConceptUri!, label: item.archaeologicalValuation! },
                      "waardering",
                    )
                  }
                  title="Zoek alle archeologische terreinen met deze waardering"
                >
                  {item.archaeologicalValuation}
                </button>
              ) : (
                item.archaeologicalValuation
              )}
            </dd>
          </div>
        ) : null}
        {item.objectType === "Archeologisch terrein" && item.parentObjectNumber ? (
          <div>
            <dt>Onderdeel van rijksmonument</dt>
            <dd><button type="button" className="concept-link" onClick={() => onObjectSearch(item.parentObjectNumber!)}>{item.parentObjectLabel}</button></dd>
          </div>
        ) : null}
        {item.objectType === "Vondstlocatie" && item.archaeologicalAcquisition ? (
          <div>
            <dt>Verwervingswijze</dt>
            <dd>
              {item.archaeologicalAcquisitionConceptUri ? (
                <button
                  type="button"
                  className="concept-link"
                  onClick={() =>
                    onConceptSearch(
                      { uri: item.archaeologicalAcquisitionConceptUri!, label: item.archaeologicalAcquisition! },
                      "verwerving",
                    )
                  }
                  title="Zoek alle vondstlocaties met deze verwervingswijze"
                >
                  {item.archaeologicalAcquisition}
                </button>
              ) : (
                item.archaeologicalAcquisition
              )}
            </dd>
          </div>
        ) : null}
        {item.objectType === "Vondstlocatie" && item.parentObjectNumber ? (
          <div>
            <dt>Onderzoeksgebied</dt>
            <dd><button type="button" className="concept-link" onClick={() => onObjectSearch(item.parentObjectNumber!)}>{item.parentObjectLabel}</button></dd>
          </div>
        ) : null}
        {item.objectType === "Grondspoor" && item.archaeologicalType ? (
          <div>
            <dt>Type grondspoor</dt>
            <dd>
              {item.archaeologicalType}
              {item.archaeologicalTypeSchemes?.length
                ? ` (${item.archaeologicalTypeSchemes.map((scheme) => scheme.label).join(", ")})`
                : ""}
            </dd>
          </div>
        ) : null}
        {item.objectType === "Grondspoor" && item.archaeologicalTraceCount ? (
          <div>
            <dt>Aantal grondsporen</dt>
            <dd>{item.archaeologicalTraceCount}</dd>
          </div>
        ) : null}
        {item.objectType === "Grondspoor" && item.parentObjectNumber ? (
          <div>
            <dt>Vondstlocatie</dt>
            <dd><button type="button" className="concept-link" onClick={() => onObjectSearch(item.parentObjectNumber!)}>{item.parentObjectLabel}</button></dd>
          </div>
        ) : null}
        {item.objectType === "Vondst" && item.archaeologicalFindCount ? (
          <div><dt>Aantal vondsten</dt><dd>{item.archaeologicalFindCount}</dd></div>
        ) : null}
        {item.objectType === "Vondst" && item.archaeologicalFindTypes?.length ? (
          <div><dt>Type vondst</dt><dd>{item.archaeologicalFindTypes.map((concept, index) => <span key={concept.uri}>{index ? ", " : ""}<button type="button" className="concept-link" onClick={() => onConceptSearch(concept, "vondsttype")} title={`Zoek alle vondsten van het type ${concept.label}`}>{concept.label}</button>{concept.schemes?.length ? ` (${concept.schemes.map((scheme) => scheme.label).join(", ")})` : ""}</span>)}</dd></div>
        ) : null}
        {item.objectType === "Vondst" && item.archaeologicalMaterials?.length ? (
          <div><dt>Materiaal</dt><dd>{item.archaeologicalMaterials.map((concept, index) => <span key={concept.uri}>{index ? ", " : ""}<button type="button" className="concept-link" onClick={() => onConceptSearch(concept, "materiaal")} title={`Zoek alle vondsten van ${concept.label}`}>{concept.label}</button>{concept.schemes?.length ? ` (${concept.schemes.map((scheme) => scheme.label).join(", ")})` : ""}</span>)}</dd></div>
        ) : null}
        {item.objectType === "Vondst" && item.archaeologicalCondition ? (
          <div><dt>Toestand</dt><dd><button type="button" className="concept-link" onClick={() => onConceptSearch(item.archaeologicalCondition!, "toestand")} title={`Zoek alle vondsten met toestand ${item.archaeologicalCondition.label}`}>{item.archaeologicalCondition.label}</button>{item.archaeologicalCondition.schemes?.length ? ` (${item.archaeologicalCondition.schemes.map((scheme) => scheme.label).join(", ")})` : ""}</dd></div>
        ) : null}
        {item.objectType === "Vondst" && item.parentObjectNumber ? (
          <div><dt>Vondstlocatie</dt><dd><button type="button" className="concept-link" onClick={() => onObjectSearch(item.parentObjectNumber!)}>{item.parentObjectLabel}</button></dd></div>
        ) : null}
        {item.objectType === "Archeologisch complex" && item.archaeologicalComplexType ? (
          <div><dt>Archeologisch complextype</dt><dd><button type="button" className="concept-link" onClick={() => onConceptSearch(item.archaeologicalComplexType!, "archeologischcomplextype")} title={`Zoek alle archeologische complexen van het type ${item.archaeologicalComplexType.label}`}>{item.archaeologicalComplexType.label}</button>{item.archaeologicalComplexType.schemes?.length ? ` (${item.archaeologicalComplexType.schemes.map((scheme) => scheme.label).join(", ")})` : ""}</dd></div>
        ) : null}
        {item.objectType === "Archeologisch complex" && item.archaeologicalContexts?.length ? (
          <div><dt>Hoort bij</dt><dd>{item.archaeologicalContexts.map((context, index) => <span key={context.uri}>{index ? ", " : ""}<button type="button" className="concept-link" onClick={() => onObjectSearch(context.choNumber)}>{context.label}</button> ({context.type})</span>)}</dd></div>
        ) : null}
      </>
    );
  }

  const hasFunction = item.kind && item.kind !== "Functie niet opgenomen";
  const functionConcept = primaryFunctionConcept(item);
  const dating =
    item.registrationDate ??
    (item.period !== "Datering niet opgenomen" ? item.period : "");
  // Naast de primaire functie (hierboven) kan een Rijksmonument meerdere
  // oorspronkelijke en/of huidige functies hebben - die worden al opgehaald
  // (facettenquery) maar tot nu toe nergens getoond. Gededupliceerd en
  // exclusief de al getoonde primaire functie.
  const otherFunctionNames = [
    ...new Set(
      [
        ...(item.originalFunctionNames ?? []),
        ...(item.currentFunctionNames ?? []).map(displayFunctionName),
      ].filter((name) => name && name !== item.kind),
    ),
  ];

  return (
    <>
      {common}
      {hasFunction ? (
        <div>
          <dt>Functie</dt>
          <dd>
            {functionConcept ? (
              <button
                type="button"
                className="concept-link"
                onClick={() => onConceptSearch(functionConcept, "functie")}
                title="Zoek alle rijksmonumenten met deze functie"
              >
                {item.kind}
              </button>
            ) : (
              item.kind
            )}
          </dd>
        </div>
      ) : null}
      {otherFunctionNames.length ? (
        <div>
          <dt>Overige functies</dt>
          <dd>
            {otherFunctionNames.map((name, index) => {
              const concept = functionConceptForLabel(item, name);
              return (
                <span key={name}>
                  {index ? ", " : ""}
                  {concept ? (
                    <button
                      type="button"
                      className="concept-link"
                      onClick={() => onConceptSearch(concept, "functie")}
                      title="Zoek alle rijksmonumenten met deze functie"
                    >
                      {name}
                    </button>
                  ) : (
                    name
                  )}
                </span>
              );
            })}
          </dd>
        </div>
      ) : null}
      {item.typeNames?.length ? (
        <div>
          <dt>Type</dt>
          <dd>{item.typeNames.join(", ")}</dd>
        </div>
      ) : null}
      {item.stijlEnCultuur ? (
        <div>
          <dt>Stijl en cultuur</dt>
          <dd>
            {item.stijlEnCultuurConcept ? (
              <button
                type="button"
                className="concept-link"
                onClick={() => onConceptSearch(item.stijlEnCultuurConcept!, "stijl")}
                title="Zoek alle rijksmonumenten met deze stijl"
              >
                {item.stijlEnCultuur}
              </button>
            ) : (
              item.stijlEnCultuur
            )}
          </dd>
        </div>
      ) : null}
      {item.bouwkundigeStaat ? (
        <div>
          <dt>Bouwkundige staat</dt>
          <dd>
            {item.bouwkundigeStaatConcept ? (
              <button
                type="button"
                className="concept-link"
                onClick={() => onConceptSearch(item.bouwkundigeStaatConcept!, "bouwkundigestaat")}
                title="Zoek alle rijksmonumenten met deze bouwkundige staat"
              >
                {item.bouwkundigeStaat}
              </button>
            ) : (
              item.bouwkundigeStaat
            )}
          </dd>
        </div>
      ) : null}
      {item.monumentAardConcept ? (
        <div>
          <dt>Monumentaard</dt>
          <dd>
            <button
              type="button"
              className="concept-link"
              onClick={() => onConceptSearch(item.monumentAardConcept!)}
              title="Zoek alle rijksmonumenten met deze monumentaard"
            >
              {item.monumentAardConcept.label}
            </button>
          </dd>
        </div>
      ) : item.monumentAard ? (
        <div>
          <dt>Monumentaard</dt>
          <dd>{item.monumentAard}</dd>
        </div>
      ) : null}
      {dating ? (
        <div>
          <dt>Inschrijving of datering</dt>
          <dd>{dating}</dd>
        </div>
      ) : null}
    </>
  );
}
