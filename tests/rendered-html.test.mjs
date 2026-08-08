import assert from "node:assert/strict";
import test from "node:test";
async function render(){const u=new URL("../dist/server/index.js",import.meta.url);u.searchParams.set("test",String(Date.now()));const{default:w}=await import(u.href);return w.fetch(new Request("http://localhost/",{headers:{accept:"text/html"}}),{ASSETS:{fetch:async()=>new Response("Not found",{status:404})}},{waitUntil(){},passThroughOnException(){}})}
test("renders Doorzoeker",async()=>{const r=await render();assert.equal(r.status,200);const h=await r.text();assert.match(h,/<title>Doorzoeker/);assert.match(h,/Zoek een rijksmonument en bekijk de officiële registratie/);assert.match(h,/Wat deze zoekmachine doet/);assert.doesNotMatch(h,/Prototype met voorbeelddata|Rietveld Schröderhuis|codex-preview|SkeletonPreview/)});
