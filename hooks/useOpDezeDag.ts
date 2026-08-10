import { useEffect, useState } from "react";
import { fetchOpDezeDag } from "@/lib/rce-client";
import { toItem, type Item } from "@/lib/heritage-view-model";

// Eén keer opgehaald bij het laden van de pagina, niet gekoppeld aan een
// zoekopdracht - toont een Rijksmonument dat op de huidige kalenderdag is
// ingeschreven in het Monumentenregister (zie
// docs/vertical-slices/010-op-deze-dag.md). Faalt stil (geen widget) in
// plaats van een foutmelding te tonen - dit is een leuk extraatje op de
// startpagina, geen kernfunctie.
export function useOpDezeDag() {
  const [item, setItem] = useState<Item | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchOpDezeDag(controller.signal)
      .then((monument) => { if (!controller.signal.aborted && monument) setItem(toItem(monument)); })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  return item;
}
