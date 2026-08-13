import { useEffect, useState } from "react";
import { fetchComplexMembers, fetchOnderzoeksgebiedVerrijking, fetchVondstlocatieInhoud, searchByFunctieConcept } from "@/lib/rce-client";
import type { ComplexMember, OnderzoeksgebiedAggregaten, OnderzoeksgebiedComplex, OnderzoeksgebiedVondstlocatie, VondstlocatieInhoud } from "@/lib/rce";
import { pickVergelijkbareRijksmonumenten, toItem, type Item } from "@/lib/heritage-view-model";

// Complexleden, de archeologische verrijking van een Onderzoeksgebied en
// vergelijkbare rijksmonumenten (docs/vertical-slices/008) zijn geen
// onderdeel van de gewone zoekresultaten (dat zou de resultatenlijst
// overspoelen) - pas ophalen zodra een gebruiker zo'n record daadwerkelijk
// opent. Ze hangen alle drie aan hetzelfde `selected`-record en horen
// daarom bij elkaar in één hook, ook al zijn het losse lazy-lookups.
export function useSelectedDetailEnrichment(selected: Item | null) {
  const [complexMembers, setComplexMembers] = useState<{ complexUri: string; members: ComplexMember[]; error?: boolean } | null>(null);
  const [onderzoeksgebiedVerrijking, setOnderzoeksgebiedVerrijking] = useState<({ gebiedUri: string; complexen: OnderzoeksgebiedComplex[]; vondstlocaties: OnderzoeksgebiedVondstlocatie[]; error?: boolean } & OnderzoeksgebiedAggregaten) | null>(null);
  const [vondstlocatieInhoud, setVondstlocatieInhoud] = useState<({ locatieUri: string; error?: boolean } & VondstlocatieInhoud) | null>(null);
  const [vergelijkbareRijksmonumenten, setVergelijkbareRijksmonumenten] = useState<{ conceptUri: string; conceptLabel: string; items: Item[]; error?: boolean } | null>(null);

  // `error: true` houdt een mislukte aanvraag onderscheidbaar van een echt
  // lege-maar-geldige respons (bv. een complex zonder leden) - zonder dit
  // vlagje zag een tijdelijke storing er voor de gebruiker identiek uit als
  // "hier is niets", zonder herkenbare fout of retry-mogelijkheid.
  useEffect(() => {
    if (selected?.objectType !== "Complex" || !selected.linkedDataUrl) return;
    const complexUri = selected.linkedDataUrl;
    const controller = new AbortController();
    fetchComplexMembers(complexUri, controller.signal)
      .then((members) => { if (!controller.signal.aborted) setComplexMembers({ complexUri, members }); })
      .catch(() => { if (!controller.signal.aborted) setComplexMembers({ complexUri, members: [], error: true }); });
    return () => controller.abort();
  }, [selected]);

  useEffect(() => {
    if (selected?.objectType !== "Onderzoeksgebied" || !selected.linkedDataUrl) return;
    const gebiedUri = selected.linkedDataUrl;
    const controller = new AbortController();
    fetchOnderzoeksgebiedVerrijking(gebiedUri, controller.signal)
      .then((data) => { if (!controller.signal.aborted) setOnderzoeksgebiedVerrijking({ gebiedUri, ...data }); })
      .catch(() => { if (!controller.signal.aborted) setOnderzoeksgebiedVerrijking({ gebiedUri, complexen: [], vondstlocaties: [], vondstlocatieTotaal: 0, grondsporenTotaal: 0, vondstenTotaal: 0, complexenViaVondstlocatieTotaal: 0, error: true }); });
    return () => controller.abort();
  }, [selected]);

  useEffect(() => {
    if (selected?.objectType !== "Vondstlocatie" || !selected.linkedDataUrl) return;
    const locatieUri = selected.linkedDataUrl;
    const controller = new AbortController();
    fetchVondstlocatieInhoud(locatieUri, controller.signal)
      .then((data) => { if (!controller.signal.aborted) setVondstlocatieInhoud({ locatieUri, ...data }); })
      .catch(() => { if (!controller.signal.aborted) setVondstlocatieInhoud({ locatieUri, complexen: [], vondsten: [], grondsporen: [], complexenTotaal: 0, vondstenTotaal: 0, grondsporenTotaal: 0, error: true }); });
    return () => controller.abort();
  }, [selected]);

  useEffect(() => {
    const concept = selected?.objectType === "Rijksmonument" ? selected.functionConcepts?.[0] : undefined;
    if (!concept || !selected?.monumentNumber) return;
    const monumentNumber = selected.monumentNumber;
    const controller = new AbortController();
    searchByFunctieConcept(concept.uri, controller.signal)
      .then((records) => {
        if (controller.signal.aborted) return;
        const items = pickVergelijkbareRijksmonumenten(records.map((record) => toItem(record)), monumentNumber);
        setVergelijkbareRijksmonumenten({ conceptUri: concept.uri, conceptLabel: concept.label, items });
      })
      .catch(() => { if (!controller.signal.aborted) setVergelijkbareRijksmonumenten({ conceptUri: concept.uri, conceptLabel: concept.label, items: [], error: true }); });
    return () => controller.abort();
  }, [selected]);

  return { complexMembers, onderzoeksgebiedVerrijking, vondstlocatieInhoud, vergelijkbareRijksmonumenten };
}
