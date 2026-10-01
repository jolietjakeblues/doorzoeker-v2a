import { useCallback, useMemo } from "react";
import { statusLabel, type Item } from "@/lib/heritage-view-model";

type FilterState = {
  functionFilter: string;
  objectType: string;
  monumentAard: string;
  province: string;
  municipality: string;
  matchSourceFilter: string;
  excludedCategories: string[];
  onlyGroenaanleg: boolean;
  onlyMsp: boolean;
  onlyTop100Wederopbouw: boolean;
};

export function useFilteredResults(baseResults: Item[], filters: FilterState) {
  const matchesFilters = useCallback(
    (item: Item, skip?: "groenaanleg" | "msp" | "top100wederopbouw") =>
      (filters.functionFilter === "Alle" ||
        [item.kind, ...(item.originalFunctionNames ?? []), ...(item.currentFunctionNames ?? [])].includes(filters.functionFilter)) &&
      (filters.objectType === "Alle" || item.objectType === filters.objectType) &&
      (filters.monumentAard === "Alle" || item.monumentAard === filters.monumentAard) &&
      (filters.province === "Alle" || item.province === filters.province) &&
      (filters.municipality === "Alle" || item.municipality === filters.municipality) &&
      (filters.matchSourceFilter === "Alle" || item.matchSource === filters.matchSourceFilter) &&
      !filters.excludedCategories.includes(statusLabel(item.objectType)) &&
      (skip === "groenaanleg" || !filters.onlyGroenaanleg || Boolean(item.groenaanleg)) &&
      (skip === "msp" || !filters.onlyMsp || item.msp === true) &&
      (skip === "top100wederopbouw" || !filters.onlyTop100Wederopbouw || item.top100Wederopbouw === true),
    [filters],
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
  const top100WederopbouwCount = useMemo(
    () => baseResults.filter((item) => matchesFilters(item, "top100wederopbouw") && item.top100Wederopbouw === true).length,
    [baseResults, matchesFilters],
  );

  return { results, groenaanlegCount, mspCount, top100WederopbouwCount };
}
