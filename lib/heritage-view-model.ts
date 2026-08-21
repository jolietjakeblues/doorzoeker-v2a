import {
  OBJECT_KIND,
  provinceName,
  type ArcheologischTerrein,
  type ArchaeologyConcept,
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
    | "Vondst"
    | "Archeologisch complex"
    | "Onderzoeksgebied"
    | "Scheepswrak";
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
  stijlEnCultuur?: string;
  stijlEnCultuurConcept?: { uri: string; label: string };
  bouwkundigeStaat?: string;
  bouwkundigeStaatConcept?: { uri: string; label: string };
  originalFunctionNames?: string[];
  currentFunctionNames?: string[];
  functionConcepts?: { uri: string; label: string }[];
  typeNames?: string[];
  typeConcepts?: { uri: string; label: string }[];
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
  parentObjectNumber?: string;
  archaeologicalFindCount?: number;
  archaeologicalFindTypes?: ArchaeologyConcept[];
  archaeologicalMaterials?: ArchaeologyConcept[];
  archaeologicalStyles?: ArchaeologyConcept[];
  archaeologicalCondition?: ArchaeologyConcept;
  archaeologicalComplexType?: ArchaeologyConcept;
  archaeologicalContexts?: { uri: string; choNumber: string; label: string; type: "Vondstlocatie" | "Archeologisch terrein" | "Onderzoeksgebied" }[];
  oppervlakteInHectare?: number;
  inProceduredatumGezicht?: string;
  begrenzingsdatumGezicht?: string;
  intrekkingsdatumGezicht?: string;
  omschrijvingOnderwerpConcepten?: { uri: string; label: string; bron: string }[];
  scheepstype?: string;
  omschrijvingHtml?: string;
  ontdekt?: string;
  licentieNaam?: string;
  licentieUrl?: string;
};

export const EMPTY_ITEMS: Item[] = [];
// Eén bron van waarheid voor de 14 navigeerbare conceptvelden (TD-05). De
// eerdere aanpak - dit union type onafhankelijk als losse letterlijke
// string-union herhalen in app/api/rce/search/route.ts, lib/rce-client.ts
// en de parseUrlState-allowlist hieronder - raakte uit sync: 5 van de 14
// velden (stijl, bouwkundigestaat, verwerving, grondspoortype,
// monumenttype) ontbraken in die allowlist, waardoor een gedeelde link met
// die velden na page reload conceptField niet herstelde (bugfix
// 17-08-2026).
export const CONCEPT_FIELDS = [
  "functie",
  "monumentaard",
  "waardering",
  "gebeurtenis",
  "actor",
  "vondsttype",
  "materiaal",
  "toestand",
  "archeologischcomplextype",
  "stijl",
  "bouwkundigestaat",
  "verwerving",
  "grondspoortype",
  "monumenttype",
] as const;
export type ConceptField = (typeof CONCEPT_FIELDS)[number];
const CONCEPT_FIELD_SET: ReadonlySet<string> = new Set(CONCEPT_FIELDS);
export function isConceptField(value: string | null): value is ConceptField {
  return value !== null && CONCEPT_FIELD_SET.has(value);
}
export type LinkedConcept = {
  uri: string;
  label: string;
  field: ConceptField;
  group: string;
};

export function linkedConcepts(item: Item): LinkedConcept[] {
  const concepts: LinkedConcept[] = [];
  for (const concept of item.functionConcepts ?? [])
    concepts.push({ ...concept, field: "functie", group: "Functie" });
  for (const concept of item.typeConcepts ?? [])
    concepts.push({ ...concept, field: "monumenttype", group: "Type" });
  if (item.monumentAardConcept)
    concepts.push({
      ...item.monumentAardConcept,
      field: "monumentaard",
      group: "Monumentaard",
    });
  if (item.archaeologicalValuation && item.archaeologicalValuationConceptUri)
    concepts.push({
      uri: item.archaeologicalValuationConceptUri,
      label: item.archaeologicalValuation,
      field: "waardering",
      group: "Waardering",
    });
  for (const concept of item.archaeologicalFindTypes ?? [])
    concepts.push({ ...concept, field: "vondsttype", group: "Vondsttype" });
  for (const concept of item.archaeologicalMaterials ?? [])
    concepts.push({ ...concept, field: "materiaal", group: "Materiaal" });
  if (item.archaeologicalCondition)
    concepts.push({
      ...item.archaeologicalCondition,
      field: "toestand",
      group: "Toestand",
    });
  if (item.archaeologicalComplexType)
    concepts.push({
      ...item.archaeologicalComplexType,
      field: "archeologischcomplextype",
      group: "Archeologisch complextype",
    });
  if (item.stijlEnCultuurConcept)
    concepts.push({
      ...item.stijlEnCultuurConcept,
      field: "stijl",
      group: "Stijl en cultuur",
    });
  if (item.bouwkundigeStaatConcept)
    concepts.push({
      ...item.bouwkundigeStaatConcept,
      field: "bouwkundigestaat",
      group: "Bouwkundige staat",
    });
  if (item.archaeologicalAcquisition && item.archaeologicalAcquisitionConceptUri)
    concepts.push({
      uri: item.archaeologicalAcquisitionConceptUri,
      label: item.archaeologicalAcquisition,
      field: "verwerving",
      group: "Verwervingswijze",
    });
  if (item.archaeologicalType && item.archaeologicalTypeConceptUri)
    concepts.push({
      uri: item.archaeologicalTypeConceptUri,
      label: item.archaeologicalType,
      field: "grondspoortype",
      group: "Type grondspoor",
    });
  return concepts;
}

// item.kind komt uit een andere query (de detailsquery, via toItem's eigen
// precedentie) dan item.functionConcepts (de facettenquery) - beide kunnen
// bij een monument met een afwijkende oorspronkelijke/huidige functie in een
// andere volgorde binnenkomen. Matchen op label (na dezelfde
// displayFunctionName-opschoning) voorkomt dat een klik op de zichtbare
// functietekst een ander concept zoekt dan wat er staat; zonder match is het
// eerste concept een redelijke terugval.
export function functionConceptForLabel(
  item: Pick<Item, "functionConcepts">,
  label: string,
): { uri: string; label: string } | undefined {
  return item.functionConcepts?.find(
    (concept) => displayFunctionName(concept.label) === label,
  );
}

export function primaryFunctionConcept(
  item: Pick<Item, "kind" | "functionConcepts">,
): { uri: string; label: string } | undefined {
  return (
    (item.kind ? functionConceptForLabel(item, item.kind) : undefined) ??
    item.functionConcepts?.[0]
  );
}

// item.typeNames (platte labels) en item.typeConcepts (uri+label-paren)
// komen uit dezelfde facettenquery maar zijn onafhankelijk gededupliceerd -
// zelfde reden als functionConceptForLabel hierboven.
export function typeConceptForLabel(
  item: Pick<Item, "typeConcepts">,
  label: string,
): { uri: string; label: string } | undefined {
  return item.typeConcepts?.find(
    (concept) => displayFunctionName(concept.label) === label,
  );
}

const VERGELIJKBARE_RIJKSMONUMENTEN_LIMIT = 5;

// "Vergelijkbare rijksmonumenten" (docs/vertical-slices/008), fase 1:
// zelfde functie-concept-URI. De server-zoekopdracht kan het geopende
// monument zelf meesturen (het matcht immers zijn eigen functie) en is
// begrensd op 25, niet op de kleine 5 die de UI toont - dit filtert en
// begrenst dat resultaat tot een presenteerbare lijst.
export function pickVergelijkbareRijksmonumenten(
  candidates: Item[],
  excludeMonumentNumber: string | undefined,
  limit: number = VERGELIJKBARE_RIJKSMONUMENTEN_LIMIT,
): Item[] {
  return candidates
    .filter((candidate) => candidate.monumentNumber !== excludeMonumentNumber)
    .slice(0, limit);
}

export type MapViewport = { lat: number; lng: number; zoom: number };
export type BrowseKind = "rijksmonument" | "archeologischterrein" | "onderzoeksgebied" | "vondstlocatie" | "archeologischcomplex" | "vondsten" | "grondsporen" | "werelderfgoed" | "gezicht" | "complex";
export type SelectedTermIdentity = {
  uri: string;
  label: string;
  sourceUri: string;
  sourceName: string;
};

export const EMPTY_URL_STATE = {
  query: "",
  browseKind: undefined as BrowseKind | undefined,
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
// Vervangt de dode archisarchief.cultureelerfgoed.nl-link (zie
// hasOwnOfficialUrl hieronder) - per gezichtsnummer bevestigd live
// (bv. .../1325 -> Orvelte, .../1734 -> Radio Kootwijk).
export const GEZICHT_KENNISBANK_BASE_URL =
  "https://kennis.cultureelerfgoed.nl/index.php/Gezicht/";

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
  if (item.objectType === "Vondstlocatie") return { letter: "L", modifier: "dig" };
  if (item.objectType === "Grondspoor") return { letter: "S", modifier: "dig" };
  if (item.objectType === "Vondst") return { letter: "V", modifier: "sand" };
  if (item.objectType === "Archeologisch complex") return { letter: "A", modifier: "complex" };
  if (item.objectType === "Scheepswrak") return { letter: "R", modifier: "wreck" };
  // Archeologisch Rijksmonument krijgt geen eigen letter (gemeld door de
  // eigenaar, 21 augustus 2026: "Het zijn Rijksmonumenten -> M") - alleen
  // de tegelkleur ("sand") maakt het onderscheid met gebouwd. Bijkomend
  // voordeel: "A" was hierdoor eerder dubbel met Archeologisch complex.
  if (item.monumentAard === "Archeologisch")
    return { letter: "M", modifier: "sand" };
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
  if (objectType === "Vondst") return "Archeologische vondst";
  if (objectType === "Archeologisch complex") return "Archeologisch complex";
  if (objectType === "Scheepswrak") return "Scheepswrak (MASS)";
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
  if (item.objectType === "Vondst") return { label: item.monumentNumber !== item.objectNumber ? "Archis" : "CHO", value };
  if (item.objectType === "Archeologisch complex") return { label: "CHO", value };
  if (item.objectType === "Scheepswrak") return { label: "MASS", value };
  return { label: "Onderzoeksgebied", value };
}

export function toItem(record: RceMonument): Item {
  const functionName = record.functionName
    ? displayFunctionName(record.functionName)
    : "";
  const originalFunctionNames = record.originalFunctionNames
    ?.map(displayFunctionName)
    .filter(Boolean);
  const currentFunctionNames = record.currentFunctionNames
    ?.map(displayFunctionName)
    .filter(Boolean);
  const matchedText =
    (record.matchSource === "oorspronkelijke functie" || record.matchSource === "huidige functie" || record.matchSource === "type") && record.matchedText
      ? displayFunctionName(record.matchedText)
      : record.matchedText;
  // Type-namen krijgen dezelfde (code)-opschoning als functienamen hierboven
  // (gemeld door de eigenaar, 21 augustus 2026: "Woonhuis(K)" - deep in het
  // systeem betekenisvol, voor de gebruiker ruis). Gededupliceerd ná het
  // opschonen, niet ervoor: "Boerderij(M)" en "Boerderij(M1)" zijn losse
  // concepten met elk hun eigen URI, maar worden als tekst hetzelfde -
  // zonder Set zou de lijst twee keer "Boerderij" tonen.
  const typeNames = record.typeNames?.length
    ? [...new Set(record.typeNames.map(displayFunctionName))]
    : record.typeNames;
  const typeConcepts = record.typeConcepts?.map((concept) => ({
    ...concept,
    label: displayFunctionName(concept.label),
  }));
  const functionConcepts = record.functionConcepts?.map((concept) => ({
    ...concept,
    label: displayFunctionName(concept.label),
  }));
  const isWerelderfgoed = record.monumentNature === OBJECT_KIND.Werelderfgoed;
  const isGezicht = record.monumentNature === OBJECT_KIND.Gezicht;
  const isComplex = record.monumentNature === OBJECT_KIND.Complex;
  const isOnderzoeksgebied =
    record.monumentNature === OBJECT_KIND.ArcheologischOnderzoeksgebied;
  const isArcheologischTerrein = record.monumentNature === OBJECT_KIND.ArcheologischTerrein;
  const isVondstlocatie = record.monumentNature === OBJECT_KIND.Vondstlocatie;
  const isGrondspoor = record.monumentNature === OBJECT_KIND.Grondsporen;
  const isVondst = record.monumentNature === OBJECT_KIND.Vondsten;
  const isArcheologischComplex = record.monumentNature === OBJECT_KIND.ArcheologischComplex;
  const isScheepswrak = record.monumentNature === OBJECT_KIND.Scheepswrak;
  // Gezicht bewust NIET hier: ceo:wordtGetoondOp wijst voor alle 472
  // rijksbeschermde gezichten naar archisarchief.cultureelerfgoed.nl, een
  // domein dat inmiddels zelf op de root al 403/404 geeft (leeg
  // archief, geen tijdelijke storing - empirisch gecontroleerd op
  // meerdere gezichtsnummers). De link viel dus voor iedereen dood.
  const hasOwnOfficialUrl = isWerelderfgoed || isScheepswrak;
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
              : isVondst
                ? "Vondst"
              : isArcheologischComplex
                ? "Archeologisch complex"
              : isScheepswrak
                ? "Scheepswrak"
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
          : isVondst
            ? `Vondst ${record.monumentNumber}`
          : isArcheologischComplex
            ? `Archeologisch complex ${record.monumentNumber}`
          : isScheepswrak
            ? `Scheepswrak ${record.monumentNumber}`
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
    sourceUrl: isGezicht
      ? record.monumentNumber
        ? `${GEZICHT_KENNISBANK_BASE_URL}${encodeURIComponent(record.monumentNumber)}`
        : record.sourceUrl
      : hasOwnOfficialUrl
        ? (record.officialUrl ?? record.sourceUrl)
        : isComplex || isOnderzoeksgebied || isArcheologischTerrein || isVondstlocatie || isGrondspoor || isVondst || isArcheologischComplex
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
    parentObjectNumber: record.parentObjectNumber,
    archaeologicalFindCount: record.archaeologicalFindCount,
    archaeologicalFindTypes: record.archaeologicalFindTypes,
    archaeologicalMaterials: record.archaeologicalMaterials,
    archaeologicalStyles: record.archaeologicalStyles,
    archaeologicalCondition: record.archaeologicalCondition,
    archaeologicalComplexType: record.archaeologicalComplexType,
    archaeologicalContexts: record.archaeologicalContexts,
    oppervlakteInHectare: record.oppervlakteInHectare,
    inProceduredatumGezicht: record.inProceduredatumGezicht,
    begrenzingsdatumGezicht: record.begrenzingsdatumGezicht,
    intrekkingsdatumGezicht: record.intrekkingsdatumGezicht,
    omschrijvingOnderwerpConcepten: record.omschrijvingOnderwerpConcepten,
    scheepstype: record.scheepstype,
    omschrijvingHtml: record.omschrijvingHtml,
    ontdekt: record.ontdekt,
    licentieNaam: record.licentieNaam,
    licentieUrl: record.licentieUrl,
    matchSource: record.matchSource,
    matchedText,
    matchScore: record.matchScore,
    legalStatus: record.legalStatus,
    stijlEnCultuur: record.stijlEnCultuur,
    stijlEnCultuurConcept:
      record.stijlEnCultuur && record.stijlEnCultuurConceptUri
        ? { uri: record.stijlEnCultuurConceptUri, label: record.stijlEnCultuur }
        : undefined,
    bouwkundigeStaat: record.bouwkundigeStaat,
    bouwkundigeStaatConcept:
      record.bouwkundigeStaat && record.bouwkundigeStaatConceptUri
        ? { uri: record.bouwkundigeStaatConceptUri, label: record.bouwkundigeStaat }
        : undefined,
    originalFunctionNames,
    currentFunctionNames,
    functionConcepts,
    typeNames,
    typeConcepts,
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
  const browse = params.get("browse");
  const parsedBrowseKind: BrowseKind | undefined =
    browse === "rijksmonument" ||
    browse === "archeologischterrein" ||
    browse === "onderzoeksgebied" ||
    browse === "vondstlocatie" ||
    browse === "archeologischcomplex" ||
    browse === "vondsten" ||
    browse === "grondsporen" ||
    browse === "werelderfgoed" ||
    browse === "gezicht" ||
    browse === "complex"
      ? browse
      : undefined;
  const objectType = params.get("soort");
  const monumentAard = params.get("aard");
  const province = params.get("provincie");
  const municipality = params.get("gemeente");
  const conceptField = params.get("veld");
  const parsedConceptField: ConceptField | undefined = isConceptField(conceptField) ? conceptField : undefined;
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
    browseKind: parsedBrowseKind,
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
      objectType === "Vondst" ||
      objectType === "Archeologisch complex" ||
      objectType === "Onderzoeksgebied" ||
      objectType === "Scheepswrak"
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
