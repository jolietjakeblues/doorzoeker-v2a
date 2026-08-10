import { useEffect, useState } from "react";
import { fetchComplexMembers, fetchOnderzoeksgebiedVerrijking, fetchVondstlocatieInhoud } from "@/lib/rce-client";
import type { ComplexMember, OnderzoeksgebiedAggregaten, OnderzoeksgebiedComplex, OnderzoeksgebiedVondstlocatie, VondstlocatieInhoud } from "@/lib/rce";
import type { Item } from "@/lib/heritage-view-model";

// Complexleden en de archeologische verrijking van een Onderzoeksgebied zijn
// geen onderdeel van de gewone zoekresultaten (dat zou de resultatenlijst
// overspoelen) - pas ophalen zodra een gebruiker zo'n record daadwerkelijk
// opent. Beide hangen aan hetzelfde `selected`-record en horen daarom bij
// elkaar in één hook, ook al zijn het twee losse lazy-lookups.
export function useSelectedDetailEnrichment(selected: Item | null) {
  const [complexMembers, setComplexMembers] = useState<{ complexUri: string; members: ComplexMember[] } | null>(null);
  const [onderzoeksgebiedVerrijking, setOnderzoeksgebiedVerrijking] = useState<{ gebiedUri: string; complexen: OnderzoeksgebiedComplex[]; vondstlocaties: OnderzoeksgebiedVondstlocatie[] } & OnderzoeksgebiedAggregaten | null>(null);
  const [vondstlocatieInhoud, setVondstlocatieInhoud] = useState<({ locatieUri: string } & VondstlocatieInhoud) | null>(null);

  useEffect(() => {
    if (selected?.objectType !== "Complex" || !selected.linkedDataUrl) return;
    const complexUri = selected.linkedDataUrl;
    const controller = new AbortController();
    fetchComplexMembers(complexUri, controller.signal)
      .then((members) => { if (!controller.signal.aborted) setComplexMembers({ complexUri, members }); })
      .catch(() => { if (!controller.signal.aborted) setComplexMembers({ complexUri, members: [] }); });
    return () => controller.abort();
  }, [selected]);

  useEffect(() => {
    if (selected?.objectType !== "Onderzoeksgebied" || !selected.linkedDataUrl) return;
    const gebiedUri = selected.linkedDataUrl;
    const controller = new AbortController();
    fetchOnderzoeksgebiedVerrijking(gebiedUri, controller.signal)
      .then((data) => { if (!controller.signal.aborted) setOnderzoeksgebiedVerrijking({ gebiedUri, ...data }); })
      .catch(() => { if (!controller.signal.aborted) setOnderzoeksgebiedVerrijking({ gebiedUri, complexen: [], vondstlocaties: [], vondstlocatieTotaal: 0, grondsporenTotaal: 0, vondstenTotaal: 0, complexenViaVondstlocatieTotaal: 0 }); });
    return () => controller.abort();
  }, [selected]);

  useEffect(() => {
    if (selected?.objectType !== "Vondstlocatie" || !selected.linkedDataUrl) return;
    const locatieUri = selected.linkedDataUrl;
    const controller = new AbortController();
    fetchVondstlocatieInhoud(locatieUri, controller.signal)
      .then((data) => { if (!controller.signal.aborted) setVondstlocatieInhoud({ locatieUri, ...data }); })
      .catch(() => { if (!controller.signal.aborted) setVondstlocatieInhoud({ locatieUri, complexen: [], vondsten: [], grondsporen: [], complexenTotaal: 0, vondstenTotaal: 0, grondsporenTotaal: 0 }); });
    return () => controller.abort();
  }, [selected]);

  return { complexMembers, onderzoeksgebiedVerrijking, vondstlocatieInhoud };
}
