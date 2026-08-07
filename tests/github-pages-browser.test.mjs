import assert from "node:assert/strict";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import test from "node:test";
import { chromium } from "playwright";

const outputDirectory = path.resolve("dist/pages");
const basePath = "/doorzoeker_v2";
const CEO = "https://linkeddata.cultureelerfgoed.nl/def/ceo#";
const rceFixture = [
  { "@id": "bag:1", [`${CEO}openbareRuimte`]: [{ "@value": "Brigittenstraat" }], [`${CEO}huisnummer`]: [{ "@value": "18" }], [`${CEO}postcode`]: [{ "@value": "3512KM" }] },
  { "@id": "basis:1", [`${CEO}heeftBAGRelatie`]: [{ "@id": "bag:1" }] },
  { "@id": "rm:38342", "@type": [`${CEO}Rijksmonument`], [`${CEO}rijksmonumentnummer`]: [{ "@value": "https://monumentenregister.cultureelerfgoed.nl/monumenten/36046" }], [`${CEO}cultuurhistorischObjectnummer`]: [{ "@value": "38342" }], [`${CEO}datumInschrijvingInMonumentenregister`]: [{ "@value": "1967-06-20" }], [`${CEO}heeftBasisregistratieRelatie`]: [{ "@id": "basis:1" }] },
];
const rceSparqlFixture = { results: { bindings: [{ cho: { value: "rm:38342" }, choi: { value: "38342" }, rmnr: { value: "36046" }, functie: { value: "Woonhuis(K)" }, omschrijving: { value: "Pand met 17e eeuwse lijstgevel." }, monumentaard: { value: "onroerend gebouwd" }, volledigAdres: { value: "Brigittenstraat 18" }, postcode: { value: "3512KM" }, woonplaats: { value: "Utrecht" }, wkt: { value: "POINT(5.1267842049703 52.088895166661)" }, inschrijving: { value: "1967-06-20" } }] } };
const rceDiscoveryFixture = { results: { bindings: [{ rmnr: { value: "36046" }, match: { value: "Pand met 17e eeuwse lijstgevel." }, bron: { value: "formele omschrijving" }, score: { value: "51" } }] } };
const rceFacetsFixture = { results: { bindings: [{ rmnr: { value: "36046" }, oorspronkelijkeFuncties: { value: "Woonhuis(K)" }, huidigeFuncties: { value: "Woning" }, typen: { value: "Woonhuis" } }] } };
const rceParcelFixture = { results: { bindings: [{ gemeente: { value: "Utrecht" }, gemeentecode: { value: "996" }, sectie: { value: "B" }, perceel: { value: "358" }, provinciecode: { value: "UT" } }] } };
const rceApiFixture = { results: [{ choNumber: "38342", monumentNumber: "36046", registrationDate: "1967-06-20", street: "", houseNumber: "", postalCode: "3512KM", sourceUrl: "rm:38342", functionName: "Woonhuis(K)", originalFunctionNames: ["Woonhuis(K)"], currentFunctionNames: ["Woning"], typeNames: ["Woonhuis"], legalStatus: "rijksmonument", description: "Pand met 17e eeuwse lijstgevel.", monumentNature: "onroerend gebouwd", fullAddress: "Brigittenstraat 18", place: "Utrecht", lng: 5.1267842049703, lat: 52.088895166661, wkt: "POINT(5.1267842049703 52.088895166661)", matchSource: "formele omschrijving", matchedText: "Pand met 17e eeuwse lijstgevel.", matchScore: 51, parcels: [{ municipality: "Utrecht", municipalityCode: "996", section: "B", parcelNumber: "358", provinceCode: "UT" }] }] };
const clusterApiFixture = { results: [
  rceApiFixture.results[0],
  { ...rceApiFixture.results[0], choNumber: "38343", monumentNumber: "36047", lng: 5.1269, lat: 52.0890 },
  { ...rceApiFixture.results[0], choNumber: "38344", monumentNumber: "36048", lng: 5.1270, lat: 52.0891 },
] };
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

function startExportServer() {
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (url.pathname !== basePath && !url.pathname.startsWith(`${basePath}/`)) {
      response.writeHead(404).end("Not found");
      return;
    }

    const relativePath = decodeURIComponent(url.pathname.slice(basePath.length)).replace(/^\/+/, "") || "index.html";
    const filePath = path.resolve(outputDirectory, relativePath);
    if (!filePath.startsWith(`${outputDirectory}${path.sep}`)) {
      response.writeHead(403).end("Forbidden");
      return;
    }

    try {
      const file = await stat(filePath);
      if (!file.isFile()) throw new Error("Not a file");
      response.writeHead(200, { "Content-Type": contentTypes[path.extname(filePath)] ?? "application/octet-stream" });
      createReadStream(filePath).pipe(response);
    } catch {
      response.writeHead(404).end("Not found");
    }
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

test("GitHub Pages export loads and remains interactive in Chromium", { timeout: 60_000 }, async () => {
  const server = await startExportServer();
  const address = server.address();
  assert.ok(address && typeof address === "object");

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.route("**/api/rce/search?**", (route) => {
    const fixture = new URL(route.request().url()).searchParams.get("q") === "cluster" ? clusterApiFixture : rceApiFixture;
    return route.fulfill({ contentType: "application/json", body: JSON.stringify(fixture) });
  });
  await page.route("https://api.linkeddata.cultureelerfgoed.nl/**", (route) => {
    const requestUrl = decodeURIComponent(route.request().url());
    const isSparql = requestUrl.includes("/sparql");
    const body = isSparql ? (requestUrl.includes("heeftBRKRelatie") ? rceParcelFixture : requestUrl.includes("GROUP_CONCAT") ? rceFacetsFixture : requestUrl.includes("?bron ?score") ? rceDiscoveryFixture : rceSparqlFixture) : rceFixture;
    return route.fulfill({ contentType: isSparql ? "application/sparql-results+json" : "application/ld+json", body: JSON.stringify(body) });
  });
  const runtimeErrors = [];
  page.on("pageerror", (error) => runtimeErrors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") runtimeErrors.push(`console: ${message.text()}`);
  });

  try {
    const response = await page.goto(`http://127.0.0.1:${address.port}${basePath}/`, { waitUntil: "networkidle" });
    assert.equal(response?.status(), 200);
    await assert.doesNotReject(() => page.locator("#q").waitFor({ state: "visible" }));
    assert.equal(await page.getByText("This page couldn’t load").count(), 0);
    assert.equal(await page.getByText("Prototype met voorbeelddata").count(), 0);
    await assert.doesNotReject(() => page.getByText("Van zoekwoord naar officiële registratie", { exact: true }).waitFor({ state: "visible" }));

    await page.getByRole("button", { name: "36046", exact: true }).click();
    await assert.doesNotReject(() => page.locator("article").getByText("Woonhuis", { exact: true }).first().waitFor({ state: "visible" }));
    await assert.doesNotReject(() => page.getByText(/1 resultaat/).waitFor({ state: "visible" }));
    await assert.doesNotReject(() => page.getByText("Resultaten rechtstreeks uit de actuele RCE Linked Data").waitFor({ state: "visible" }));
    await page.getByRole("button", { name: "Details van Woonhuis" }).click();
    assert.equal(await page.getByRole("link", { name: /Bekijk in het Monumentenregister/ }).getAttribute("href"), "https://monumentenregister.cultureelerfgoed.nl/monumenten/36046");
    await assert.doesNotReject(() => page.getByText("POINT(5.1267842049703 52.088895166661)").waitFor({ state: "visible" }));
    await assert.doesNotReject(() => page.getByText("Utrecht B 358 (UT)").waitFor({ state: "visible" }));
    await page.getByRole("button", { name: "Details sluiten" }).click();
    const sharedDetailUrl = new URL(page.url());
    sharedDetailUrl.search = "?q=36046&rm=38342";
    await page.goto(sharedDetailUrl.href, { waitUntil: "networkidle" });
    await assert.doesNotReject(() => page.getByRole("button", { name: "Details sluiten" }).waitFor({ state: "visible" }));
    await assert.doesNotReject(() => page.getByText("POINT(5.1267842049703 52.088895166661)").waitFor({ state: "visible" }));
    await page.getByRole("button", { name: "Details sluiten" }).click();
    await page.locator("#q").fill("lijstgevel");
    await page.getByRole("button", { name: "Doorzoek RCE", exact: true }).click();
    await assert.doesNotReject(() => page.locator("article").getByText("Pand met 17e eeuwse lijstgevel.", { exact: true }).waitFor({ state: "visible" }));
    await assert.doesNotReject(() => page.getByText(/Gevonden via formele omschrijving: Pand met 17e eeuwse lijstgevel/).waitFor({ state: "visible" }));
    await page.getByRole("combobox", { name: "Filter op matchbron" }).selectOption("formele omschrijving");
    await page.getByRole("combobox", { name: "Filter op functie" }).selectOption("Woonhuis");
    await assert.doesNotReject(() => page.getByText(/1 resultaat/).waitFor({ state: "visible" }));
    await page.getByText("Archeologisch", { exact: true }).first().click();
    await page.locator("#q").fill("36046");
    await page.getByRole("button", { name: "Doorzoek RCE", exact: true }).click();
    assert.equal(await page.getByText("Alle monumentaarden").locator("..").locator("input").evaluate((input) => input.checked), true);
    await assert.doesNotReject(() => page.locator("article").getByText("Woonhuis", { exact: true }).first().waitFor({ state: "visible" }));

    await page.locator("#q").fill("cluster");
    await page.getByRole("button", { name: "Doorzoek RCE", exact: true }).click();
    await page.getByRole("button", { name: "Kaartweergave" }).click();
    await assert.doesNotReject(() => page.locator(".heritage-cluster").waitFor({ state: "visible" }));
    assert.equal(await page.locator(".heritage-cluster").innerText(), "3");

    assert.deepEqual(runtimeErrors, [], runtimeErrors.join("\n"));
  } finally {
    await browser.close();
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
