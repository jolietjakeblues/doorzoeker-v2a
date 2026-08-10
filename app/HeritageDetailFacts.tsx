import { statusLabel, type ConceptField, type Item } from "@/lib/heritage-view-model";

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
}: {
  item: Item;
  onConceptSearch: (concept: Concept, field?: ConceptField) => void;
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
            <dd>{item.archaeologicalValuation}</dd>
          </div>
        ) : null}
        {item.objectType === "Vondstlocatie" && item.archaeologicalAcquisition ? (
          <div>
            <dt>Verwervingswijze</dt>
            <dd>{item.archaeologicalAcquisition}</dd>
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
        {item.objectType === "Grondspoor" && item.parentObjectUrl ? (
          <div>
            <dt>Vondstlocatie</dt>
            <dd><a href={item.parentObjectUrl} target="_blank" rel="noreferrer">{item.parentObjectLabel}</a></dd>
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
        {item.objectType === "Vondst" && item.parentObjectUrl ? (
          <div><dt>Vondstlocatie</dt><dd><a href={item.parentObjectUrl} target="_blank" rel="noreferrer">{item.parentObjectLabel}</a></dd></div>
        ) : null}
      </>
    );
  }

  const hasFunction = item.kind && item.kind !== "Functie niet opgenomen";
  const dating =
    item.registrationDate ??
    (item.period !== "Datering niet opgenomen" ? item.period : "");

  return (
    <>
      {common}
      {hasFunction ? (
        <div>
          <dt>Functie</dt>
          <dd>{item.kind}</dd>
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
