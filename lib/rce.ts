const ENDPOINT = "https://api.linkeddata.cultureelerfgoed.nl/queries/rce/rest-api-rijksmonumenten/run";
const SPARQL_ENDPOINT = "https://api.linkeddata.cultureelerfgoed.nl/datasets/rce/cho/sparql";
const CEO = "https://linkeddata.cultureelerfgoed.nl/def/ceo#";
const RM_TYPE = `${CEO}Rijksmonument`;

type JsonLdValue = { "@id"?: string; "@value"?: string };
type JsonLdNode = Record<string, unknown> & { "@id": string; "@type"?: string[] };

export type RceMonument = {
  choNumber: string;
  monumentNumber: string;
  registrationDate: string;
  street: string;
  houseNumber: string;
  postalCode: string;
  sourceUrl: string;
  name?: string;
  functionName?: string;
  description?: string;
  monumentNature?: string;
  fullAddress?: string;
  place?: string;
  lat?: number;
  lng?: number;
  wkt?: string;
  parcels?: RceParcel[];
};

export type RceParcel = {
  municipality: string;
  municipalityCode: string;
  section: string;
  parcelNumber: string;
  provinceCode: string;
};

type SparqlBinding = Record<string, { value?: string }>;

export function parseSparqlResults(document: unknown): RceMonument[] {
  const bindings = (document as { results?: { bindings?: SparqlBinding[] } })?.results?.bindings;
  if (!Array.isArray(bindings)) return [];
  return bindings.map((binding) => {
    const wkt = binding.wkt?.value ?? "";
    const point = /POINT\(\s*([\d.-]+)\s+([\d.-]+)\s*\)/i.exec(wkt);
    return {
      choNumber: binding.choi?.value ?? "",
      monumentNumber: binding.rmnr?.value ?? "",
      registrationDate: binding.inschrijving?.value ?? "",
      street: "",
      houseNumber: "",
      postalCode: binding.postcode?.value ?? "",
      sourceUrl: binding.cho?.value ?? "",
      name: binding.naam?.value,
      functionName: binding.functie?.value,
      description: binding.omschrijving?.value,
      monumentNature: binding.monumentaard?.value,
      fullAddress: binding.volledigAdres?.value,
      place: binding.woonplaats?.value,
      lng: point ? Number(point[1]) : undefined,
      lat: point ? Number(point[2]) : undefined,
      wkt: wkt || undefined,
    };
  });
}

export function parseParcelResults(document: unknown): RceParcel[] {
  const bindings = (document as { results?: { bindings?: SparqlBinding[] } })?.results?.bindings;
  if (!Array.isArray(bindings)) return [];
  return bindings.map((binding) => ({
    municipality: binding.gemeente?.value ?? "",
    municipalityCode: binding.gemeentecode?.value ?? "",
    section: binding.sectie?.value ?? "",
    parcelNumber: binding.perceel?.value ?? "",
    provinceCode: binding.provinciecode?.value ?? "",
  }));
}

export function buildRceNumberQuery(monumentNumber: string) {
  return `PREFIX ceo: <https://linkeddata.cultureelerfgoed.nl/def/ceo#>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
PREFIX geo: <http://www.opengis.net/ont/geosparql#>
SELECT ?cho ?choi ?rmnr
  (SAMPLE(STR(?naamValue)) AS ?naam)
  (SAMPLE(STR(?functieValue)) AS ?functie)
  (SAMPLE(STR(?omschrijvingValue)) AS ?omschrijving)
  (SAMPLE(STR(?monumentaardValue)) AS ?monumentaard)
  (SAMPLE(STR(?adresValue)) AS ?volledigAdres)
  (SAMPLE(STR(?postcodeValue)) AS ?postcode)
  (SAMPLE(STR(?woonplaatsValue)) AS ?woonplaats)
  (SAMPLE(STR(?wktValue)) AS ?wkt)
  (SAMPLE(STR(?inschrijvingValue)) AS ?inschrijving)
WHERE {
  ?cho a ceo:Rijksmonument ; ceo:rijksmonumentnummer ?rmnr ; ceo:cultuurhistorischObjectnummer ?choi .
  FILTER(?rmnr = "${monumentNumber}")
  OPTIONAL { ?cho ceo:heeftNaam/ceo:naam ?naamValue . }
  OPTIONAL { ?cho ceo:heeftOorspronkelijkeFunctie/ceo:heeftFunctieNaam/skos:prefLabel ?functieValue . }
  OPTIONAL {
    ?cho ceo:heeftOmschrijving ?omschrijvingNode .
    ?omschrijvingNode ceo:omschrijving ?omschrijvingValue ;
                      ceo:formeelStandpunt true .
  }
  OPTIONAL { ?cho ceo:heeftMonumentAard/skos:prefLabel ?monumentaardValue . }
  OPTIONAL {
    ?cho ceo:heeftBasisregistratieRelatie/ceo:heeftBAGRelatie ?bag .
    OPTIONAL { ?bag ceo:volledigAdres ?adresValue . }
    OPTIONAL { ?bag ceo:postcode ?postcodeValue . }
    OPTIONAL { ?bag ceo:woonplaatsnaam ?woonplaatsValue . }
  }
  OPTIONAL { ?cho ceo:heeftGeometrie/geo:asWKT ?wktValue . }
  OPTIONAL { ?cho ceo:datumInschrijvingInMonumentenregister ?inschrijvingValue . }
}
GROUP BY ?cho ?choi ?rmnr
LIMIT 10`;
}

export function buildRceParcelQuery(monumentNumber: string) {
  return `PREFIX ceo: <https://linkeddata.cultureelerfgoed.nl/def/ceo#>
SELECT DISTINCT ?gemeente ?gemeentecode ?sectie ?perceel ?provinciecode
WHERE {
  ?cho a ceo:Rijksmonument ;
       ceo:rijksmonumentnummer "${monumentNumber}" ;
       ceo:heeftBasisregistratieRelatie/ceo:heeftBRKRelatie ?brk .
  ?brk ceo:gemeentenaam ?gemeente ;
       ceo:sectie ?sectie ;
       ceo:perceelnummer ?perceel .
  OPTIONAL { ?brk ceo:gemeentecode ?gemeentecode . }
  OPTIONAL { ?brk ceo:provinciecode ?provinciecode . }
}`;
}

async function fetchSparql(query: string, signal?: AbortSignal) {
  const response = await fetch(`${SPARQL_ENDPOINT}?query=${encodeURIComponent(query)}`, {
    headers: { Accept: "application/sparql-results+json" },
    signal,
  });
  if (!response.ok) throw new Error(`RCE SPARQL-service antwoordde met ${response.status}`);
  return response.json();
}

async function searchRceByNumber(monumentNumber: string, signal?: AbortSignal) {
  const [monumentsDocument, parcelsDocument] = await Promise.all([
    fetchSparql(buildRceNumberQuery(monumentNumber), signal),
    fetchSparql(buildRceParcelQuery(monumentNumber), signal),
  ]);
  const parcels = parseParcelResults(parcelsDocument);
  return parseSparqlResults(monumentsDocument).map((monument) => ({ ...monument, parcels }));
}

function values(node: JsonLdNode | undefined, property: string): JsonLdValue[] {
  const result = node?.[`${CEO}${property}`];
  return Array.isArray(result) ? result as JsonLdValue[] : [];
}

function value(node: JsonLdNode | undefined, property: string) {
  return values(node, property)[0]?.["@value"] ?? "";
}

function linkedNode(nodes: Map<string, JsonLdNode>, node: JsonLdNode | undefined, property: string) {
  const id = values(node, property)[0]?.["@id"];
  return id ? nodes.get(id) : undefined;
}

export function parseRceMonuments(document: unknown): RceMonument[] {
  if (!Array.isArray(document)) return [];
  const graph = document.filter((node): node is JsonLdNode => Boolean(node && typeof node === "object" && "@id" in node));
  const nodes = new Map(graph.map((node) => [node["@id"], node]));

  return graph.filter((node) => node["@type"]?.includes(RM_TYPE)).map((monument) => {
    const registration = linkedNode(nodes, monument, "heeftBasisregistratieRelatie");
    const bag = linkedNode(nodes, registration, "heeftBAGRelatie");
    const registerUrl = value(monument, "rijksmonumentnummer");
    return {
      choNumber: value(monument, "cultuurhistorischObjectnummer") || monument["@id"].split("/").pop() || "",
      monumentNumber: registerUrl.split("/").pop() || "",
      registrationDate: value(monument, "datumInschrijvingInMonumentenregister"),
      street: value(bag, "openbareRuimte"),
      houseNumber: value(bag, "huisnummer"),
      postalCode: value(bag, "postcode"),
      sourceUrl: monument["@id"],
    };
  });
}

export async function searchRceMonuments(query: string, signal?: AbortSignal) {
  const trimmed = query.trim();
  if (/^\d{4,6}$/.test(trimmed)) return searchRceByNumber(trimmed, signal);
  const params = new URLSearchParams({ page: "1", pageSize: "100" });
  if (/^\d{4}\s?[A-Za-z]{2}$/.test(trimmed)) params.set("postcode", trimmed.replace(/\s/g, "").toUpperCase());
  else params.set("woonplaatsnaam", trimmed);

  const response = await fetch(`${ENDPOINT}?${params}`, {
    headers: { Accept: "application/ld+json" },
    signal,
  });
  if (!response.ok) throw new Error(`RCE-service antwoordde met ${response.status}`);
  return parseRceMonuments(await response.json());
}
