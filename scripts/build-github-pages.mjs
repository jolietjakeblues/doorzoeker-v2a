import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const repository = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "doorzoeker_v2";
const basePath = process.env.GITHUB_PAGES_BASE_PATH ?? `/${repository}`;
const normalizedBasePath = basePath === "/" ? "" : `/${basePath.replace(/^\/+|\/+$/g, "")}`;
const origin = process.env.GITHUB_PAGES_ORIGIN ?? "https://jolietjakeblues.github.io";
const outputDirectory = path.resolve("dist/pages");
const clientDirectory = path.resolve("dist/client");
const workerUrl = pathToFileURL(path.resolve("dist/server/index.js"));

const { default: worker } = await import(workerUrl.href);
const response = await worker.fetch(
  new Request(`${origin}/`, {
    headers: { accept: "text/html" },
  }),
  {
    ASSETS: {
      fetch: async (request) => {
        const pathname = new URL(request.url).pathname;
        const relativePath = pathname.replace(`${normalizedBasePath}/`, "").replace(/^\//, "");

        try {
          return new Response(await readFile(path.join(clientDirectory, relativePath)));
        } catch {
          return new Response("Not found", { status: 404 });
        }
      },
    },
  },
  { passThroughOnException() {}, waitUntil() {} },
);

if (!response.ok) {
  throw new Error(`Pre-rendering failed with HTTP ${response.status}`);
}

let html = await response.text();

if (normalizedBasePath) {
  html = html.replace(/((?:src|href)=")\/(?!\/)/g, `$1${normalizedBasePath}/`);
  html = html.replaceAll('"/logo-rce.gif', `"${normalizedBasePath}/logo-rce.gif`);
  html = html.replaceAll('"/favicon.svg', `"${normalizedBasePath}/favicon.svg`);
  html = html.replaceAll('"assetPrefix":""', `"assetPrefix":"${normalizedBasePath}"`);
}

await rm(outputDirectory, { force: true, recursive: true });
await mkdir(outputDirectory, { recursive: true });
await cp(clientDirectory, outputDirectory, { recursive: true });
await writeFile(path.join(outputDirectory, "index.html"), html);
await writeFile(path.join(outputDirectory, ".nojekyll"), "");

console.log(`GitHub Pages export created in ${outputDirectory}`);
