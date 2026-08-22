import { expect, test, type Page } from "@playwright/test";

const records = [
  {
    choNumber: "cho-1",
    monumentNumber: "517912",
    registrationDate: "2002-01-01",
    street: "Dorpsstraat",
    houseNumber: "1",
    postalCode: "5051AA",
    sourceUrl: "https://linkeddata.cultureelerfgoed.nl/cho-1",
    name: "Woonhuis van de architect",
    functionName: "Woonhuis",
    description: "Een gebouwd rijksmonument in Goirle.",
    monumentNature: "onroerend gebouwd",
    fullAddress: "Dorpsstraat 1",
    place: "Goirle",
    municipality: "Goirle",
    provinceCode: "NB",
    lat: 51.52,
    lng: 5.07,
    matchSource: "oorspronkelijke functie",
    matchedText: "Woonhuis",
    matchScore: 1,
  },
  {
    choNumber: "cho-2",
    monumentNumber: "complex-12",
    registrationDate: "",
    street: "",
    houseNumber: "",
    postalCode: "",
    sourceUrl: "https://linkeddata.cultureelerfgoed.nl/cho-2",
    name: "Historisch boerderijcomplex",
    description: "Een samenhang van twee rijksmonumenten.",
    monumentNature: "complex",
    place: "Goirle",
    municipality: "Goirle",
    provinceCode: "NB",
    complexMemberCount: 2,
    lat: 51.53,
    lng: 5.08,
  },
  {
    choNumber: "cho-3",
    monumentNumber: "onderzoek-4",
    registrationDate: "",
    street: "",
    houseNumber: "",
    postalCode: "",
    sourceUrl: "https://linkeddata.cultureelerfgoed.nl/cho-3",
    description: "Hier is archeologisch onderzoek uitgevoerd.",
    monumentNature: "archeologischonderzoeksgebied",
    place: "Goirle",
    municipality: "Goirle",
    provinceCode: "NB",
  },
];

async function mockRce(page: Page) {
  await page.route("**/api/rce/op-deze-dag", (route) =>
    route.fulfill({ json: { monument: null } }),
  );
  await page.route("**/api/terms/suggest**", (route) => {
    const query = new URL(route.request().url()).searchParams.get("q") ?? "";
    return route.fulfill({
      json: {
        suggestions: query.toLocaleLowerCase("nl").startsWith("kerk")
          ? [
              {
                uri: "https://example.test/term/kerk",
                label: "Kerk",
                sourceUri: "https://example.test/cht",
                sourceName: "Cultuurhistorische Thesaurus",
              },
            ]
          : [],
      },
    });
  });
  await page.route("**/api/rce/complex-members**", (route) =>
    route.fulfill({ json: { members: [] } }),
  );
  await page.route("**/api/rce/onderzoeksgebied-verrijking**", (route) =>
    route.fulfill({
      json: {
        complexen: [],
        vondstlocaties: [],
        vondstlocatieTotaal: 0,
        grondsporenTotaal: 0,
        vondstenTotaal: 0,
        complexenViaVondstlocatieTotaal: 0,
      },
    }),
  );
  await page.route("**/api/rce/vondstlocatie-inhoud**", (route) =>
    route.fulfill({ json: { complexen: [], vondsten: [], grondsporen: [], complexenTotaal: 0, vondstenTotaal: 0, grondsporenTotaal: 0 } }),
  );
  await page.route("**/api/rce/search**", (route) =>
    route.fulfill({
      json: { results: records, page: 1, hasMore: false },
    }),
  );
}

test.beforeEach(async ({ page }) => {
  await mockRce(page);
  const clientReady = page.waitForResponse((response) =>
    response.url().includes("/api/rce/op-deze-dag"),
  );
  await page.goto("/");
  await clientReady;
});

test("zoeken toont verschillende erfgoedtypen", async ({ page }) => {
  await page.getByRole("combobox", { name: "Zoeken" }).fill("Goirle");
  await page.getByRole("button", { name: "Doorzoek RCE" }).click();
  await expect(
    page.getByRole("heading", { name: "3 resultaten voor “Goirle”" }),
  ).toBeVisible();
  await expect(
    page.getByText("Rijksmonument", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("Complex van rijksmonumenten", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("Archeologisch onderzoeksgebied", { exact: true }).first(),
  ).toBeVisible();
});

test("de footer noemt de bèta-status, een feedbacklink naar GitHub en de privacyvermelding over PDOK/RCE-beeldbank", async ({ page }) => {
  const footer = page.locator("footer.site-footer");
  await expect(footer).toContainText("PDOK");
  await expect(footer).toContainText("RCE-beeldbank");
  await expect(footer).toContainText("bèta");
  const feedbackLink = footer.getByRole("link", { name: "Bug gevonden of suggestie? Meld het op GitHub" });
  await expect(feedbackLink).toHaveAttribute(
    "href",
    "https://github.com/jolietjakeblues/doorzoeker-v2a/issues/new?template=bug_report.md",
  );
});

test("de kopbalk linkt naar de achtergrondpagina, ook op mobiel waar de rest van de regel verborgen is", async ({ page }) => {
  await expect(page.getByRole("link", { name: "Achtergrond" })).toHaveAttribute("href", "/achtergrond.html");

  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.getByRole("link", { name: "Achtergrond" })).toBeVisible();
});

test("de achtergrondpagina laadt met de verwachte inhoud, skip-link en afbeeldingen", async ({ page }) => {
  await page.goto("/achtergrond.html");
  await expect(page.getByRole("heading", { level: 1, name: "Achtergrond" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "De geschiedenis: Doorzoeker 1 (2013-2014)" })).toBeVisible();
  await expect(page.getByText("Fubineva").first()).toBeVisible();
  await expect(page.getByText("in opdracht van de Rijksdienst voor het Cultureel Erfgoed")).toBeVisible();
  await expect(page.getByText("Dirk, Kees, Hans en Joppe")).toBeVisible();

  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Direct naar de inhoud" })).toBeFocused();

  const images = page.locator("main img");
  await expect(images).toHaveCount(4);
  for (const image of await images.all()) {
    await expect(image).toHaveAttribute("alt", /.+/);
  }
});

test("de bèta-badge staat rechtsboven, ook nog na een zoekopdracht", async ({ page }) => {
  const badge = page.locator(".beta-badge");
  await expect(badge).toContainText("Bèta");

  await page.getByRole("combobox", { name: "Zoeken" }).fill("Goirle");
  await page.getByRole("button", { name: "Doorzoek RCE" }).click();
  await expect(
    page.getByRole("heading", { name: "3 resultaten voor “Goirle”" }),
  ).toBeVisible();
  await expect(badge).toContainText("Bèta");
});

test("belangrijke knoppen halen de WCAG 2.5.5-ondergrens van 44x44 CSS px (accessibility-review 15-08-2026)", async ({ page }) => {
  await page.getByRole("combobox", { name: "Zoeken" }).fill("Goirle");
  await page.getByRole("button", { name: "Doorzoek RCE" }).click();
  await expect(page.getByRole("heading", { name: "3 resultaten voor “Goirle”" })).toBeVisible();

  async function assertAtLeast44(locator: ReturnType<typeof page.locator>, label: string) {
    const box = await locator.boundingBox();
    expect(box, `${label} niet gevonden`).not.toBeNull();
    expect(box!.width, `${label} breedte`).toBeGreaterThanOrEqual(44);
    expect(box!.height, `${label} hoogte`).toBeGreaterThanOrEqual(44);
  }

  await assertAtLeast44(page.getByRole("button", { name: "Lijstweergave" }), "weergave-toggle (lijst)");
  await assertAtLeast44(page.getByRole("button", { name: "Kaartweergave" }), "weergave-toggle (kaart)");
  await assertAtLeast44(page.getByRole("button", { name: "Exporteer 3 resultaten als CSV" }), "exportknop CSV");
  await assertAtLeast44(page.getByRole("button", { name: "Exporteer 3 resultaten als GeoJSON" }), "exportknop GeoJSON");
  await assertAtLeast44(
    page.getByRole("navigation", { name: "Ontdek een thema" }).getByRole("button", { name: "Kerken", exact: true }),
    "themaknop (Kerken)",
  );
  await assertAtLeast44(
    page.getByRole("complementary", { name: "Zoekfilters" }).locator("label", { hasText: "Alle soorten" }),
    "filterrij (Alle soorten)",
  );
});

test("skip-link laat een toetsenbordgebruiker de knoppen in de zoekintro overslaan (accessibility-review 15-08-2026)", async ({ page }) => {
  // Geen zoekopdracht vooraf: de allereerste Tab-druk op de pagina moet
  // meteen de skip-link raken, niet een van de knoppen in Probeer
  // bijvoorbeeld/Ontdek een thema/Bekijk alles.
  const skipLink = page.getByRole("link", { name: "Direct naar resultaten" });
  await page.keyboard.press("Tab");
  await expect(skipLink).toBeFocused();

  await skipLink.click();
  await expect(page.locator("#results")).toBeFocused();
});

test("secundaire tekstkleur van de adresregel op resultaatkaarten is consistent met andere secundaire tekst (design critique 15-08-2026)", async ({ page }) => {
  await page.getByRole("combobox", { name: "Zoeken" }).fill("Goirle");
  await page.getByRole("button", { name: "Doorzoek RCE" }).click();
  const address = page.getByText("Goirle", { exact: true }).first();
  await expect(address).toBeVisible();
  await expect(address).toHaveCSS("color", "rgb(89, 89, 89)");
});

test("Referrer-Policy is expliciet ingesteld voor externe bronnen zoals PDOK-kaarttegels en RCE-afbeeldingen (securityreview 15-08-2026)", async ({ page }) => {
  await expect(page.locator('meta[name="referrer"]')).toHaveAttribute("content", "strict-origin-when-cross-origin");
});

test("resultaten zijn te exporteren als CSV en GeoJSON (#34)", async ({ page }) => {
  await page.getByRole("combobox", { name: "Zoeken" }).fill("Goirle");
  await page.getByRole("button", { name: "Doorzoek RCE" }).click();
  await expect(page.getByRole("heading", { name: "3 resultaten voor “Goirle”" })).toBeVisible();

  // Knoptekst vermeldt het aantal (codereview: export kon onvolledig zijn
  // zonder dat te vermelden) - hier alle 3 geladen resultaten.
  const [csvDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Exporteer 3 resultaten als CSV" }).click(),
  ]);
  expect(csvDownload.suggestedFilename()).toMatch(/^doorzoeker-export-\d{4}-\d{2}-\d{2}\.csv$/);
  const csvStream = await csvDownload.createReadStream();
  const csvChunks: Buffer[] = [];
  for await (const chunk of csvStream) csvChunks.push(chunk);
  const csv = Buffer.concat(csvChunks).toString("utf-8");
  expect(csv.split("\r\n")[0]).toBe(
    "monumentnummer,titel,adres,postcode,plaats,provincie,soort object,monumentaard,functie,registratiedatum,matchbron,object_uri,cho_nummer,primaire_identifier,identifier_type",
  );
  expect(csv).toContain("Woonhuis van de architect");

  const [geoJsonDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Exporteer 3 resultaten als GeoJSON" }).click(),
  ]);
  expect(geoJsonDownload.suggestedFilename()).toMatch(/^doorzoeker-export-\d{4}-\d{2}-\d{2}\.geojson$/);
  const geoJsonStream = await geoJsonDownload.createReadStream();
  const geoJsonChunks: Buffer[] = [];
  for await (const chunk of geoJsonStream) geoJsonChunks.push(chunk);
  const geojson = JSON.parse(Buffer.concat(geoJsonChunks).toString("utf-8"));
  expect(geojson.type).toBe("FeatureCollection");
  expect(geojson.features).toHaveLength(3);
  // De testfixture-records dragen geen wkt-veld, dus geen crash op een
  // ontbrekende geometrie is precies wat hier getoetst wordt - de WKT->
  // GeoJSON-omzetting zelf (point/polygon) staat al onder unit test in
  // tests/export.test.mjs.
  expect(geojson.features[0].geometry).toBeNull();
});

test("resultaatteller en filtertellingen maken duidelijk dat er nog meer te laden is (#33)", async ({ page }) => {
  await page.unroute("**/api/rce/search**");
  await page.route("**/api/rce/search**", (route) => route.fulfill({
    json: { results: [{ ...records[0] }], page: 1, hasMore: true },
  }));
  await page.getByRole("combobox", { name: "Zoeken" }).fill("Woonhuis");
  await page.getByRole("button", { name: "Doorzoek RCE" }).click();

  const heading = page.getByRole("heading", { name: "1 resultaat voor “Woonhuis”" });
  await expect(heading).toBeVisible();
  await expect(heading).toContainText("nog niet alles geladen");

  const filters = page.getByRole("complementary", { name: "Zoekfilters" });
  await expect(filters.locator("label", { hasText: "Alle soorten" })).toContainText("1+");
  await expect(filters).toContainText("\"12+\" betekent dat er nog meer kunnen zijn");
});

test("export vermeldt onvolledigheid ook ín het bestand zelf, niet alleen op de knop (codereview: context ging verloren zodra het bestand werd doorgestuurd)", async ({ page }) => {
  await page.unroute("**/api/rce/search**");
  await page.route("**/api/rce/search**", (route) => route.fulfill({
    json: { results: [{ ...records[0] }], page: 1, hasMore: true },
  }));
  await page.getByRole("combobox", { name: "Zoeken" }).fill("Woonhuis");
  await page.getByRole("button", { name: "Doorzoek RCE" }).click();
  await expect(page.getByRole("heading", { name: "1 resultaat voor “Woonhuis”" })).toBeVisible();

  const [csvDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Exporteer 1 resultaat als CSV" }).click(),
  ]);
  const csvStream = await csvDownload.createReadStream();
  const csvChunks: Buffer[] = [];
  for await (const chunk of csvStream) csvChunks.push(chunk);
  const csv = Buffer.concat(csvChunks).toString("utf-8");
  const csvLines = csv.split("\r\n");
  expect(csvLines[csvLines.length - 1]).toMatch(/^Let op: dit bestand bevat niet alle resultaten/);

  const [geoJsonDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Exporteer 1 resultaat als GeoJSON" }).click(),
  ]);
  const geoJsonStream = await geoJsonDownload.createReadStream();
  const geoJsonChunks: Buffer[] = [];
  for await (const chunk of geoJsonStream) geoJsonChunks.push(chunk);
  const geojson = JSON.parse(Buffer.concat(geoJsonChunks).toString("utf-8"));
  expect(geojson.metadata.compleet).toBe(false);
  expect(geojson.metadata.opmerking).toMatch(/niet alle resultaten/);
});

test("resultaatteller en filtertellingen tonen geen '+' zodra alles geladen is (#33)", async ({ page }) => {
  await page.getByRole("combobox", { name: "Zoeken" }).fill("Goirle");
  await page.getByRole("button", { name: "Doorzoek RCE" }).click();

  const heading = page.getByRole("heading", { name: "3 resultaten voor “Goirle”" });
  await expect(heading).toBeVisible();
  await expect(heading).not.toContainText("nog niet alles geladen");

  const filters = page.getByRole("complementary", { name: "Zoekfilters" });
  const alleSoorten = filters.locator("label", { hasText: "Alle soorten" });
  await expect(alleSoorten).toContainText("3");
  await expect(alleSoorten).not.toContainText("3+");
});

test("'Ontdek een thema' laat erfgoed ontdekken zonder zoekterm (#32)", async ({ page }) => {
  const kerkUri = "https://data.cultureelerfgoed.nl/term/id/rn/2/6fa5f251-cd84-4f3a-acb7-7c219df2540f";
  await page.unroute("**/api/rce/search**");
  await page.route("**/api/rce/search**", (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("concept") === kerkUri && url.searchParams.get("veld") === "functie") {
      return route.fulfill({ json: { results: [{ ...records[0], name: "Sint-Jorisbasiliek" }], page: 1, hasMore: false } });
    }
    return route.fulfill({ json: { results: [], page: 1, hasMore: false } });
  });

  const themas = page.getByRole("navigation", { name: "Ontdek een thema" });
  for (const label of ["Kerken", "Molens", "Kastelen", "Boerderijen", "Landhuizen"])
    await expect(themas.getByRole("button", { name: label, exact: true })).toBeVisible();

  await themas.getByRole("button", { name: "Kerken", exact: true }).click();
  await expect(page).toHaveURL(/veld=functie/);
  await expect(page).toHaveURL(new RegExp(encodeURIComponent(kerkUri).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  await expect(page.getByText("Sint-Jorisbasiliek")).toBeVisible();
});

test("de startpagina toont een klein, doelgericht setje zoekvoorbeelden (UX-review 17-08-2026: elk voorbeeld toont een eigen zoekingang - nummer, plaats, functie, naam)", async ({ page }) => {
  await page.goto("/");

  const directZoeken = page.getByRole("navigation", { name: "Probeer bijvoorbeeld" });
  for (const term of ["36046", "Utrecht", "moutmolen", "Kinderdijk"]) {
    await expect(directZoeken.getByRole("button", { name: term, exact: true })).toBeVisible();
  }

  const collecties = page.getByRole("navigation", {
    name: "Bekijk een volledige collectie",
  });
  await expect(collecties.getByRole("button", { name: "Rijksmonumenten" })).toBeVisible();
  await expect(collecties.getByRole("button", { name: "Werelderfgoed" })).toBeVisible();
  await expect(collecties.getByRole("button", { name: "Gezichten" })).toBeVisible();
  await expect(
    collecties.getByRole("button", { name: "Gebouwde complexen" }),
  ).toBeVisible();
  await expect(collecties.getByRole("button", { name: "Archeologische terreinen" })).toBeVisible();
  await expect(collecties.getByRole("button", { name: "Onderzoeksgebieden" })).toBeVisible();
  await expect(collecties.getByRole("button", { name: "Vondstlocaties" })).toBeVisible();
  await expect(collecties.getByRole("button", { name: "Archeologische complexen" })).toBeVisible();
  await expect(collecties.getByRole("button", { name: "Vondsten" })).toBeVisible();
  await expect(collecties.getByRole("button", { name: "Grondsporen" })).toBeVisible();
});

test("'Op deze dag' opent het detail direct, zonder een nieuwe zoekopdracht te starten (bugfix)", async ({ page }) => {
  await page.unroute("**/api/rce/op-deze-dag");
  await page.route("**/api/rce/op-deze-dag", (route) => route.fulfill({
    json: { monument: { ...records[0], choNumber: "cho-opdezedag", monumentNumber: "7586" } },
  }));
  await page.unroute("**/api/rce/search**");
  let searchRequested = false;
  await page.route("**/api/rce/search**", (route) => {
    searchRequested = true;
    return route.fulfill({ json: { results: [], page: 1, hasMore: false } });
  });

  const startDataReady = page.waitForResponse((response) => response.url().includes("/api/rce/op-deze-dag"));
  await page.goto("/");
  await startDataReady;

  // Klikken op de pijl van een al volledig bekend record (het is het
  // Op-deze-dag-record zelf, geen zoekresultaat) mag geen ambigue
  // nummerzoekopdracht starten - dat leverde voorheen meerdere,
  // ongerelateerde treffers op uit andere objectsoorten die toevallig
  // hetzelfde nummer in hun eigen veld hebben (bv. een Archis-nummer).
  await page.getByRole("button", { name: "Details van Woonhuis van de architect" }).click();
  await expect(page.getByRole("dialog")).toContainText("Woonhuis van de architect");
  expect(searchRequested).toBe(false);
});

test("vondsten en grondsporen zijn als collectie te openen", async ({ page }) => {
  await page.unroute("**/api/rce/search**");
  await page.route("**/api/rce/search**", (route) => {
    const kind = new URL(route.request().url()).searchParams.get("browse");
    return route.fulfill({ json: {
      results: [{
        ...records[2],
        choNumber: kind === "vondsten" ? "vondst-1" : "spoor-1",
        monumentNumber: kind === "vondsten" ? "33333" : "44444",
        monumentNature: kind === "vondsten" ? "vondsten" : "grondsporen",
        description: kind === "vondsten" ? "Een vondstgroep." : "Een grondspoorgroep.",
        archaeologicalFindCount: kind === "vondsten" ? 2 : undefined,
        archaeologicalTraceCount: kind === "grondsporen" ? 3 : undefined,
      }],
      page: 1,
      hasMore: false,
    } });
  });

  await page.getByRole("button", { name: "Vondsten", exact: true }).click();
  await expect(page.getByRole("heading", { name: "1 resultaat voor “Vondsten”" })).toBeVisible();
  await expect(page.getByText("Archeologische vondst", { exact: true }).first()).toBeVisible();

  const startDataReady = page.waitForResponse((response) => response.url().includes("/api/rce/op-deze-dag"));
  await page.goto("/");
  await startDataReady;
  await page.getByRole("button", { name: "Grondsporen", exact: true }).click();
  await expect(page.getByRole("heading", { name: "1 resultaat voor “Grondsporen”" })).toBeVisible();
  await expect(page.getByText("Archeologisch grondspoor", { exact: true }).first()).toBeVisible();
});

test("vondstlocaties en archeologische complexen zijn als collectie te openen", async ({ page }) => {
  await page.unroute("**/api/rce/search**");
  await page.route("**/api/rce/search**", (route) => {
    const kind = new URL(route.request().url()).searchParams.get("browse");
    return route.fulfill({ json: {
      results: [{
        ...records[2],
        choNumber: kind === "vondstlocatie" ? "locatie-1" : "complex-1",
        monumentNumber: kind === "vondstlocatie" ? "11111" : "22222",
        monumentNature: kind === "vondstlocatie" ? "vondstlocatie" : "archeologischcomplex",
        name: kind === "vondstlocatie" ? "Testvondstlocatie" : "Testcomplex",
      }],
      page: 1,
      hasMore: false,
    } });
  });

  await page.getByRole("button", { name: "Vondstlocaties", exact: true }).click();
  await expect(page.getByRole("heading", { name: "1 resultaat voor “Vondstlocaties”" })).toBeVisible();
  await expect(page.getByText("Archeologische vondstlocatie", { exact: true }).first()).toBeVisible();

  const startDataReady = page.waitForResponse((response) => response.url().includes("/api/rce/op-deze-dag"));
  await page.goto("/");
  await startDataReady;
  await page.getByRole("button", { name: "Archeologische complexen", exact: true }).click();
  await expect(page.getByRole("heading", { name: "1 resultaat voor “Archeologische complexen”" })).toBeVisible();
  await expect(page.getByText("Archeologisch complex", { exact: true }).first()).toBeVisible();
});

test("archeologische terreinen en onderzoeksgebieden zijn als collectie te openen", async ({ page }) => {
  await page.unroute("**/api/rce/search**");
  await page.route("**/api/rce/search**", (route) => {
    const kind = new URL(route.request().url()).searchParams.get("browse");
    return route.fulfill({
      json: {
        results: [{
          ...records[2],
          choNumber: kind === "archeologischterrein" ? "terrein-1" : "onderzoek-1",
          monumentNumber: kind === "archeologischterrein" ? "12345" : "67890",
          monumentNature: kind === "archeologischterrein" ? "archeologischterrein" : "archeologischonderzoeksgebied",
          description: kind === "archeologischterrein" ? "Een archeologisch terrein." : "Een onderzoeksgebied.",
        }],
        page: 1,
        hasMore: false,
      },
    });
  });

  await page.getByRole("button", { name: "Archeologische terreinen", exact: true }).click();
  await expect(page.getByRole("heading", { name: "1 resultaat voor “Archeologische terreinen”" })).toBeVisible();
  await expect(page.getByText("Archeologisch terrein", { exact: true }).first()).toBeVisible();

  const startDataReady = page.waitForResponse((response) =>
    response.url().includes("/api/rce/op-deze-dag"),
  );
  await page.goto("/");
  await startDataReady;
  await page.getByRole("button", { name: "Onderzoeksgebieden", exact: true }).click();
  await expect(page.getByRole("heading", { name: "1 resultaat voor “Onderzoeksgebieden”" })).toBeVisible();
  await expect(page.getByText("Archeologisch onderzoeksgebied", { exact: true }).first()).toBeVisible();
});

test("Rijksmonumenten zijn per 25 te doorbladeren", async ({ page }) => {
  await page.unroute("**/api/rce/search**");
  await page.route("**/api/rce/search**", (route) => {
    const requestedPage = Number(new URL(route.request().url()).searchParams.get("page") ?? "1");
    const count = requestedPage === 1 ? 25 : 2;
    return route.fulfill({
      json: {
        results: Array.from({ length: count }, (_, index) => ({
          ...records[0],
          choNumber: `cho-${requestedPage}-${index}`,
          monumentNumber: `${requestedPage}${String(index).padStart(5, "0")}`,
          name: `Rijksmonument pagina ${requestedPage}, nummer ${index + 1}`,
        })),
        page: requestedPage,
        hasMore: requestedPage === 1,
      },
    });
  });

  await page.getByRole("button", { name: "Rijksmonumenten", exact: true }).click();
  await expect(page).toHaveURL(/browse=rijksmonument/);
  await page.reload();
  await expect(page.getByRole("heading", { name: "25 resultaten voor “Rijksmonumenten”" })).toBeVisible();
  await page.getByRole("button", { name: "Laad 25 volgende resultaten" }).click();
  await expect(page.getByRole("heading", { name: "27 resultaten voor “Rijksmonumenten”" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Laad 25 volgende resultaten" })).toHaveCount(0);
});

test("'laad meer' bij tekstzoekopdracht stopt niet als het laatst geladen item toevallig geen matchScore heeft (P1)", async ({ page }) => {
  await page.unroute("**/api/rce/search**");
  await page.route("**/api/rce/search**", (route) => {
    const url = new URL(route.request().url());
    const scope = url.searchParams.get("scope");
    const requestedPage = Number(url.searchParams.get("page") ?? "1");

    if (scope === "core") {
      return route.fulfill({ json: {
        results: [{
          ...records[0],
          choNumber: `cho-core-${requestedPage}`,
          sourceUrl: `https://linkeddata.cultureelerfgoed.nl/cho-core-${requestedPage}`,
          monumentNumber: `core-${requestedPage}`,
          name: `Rijksmonument pagina ${requestedPage}`,
        }],
        page: requestedPage,
        hasMore: requestedPage === 1,
      } });
    }
    if (scope === "heritage" && requestedPage === 1) {
      // Dit heritage-item heeft geen matchedText/matchScore (die worden
      // alleen door de core-discovery gezet) en komt na het core-item in de
      // samengevoegde resultatenlijst terecht - precies de situatie die de
      // kapotte "laatste item" heuristiek in loadMore liet struikelen.
      return route.fulfill({ json: {
        results: [{
          ...records[1],
          choNumber: "cho-heritage-1",
          sourceUrl: "https://linkeddata.cultureelerfgoed.nl/cho-heritage-1",
          monumentNumber: "complex-1",
          name: "Historisch complex",
        }],
        page: 1,
        hasMore: false,
      } });
    }
    return route.fulfill({ json: { results: [], page: requestedPage, hasMore: false } });
  });

  await page.getByRole("combobox", { name: "Zoeken" }).fill("Goirle");
  await page.getByRole("button", { name: "Doorzoek RCE" }).click();
  await expect(page.getByText("Historisch complex")).toBeVisible();
  await expect(page.getByRole("button", { name: "Laad 25 volgende resultaten" })).toBeVisible();

  await page.getByRole("button", { name: "Laad 25 volgende resultaten" }).click();
  await expect(page.getByText("Rijksmonument pagina 2")).toBeVisible();
  await expect(page.getByRole("button", { name: "Laad 25 volgende resultaten" })).toHaveCount(0);
});

test("een categorie die stil faalt (bv. Scheepswrak via de losstaande MASS-dienst) toont een waarschuwing i.p.v. onopgemerkt te verdwijnen (gemeld door de eigenaar, 21-08-2026: 'schoener' toonde 0 scheepswrakken zonder signaal)", async ({ page }) => {
  await page.unroute("**/api/rce/search**");
  await page.route("**/api/rce/search**", (route) => {
    const url = new URL(route.request().url());
    const scope = url.searchParams.get("scope");
    if (scope === "core") {
      return route.fulfill({ json: { results: [{ ...records[0] }], page: 1, hasMore: false } });
    }
    if (scope === "archaeology-b") {
      return route.fulfill({ json: { results: [], failedCategories: ["Scheepswrak"] } });
    }
    return route.fulfill({ json: { results: [] } });
  });

  await page.getByRole("combobox", { name: "Zoeken" }).fill("schoener");
  await page.getByRole("button", { name: "Doorzoek RCE" }).click();
  await expect(page.getByText("Scheepswrak kon niet worden geladen.")).toBeVisible();
  // De wél geladen resultaten blijven gewoon zichtbaar naast de waarschuwing.
  await expect(page.getByText("Woonhuis van de architect")).toBeVisible();
});

test("een nieuwe zoekopdracht overschrijft resultaten van een nog lopende 'laad meer' (TD-12 regressie)", async ({ page }) => {
  await page.unroute("**/api/rce/search**");
  await page.route("**/api/rce/search**", async (route) => {
    const url = new URL(route.request().url());
    const browse = url.searchParams.get("browse");
    const requestedPage = Number(url.searchParams.get("page") ?? "1");
    const q = url.searchParams.get("q") ?? "";

    if (browse === "rijksmonument" && requestedPage === 1) {
      return route.fulfill({ json: {
        results: [{ ...records[0], choNumber: "cho-p1", monumentNumber: "p1", name: "Eerste pagina" }],
        page: 1, hasMore: true,
      } });
    }
    if (browse === "rijksmonument" && requestedPage === 2) {
      // Bewust vertraagd: dit simuleert een 'laad meer' die nog loopt
      // wanneer de gebruiker alweer een heel nieuwe zoekopdracht start.
      await new Promise((resolve) => setTimeout(resolve, 500));
      return route.fulfill({ json: {
        results: [{ ...records[0], choNumber: "cho-p2", monumentNumber: "p2", name: "Verouderde vervolgpagina" }],
        page: 2, hasMore: false,
      } });
    }
    if (q === "nieuwe zoekopdracht") {
      return route.fulfill({ json: {
        results: [{ ...records[0], choNumber: "cho-nieuw", monumentNumber: "nieuw", name: "Vers zoekresultaat" }],
        page: 1, hasMore: false,
      } });
    }
    return route.fulfill({ json: { results: [], page: 1, hasMore: false } });
  });

  await page.getByRole("button", { name: "Rijksmonumenten", exact: true }).click();
  await expect(page.getByText("Eerste pagina")).toBeVisible();
  await page.getByRole("button", { name: "Laad 25 volgende resultaten" }).click();

  // Niet wachten tot 'laad meer' klaar is: meteen een nieuwe, andere
  // zoekopdracht starten terwijl de vertraagde vervolgpagina nog onderweg is.
  await page.getByRole("combobox", { name: "Zoeken" }).fill("nieuwe zoekopdracht");
  await page.getByRole("button", { name: "Doorzoek RCE" }).click();
  await expect(page.getByText("Vers zoekresultaat")).toBeVisible();

  // Wacht ruim langer dan de vertraagde 'laad meer'-respons nodig heeft, en
  // controleer dat die verouderde pagina niet alsnog in de nieuwe
  // zoekopdracht is gelekt.
  await page.waitForTimeout(700);
  await expect(page.getByText("Verouderde vervolgpagina")).toHaveCount(0);
  await expect(page.getByText("Eerste pagina")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "1 resultaat voor “nieuwe zoekopdracht”" })).toBeVisible();
});

test("een detail geopend via 'bekijk alles' blijft open na herladen (TD-16 regressie)", async ({ page }) => {
  await page.unroute("**/api/rce/search**");
  await page.route("**/api/rce/search**", (route) => route.fulfill({
    json: { results: [{ ...records[0] }], page: 1, hasMore: false },
  }));

  await page.getByRole("button", { name: "Rijksmonumenten", exact: true }).click();
  await expect(page).toHaveURL(/browse=rijksmonument/);
  await page.getByRole("button", { name: "Bekijk gegevens van Woonhuis van de architect" }).click();
  await expect(page).toHaveURL(/object=/);
  const sharedUrl = page.url();

  await page.reload();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText("Woonhuis van de architect");
  expect(page.url()).toBe(sharedUrl);
});

test("zoeken toont een rustige laadstaat op de plaats van de resultaten", async ({ page }) => {
  await page.unroute("**/api/rce/search**");
  await page.route("**/api/rce/search**", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    await route.fulfill({ json: { results: records, page: 1, hasMore: false } });
  });

  await page.getByRole("combobox", { name: "Zoeken" }).fill("moutmolen");
  await page.getByRole("button", { name: "Doorzoek RCE" }).click();

  await expect(page.getByRole("status").filter({ hasText: "We zoeken in de RCE-bronnen" })).toBeVisible();
  await expect(page.locator(".skeleton-card")).toHaveCount(3);
  await expect(page.locator(".search-combobox form")).toHaveAttribute("aria-busy", "true");
  await expect(page.getByRole("heading", { name: /3 resultaten/ })).toBeVisible();
});

test("een vondstlocatie toont vondsten met hun RN2-bron", async ({ page }) => {
  await page.unroute("**/api/rce/search**");
  await page.route("**/api/rce/search**", (route) => route.fulfill({ json: { results: [{
    choNumber: "6109334", monumentNumber: "102482", registrationDate: "2016-09-30", street: "", houseNumber: "", postalCode: "",
    sourceUrl: "https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/vondstlocatie/6109334", name: "Padstuk-Dres", place: "Opmeer", municipality: "Opmeer",
    description: "Archeologische vondstlocatie.", monumentNature: "vondstlocatie", archaeologicalAcquisition: "archeologisch: boring",
    matchSource: "Archis-vondstmeldingsnummer", matchedText: "102482", matchScore: 10,
  }], page: 1, hasMore: false } }));
  await page.unroute("**/api/rce/vondstlocatie-inhoud**");
  await page.route("**/api/rce/vondstlocatie-inhoud**", (route) => route.fulfill({ json: {
    complexen: [], grondsporen: [], complexenTotaal: 0, grondsporenTotaal: 0, vondstenTotaal: 1,
    vondsten: [{ uri: "https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/vondsten/2199539", choNumber: "2199539", archisVondstnummer: "5888", aantal: 1,
      types: [{ uri: "https://data.cultureelerfgoed.nl/term/id/rn/2/type", label: "aardewerk", schemes: [{ uri: "https://data.cultureelerfgoed.nl/term/id/rn/2/ais", label: "Archeologisch Informatie Systeem" }] }],
      materialen: [], stijlen: [], toestand: { uri: "https://data.cultureelerfgoed.nl/term/id/rn/2/toestand", label: "fragment", schemes: [{ uri: "https://data.cultureelerfgoed.nl/term/id/rn/2/choi", label: "Cultuurhistorische Object Informatie" }] } }],
  } }));
  await page.getByRole("combobox", { name: "Zoeken" }).fill("102482");
  await page.getByRole("button", { name: "Doorzoek RCE" }).click();
  await page.getByRole("button", { name: "Bekijk gegevens van Padstuk-Dres" }).click();
  await expect(page.getByText("Archis-vondst 5888", { exact: true })).toBeVisible();
  await expect(page.getByText(/aardewerk \(Archeologisch Informatie Systeem\).*fragment \(Cultuurhistorische Object Informatie\)/)).toBeVisible();
});

test("archeologische complexen met hetzelfde type blijven van elkaar te onderscheiden, type is doorklikbaar naar het rn/2-begrip (TD-33, P1: CHO's naast een type klopten niet)", async ({ page }) => {
  const urnenveldUri = "https://data.cultureelerfgoed.nl/term/id/rn/2/urnenveld";
  await page.unroute("**/api/rce/search**");
  await page.route("**/api/rce/search**", (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("veld") === "archeologischcomplextype") {
      return route.fulfill({ json: { results: [{ ...records[0], name: "Ander complex met hetzelfde type", monumentNumber: "888004" }], page: 1, hasMore: false } });
    }
    return route.fulfill({ json: { results: [{
      choNumber: "39087", monumentNumber: "39087", registrationDate: "1994-05-17", street: "", houseNumber: "", postalCode: "",
      sourceUrl: "https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/vondstlocatie/39087", name: "Vorstengrafdonk", place: "Oss", municipality: "Oss",
      description: "Archeologische vondstlocatie.", monumentNature: "vondstlocatie", archaeologicalAcquisition: "archeologisch: opgraving",
      matchSource: "Archis-waarnemingsnummer", matchedText: "39087", matchScore: 10,
    }], page: 1, hasMore: false } });
  });
  await page.unroute("**/api/rce/vondstlocatie-inhoud**");
  await page.route("**/api/rce/vondstlocatie-inhoud**", (route) => route.fulfill({ json: {
    complexen: [
      { uri: "https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/archeologischcomplex/1", choNumber: "111",
        type: { uri: urnenveldUri, label: "urnenveld", schemes: [{ uri: "https://data.cultureelerfgoed.nl/term/id/rn/2/ais", label: "Archeologisch Informatie Systeem" }] } },
      { uri: "https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/archeologischcomplex/2", choNumber: "222",
        type: { uri: urnenveldUri, label: "urnenveld", schemes: [{ uri: "https://data.cultureelerfgoed.nl/term/id/rn/2/ais", label: "Archeologisch Informatie Systeem" }] } },
    ],
    grondsporen: [], complexenTotaal: 2, grondsporenTotaal: 0, vondstenTotaal: 0, vondsten: [],
  } }));
  await page.getByRole("combobox", { name: "Zoeken" }).fill("39087");
  await page.getByRole("button", { name: "Doorzoek RCE" }).click();
  await page.getByRole("button", { name: "Bekijk gegevens van Vorstengrafdonk" }).click();
  const dialog = page.getByRole("dialog");

  // TD-33: nog steeds van elkaar te onderscheiden via hun eigen CHO-nummer,
  // nu duidelijk gelabeld als "Complex {nummer}" i.p.v. een verwarrende
  // "(CHO {nummer})" die naast het type-begrip stond.
  await expect(dialog.getByRole("button", { name: "Complex 111", exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Complex 222", exact: true })).toBeVisible();

  // P1: het type zelf is nu een echte doorklik naar het rn/2-begrip, niet
  // langer een CHO-nummer dat niets met het type te maken had.
  const typeLinks = dialog.getByRole("button", { name: "urnenveld", exact: true });
  await expect(typeLinks).toHaveCount(2);
  await typeLinks.first().click();
  await expect(page).toHaveURL(/veld=archeologischcomplextype/);
  await expect(page).toHaveURL(new RegExp(encodeURIComponent(urnenveldUri).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  await expect(page.getByText("Ander complex met hetzelfde type")).toBeVisible();
});

test("archeologische complexen binnen een onderzoeksgebied tonen het type als doorklik naar het rn/2-begrip, niet als CHO-citaat (gemeld door de eigenaar, 17-08-2026)", async ({ page }) => {
  const brugUri = "https://data.cultureelerfgoed.nl/term/id/rn/2/brug";
  await page.unroute("**/api/rce/search**");
  await page.route("**/api/rce/search**", (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("veld") === "archeologischcomplextype") {
      return route.fulfill({ json: { results: [{ ...records[0], name: "Ander complex met hetzelfde type", monumentNumber: "888005" }], page: 1, hasMore: false } });
    }
    return route.fulfill({ json: { results: [{
      choNumber: "10030417", monumentNumber: "10030417", registrationDate: "2016-01-01", street: "", houseNumber: "", postalCode: "",
      sourceUrl: "https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/archeologischonderzoeksgebied/10030417", name: "Onderzoeksgebied Zandwetering", place: "Deventer", municipality: "Deventer",
      description: "Archeologisch onderzoeksgebied.", monumentNature: "archeologischonderzoeksgebied",
      matchSource: "CHO-nummer (onderzoeksgebied)", matchedText: "10030417", matchScore: 10,
    }], page: 1, hasMore: false } });
  });
  await page.unroute("**/api/rce/onderzoeksgebied-verrijking**");
  await page.route("**/api/rce/onderzoeksgebied-verrijking**", (route) => route.fulfill({ json: {
    complexen: [
      { complexUri: "https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/archeologischcomplex/10038712", choNumber: "10038712",
        type: { uri: brugUri, label: "brug", schemes: [{ uri: "https://data.cultureelerfgoed.nl/term/id/rn/2/ais", label: "Archeologisch Informatie Systeem" }] } },
    ],
    vondstlocaties: [], vondstlocatieTotaal: 0, grondsporenTotaal: 0, vondstenTotaal: 0, complexenViaVondstlocatieTotaal: 0,
  } }));
  await page.getByRole("combobox", { name: "Zoeken" }).fill("10030417");
  await page.getByRole("button", { name: "Doorzoek RCE" }).click();
  await page.getByRole("button", { name: "Bekijk gegevens van Onderzoeksgebied Zandwetering" }).click();
  const dialog = page.getByRole("dialog");

  // Voorheen stond het CHO-nummer van de complex-*instantie* misleidend
  // tussen haakjes naast de typenaam, alsof dat het rn/2-begrip was. De
  // instantie blijft apart opvraagbaar, duidelijk gelabeld.
  await expect(dialog.getByRole("button", { name: "Complex 10038712", exact: true })).toBeVisible();

  // Het type zelf is nu een echte doorklik naar het rn/2-begrip.
  const typeLink = dialog.getByRole("button", { name: "brug", exact: true });
  await expect(typeLink).toBeVisible();
  await typeLink.click();
  await expect(page).toHaveURL(/veld=archeologischcomplextype/);
  await expect(page).toHaveURL(new RegExp(encodeURIComponent(brugUri).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  await expect(page.getByText("Ander complex met hetzelfde type")).toBeVisible();
});

test("'Onderdeel van complex' is doorklikbaar binnen Doorzoeker, niet alleen platte tekst", async ({ page }) => {
  await page.unroute("**/api/rce/search**");
  await page.route("**/api/rce/search**", (route) => route.fulfill({
    json: {
      page: 1,
      hasMore: false,
      results: [{
        ...records[0],
        complexes: [{ complexnummer: "519470", complexnaam: "Buitenplaats De Ruiten", role: "onderdeel" }],
      }],
    },
  }));
  await page.getByRole("combobox", { name: "Zoeken" }).fill("architect");
  await page.getByRole("button", { name: "Doorzoek RCE" }).click();
  await page.getByRole("button", { name: "Bekijk gegevens van Woonhuis van de architect" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Buitenplaats De Ruiten" }).click();
  await expect(page).toHaveURL(/q=519470/);
});

test("'Onderdeel van Werelderfgoed' en 'Ligt in Rijksbeschermd gezicht' zijn live, lazy opgehaald en beide zichtbaar (006-werelderfgoed-ligt-in)", async ({ page }) => {
  await page.unroute("**/api/rce/search**");
  await page.route("**/api/rce/search**", (route) => route.fulfill({
    json: { page: 1, hasMore: false, results: [records[0]] },
  }));
  await page.unroute("**/api/rce/ligt-in**");
  await page.route("**/api/rce/ligt-in**", (route) => route.fulfill({
    json: {
      gezicht: [{ gezichtsnummer: "1489", naam: "Kinderdijk - Elshout" }],
      werelderfgoed: [{ werelderfgoednummer: "818", naam: "Molens bij Kinderdijk-Elshout" }],
    },
  }));
  await page.getByRole("combobox", { name: "Zoeken" }).fill("architect");
  await page.getByRole("button", { name: "Doorzoek RCE" }).click();
  await page.getByRole("button", { name: "Bekijk gegevens van Woonhuis van de architect" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "Molens bij Kinderdijk-Elshout" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Kinderdijk - Elshout" })).toBeVisible();
});

test("'Onderdeel van Werelderfgoed' is doorklikbaar (006-werelderfgoed-ligt-in)", async ({ page }) => {
  await page.unroute("**/api/rce/search**");
  await page.route("**/api/rce/search**", (route) => route.fulfill({
    json: { page: 1, hasMore: false, results: [records[0]] },
  }));
  await page.unroute("**/api/rce/ligt-in**");
  await page.route("**/api/rce/ligt-in**", (route) => route.fulfill({
    json: { gezicht: [], werelderfgoed: [{ werelderfgoednummer: "818", naam: "Molens bij Kinderdijk-Elshout" }] },
  }));
  await page.getByRole("combobox", { name: "Zoeken" }).fill("architect");
  await page.getByRole("button", { name: "Doorzoek RCE" }).click();
  await page.getByRole("button", { name: "Bekijk gegevens van Woonhuis van de architect" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Molens bij Kinderdijk-Elshout" }).click();
  await expect(page).toHaveURL(/q=Molens\+bij\+Kinderdijk-Elshout/);
});

test("'Onderwerp (uit omschrijving)' wordt lazy opgehaald per record, niet meer in de gewone zoekresultaten (regressie 22-08-2026: de oude, gebatchte variant maakte gewoon zoeken traag/timeout)", async ({ page }) => {
  await page.unroute("**/api/rce/search**");
  await page.route("**/api/rce/search**", (route) => route.fulfill({
    json: { page: 1, hasMore: false, results: [records[0]] },
  }));
  let omschrijvingOnderwerpCalls = 0;
  await page.route("**/api/rce/omschrijving-onderwerp**", (route) => {
    omschrijvingOnderwerpCalls += 1;
    return route.fulfill({
      json: { concepten: [
        { uri: "https://data.cultureelerfgoed.nl/term/id/cht/1", label: "kanalen", bron: "CHT" },
        { uri: "https://data.cultureelerfgoed.nl/term/id/abr/2", label: "terra sigillata", bron: "ABR" },
      ] },
    });
  });
  await page.getByRole("combobox", { name: "Zoeken" }).fill("architect");
  await page.getByRole("button", { name: "Doorzoek RCE" }).click();
  // De zoekresultaten zelf mogen geen aanroep naar de nieuwe route maken -
  // pas het openen van een detail triggert de lazy-fetch.
  expect(omschrijvingOnderwerpCalls).toBe(0);
  await page.getByRole("button", { name: "Bekijk gegevens van Woonhuis van de architect" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("kanalen (CHT), terra sigillata (ABR)")).toBeVisible();
  expect(omschrijvingOnderwerpCalls).toBe(1);
});

test("'Archeologische context'-knop toont een waarschuwing, laadstatus en doorklikbaar resultaat (017-archeologische-context-onderzoeksgebied)", async ({ page }) => {
  await page.unroute("**/api/rce/search**");
  await page.route("**/api/rce/search**", (route) => route.fulfill({
    json: { page: 1, hasMore: false, results: [records[0]] },
  }));
  await page.unroute("**/api/rce/archeologische-context**");
  await page.route("**/api/rce/archeologische-context**", (route) => route.fulfill({
    json: {
      gebieden: [{
        onderzoeksgebiedUri: "https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/archeologischonderzoeksgebied/2051204",
        choNummer: "2051204",
        omschrijving: "Gallo-Romeins Tempelcomplex 1e en 2e eeuw",
        wkt: "Point (5.83 51.93)",
      }],
    },
  }));
  await page.getByRole("combobox", { name: "Zoeken" }).fill("architect");
  await page.getByRole("button", { name: "Doorzoek RCE" }).click();
  await page.getByRole("button", { name: "Bekijk gegevens van Woonhuis van de architect" }).click();
  const dialog = page.getByRole("dialog");
  // Alleen zichtbaar bij een gebouwd Rijksmonument (017-Beslissingen nr. 5),
  // met de waarschuwing vóórdat er geklikt wordt.
  await expect(dialog.getByText("kan tot ~20 seconden duren")).toBeVisible();
  // Vóór het resultaat is er maar één kaart (de gewone overzichtskaart
  // bovenaan); pas ná een geslaagde zoekopdracht komt de aparte
  // archeologische-contextkaart erbij (017-Beslissingen nr. 1: nieuwe,
  // losse laag, niet de bovenste kaart vervangen).
  await expect(dialog.getByLabel("Kaart met gevonden erfgoedobjecten")).toHaveCount(1);
  await dialog.getByRole("button", { name: "Zoek archeologische context" }).click();
  // exact: true - de nieuwe kaart maakt de polygoon ook een focusbare knop,
  // met een langere aria-label ("Onderzoeksgebied 2051204, Gallo-Romeins ...")
  // die anders ook op deze naam zou matchen.
  const resultaat = dialog.getByRole("button", { name: "Onderzoeksgebied 2051204", exact: true });
  await expect(resultaat).toBeVisible();
  await expect(dialog.getByText("Gallo-Romeins Tempelcomplex")).toBeVisible();
  await expect(dialog.getByLabel("Kaart met gevonden erfgoedobjecten")).toHaveCount(2);
  await resultaat.click();
  await expect(page).toHaveURL(/q=2051204/);
});

test("'Archeologische context'-knop toont geen resultaten-melding als er niets overlapt (017-archeologische-context-onderzoeksgebied)", async ({ page }) => {
  await page.unroute("**/api/rce/search**");
  await page.route("**/api/rce/search**", (route) => route.fulfill({
    json: { page: 1, hasMore: false, results: [records[0]] },
  }));
  await page.unroute("**/api/rce/archeologische-context**");
  await page.route("**/api/rce/archeologische-context**", (route) => route.fulfill({ json: { gebieden: [] } }));
  await page.getByRole("combobox", { name: "Zoeken" }).fill("architect");
  await page.getByRole("button", { name: "Doorzoek RCE" }).click();
  await page.getByRole("button", { name: "Bekijk gegevens van Woonhuis van de architect" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Zoek archeologische context" }).click();
  await expect(dialog.getByText("Geen archeologische context gevonden")).toBeVisible();
});

test("stijl & cultuur, bouwkundige staat, type en overige functies worden getoond", async ({ page }) => {
  const kantoorUri = "https://data.cultureelerfgoed.nl/term/id/rn/2/kantoor";
  const stijlUri = "https://data.cultureelerfgoed.nl/term/id/rn/2/478ca85b-ecb3-4a38-8b97-ba78deeba3dd";
  const bouwkundigeStaatUri = "https://data.cultureelerfgoed.nl/term/id/rn/2/ed0abe81-4466-44c3-a8c4-2f1a0e63176d";
  await page.unroute("**/api/rce/search**");
  await page.route("**/api/rce/search**", (route) => route.fulfill({
    json: {
      page: 1,
      hasMore: false,
      results: [{
        ...records[0],
        wkt: "Point (5.07 51.52)",
        originalFunctionNames: ["Woonhuis", "Kantoor"],
        functionConcepts: [
          { uri: "https://data.cultureelerfgoed.nl/term/id/rn/2/woonhuis", label: "Woonhuis" },
          { uri: kantoorUri, label: "Kantoor" },
        ],
        typeNames: ["vrijstaand huis"],
        stijlEnCultuur: "Neo-Renaissance",
        stijlEnCultuurConceptUri: stijlUri,
        bouwkundigeStaat: "goed",
        bouwkundigeStaatConceptUri: bouwkundigeStaatUri,
      }],
    },
  }));
  await page.getByRole("combobox", { name: "Zoeken" }).fill("architect");
  await page.getByRole("button", { name: "Doorzoek RCE" }).click();
  await page.getByRole("button", { name: "Bekijk gegevens van Woonhuis van de architect" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("vrijstaand huis", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Toon ruwe WKT", { exact: false })).toHaveCount(0);
  await dialog.getByRole("button", { name: "Kantoor", exact: true }).click();
  await expect(page).toHaveURL(/veld=functie/);
  await expect(page).toHaveURL(new RegExp(encodeURIComponent(kantoorUri).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("Type is doorklikbaar naar zijn eigen conceptzoekopdracht (gemeld door de eigenaar, CHO 27601 'Bovenkruier')", async ({ page }) => {
  const bovenkruierUri = "https://data.cultureelerfgoed.nl/term/id/rn/2/9ba13642-5aa7-42fa-862f-4b9c71455cce";
  await page.unroute("**/api/rce/search**");
  await page.route("**/api/rce/search**", (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("veld") === "monumenttype") {
      return route.fulfill({ json: { page: 1, hasMore: false, results: [{
        ...records[0], choNumber: "cho-type", monumentNumber: "999005", name: "Andere molen met hetzelfde type",
      }] } });
    }
    return route.fulfill({ json: { page: 1, hasMore: false, results: [{
      ...records[0],
      typeNames: ["Bovenkruier"],
      typeConcepts: [{ uri: bovenkruierUri, label: "Bovenkruier" }],
    }] } });
  });
  await page.getByRole("combobox", { name: "Zoeken" }).fill("architect");
  await page.getByRole("button", { name: "Doorzoek RCE" }).click();
  await page.getByRole("button", { name: "Bekijk gegevens van Woonhuis van de architect" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Bovenkruier", exact: true }).click();
  await expect(page).toHaveURL(/veld=monumenttype/);
  await expect(page).toHaveURL(new RegExp(encodeURIComponent(bovenkruierUri).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  await expect(page.getByText("Andere molen met hetzelfde type")).toBeVisible();
});

test("stijl en cultuur / bouwkundige staat zijn doorklikbaar naar hun eigen concept-zoekopdracht", async ({ page }) => {
  const stijlUri = "https://data.cultureelerfgoed.nl/term/id/rn/2/478ca85b-ecb3-4a38-8b97-ba78deeba3dd";
  const bouwkundigeStaatUri = "https://data.cultureelerfgoed.nl/term/id/rn/2/ed0abe81-4466-44c3-a8c4-2f1a0e63176d";
  await page.unroute("**/api/rce/search**");
  await page.route("**/api/rce/search**", (route) => {
    const url = new URL(route.request().url());
    const veld = url.searchParams.get("veld");
    if (veld === "stijl") {
      return route.fulfill({ json: { page: 1, hasMore: false, results: [{
        ...records[0], choNumber: "cho-stijl", monumentNumber: "999001", name: "Ander pand met dezelfde stijl",
      }] } });
    }
    return route.fulfill({
      json: {
        page: 1,
        hasMore: false,
        results: [{
          ...records[0],
          stijlEnCultuur: "Neo-Renaissance",
          stijlEnCultuurConceptUri: stijlUri,
          bouwkundigeStaat: "goed",
          bouwkundigeStaatConceptUri: bouwkundigeStaatUri,
        }],
      },
    });
  });
  await page.getByRole("combobox", { name: "Zoeken" }).fill("architect");
  await page.getByRole("button", { name: "Doorzoek RCE" }).click();
  await page.getByRole("button", { name: "Bekijk gegevens van Woonhuis van de architect" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Neo-Renaissance", exact: true }).click();
  await expect(page).toHaveURL(/veld=stijl/);
  await expect(page).toHaveURL(new RegExp(encodeURIComponent(stijlUri).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  await expect(page.getByText("Ander pand met dezelfde stijl")).toBeVisible();
});

test("'Alle gekoppelde begrippen' toont elk begrip gegroepeerd en is zelf ook doorklikbaar", async ({ page }) => {
  const functieUri = "https://data.cultureelerfgoed.nl/term/id/rn/2/functie-woonhuis";
  const stijlUri = "https://data.cultureelerfgoed.nl/term/id/rn/2/stijl-neorenaissance";
  await page.unroute("**/api/rce/search**");
  await page.route("**/api/rce/search**", (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("veld") === "stijl") {
      return route.fulfill({ json: { page: 1, hasMore: false, results: [{
        ...records[0], choNumber: "cho-stijl", monumentNumber: "999002", name: "Ander pand met dezelfde stijl",
      }] } });
    }
    return route.fulfill({
      json: {
        page: 1,
        hasMore: false,
        results: [{
          ...records[0],
          functionConcepts: [{ uri: functieUri, label: "Woonhuis" }],
          stijlEnCultuur: "Neo-Renaissance",
          stijlEnCultuurConceptUri: stijlUri,
        }],
      },
    });
  });
  await page.getByRole("combobox", { name: "Zoeken" }).fill("architect");
  await page.getByRole("button", { name: "Doorzoek RCE" }).click();
  await page.getByRole("button", { name: "Bekijk gegevens van Woonhuis van de architect" }).click();

  const overzicht = page.locator(".map-object-list", { hasText: "Alle gekoppelde begrippen" });
  await expect(overzicht.getByRole("button", { name: "Functie: Woonhuis", exact: true })).toBeVisible();
  await expect(overzicht.getByRole("button", { name: "Stijl en cultuur: Neo-Renaissance", exact: true })).toBeVisible();

  await overzicht.getByRole("button", { name: "Stijl en cultuur: Neo-Renaissance", exact: true }).click();
  await expect(page).toHaveURL(/veld=stijl/);
  await expect(page).toHaveURL(new RegExp(encodeURIComponent(stijlUri).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  await expect(page.getByText("Ander pand met dezelfde stijl")).toBeVisible();
});

test("type grondspoor is doorklikbaar naar zijn eigen conceptzoekopdracht (gemeld door de eigenaar, CHO 10000187)", async ({ page }) => {
  const typeUri = "https://data.cultureelerfgoed.nl/term/id/rn/2/f4ae6fd1-8ae5-4265-8021-652c637de15c";
  await page.unroute("**/api/rce/search**");
  await page.route("**/api/rce/search**", (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("veld") === "grondspoortype") {
      return route.fulfill({ json: { results: [{ ...records[0], name: "Ander grondspoor met hetzelfde type", monumentNumber: "888003" }], page: 1, hasMore: false } });
    }
    return route.fulfill({ json: { results: [{
      choNumber: "10000187", monumentNumber: "10000187", registrationDate: "2015-06-09", street: "", houseNumber: "", postalCode: "",
      sourceUrl: "https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/grondsporen/10000187", name: "Grondverkleuring", place: "Almere", municipality: "Almere",
      description: "Grondverkleuring", monumentNature: "grondsporen", archaeologicalTraceCount: 10, archaeologicalType: "grondverkleuring",
      archaeologicalTypeConceptUri: typeUri,
      matchSource: "omschrijving (grondspoor)", matchedText: "Grondverkleuring", matchScore: 20,
    }], page: 1, hasMore: false } });
  });
  await page.getByRole("combobox", { name: "Zoeken" }).fill("Grondverkleuring");
  await page.getByRole("button", { name: "Doorzoek RCE" }).click();
  await page.getByRole("button", { name: "Bekijk gegevens van Grondverkleuring" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "grondverkleuring", exact: true }).click();
  await expect(page).toHaveURL(/veld=grondspoortype/);
  await expect(page).toHaveURL(new RegExp(encodeURIComponent(typeUri).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  await expect(page.getByText("Ander grondspoor met hetzelfde type")).toBeVisible();
});

test("een grondspoor toont aantal, RN2-bron en bijbehorende vondstlocatie", async ({ page }) => {
  await page.unroute("**/api/rce/search**");
  await page.route("**/api/rce/search**", (route) => route.fulfill({ json: { results: [{
    choNumber: "10000135", monumentNumber: "10000135", registrationDate: "2015-06-05", street: "", houseNumber: "", postalCode: "",
    sourceUrl: "https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/grondsporen/10000135", name: "Karrespoor", place: "Brunssum", municipality: "Brunssum",
    description: "Karrespoor", monumentNature: "grondsporen", archaeologicalTraceCount: 1, archaeologicalType: "onbekend",
    archaeologicalTypeConceptUri: "https://data.cultureelerfgoed.nl/term/id/rn/2/type",
    archaeologicalTypeSchemes: [{ uri: "https://data.cultureelerfgoed.nl/term/id/rn/2/ais", label: "Archeologisch Informatie Systeem" }],
    parentObjectUrl: "https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/vondstlocatie/6175362", parentObjectLabel: "Bijbehorende vondstlocatie", parentObjectNumber: "6175362",
    matchSource: "omschrijving (grondspoor)", matchedText: "Karrespoor", matchScore: 20,
  }], page: 1, hasMore: false } }));
  await page.getByRole("combobox", { name: "Zoeken" }).fill("Karrespoor");
  await page.getByRole("button", { name: "Doorzoek RCE" }).click();
  await page.getByRole("button", { name: "Bekijk gegevens van Karrespoor" }).click();
  await expect(page.getByText("Archeologisch grondspoor", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("onbekend (Archeologisch Informatie Systeem)", { exact: true })).toBeVisible();
  await expect(page.getByText("Bijbehorende vondstlocatie", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Bijbehorende vondstlocatie", exact: true }).click();
  await expect(page).toHaveURL(/q=6175362/);
});

test("een archeologisch terrein toont waardering doorklikbaar en 'onderdeel van rijksmonument' (P1)", async ({ page }) => {
  const waarderingUri = "https://data.cultureelerfgoed.nl/term/id/rn/2/31020cd0-9029-4609-bbd8-ee83f9baf3f4";
  await page.unroute("**/api/rce/search**");
  await page.route("**/api/rce/search**", (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("veld") === "waardering") {
      return route.fulfill({ json: { results: [{ ...records[0], name: "Ander terrein met dezelfde waardering", monumentNumber: "888001" }], page: 1, hasMore: false } });
    }
    return route.fulfill({ json: { results: [{
      choNumber: "9001", monumentNumber: "12345", registrationDate: "", street: "", houseNumber: "", postalCode: "",
      sourceUrl: "https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/archeologischterrein/9001", name: "Romeins grafveld", place: "Nijmegen", municipality: "Nijmegen",
      description: "Terrein met resten uit de Romeinse tijd.", monumentNature: "archeologischterrein",
      archaeologicalValuation: "terrein van hoge archeologische waarde", archaeologicalValuationConceptUri: waarderingUri,
      parentObjectUrl: "https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/rijksmonument/45708", parentObjectLabel: "Buitenplaats", parentObjectNumber: "532442",
      matchSource: "omschrijving (archeologisch terrein)", matchedText: "Romeins grafveld", matchScore: 20,
    }], page: 1, hasMore: false } });
  });
  await page.getByRole("combobox", { name: "Zoeken" }).fill("Romeins grafveld");
  await page.getByRole("button", { name: "Doorzoek RCE" }).click();
  await page.getByRole("button", { name: "Bekijk gegevens van Romeins grafveld" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Buitenplaats", exact: true }).click();
  await expect(page).toHaveURL(/q=532442/);

  await page.getByRole("button", { name: "Bekijk gegevens van Romeins grafveld" }).click();
  await dialog.getByRole("button", { name: "terrein van hoge archeologische waarde", exact: true }).click();
  await expect(page).toHaveURL(/veld=waardering/);
  await expect(page).toHaveURL(new RegExp(encodeURIComponent(waarderingUri).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  await expect(page.getByText("Ander terrein met dezelfde waardering")).toBeVisible();
});

test("een vondstlocatie toont verwervingswijze doorklikbaar en ligt binnen een onderzoeksgebied (P1)", async ({ page }) => {
  const verwervingUri = "https://data.cultureelerfgoed.nl/term/id/rn/2/d303201f-d9c5-44d7-a57c-b65644fed2aa";
  await page.unroute("**/api/rce/search**");
  await page.route("**/api/rce/search**", (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("veld") === "verwerving") {
      return route.fulfill({ json: { results: [{ ...records[0], name: "Andere vondstlocatie met dezelfde verwervingswijze", monumentNumber: "888002" }], page: 1, hasMore: false } });
    }
    return route.fulfill({ json: { results: [{
      choNumber: "6176097", monumentNumber: "6176097", registrationDate: "", street: "", houseNumber: "", postalCode: "",
      sourceUrl: "https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/vondstlocatie/6176097", name: "Kempweg", place: "Meterik", municipality: "Meterik",
      description: "Archeologische vondstlocatie.", monumentNature: "vondstlocatie",
      archaeologicalAcquisition: "niet-archeologisch: graafwerk", archaeologicalAcquisitionConceptUri: verwervingUri,
      parentObjectUrl: "https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/archeologischonderzoeksgebied/10001066", parentObjectLabel: "Onderzoeksgebied 10001066", parentObjectNumber: "10001066",
      matchSource: "CHO-nummer (vondstlocatie)", matchedText: "6176097", matchScore: 0,
    }], page: 1, hasMore: false } });
  });
  await page.getByRole("combobox", { name: "Zoeken" }).fill("6176097");
  await page.getByRole("button", { name: "Doorzoek RCE" }).click();
  await page.getByRole("button", { name: "Bekijk gegevens van Kempweg" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Onderzoeksgebied 10001066", exact: true }).click();
  await expect(page).toHaveURL(/q=10001066/);

  await page.getByRole("button", { name: "Bekijk gegevens van Kempweg" }).click();
  await dialog.getByRole("button", { name: "niet-archeologisch: graafwerk", exact: true }).click();
  await expect(page).toHaveURL(/veld=verwerving/);
  await expect(page).toHaveURL(new RegExp(encodeURIComponent(verwervingUri).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  await expect(page.getByText("Andere vondstlocatie met dezelfde verwervingswijze")).toBeVisible();
});

test("materiaal van een vondst zoekt exact verder via de RN2-URI", async ({ page }) => {
  const materialUri = "https://data.cultureelerfgoed.nl/term/id/rn/2/91645e25-8d66-44ba-9126-56e64ac5fd1f";
  await page.unroute("**/api/rce/search**");
  await page.route("**/api/rce/search**", (route) => {
    const url = new URL(route.request().url());
    const exactMaterial = url.searchParams.get("veld") === "materiaal" && url.searchParams.get("concept") === materialUri;
    return route.fulfill({ json: { results: [{
      choNumber: exactMaterial ? "10004949" : "10015422", monumentNumber: exactMaterial ? "10004949" : "10015422", registrationDate: "2016-03-17", street: "", houseNumber: "", postalCode: "",
      sourceUrl: `https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/vondsten/${exactMaterial ? "10004949" : "10015422"}`,
      description: exactMaterial ? "Bedelaarsgildepenning" : "Een riemtong van messing.", monumentNature: "vondsten", place: "Eindhoven", municipality: "Eindhoven", archaeologicalFindCount: 1,
      archaeologicalFindTypes: [{ uri: "https://data.cultureelerfgoed.nl/term/id/rn/2/type", label: exactMaterial ? "penning" : "riemtong - langwerpig", schemes: [{ uri: "https://data.cultureelerfgoed.nl/term/id/rn/2/ais", label: "Archeologisch Informatie Systeem" }] }],
      archaeologicalMaterials: [{ uri: materialUri, label: "messing", schemes: [{ uri: "https://data.cultureelerfgoed.nl/term/id/rn/2/ais", label: "Archeologisch Informatie Systeem" }] }],
      archaeologicalCondition: { uri: "https://data.cultureelerfgoed.nl/term/id/rn/2/toestand", label: "onbekend", schemes: [{ uri: "https://data.cultureelerfgoed.nl/term/id/rn/2/choi", label: "Cultuurhistorische Object Informatie" }] },
      parentObjectUrl: "https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/vondstlocatie/6175445", parentObjectLabel: "Collse Watermolen",
      matchSource: exactMaterial ? "materiaal vondst" : "CHO-nummer (vondst)", matchedText: exactMaterial ? "" : "10015422", matchScore: exactMaterial ? 0 : 10,
    }], page: 1, hasMore: false } });
  });
  await page.getByRole("combobox", { name: "Zoeken" }).fill("10015422");
  await page.getByRole("button", { name: "Doorzoek RCE" }).click();
  await page.getByRole("button", { name: /Bekijk gegevens van/ }).click();
  await expect(page.getByRole("button", { name: "messing", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "messing", exact: true }).click();
  await expect(page).toHaveURL(/veld=materiaal/);
  await expect(page).toHaveURL(new RegExp(encodeURIComponent(materialUri).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  await expect(page.getByText("Bedelaarsgildepenning", { exact: true })).toBeVisible();
});

test("een archeologisch complex blijft onderscheiden van een gebouwd complex", async ({ page }) => {
  await page.unroute("**/api/rce/search**");
  await page.route("**/api/rce/search**", (route) => route.fulfill({ json: { results: [{
    choNumber: "10015403", monumentNumber: "10015403", registrationDate: "2016-03-17", street: "", houseNumber: "", postalCode: "",
    sourceUrl: "https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/archeologischcomplex/10015403", name: "watermolen", description: "Archeologische duiding bij de watermolen.", monumentNature: "archeologischcomplex", place: "Eindhoven", municipality: "Eindhoven",
    archaeologicalComplexType: { uri: "https://data.cultureelerfgoed.nl/term/id/rn/2/watermolen", label: "watermolen", schemes: [{ uri: "https://data.cultureelerfgoed.nl/term/id/rn/2/ais", label: "Archeologisch Informatie Systeem" }] },
    archaeologicalContexts: [{ uri: "https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/vondstlocatie/6175445", label: "Collse Watermolen", type: "Vondstlocatie" }],
    matchSource: "CHO-nummer (archeologisch complex)", matchedText: "10015403", matchScore: 10,
  }], page: 1, hasMore: false } }));
  await page.getByRole("combobox", { name: "Zoeken" }).fill("10015403");
  await page.getByRole("button", { name: "Doorzoek RCE" }).click();
  await expect(page.getByText("Archeologisch complex", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Complex van rijksmonumenten", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Bekijk gegevens van watermolen" }).click();
  await expect(page.getByRole("button", { name: "watermolen", exact: true })).toBeVisible();
  await expect(page.getByText("Collse Watermolen", { exact: true })).toBeVisible();
});

test("filters volgen het gekozen objecttype", async ({ page }) => {
  await page.getByRole("combobox", { name: "Zoeken" }).fill("Goirle");
  await page.getByRole("button", { name: "Doorzoek RCE" }).click();
  await page.getByRole("radio", { name: /Complex 1/ }).check();
  await expect(page.getByRole("group", { name: "Monumentaard" })).toHaveCount(
    0,
  );
  await expect(page.getByRole("group", { name: "Functie" })).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "1 resultaat voor “Goirle”" }),
  ).toBeVisible();
});

test("het filter voor objectsoort heet niet meer 'Juridische status' (gemeld door de eigenaar, 21-08-2026: 'er zijn maar 3 juridische statussen', dit filter toonde objectsoorten onder een verkeerd label)", async ({ page }) => {
  await page.getByRole("combobox", { name: "Zoeken" }).fill("Goirle");
  await page.getByRole("button", { name: "Doorzoek RCE" }).click();
  await expect(
    page.getByRole("heading", { name: "3 resultaten voor “Goirle”" }),
  ).toBeVisible();

  const fieldset = page.locator("fieldset", { has: page.getByText("Objectsoort uitsluiten") });
  await expect(fieldset).toBeVisible();
  await expect(page.getByText("Juridische status", { exact: true })).toHaveCount(0);
  await fieldset.getByText("Wat betekent dit?").click();
  await expect(fieldset).toContainText("Dit is geen juridische status");
  await expect(fieldset).toContainText("rijksmonument, voorbeschermd en geen rijksmonument");

  // Uitvinken verbergt die objectsoort, de rest blijft zichtbaar.
  await fieldset.getByRole("checkbox", { name: /Complex van rijksmonumenten/ }).uncheck();
  await expect(page.getByText("Historisch boerderijcomplex")).toHaveCount(0);
  await expect(page.getByText("Woonhuis van de architect")).toBeVisible();
});

test("een complexdetail toont geen lege monumentvelden", async ({ page }) => {
  await page.getByRole("combobox", { name: "Zoeken" }).fill("Goirle");
  await page.getByRole("button", { name: "Doorzoek RCE" }).click();
  await page
    .getByRole("button", { name: "Bekijk gegevens van Historisch boerderijcomplex" })
    .click();
  const dialog = page.getByRole("dialog");
  const detailLayer = await page.locator(".backdrop").evaluate((element) =>
    Number.parseInt(getComputedStyle(element).zIndex, 10),
  );
  expect(detailLayer).toBeGreaterThan(800);
  await expect(dialog).toContainText("Complex van rijksmonumenten");
  await expect(
    dialog.getByText("2 rijksmonumenten", { exact: true }),
  ).toBeVisible();
  await expect(dialog.getByText("Functie", { exact: true })).toHaveCount(0);
  await expect(
    dialog.getByText("Inschrijving of datering", { exact: true }),
  ).toHaveCount(0);
});

test("een mislukte complexverrijking toont een foutmelding, geen stille leegte (TD-17 regressie)", async ({ page }) => {
  await page.unroute("**/api/rce/complex-members**");
  await page.route("**/api/rce/complex-members**", (route) =>
    route.fulfill({ status: 502, json: { error: "Tijdelijk niet bereikbaar" } }),
  );

  await page.getByRole("combobox", { name: "Zoeken" }).fill("Goirle");
  await page.getByRole("button", { name: "Doorzoek RCE" }).click();
  await page
    .getByRole("button", { name: "Bekijk gegevens van Historisch boerderijcomplex" })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByText("Onderdelen van dit complex konden niet worden geladen. Probeer het later opnieuw.", { exact: true }),
  ).toBeVisible();
});

test("de detaildialoog houdt focus vast en herstelt hem na Escape", async ({
  page,
}) => {
  await page.getByRole("combobox", { name: "Zoeken" }).fill("Goirle");
  await page.getByRole("button", { name: "Doorzoek RCE" }).click();
  const opener = page.getByRole("button", {
    name: "Bekijk gegevens van Historisch boerderijcomplex",
  });
  await opener.click();

  const dialog = page.getByRole("dialog");
  const closeButton = dialog.getByRole("button", { name: "Details sluiten" });
  await expect(closeButton).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(
    dialog.getByRole("link", { name: /Bekijk in de RCE Linked Data/ }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(closeButton).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test("de kaartpositie blijft in de URL staan na herladen", async ({ page }) => {
  await page.getByRole("combobox", { name: "Zoeken" }).fill("Goirle");
  await page.getByRole("button", { name: "Doorzoek RCE" }).click();
  await page.getByRole("button", { name: "Kaartweergave" }).click();
  await page.getByRole("button", { name: "Zoom in" }).click();

  await expect
    .poll(() => new URL(page.url()).searchParams.get("zoom"))
    .not.toBeNull();
  const sharedUrl = page.url();
  const sharedState = new URL(sharedUrl).searchParams;
  expect(sharedState.get("lat")).not.toBeNull();
  expect(sharedState.get("lng")).not.toBeNull();

  await page.reload();
  await expect(
    page.getByRole("button", { name: "Kaartweergave" }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(page.url()).toBe(sharedUrl);
});

test("Kaartweergave-knop is uitgeschakeld als geen van de resultaten een eigen locatie heeft (UX-review 17-08-2026: archeologisch onderzoeksgebied heeft geen wkt/lat/lng)", async ({ page }) => {
  await page.unroute("**/api/rce/search**");
  await page.route("**/api/rce/search**", (route) =>
    route.fulfill({ json: { results: [records[2]], page: 1, hasMore: false } }),
  );
  await page.getByRole("combobox", { name: "Zoeken" }).fill("Onderzoek");
  await page.getByRole("button", { name: "Doorzoek RCE" }).click();
  await expect(
    page.getByRole("heading", { name: "1 resultaat voor “Onderzoek”" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Kaartweergave" })).toBeDisabled();
});

test("Kaartweergave-knop blijft bruikbaar zodra minstens één resultaat een eigen locatie heeft", async ({ page }) => {
  await page.getByRole("combobox", { name: "Zoeken" }).fill("Goirle");
  await page.getByRole("button", { name: "Doorzoek RCE" }).click();
  await expect(
    page.getByRole("heading", { name: "3 resultaten voor “Goirle”" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Kaartweergave" })).toBeEnabled();
});

test("kaartmarkers zijn met het toetsenbord bedienbaar, niet alleen met de muis (TD-27, accessibility-review 15-08-2026: 31 Leaflet-markers zonder tabindex/role gevonden)", async ({ page }) => {
  await page.unroute("**/api/rce/search**");
  await page.route("**/api/rce/search**", (route) =>
    route.fulfill({ json: { results: [records[0]], page: 1, hasMore: false } }),
  );
  await page.getByRole("combobox", { name: "Zoeken" }).fill("Woonhuis");
  await page.getByRole("button", { name: "Doorzoek RCE" }).click();
  await expect(
    page.getByRole("heading", { name: "1 resultaat voor “Woonhuis”" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Kaartweergave" }).click();

  const marker = page.locator('.leaflet-map [role="button"]').first();
  await expect(marker).toHaveAttribute("tabindex", "0");
  await marker.focus();
  await page.keyboard.press("Enter");

  await expect(page.getByRole("dialog")).toBeVisible();
});

test("de compacte kaart in een detailvenster heeft in- en uitzoomknoppen, niet alleen scrollwheel-zoom (gemeld door de eigenaar, 21-08-2026: 'ik moet toch de omgeving van een monument of complex kunnen zien')", async ({ page }) => {
  // Een compacte kaart (monument, complex, archeologische context) opent op
  // straatniveau (fitBounds op één punt) zonder enige manier om uit te
  // zoomen: scrollwheel-zoom staat bewust uit (zou de dialoogscroll kapen),
  // maar de +/--knoppen waren tot 21-08-2026 óók uitgezet, dus de omgeving
  // van het object was helemaal niet te zien.
  await page.unroute("**/api/rce/search**");
  await page.route("**/api/rce/search**", (route) =>
    route.fulfill({ json: { results: [records[0]], page: 1, hasMore: false } }),
  );
  await page.getByRole("combobox", { name: "Zoeken" }).fill("Woonhuis");
  await page.getByRole("button", { name: "Doorzoek RCE" }).click();
  await page.getByRole("button", { name: "Bekijk gegevens van Woonhuis van de architect" }).click();

  await expect(page.locator(".detail-map .leaflet-control-zoom-in")).toBeVisible();
  // Een kaart met één punt fit al op maxZoom (kan dus niet verder inzoomen,
  // vandaar dat alleen uitzoomen hier getest wordt) - vóór 21-08-2026
  // bestond deze knop op een compacte kaart helemaal niet.
  const zoomOut = page.locator(".detail-map .leaflet-control-zoom-out");
  await expect(zoomOut).toBeVisible();
  await expect(zoomOut).not.toHaveClass(/leaflet-disabled/);
  await zoomOut.click();
});

test("een gekozen termsuggestie behoudt URI en bron na herladen", async ({
  page,
}) => {
  const search = page.getByRole("combobox", { name: "Zoeken" });
  await search.fill("kerk");
  await page
    .getByRole("option")
    .getByRole("button", { name: /Kerk.*Cultuurhistorische Thesaurus/ })
    .click();
  await page.getByRole("button", { name: "Doorzoek RCE" }).click();

  await expect
    .poll(() => new URL(page.url()).searchParams.get("begrip"))
    .toBe("https://example.test/term/kerk");
  expect(new URL(page.url()).searchParams.get("begripbron")).toBe(
    "https://example.test/cht",
  );

  await page.reload();
  await expect(search).toHaveValue("Kerk");
  expect(new URL(page.url()).searchParams.get("begripbronnaam")).toBe(
    "Cultuurhistorische Thesaurus",
  );
});

test("een aantoonbaar gekoppelde RN2-term zoekt exact op de concept-URI", async ({ page }) => {
  const conceptUri = "https://data.cultureelerfgoed.nl/term/id/rn/2/woonhuis";
  await page.route("**/api/terms/suggest**", (route) => route.fulfill({ json: {
    suggestions: [{
      uri: conceptUri,
      label: "Woonhuis",
      sourceUri: "https://data.cultureelerfgoed.nl/term/id/rn/2/mrs",
      sourceName: "Monumenten Registratie Systeem",
      conceptField: "functie",
      usageCount: 13140,
    }],
  } }));

  const search = page.getByRole("combobox", { name: "Zoeken" });
  await search.fill("woon");
  const option = page.getByRole("option").getByRole("button", { name: /Woonhuis.*13\.140 objecten.*exact gekoppeld als functie/ });
  await expect(option).toBeVisible();
  const requestPromise = page.waitForRequest((request) => request.url().includes("/api/rce/search?"));
  await option.click();
  const requestUrl = new URL((await requestPromise).url());
  expect(requestUrl.searchParams.get("concept")).toBe(conceptUri);
  expect(requestUrl.searchParams.get("veld")).toBe("functie");
  await expect.poll(() => new URL(page.url()).searchParams.get("veld")).toBe("functie");
});

test("browser-terug en -vooruit herstellen de zoekopdracht", async ({
  page,
}) => {
  const search = page.getByRole("combobox", { name: "Zoeken" });
  await search.fill("Eerste zoekactie");
  await page.getByRole("button", { name: "Doorzoek RCE" }).click();
  await expect(
    page.getByRole("heading", {
      name: "3 resultaten voor “Eerste zoekactie”",
    }),
  ).toBeVisible();

  await search.fill("Tweede zoekactie");
  await page.getByRole("button", { name: "Doorzoek RCE" }).click();
  await expect(
    page.getByRole("heading", {
      name: "3 resultaten voor “Tweede zoekactie”",
    }),
  ).toBeVisible();

  await page.goBack();
  await expect(search).toHaveValue("Eerste zoekactie");
  await expect(
    page.getByRole("heading", {
      name: "3 resultaten voor “Eerste zoekactie”",
    }),
  ).toBeVisible();

  await page.goForward();
  await expect(search).toHaveValue("Tweede zoekactie");
});

test("een oude verbindingsfout verdwijnt zodra een nieuwe zoekterm wordt ingevoerd", async ({
  page,
}) => {
  await page.unroute("**/api/rce/search**");
  await page.route("**/api/rce/search**", (route) =>
    route.fulfill({ status: 502, json: { error: "Tijdelijk niet bereikbaar" } }),
  );

  const search = page.getByRole("combobox", { name: "Zoeken" });
  await search.fill("Eerste zoekactie");
  await page.getByRole("button", { name: "Doorzoek RCE" }).click();
  await expect(
    page.getByText("De RCE Linked Data-service is momenteel niet bereikbaar."),
  ).toBeVisible();

  await search.fill("vuurtoren");
  await expect(
    page.getByText("De RCE Linked Data-service is momenteel niet bereikbaar."),
  ).toHaveCount(0);
});

test("'Probeer opnieuw' herhaalt de laatst mislukte zoekopdracht (P1)", async ({ page }) => {
  // searchRceMonuments vuurt voor een tekstzoekopdracht meerdere parallelle
  // deelverzoeken af (core/heritage/archaeology-a/archaeology-b) - een
  // simpele call-counter is dus onbetrouwbaar om "vóór/na retry" te
  // onderscheiden. Een expliciete vlag, omgezet ná de eerste mislukking en
  // vóór de klik op "Probeer opnieuw", is dat wel.
  let shouldFail = true;
  await page.unroute("**/api/rce/search**");
  await page.route("**/api/rce/search**", (route) => {
    if (shouldFail) return route.fulfill({ status: 502, json: { error: "Tijdelijk niet bereikbaar" } });
    return route.fulfill({ json: { page: 1, hasMore: false, results: [{ ...records[0] }] } });
  });

  await page.getByRole("combobox", { name: "Zoeken" }).fill("architect");
  await page.getByRole("button", { name: "Doorzoek RCE" }).click();
  const errorMessage = page.getByText("De RCE Linked Data-service is momenteel niet bereikbaar.");
  await expect(errorMessage).toBeVisible();
  shouldFail = false;
  await page.getByRole("button", { name: "Probeer opnieuw" }).click();
  await expect(errorMessage).toHaveCount(0);
  await expect(page.getByText("Woonhuis van de architect")).toBeVisible();
});

test("een 504 (RCE-timeout) toont een eerlijker bericht dan een echte verbindingsfout, met werkende 'Probeer opnieuw'", async ({ page }) => {
  // Live geraakt 21-08-2026: een breed RN2-begrip raakte de standaard
  // 20s-timeout terwijl RCE zelf gewoon bereikbaar was. withRceErrorHandling
  // (lib/server/route-error-handling.ts) geeft zo'n timeout nu 504 i.p.v.
  // 502, met een minder alarmerend bericht dan "niet bereikbaar".
  let shouldFail = true;
  await page.unroute("**/api/rce/search**");
  await page.route("**/api/rce/search**", (route) => {
    if (shouldFail) return route.fulfill({ status: 504, json: { error: "Deze zoekopdracht duurt op dit moment ongewoon lang bij de RCE-bron. Probeer het over een paar seconden opnieuw." } });
    return route.fulfill({ json: { page: 1, hasMore: false, results: [{ ...records[0] }] } });
  });

  await page.getByRole("combobox", { name: "Zoeken" }).fill("architect");
  await page.getByRole("button", { name: "Doorzoek RCE" }).click();
  const timeoutMessage = page.getByText("Deze zoekopdracht duurt op dit moment ongewoon lang bij de RCE-bron.");
  await expect(timeoutMessage).toBeVisible();
  await expect(page.getByText("De RCE Linked Data-service is momenteel niet bereikbaar.")).toHaveCount(0);
  shouldFail = false;
  await page.getByRole("button", { name: "Probeer opnieuw" }).click();
  await expect(timeoutMessage).toHaveCount(0);
  await expect(page.getByText("Woonhuis van de architect")).toBeVisible();
});

test("groenaanleg wordt uitgevinkt (maar blijft zichtbaar) wanneer de overige filters geen keuze meer overlaten", async ({
  page,
}) => {
  await page.unroute("**/api/rce/search**");
  await page.route("**/api/rce/search**", (route) =>
    route.fulfill({
      json: {
        page: 1,
        hasMore: false,
        results: [
          {
            ...records[0],
            choNumber: "cho-goirle",
            monumentNumber: "1",
            sourceUrl: "https://linkeddata.cultureelerfgoed.nl/cho-goirle",
          },
          {
            ...records[0],
            choNumber: "cho-utrecht",
            monumentNumber: "2",
            sourceUrl: "https://linkeddata.cultureelerfgoed.nl/cho-utrecht",
            place: "Utrecht",
            municipality: "Utrecht",
            provinceCode: "UT",
            groenaanleg: { typeAanleg: "Tuin" },
          },
        ],
      },
    }),
  );

  await page.getByRole("combobox", { name: "Zoeken" }).fill("architect");
  await page.getByRole("button", { name: "Doorzoek RCE" }).click();
  const groenaanleg = page.getByRole("checkbox", {
    name: /Historische aanleg \(groenaanleg\)/,
  });
  await expect(groenaanleg).toBeVisible();
  await groenaanleg.check();
  await page
    .getByRole("combobox", { name: "Filter op gemeente of woonplaats" })
    .selectOption("Goirle");

  // P1: het filter verdween voorheen helemaal uit de DOM zodra de teller op
  // deze pagina 0 werd, wat een gebruiker liet denken dat het kenmerk niet
  // bestond voor Rijksmonumenten. Nu blijft het zichtbaar met "0", en wordt
  // alleen de eigen aanvinking losgelaten (bestaand gedrag, zie
  // useSearchState.ts).
  await expect(groenaanleg).toBeVisible();
  await expect(groenaanleg).not.toBeChecked();
  await expect(page.getByText("Woonhuis van de architect")).toBeVisible();
});

test("Kenmerken-filters blijven zichtbaar met telling 0 in plaats van te verdwijnen (P1)", async ({ page }) => {
  await page.unroute("**/api/rce/search**");
  await page.route("**/api/rce/search**", (route) =>
    route.fulfill({
      json: {
        page: 1,
        hasMore: false,
        results: [{ ...records[0] }],
      },
    }),
  );

  await page.getByRole("combobox", { name: "Zoeken" }).fill("architect");
  await page.getByRole("button", { name: "Doorzoek RCE" }).click();
  const groenaanleg = page.getByRole("checkbox", {
    name: /Historische aanleg \(groenaanleg\)/,
  });
  const msp = page.getByRole("checkbox", {
    name: /Monumenten Selectie Project/,
  });
  await expect(groenaanleg).toBeVisible();
  await expect(groenaanleg).toHaveAccessibleName(/0$/);
  await expect(msp).toBeVisible();
  await expect(msp).toHaveAccessibleName(/0$/);
});

test("groenaanleg blijft aangevinkt tijdens het laden na URL-herstel (TD-13 regressie)", async ({ page }) => {
  await page.unroute("**/api/rce/search**");
  await page.route("**/api/rce/search**", async (route) => {
    // Bewust vertraagd: dit geeft de premature-reset-race (TD-13) de kans om
    // op te treden vóórdat de echte resultaten binnen zijn.
    await new Promise((resolve) => setTimeout(resolve, 300));
    return route.fulfill({
      json: {
        page: 1,
        hasMore: false,
        results: [{
          ...records[0],
          choNumber: "cho-groen",
          monumentNumber: "groen-1",
          sourceUrl: "https://linkeddata.cultureelerfgoed.nl/cho-groen",
          groenaanleg: { typeAanleg: "Tuin" },
        }],
      },
    });
  });

  // Simuleert een gedeelde/bewaarde URL met het groenaanleg-filter al aan.
  await page.goto("/?q=architect&groenaanleg=1");
  const groenaanleg = page.getByRole("checkbox", {
    name: /Historische aanleg \(groenaanleg\)/,
  });
  await expect(page.getByText("Woonhuis van de architect")).toBeVisible();
  await expect(groenaanleg).toBeVisible();
  await expect(groenaanleg).toBeChecked();
});

test("een groenaanleg-foto wordt getoond met bron en rechten", async ({ page }) => {
  await page.unroute("**/api/rce/search**");
  await page.route("**/api/rce/search**", (route) => route.fulfill({
    json: {
      page: 1,
      hasMore: false,
      results: [{
        ...records[0],
        choNumber: "cho-groen-foto",
        monumentNumber: "groen-foto-1",
        sourceUrl: "https://linkeddata.cultureelerfgoed.nl/cho-groen-foto",
        groenaanleg: {
          typeAanleg: "Tuin",
          categorie: "Formele aanleg",
          image: {
            url: "https://images.memorix.nl/rce/thumb/fullsize/groenaanleg.jpg",
            license: "Onbekend (beeldbank RCE)",
            sourceUrl: "https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/afbeelding/groenaanleg-1",
          },
        },
      }],
    },
  }));

  await page.getByRole("combobox", { name: "Zoeken" }).fill("architect");
  await page.getByRole("button", { name: "Doorzoek RCE" }).click();
  await page.getByRole("button", { name: "Bekijk gegevens van Woonhuis van de architect" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Historische aanleg", { exact: true })).toBeVisible();
  await expect(dialog).toContainText("Tuin — Formele aanleg");
  const photo = dialog.getByRole("img", { name: "Historische aanleg bij Woonhuis van de architect" });
  await expect(photo).toBeVisible();
  await expect(photo).toHaveAttribute("src", "https://images.memorix.nl/rce/thumb/fullsize/groenaanleg.jpg");
  await expect(dialog.getByText("Foto groenaanleg — RCE Beeldbank (Onbekend (beeldbank RCE))", { exact: false })).toBeVisible();
  await expect(dialog.getByRole("link", { name: "bron" })).toHaveAttribute(
    "href",
    "https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/afbeelding/groenaanleg-1",
  );
});

test("een scheepswrak (MASS) toont scheepstype, gesaneerde omschrijving met afbeelding en de vaste bronvermelding (018-mass-scheepswrakken)", async ({ page }) => {
  await page.unroute("**/api/rce/search**");
  await page.route("**/api/rce/search**", (route) => route.fulfill({
    json: {
      page: 1,
      hasMore: false,
      results: [{
        choNumber: "1",
        monumentNumber: "1",
        registrationDate: "",
        street: "",
        houseNumber: "",
        postalCode: "",
        sourceUrl: "https://mass.cultureelerfgoed.nl/id/1",
        officialUrl: "https://mass.cultureelerfgoed.nl/hendrika",
        name: "Hendrika",
        description: "Fregat",
        monumentNature: "scheepswrak",
        lat: 51.717,
        lng: 3.646,
        scheepstype: "Fregat",
        // Al server-side gesaneerd vóór verzending (net als de echte API) -
        // de e2e-test controleert alleen het clientgedrag, niet de
        // sanitatie zelf (die heeft tests/html-sanitize.test.mjs).
        omschrijvingHtml: '<h1>Historie</h1><p>Gezonken in 1850 op de Banjaard.</p><img src="https://mass.cultureelerfgoed.nl/photos/l/00000001.jpg" alt="Enige afbeelding van de Hendrika">',
        ontdekt: "2004",
        licentieNaam: "Creative Commons Attribution-ShareAlike 4.0 International License (CC BY-SA 4.0)",
        licentieUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
      }],
    },
  }));

  await page.getByRole("combobox", { name: "Zoeken" }).fill("hendrika");
  await page.getByRole("button", { name: "Doorzoek RCE" }).click();
  await expect(page.getByText("Scheepswrak (MASS)").first()).toBeVisible();
  await page.getByRole("button", { name: "Bekijk gegevens van Hendrika" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Scheepswrak (MASS)", { exact: true }).first()).toBeVisible();
  await expect(dialog.getByText("Fregat", { exact: true }).first()).toBeVisible();
  await expect(dialog.getByText("Ontdekt")).toBeVisible();
  await expect(dialog.getByText("2004", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Historie" })).toBeVisible();
  await expect(dialog.getByText("Gezonken in 1850 op de Banjaard.")).toBeVisible();
  const photo = dialog.getByRole("img", { name: "Enige afbeelding van de Hendrika" });
  await expect(photo).toHaveAttribute("src", "https://mass.cultureelerfgoed.nl/photos/l/00000001.jpg");
  await expect(dialog.getByText("Bron: MASS (RCE), stand per 31-12-2025.")).toBeVisible();
  const licentieLink = dialog.getByRole("link", { name: "CC BY-SA 4.0" });
  await expect(licentieLink).toHaveAttribute("href", "https://creativecommons.org/licenses/by-sa/4.0/");
  await expect(dialog.getByRole("link", { name: /Bekijk op MASS \(RCE\)/ })).toHaveAttribute(
    "href",
    "https://mass.cultureelerfgoed.nl/hendrika",
  );
});
