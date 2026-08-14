import type { ArchaeologyConcept, ArcheologischTerrein } from "./archaeology.ts";
import type { ComplexMembership, RceParcel } from "./monuments.ts";

// `RceMonument.monumentNature` heeft twee rollen: voor een Rijksmonument
// bevat het het echte SKOS-`monumentaard`-label (bv. "onroerend gebouwd"),
// voor de overige objectsoorten dient het als een vast, intern
// discriminatie-label. Deze constanten zijn de enige plek waar die tweede
// rol als letterlijke string wordt vastgelegd - producenten (archaeology.ts,
// monuments.ts) en consumenten (heritage-view-model.ts, de zoekroute) lezen
// hem allebei via `OBJECT_KIND`, zodat een typefout of hernoeming een
// compilerfout geeft in plaats van stil de classificatie te breken.
export const OBJECT_KIND = {
  Werelderfgoed: "werelderfgoed",
  Gezicht: "gezicht",
  Complex: "complex",
  ArcheologischOnderzoeksgebied: "archeologischonderzoeksgebied",
  ArcheologischTerrein: "archeologischterrein",
  Vondstlocatie: "vondstlocatie",
  Grondsporen: "grondsporen",
  Vondsten: "vondsten",
  ArcheologischComplex: "archeologischcomplex",
} as const;
export type ObjectKind = (typeof OBJECT_KIND)[keyof typeof OBJECT_KIND];

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
  originalFunctionNames?: string[];
  currentFunctionNames?: string[];
  functionConcepts?: { uri: string; label: string }[];
  typeNames?: string[];
  legalStatus?: string;
  description?: string;
  monumentNature?: string;
  monumentAardConceptUri?: string;
  fullAddress?: string;
  place?: string;
  municipality?: string;
  provinceCode?: string;
  lat?: number;
  lng?: number;
  wkt?: string;
  stijlEnCultuur?: string;
  stijlEnCultuurConceptUri?: string;
  bouwkundigeStaat?: string;
  bouwkundigeStaatConceptUri?: string;
  parcels?: RceParcel[];
  matchSource?: string;
  matchedText?: string;
  matchScore?: number;
  archaeologicalSites?: ArcheologischTerrein[];
  complexes?: ComplexMembership[];
  officialUrl?: string;
  complexMemberCount?: number;
  image?: MonumentImage;
  groenaanleg?: Groenaanleg;
  msp?: boolean;
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
};

export type MonumentImage = { url: string; title?: string; license?: string; sourceUrl?: string };
export type Groenaanleg = { typeAanleg?: string; categorie?: string; image?: MonumentImage };
export type GebeurtenisActor = { naam: string; rol?: string; actorConceptUri?: string };
export type Gebeurtenis = { naam: string; naamConceptUri?: string; beginDatum?: string; eindDatum?: string; actoren: GebeurtenisActor[] };
export type LiteratureRef = { uri: string; title: string; year?: string; authors: string[]; sourceUrl?: string };
