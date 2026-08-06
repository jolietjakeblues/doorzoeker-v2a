const ENDPOINT = "https://api.linkeddata.cultureelerfgoed.nl/queries/rce/rest-api-rijksmonumenten/run";
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
};

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
  const params = new URLSearchParams({ page: "1", pageSize: "100" });
  if (/^\d{4,6}$/.test(trimmed)) params.set("rijksmonumentnummer", trimmed);
  else if (/^\d{4}\s?[A-Za-z]{2}$/.test(trimmed)) params.set("postcode", trimmed.replace(/\s/g, "").toUpperCase());
  else params.set("woonplaatsnaam", trimmed);

  const response = await fetch(`${ENDPOINT}?${params}`, {
    headers: { Accept: "application/ld+json" },
    signal,
  });
  if (!response.ok) throw new Error(`RCE-service antwoordde met ${response.status}`);
  return parseRceMonuments(await response.json());
}
