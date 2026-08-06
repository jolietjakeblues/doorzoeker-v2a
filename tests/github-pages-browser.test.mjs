import assert from "node:assert/strict";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import test from "node:test";
import { chromium } from "playwright";

const outputDirectory = path.resolve("dist/pages");
const basePath = "/doorzoeker_v2";
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

    await page.locator("#q").fill("36046");
    await page.getByRole("button", { name: "Zoeken", exact: true }).click();
    await assert.doesNotReject(() => page.getByText("Domtoren", { exact: true }).waitFor({ state: "visible" }));
    await assert.doesNotReject(() => page.getByText(/1 resultaat/).waitFor({ state: "visible" }));

    assert.deepEqual(runtimeErrors, [], runtimeErrors.join("\n"));
  } finally {
    await browser.close();
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
