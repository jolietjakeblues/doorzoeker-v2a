import { useEffect } from "react";

// Voorkomt dat de pagina erachter blijft scrollen terwijl een rechts
// uitgelijnd, zelf-scrollend paneel (bv. het detailpaneel) open staat - zonder
// dit blokkeert niets de paginascroll, terwijl de scrollbar van het paneel op
// exact dezelfde plek zit als die van de pagina, onduidelijk welke van de
// twee je aan het bedienen bent.
export function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [locked]);
}
