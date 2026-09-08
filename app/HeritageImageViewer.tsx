"use client";

import { useEffect, useRef, useState } from "react";
import type OpenSeadragon from "openseadragon";
import { iiifSourceForImage, type MonumentImage } from "@/lib/rce";

// Zelfde patroon als HeritageMap.tsx's Leaflet-integratie: de zware,
// DOM-aanrakende bibliotheek laadt pas via een dynamische import binnen een
// effect (nooit tijdens SSR op de Worker), niet via een statische import.
// OpenSeadragon heeft, anders dan Leaflet, geen eigen CSS nodig - de
// standaard-navigatieknoppen staan bewust uit (showNavigationControl:
// false) zodat er geen extra icon-assets gehost hoeven te worden; de
// +/-/⟲-knoppen hieronder zijn gewone tekstknoppen, zelfde stijl als de
// bestaande ×-sluitknop.
export function HeritageImageViewer({
  image,
  title,
  badgeLetter,
  statusText,
  modifierClass,
}: {
  image: MonumentImage;
  title: string;
  badgeLetter: string;
  statusText: string;
  modifierClass: string;
}) {
  const iiifSource = iiifSourceForImage(image.url);
  const [expanded, setExpanded] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const osdElement = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<OpenSeadragon.Viewer | undefined>(undefined);

  useEffect(() => {
    // image.url (een primitieve string) als dependency, niet het per render
    // opnieuw aangemaakte iiifSource-object hierboven - anders zou elke
    // render (bv. door de ready/failed-state hieronder) dit effect als
    // "gewijzigd" zien en de viewer eindeloos afbreken/heropbouwen.
    const source = iiifSourceForImage(image.url);
    if (!expanded || !source) return;
    let cancelled = false;
    let viewer: OpenSeadragon.Viewer | undefined;
    // Zelfde omweg als HeritageMap.tsx: setState pas na een microtask, zodat
    // dit niet als een synchrone setState-tijdens-effect telt (cascaderende
    // renders) terwijl de laadstatus toch al bij de volgende render klopt.
    queueMicrotask(() => {
      if (!cancelled) setReady(false);
    });

    import("openseadragon").then((mod) => {
      if (cancelled || !osdElement.current) return;
      const OSD = mod.default;
      viewer = OSD({
        element: osdElement.current,
        tileSources: source.infoUrl,
        showNavigationControl: false,
        gestureSettingsMouse: { clickToZoom: false },
      });
      viewer.addHandler("open", () => {
        if (!cancelled) setReady(true);
      });
      // Een mislukte load (bv. een tijdelijk onbereikbare beeldserver) mag
      // nooit een kapotte, lege viewer laten staan - terugklappen naar de
      // gewone, wél werkende foto is de veiligere uitkomst dan een
      // eindeloze laadstatus of een leeg canvas.
      viewer.addHandler("open-failed", () => {
        if (!cancelled) {
          setFailed(true);
          setExpanded(false);
        }
      });
      viewerRef.current = viewer;
    });

    return () => {
      cancelled = true;
      viewer?.destroy();
      viewerRef.current = undefined;
    };
  }, [expanded, image.url]);

  if (!expanded) {
    return (
      <div
        className={`detail-head ${modifierClass} has-image`.trim()}
        style={{
          backgroundImage: `linear-gradient(0deg, #00000073, #00000073), url(${image.url})`,
        }}
      >
        <span className="tile-badge large">{badgeLetter}</span>
        <small>{statusText}</small>
        {iiifSource && !failed ? (
          <button
            type="button"
            className="detail-head-zoom"
            onClick={() => setExpanded(true)}
          >
            Vergroten
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className={`detail-head ${modifierClass} expanded`.trim()} aria-busy={!ready}>
      <div
        ref={osdElement}
        className="iiif-viewer"
        role="img"
        aria-label={`Ingezoomde foto: ${title}`}
      />
      {!ready && (
        <div className="map-loading" role="status">
          <span aria-hidden="true" />
          Foto laden
        </div>
      )}
      <div className="iiif-controls">
        <button
          type="button"
          aria-label="Inzoomen"
          onClick={() => viewerRef.current?.viewport.zoomBy(1.4)}
        >
          +
        </button>
        <button
          type="button"
          aria-label="Uitzoomen"
          onClick={() => viewerRef.current?.viewport.zoomBy(0.7)}
        >
          −
        </button>
        <button
          type="button"
          aria-label="Foto opnieuw centreren"
          onClick={() => viewerRef.current?.viewport.goHome()}
        >
          ⟲
        </button>
      </div>
      <button
        type="button"
        className="detail-head-zoom"
        onClick={() => setExpanded(false)}
      >
        Verkleinen
      </button>
    </div>
  );
}
