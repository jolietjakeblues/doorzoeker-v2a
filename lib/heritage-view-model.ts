import {
  provinceName,
  type ArcheologischTerrein,
  type ComplexMembership,
  type Gebeurtenis,
  type Groenaanleg,
  type LiteratureRef,
  type MonumentImage,
  type RceMonument,
  type RceParcel,
} from "./rce.ts";

// Rijksmonument, Werelderfgoed, Gezicht en Complex zijn geen smaken van
// hetzelfde ding: het zijn verschillende soorten cultuurhistorisch object.
// Werelderfgoed en Gezicht zijn gebieden waar de RCE verantwoordelijk voor is
// en die rijksmonumenten kunnen bevatten; Complex is zelf geen monument maar
// een samenhang tussen rijksmonumenten (bv. een buitenplaats). Geen van
// drieën is zelf "een monumentaard" - monumentaard (gebouwd/archeologisch)
// is dan ook alleen een eigenschap van een Rijksmonument.
export type Item = {
  id: string;
  objectNumber: string;
  title: string;
  kind: string;
  address: string;
  postalCode: string;
  place: string;
  municipality: string;
  province: string;
  objectType:
    | "Rijksmonument"
    | "Werelderfgoed"
    | "Gezicht"
    | "Complex"
    | "Archeologisch terrein"
    | "Vondstlocatie"
    | "Grondspoor"
    | "Onderzoeksgebied";
  monumentAard?: "Gebouwd" | "Archeologisch";
  period: string;
  description: string;
  lat: number;
  lng: number;
  monumentNumber?: string;
  registrationDate?: string;
  official?: boolean;
  sourceUrl?: string;
  linkedDataUrl?: string;
  wkt?: string;
  matchSource?: string;
  matchedText?: string;
  matchScore?: number;
  legalStatus?: string;
  originalFunctionNames?: string[];
  currentFunctionNames?: string[];
  typeNames?: string[];
  parcels?: RceParcel[];
  archaeologicalSites?: ArcheologischTerrein[];
  complexes?: ComplexMembership[];
  complexMemberCount?: number;
  image?: MonumentImage;
  groenaanleg?: Groenaanleg;
  msp?: boolean;
  monumentAardConcept?: { uri: string; label: string };
  literature?: LiteratureRef[];
  gebeurtenissen?: Gebeurtenis[];
  archaeologicalValuation?: string;
  archaeologicalValuationConceptUri?: string;
  archaeologicalAcquisition?: string;
  archaeologicalAcquisitionConceptUri?: string;
  archaeologicalTraceCount?: number;
  archaeologicalType?: string;
  archaeologicalTypeConceptUri?: string;
  archaeologicalTypeSchemes?: { uri: string; label: string }[];
  parentObjectUrl?: string;
  parentObjectLabel?: string;
};

export const EMPTY_ITEMS: Item[] = [];
export type ConceptField =
  | "monumentaard"
  | "waardering"
  | "gebeurtenis"
  | "actor";
export type MapViewport = { lat: number; lng: number; zoom: number };
export type SelectedTermIdentity = {
  uri: string;
  label: string;
  sourceUri: string;
  sourceName: string;
};

export const EMPTY_URL_STATE = {
  query: "",
  conceptUri: "",
  conceptField: undefined as ConceptField | undefined,
  selectedTerm: undefined as SelectedTermIdentity | undefined,
  objectType: "Alle",
  monumentAard: "Alle",
  province: "Alle",
  municipality: "Alle",
  functionFilter: "Alle",
  matchSourceFilter: "Alle",
  excludedStatuses: [] as string[],
  onlyGroenaanleg: false,
  onlyMsp: false,
  view: "list" as const,
  mapViewport: undefined as MapViewport | undefined,
  selectedId: "",
  page: 1,
};
export const MONUMENT_REGISTER_BASE_URL =
  "https://monumentenregister.cultureelerfgoed.nl/monumenten/";

export function displayFunctionName(value: string) {
  return value.replace(/\s*\([^()]*\)\s*$/, "").trim();
}

// Kapt af op een woordgrens (niet midden in een woord) - zie
// docs/vertical-slices/013-omschrijving-inkorten.md. Alleen voor de
// resultatenkaart; het detailpaneel toont altijd de volledige tekst.
export function truncateAtWordBoundary(text: string, max: number) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd();
}

export function typeBadge(item: {
  objectType: Item["objectType"];
  monumentAard?: Item["monumentAard"];
}) {
  if (item.objectType === "Werelderfgoed")
    return { letter: "W", modifier: "world" };
  if (item.objectType === "Gezicht") return { letter: "G", modifier: "green" };
  if (item.objectType === "Complex")
    return { letter: "C", modifier: "complex" };
  if (item.objectType === "Onderzoeksgebied")
    return { letter: "O", modifier: "dig" };
  if (item.objectType === "Archeologisch terrein")
    return { letter: "T", modifier: "sand" };
  if (item.objectType === "Vondstlocatie") return { letter: "V", modifier: "dig" };
  if (item.objectType === "Grondspoor") return { letter: "S", modifier: "dig" };
  if (item.monumentAard === "Archeologisch")
    return { letter: "A", modifier: "sand" };
  return { letter: "M", modifier: "" };
}

// Niet elk resultaat is een Rijksmonument: Werelderfgoed en Gezicht hebben
// hun eigen juridische status, een Complex is zelf geen monument maar een
// samenhang tussen rijksmonumenten, en een Onderzoeksgebied staat volledig los
// van het monumentenregister - het heeft geen juridische status, alleen een
// afgebakend gebied waarin archeologisch onderzoek is uitgevoerd.
export function statusLabel(objectType: Item["objectType"]) {
  if (objectType === "Werelderfgoed") return "Werelderfgoed";
  if (objectType === "Gezicht") return "Rijksbeschermd stads- of dorpsgezicht";
  if (objectType === "Complex") return "Complex van rijksmonumenten";
  if (objectType === "Onderzoeksgebied")
    return "Archeologisch onderzoeksgebied";
  if (objectType === "Archeologisch terrein") return "Archeologisch terrein";
  if (objectType === "Vondstlocatie") return "Archeologische vondstlocatie";
  if (objectType === "Grondspoor") return "Archeologisch grondspoor";
  return "Rijksmonument";
}

export function primaryIdentifier(
  item: Pick<Item, "objectType" | "monumentNumber" | "objectNumber">,
) {
  const value = item.monumentNumber || item.objectNumber;
  if (item.objectType === "Rijksmonument") return { label: "RM", value };
  if (item.objectType === "Werelderfgoed")
    return { label: "Werelderfgoed", value };
  if (item.objectType === "Gezicht") return { label: "Gezicht", value };
  if (item.objectType === "Complex") return { label: "Complex", value };
  if (item.objectType === "Archeologisch terrein")
    return { label: "Archis", value };
  if (item.objectType === "Vondstlocatie") return { label: "Archis", value };
  if (item.objectType === "Grondspoor") return { label: "CHO", value };
  return { label: "Onderzoeksgebied", value };
}

export function toItem(record: RceMonument): Item {
  const functionName = record.functionName
    ? displayFunctionName(record.functionName)
    : "";
  const originalFunctionNames = record.originalFunctionNames
    ?.map(displayFunctionName)
    .filter(Boolean);
  const matchedText =
    record.matchSource === "oorspronkelijke functie" && record.matchedText
      ? displayFunctionName(record.matchedText)
      : record.matchedText;
  const isWerelderfgoed = record.monumentNature === "werelderfgoed";
  const isGezicht = record.monumentNature === "gezicht";
  const isComplex = record.monumentNature === "complex";
  const isOnderzoeksgebied =
    record.monumentNature === "archeologischonderzoeksgebied";
  const isArcheologischTerrein = record.monumentNature === "archeologischterrein";
  const isVondstlocatie = record.monumentNature === "vondstlocatie";
  const isGrondspoor = record.monumentNature === "grondsporen";
  const hasOwnOfficialUrl = isWerelderfgoed || isGezicht;
  const objectType: Item["objectType"] = isWerelderfgoed
    ? "Werelderfgoed"
    : isGezicht
      ? "Gezicht"
      : isComplex
        ? "Complex"
        : isOnderzoeksgebied
          ? "Onderzoeksgebied"
          : isArcheologischTerrein
            ? "Archeologisch terrein"
            : isVondstlocatie
              ? "Vondstlocatie"
              : isGrondspoor
                ? "Grondspoor"
              : "Rijksmonument";
  const monumentAard: Item["monumentAard"] =
    objectType === "Rijksmonument"
      ? record.monumentNature?.toLocaleLowerCase("nl").includes("archeologisch")
        ? "Archeologisch"
        : "Gebouwd"
      : undefined;
  return {
    id: record.choNumber,
    monumentNumber: record.monumentNumber,
    objectNumber: record.choNumber,
    title:
      record.name ||
      functionName ||
      (isComplex
        ? `Complex ${record.monumentNumber}`
        : isOnderzoeksgebied
          ? `Onderzoeksgebied ${record.monumentNumber}`
          : isArcheologischTerrein
            ? `Archeologisch terrein ${record.monumentNumber}`
          : isVondstlocatie
            ? `Vondstlocatie ${record.monumentNumber}`
          : isGrondspoor
            ? `Grondspoor ${record.monumentNumber}`
          : `Rijksmonument ${record.monumentNumber}`),
    kind: functionName || "Functie niet opgenomen",
    address:
      record.fullAddress ||
      [record.street, record.houseNumber].filter(Boolean).join(" ") ||
      "Adres niet opgenomen",
    postalCode: record.postalCode,
    place: record.place ?? "",
    municipality: record.municipality ?? record.place ?? "",
    province: provinceName(record.provinceCode) ?? "",
    objectType,
    monumentAard,
    period: record.matchSource
      ? `Gevonden via ${record.matchSource}${matchedText ? `: ${matchedText.slice(0, 72)}${matchedText.length > 72 ? "…" : ""}` : ""}`
      : record.registrationDate
        ? `Ingeschreven ${record.registrationDate}`
        : "Datering niet opgenomen",
    description:
      record.description ||
      "Actueel record uit de Linked Data Voorziening van de Rijksdienst voor het Cultureel Erfgoed.",
    registrationDate: record.registrationDate,
    official: true,
    sourceUrl: hasOwnOfficialUrl
      ? (record.officialUrl ?? record.sourceUrl)
      : isComplex || isOnderzoeksgebied || isArcheologischTerrein || isVondstlocatie || isGrondspoor
        ? record.sourceUrl
        : record.monumentNumber
          ? `${MONUMENT_REGISTER_BASE_URL}${encodeURIComponent(record.monumentNumber)}`
          : record.sourceUrl,
    linkedDataUrl: record.sourceUrl,
    wkt: record.wkt,
    parcels: record.parcels,
    archaeologicalSites: record.archaeologicalSites,
    complexes: record.complexes,
    complexMemberCount: record.complexMemberCount,
    image: record.image,
    groenaanleg: record.groenaanleg,
    msp: record.msp,
    literature: record.literature,
    gebeurtenissen: record.gebeurtenissen,
    archaeologicalValuation: record.archaeologicalValuation,
    archaeologicalValuationConceptUri: record.archaeologicalValuationConceptUri,
    archaeologicalAcquisition: record.archaeologicalAcquisition,
    archaeologicalAcquisitionConceptUri: record.archaeologicalAcquisitionConceptUri,
    archaeologicalTraceCount: record.archaeologicalTraceCount,
    archaeologicalType: record.archaeologicalType,
    archaeologicalTypeConceptUri: record.archaeologicalTypeConceptUri,
    archaeologicalTypeSchemes: record.archaeologicalTypeSchemes,
    parentObjectUrl: record.parentObjectUrl,
    parentObjectLabel: record.parentObjectLabel,
    matchSource: record.matchSource,
    matchedText,
    matchScore: record.matchScore,
    legalStatus: record.legalStatus,
    originalFunctionNames,
    currentFunctionNames: record.currentFunctionNames,
    typeNames: record.typeNames,
    lat: record.lat ?? 0,
    lng: record.lng ?? 0,
    monumentAardConcept:
      record.monumentAardConceptUri && record.monumentNature
        ? { uri: record.monumentAardConceptUri, label: record.monumentNature }
        : undefined,
  };
}

export function parseUrlState(search: string) {
  const params = new URLSearchParams(search);
  const objectType = params.get("soort");
  const monumentAard = params.get("aard");
  const province = params.get("provincie");
  const municipality = params.get("gemeente");
  const conceptField = params.get("veld");
  const parsedConceptField: ConceptField | undefined =
    conceptField === "monumentaard" ||
    conceptField === "waardering" ||
    conceptField === "gebeurtenis" ||
    conceptField === "actor"
      ? conceptField
      : undefined;
  const page = Number(params.get("pagina") ?? "1");
  const mapLat = Number(params.get("lat"));
  const mapLng = Number(params.get("lng"));
  const mapZoom = Number(params.get("zoom"));
  const mapViewport =
    params.has("lat") &&
    params.has("lng") &&
    params.has("zoom") &&
    Number.isFinite(mapLat) &&
    mapLat >= -90 &&
    mapLat <= 90 &&
    Number.isFinite(mapLng) &&
    mapLng >= -180 &&
    mapLng <= 180 &&
    Number.isInteger(mapZoom) &&
    mapZoom >= 1 &&
    mapZoom <= 19
      ? { lat: mapLat, lng: mapLng, zoom: mapZoom }
      : undefined;
  const termUri = params.get("begrip");
  const termSourceUri = params.get("begripbron");
  const termSourceName = params.get("begripbronnaam");
  const selectedTerm =
    termUri && termSourceUri && termSourceName
      ? {
          uri: termUri,
          label: params.get("q") ?? "",
          sourceUri: termSourceUri,
          sourceName: termSourceName,
        }
      : undefined;
  return {
    query: params.get("q") ?? "",
    conceptUri: params.get("concept") ?? "",
    conceptField: parsedConceptField,
    selectedTerm,
    objectType:
      objectType === "Rijksmonument" ||
      objectType === "Werelderfgoed" ||
      objectType === "Gezicht" ||
      objectType === "Complex" ||
      objectType === "Archeologisch terrein" ||
      objectType === "Vondstlocatie" ||
      objectType === "Grondspoor" ||
      objectType === "Onderzoeksgebied"
        ? objectType
        : "Alle",
    monumentAard:
      monumentAard === "Gebouwd" || monumentAard === "Archeologisch"
        ? monumentAard
        : "Alle",
    province: province || "Alle",
    municipality: municipality || "Alle",
    functionFilter: params.get("functie") ?? "Alle",
    matchSourceFilter: params.get("bron") ?? "Alle",
    excludedStatuses:
      params.get("uitgesloten")?.split(",").filter(Boolean) ?? [],
    onlyGroenaanleg: params.get("groenaanleg") === "1",
    onlyMsp: params.get("msp") === "1",
    view: params.get("view") === "map" ? ("map" as const) : ("list" as const),
    mapViewport,
    selectedId: params.get("object") ?? params.get("rm") ?? "",
    page: Number.isInteger(page) && page > 0 && page <= 20 ? page : 1,
  };
}

export function readUrlState() {
  return typeof window === "undefined"
    ? EMPTY_URL_STATE
    : parseUrlState(window.location.search);
}
