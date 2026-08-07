"use client";

import { useEffect, useRef } from "react";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import { clusterMapPoints } from "@/lib/map-clustering";

type MapItem = { id: string; title: string; address: string; place: string; type: "Gebouwd" | "Archeologisch"; lat: number; lng: number };

function tooltip(titleText: string, detail: string) {
  const content = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = titleText;
  content.appendChild(title);
  content.appendChild(document.createElement("br"));
  content.appendChild(document.createTextNode(detail));
  return content;
}

export function HeritageMap({ items, onSelect }: { items: MapItem[]; onSelect: (item: MapItem) => void }) {
  const element = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let map: Leaflet.Map | undefined;

    import("leaflet").then((L) => {
      if (cancelled || !element.current) return;
      const leafletMap = L.map(element.current, { zoomControl: true, scrollWheelZoom: true }).setView([52.09, 5.08], 11);
      map = leafletMap;
      L.tileLayer("https://service.pdok.nl/kadaster/brt-achtergrondkaart/wmts/v2_0?service=WMTS&request=GetTile&version=1.0.0&layer=grijs&style=default&tilematrixset=EPSG:3857&format=image/png&tilematrix={z}&tilerow={y}&tilecol={x}", { maxZoom: 19, attribution: 'Kaart: <a href="https://www.pdok.nl/">PDOK</a> · BRT Kadaster' }).addTo(leafletMap);
      const markerLayer = L.layerGroup().addTo(leafletMap);
      const bounds = items.map((item) => L.latLng(item.lat, item.lng));

      const renderMarkers = () => {
        markerLayer.clearLayers();
        const projected = items.map((item) => {
          const point = leafletMap.project(L.latLng(item.lat, item.lng), leafletMap.getZoom());
          return { item, x: point.x, y: point.y };
        });

        for (const cluster of clusterMapPoints(projected, 48)) {
          if (cluster.items.length === 1) {
            const item = cluster.items[0];
            const marker = L.circleMarker([item.lat, item.lng], { radius: 9, color: "#fff", weight: 3, fillColor: item.type === "Archeologisch" ? "#ffb612" : "#154273", fillOpacity: 1 }).addTo(markerLayer);
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
          badge.setAttribute("aria-label", `${cluster.items.length} rijksmonumenten; klik om in te zoomen`);
          const marker = L.marker(center, { icon: L.divIcon({ html: badge, className: "heritage-cluster-wrapper", iconSize: [46, 46], iconAnchor: [23, 23] }) }).addTo(markerLayer);
          marker.bindTooltip(tooltip(`${cluster.items.length} rijksmonumenten`, "Klik om de groep te bekijken"));
          marker.on("click", () => {
            const clusterBounds = L.latLngBounds(cluster.items.map((item) => L.latLng(item.lat, item.lng)));
            if (clusterBounds.getNorthEast().equals(clusterBounds.getSouthWest())) leafletMap.setZoomAround(center, Math.min(leafletMap.getZoom() + 2, 19));
            else leafletMap.fitBounds(clusterBounds, { padding: [55, 55], maxZoom: 17 });
          });
        }
      };

      if (bounds.length) leafletMap.fitBounds(L.latLngBounds(bounds), { padding: [45, 45], maxZoom: 14 });
      renderMarkers();
      leafletMap.on("zoomend", renderMarkers);
    });

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [items, onSelect]);

  return <div className="leaflet-map" ref={element} aria-label="Kaart met gevonden rijksmonumenten" />;
}
