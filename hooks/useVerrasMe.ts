import { useEffect, useRef, useState } from "react";
import { fetchVerrasMe } from "@/lib/rce-client";
import { toItem, type Item } from "@/lib/heritage-view-model";

// Op klik aangeroepen vanuit het startpaneel, geen idle-load - toont een
// willekeurig gebouwd Rijksmonument met afbeelding (zie
// docs/vertical-slices/014-verras-me.md). Faalt stil (geen foutmelding) in
// plaats van een foutmelding te tonen - dit is een leuk extraatje, geen
// kernfunctie, zelfde aanpak als useOpDezeDag.
export function useVerrasMe() {
  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  function trigger() {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true);
    fetchVerrasMe(controller.signal)
      .then((monument) => {
        if (controller.signal.aborted) return;
        setItem(monument ? toItem(monument) : null);
      })
      .catch(() => {
        if (!controller.signal.aborted) setItem(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
  }

  return { item, loading, trigger };
}
