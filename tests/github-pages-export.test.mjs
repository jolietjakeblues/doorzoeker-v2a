import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const outputDirectory = path.resolve("dist/pages");

async function collectTextFiles(directory, files = []) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) await collectTextFiles(filePath, files);
    else if (/\.(?:css|html|js|json|map)$/i.test(entry.name)) files.push(filePath);
  }
  return files;
}

test("GitHub Pages export is complete and base-path safe", async () => {
  await access(path.join(outputDirectory, "index.html"));
  await access(path.join(outputDirectory, ".nojekyll"));

  const files = await collectTextFiles(outputDirectory);
  assert.ok(files.length > 0, "expected exported text assets");

  for (const file of files) {
    const contents = await readFile(file, "utf8");
    const withoutExpectedPrefix = contents
      .replaceAll("/doorzoeker_v2/_next/", "")
      .replaceAll("doorzoeker_v2/_next/", "");
    assert.ok(!withoutExpectedPrefix.includes("/_next/"), `${path.relative(outputDirectory, file)} contains a root-relative framework path`);
    assert.ok(!/["']_next\//.test(contents), `${path.relative(outputDirectory, file)} contains a relative framework path`);
  }
});
