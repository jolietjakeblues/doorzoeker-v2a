"use client";

import { useEffect, useRef } from "react";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import { clusterMapPoints } from "@/lib/map-clustering";
import { parseWktGeometry } from "@/lib/rce";

type MapItem = {
  id: string; title: string; address: string; place: string;
  objectType: "Rijksmonument" | "Werelderfgoed" | "Gezicht" | "Complex";
  monumentAard?: "Gebouwd" | "Archeologisch";
  lat: number; lng: number; wkt?: string;
};

function markerColor(item: Pick<MapItem, "objectType" | "monumentAard">) {
  if (item.objectType === "Werelderfgoed") return "#01689b";
  if (item.objectType === "Gezicht") return "#176b3a";
  if (item.objectType === "Complex") return "#5b4b8a";
  if (item.monumentAard === "Archeologisch") return "#ffb612";
  return "#154273";
}

// Werelderfgoed, Gezicht en archeologische terreinen zijn een gebied, geen
// punt: gebruikers weten vaak al ongeveer waar zoiets ligt (de Waddenzee,
// de Hollandse Waterlinies) maar willen de daadwerkelijke omvang en grens
// zien. Een stip zou dat net weglaten. Gewoon gebouwde rijksmonumenten
// blijven een marker - die zijn punt-achtig genoeg dat een stip niets
// verliest, en met honderden tegelijk op de kaart blijft clusteren nodig.
// Een Complex is bewust géén gebiedstype: we hebben alleen de geometrie van
// het hoofdobject (één gebouw), niet van het complex als geheel (dat kan een
// heel landgoed met meerdere panden beslaan). Die ene bouwvoetprint als "de
// vorm van het complex" tonen zou net zo misleidend zijn als het probleem
// dat deze aanpak elders juist oplost - dus blijft een Complex een punt op
// de locatie van het hoofdobject.
function isAreaType(item: Pick<MapItem, "objectType" | "monumentAard">) {
  return item.objectType === "Werelderfgoed" || item.objectType === "Gezicht" || item.monumentAard === "Archeologisch";
}

function tooltip(titleText: string, detail: string) {
  const content = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = titleText;
  content.appendChild(title);
  content.appendChild(document.createElement("br"));
  content.appendChild(document.createTextNode(detail));
  return content;
}

export function HeritageMap({ items, onSelect, compact }: { items: MapItem[]; onSelect: (item: MapItem) => void; compact?: boolean }) {
  const element = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let map: Leaflet.Map | undefined;

    import("leaflet").then((L) => {
      if (cancelled || !element.current) return;
      // Compact maps zitten ingebed in een scrollbaar detailpaneel; scrollwheel-zoom
      // zou daar de paneelscroll kapen zodra de muis over de kaart komt.
      const leafletMap = L.map(element.current, { zoomControl: !compact, scrollWheelZoom: !compact }).setView([52.09, 5.08], 11);
      map = leafletMap;
      L.tileLayer("https://service.pdok.nl/kadaster/brt-achtergrondkaart/wmts/v2_0?service=WMTS&request=GetTile&version=1.0.0&layer=grijs&style=default&tilematrixset=EPSG:3857&format=image/png&tilematrix={z}&tilerow={y}&tilecol={x}", { maxZoom: 19, attribution: 'Kaart: <a href="https://www.pdok.nl/">PDOK</a> · BRT Kadaster' }).addTo(leafletMap);
      const shapeLayer = L.layerGroup().addTo(leafletMap);
      const markerLayer = L.layerGroup().addTo(leafletMap);

      // Vorm-items (Werelderfgoed, Gezicht, archeologisch) worden één keer als
      // echte polygon getekend - Leaflet herprojecteert die zelf bij
      // pan/zoom. Alleen de resterende punt-items gaan door de handmatige
      // clustering hieronder, die wél per zoomniveau opnieuw moet.
      const pointItems: MapItem[] = [];
      let shapeBounds: Leaflet.LatLngBounds | undefined;
      for (const item of items) {
        const geometry = isAreaType(item) && item.wkt ? parseWktGeometry(item.wkt) : undefined;
        if (!geometry || geometry.kind === "point") {
          pointItems.push(item);
          continue;
        }
        const polygons = geometry.kind === "polygon" ? [geometry.rings] : geometry.polygons;
        const latLngs = polygons.map((rings) => rings.map((ring) => ring.map(([lng, lat]): [number, number] => [lat, lng])));
        const color = markerColor(item);
        const polygon = L.polygon(latLngs, { color, weight: 2, fillColor: color, fillOpacity: 0.3 }).addTo(shapeLayer);
        polygon.bindTooltip(tooltip(item.title, [item.address, item.place].filter(Boolean).join(", ")));
        polygon.on("click", () => onSelect(item));
        shapeBounds = shapeBounds ? shapeBounds.extend(polygon.getBounds()) : polygon.getBounds();
      }

      const renderMarkers = () => {
        markerLayer.clearLayers();
        const projected = pointItems.map((item) => {
          const point = leafletMap.project(L.latLng(item.lat, item.lng), leafletMap.getZoom());
          return { item, x: point.x, y: point.y };
        });

        for (const cluster of clusterMapPoints(projected, 48)) {
          if (cluster.items.length === 1) {
            const item = cluster.items[0];
            const marker = L.circleMarker([item.lat, item.lng], { radius: 9, color: "#fff", weight: 3, fillColor: markerColor(item), fillOpacity: 1 }).addTo(markerLayer);
            marker.bindTooltip(tooltip(item.title, [item.address, item.place].filter(Boolean).join(", ")));
            marker.on("click", () => onSelect(item));
            continue;
          }

          const center = L.latLng(
            cluster.items.reduce((sum, item) => sum + item.lat, 0) / cluster.items.length,
            cluster.items.reduce((sum, item) => sum + item.lng, 0) / cluster.items.length,
          );
          const badge = document.createElement("span");
          badge.className = "heritage-cluster";
          badge.textContent = String(cluster.items.length);
          badge.setAttribute("role", "button");
          badge.setAttribute("aria-label", `${cluster.items.length} erfgoedobjecten; klik om in te zoomen`);
          const marker = L.marker(center, { icon: L.divIcon({ html: badge, className: "heritage-cluster-wrapper", iconSize: [46, 46], iconAnchor: [23, 23] }) }).addTo(markerLayer);
          marker.bindTooltip(tooltip(`${cluster.items.length} erfgoedobjecten`, "Klik om de groep te bekijken"));
          marker.on("click", () => {
            const clusterBounds = L.latLngBounds(cluster.items.map((item) => L.latLng(item.lat, item.lng)));
            if (clusterBounds.getNorthEast().equals(clusterBounds.getSouthWest())) leafletMap.setZoomAround(center, Math.min(leafletMap.getZoom() + 2, 19));
            else leafletMap.fitBounds(clusterBounds, { padding: [55, 55], maxZoom: 17 });
          });
        }
      };

      const pointBounds = pointItems.length ? L.latLngBounds(pointItems.map((item) => L.latLng(item.lat, item.lng))) : undefined;
      const combinedBounds = shapeBounds && pointBounds ? shapeBounds.extend(pointBounds) : shapeBounds ?? pointBounds;
      if (combinedBounds?.isValid()) leafletMap.fitBounds(combinedBounds, { padding: [45, 45], maxZoom: 14 });
      renderMarkers();
      leafletMap.on("zoomend", renderMarkers);
    });

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [compact, items, onSelect]);

  return <div className={`leaflet-map${compact ? " compact" : ""}`} ref={element} aria-label="Kaart met gevonden erfgoedobjecten" />;
}
