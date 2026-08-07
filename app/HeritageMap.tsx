"use client";
import {useEffect,useRef} from "react";
import "leaflet/dist/leaflet.css";

type MapItem={id:string;title:string;address:string;place:string;type:"Gebouwd"|"Archeologisch";lat:number;lng:number};
export function HeritageMap({items,onSelect}:{items:MapItem[];onSelect:(item:MapItem)=>void}){
 const element=useRef<HTMLDivElement>(null);
 useEffect(()=>{let cancelled=false;let map:{remove:()=>void}|undefined;
  import("leaflet").then(L=>{if(cancelled||!element.current)return;
   const leafletMap=L.map(element.current,{zoomControl:true,scrollWheelZoom:true}).setView([52.09,5.08],11);
   map=leafletMap;
   L.tileLayer("https://service.pdok.nl/kadaster/brt-achtergrondkaart/wmts/v2_0?service=WMTS&request=GetTile&version=1.0.0&layer=grijs&style=default&tilematrixset=EPSG:3857&format=image/png&tilematrix={z}&tilerow={y}&tilecol={x}",{maxZoom:19,attribution:'Kaart: <a href="https://www.pdok.nl/">PDOK</a> · BRT Kadaster'}).addTo(leafletMap);
   const bounds:L.LatLngExpression[]=[];
   items.forEach(item=>{bounds.push([item.lat,item.lng]);const marker=L.circleMarker([item.lat,item.lng],{radius:9,color:"#fff",weight:3,fillColor:item.type==="Archeologisch"?"#ffb612":"#154273",fillOpacity:1}).addTo(leafletMap);const tooltip=document.createElement("div");const title=document.createElement("strong");title.textContent=item.title;tooltip.appendChild(title);tooltip.appendChild(document.createElement("br"));tooltip.appendChild(document.createTextNode([item.address,item.place].filter(Boolean).join(", ")));marker.bindTooltip(tooltip);marker.on("click",()=>onSelect(item))});
   if(bounds.length)leafletMap.fitBounds(L.latLngBounds(bounds),{padding:[45,45],maxZoom:14});
  });
  return()=>{cancelled=true;map?.remove()};
 },[items,onSelect]);
 return <div className="leaflet-map" ref={element} aria-label="Kaart met gevonden rijksmonumenten"/>;
}
