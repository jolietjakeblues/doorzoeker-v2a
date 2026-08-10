import { statusLabel, type Item } from "@/lib/heritage-view-model";

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
  onConceptSearch: (concept: Concept) => void;
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
