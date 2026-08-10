import { useCallback, useMemo } from "react";
import { statusLabel, type Item } from "@/lib/heritage-view-model";

type FilterState = {
  functionFilter: string;
  objectType: string;
  monumentAard: string;
  province: string;
  municipality: string;
  matchSourceFilter: string;
  excludedStatuses: string[];
  onlyGroenaanleg: boolean;
  onlyMsp: boolean;
};

export function useFilteredResults(baseResults: Item[], filters: FilterState) {
  const matchesFilters = useCallback(
    (item: Item, skip?: "groenaanleg" | "msp") =>
      (filters.functionFilter === "Alle" ||
        [item.kind, ...(item.originalFunctionNames ?? []), ...(item.currentFunctionNames ?? [])].includes(filters.functionFilter)) &&
      (filters.objectType === "Alle" || item.objectType === filters.objectType) &&
      (filters.monumentAard === "Alle" || item.monumentAard === filters.monumentAard) &&
      (filters.province === "Alle" || item.province === filters.province) &&
      (filters.municipality === "Alle" || item.municipality === filters.municipality) &&
      (filters.matchSourceFilter === "Alle" || item.matchSource === filters.matchSourceFilter) &&
      !filters.excludedStatuses.includes(statusLabel(item.objectType)) &&
      (skip === "groenaanleg" || !filters.onlyGroenaanleg || Boolean(item.groenaanleg)) &&
      (skip === "msp" || !filters.onlyMsp || item.msp === true),
    [filters],
  );

  const functions = useMemo(
    () =>
      [
        ...new Set(
          baseResults
            .flatMap((item) => [
              ...(item.originalFunctionNames ?? []),
              ...(item.currentFunctionNames ?? []),
              item.kind,
            ])
            .filter((kind) => kind !== "Functie niet opgenomen"),
        ),
      ].sort((a, b) => a.localeCompare(b, "nl")),
    [baseResults],
  );
  const provinces = useMemo(
    () =>
      [
        ...new Set(baseResults.map((item) => item.province).filter(Boolean)),
      ].sort((a, b) => a.localeCompare(b, "nl")),
    [baseResults],
  );
  const municipalities = useMemo(
    () =>
      [
        ...new Set(
          baseResults
            .filter(
              (item) =>
                filters.province === "Alle" ||
                item.province === filters.province,
            )
            .map((item) => item.municipality)
            .filter(Boolean),
        ),
      ].sort((a, b) => a.localeCompare(b, "nl")),
    [baseResults, filters.province],
  );
  const matchSources = useMemo(
    () => [
      ...new Set(
        baseResults
          .map((item) => item.matchSource)
          .filter((source): source is string => Boolean(source)),
      ),
    ],
    [baseResults],
  );
  const results = useMemo(
    () => baseResults.filter((item) => matchesFilters(item)),
    [baseResults, matchesFilters],
  );

  const groenaanlegCount = useMemo(
    () => baseResults.filter((item) => matchesFilters(item, "groenaanleg") && item.groenaanleg).length,
    [baseResults, matchesFilters],
  );
  const mspCount = useMemo(
    () => baseResults.filter((item) => matchesFilters(item, "msp") && item.msp === true).length,
    [baseResults, matchesFilters],
  );

  return { functions, provinces, municipalities, matchSources, results, groenaanlegCount, mspCount };
}
