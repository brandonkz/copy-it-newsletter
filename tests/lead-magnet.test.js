import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const stalePhrases = ["10 ideas", "10 free", "10 overseas", "10-idea"];
const copyFiles = [
  "src/pages/index.html",
  "src/pages/thank-you.html",
  "src/site.js",
  "site.config.js",
  "README.md",
];

test("signup copy promises the 19-idea guide", async () => {
  const index = await readFile(join(root, "src/pages/index.html"), "utf8");
  const thankYou = await readFile(join(root, "src/pages/thank-you.html"), "utf8");
  const site = await readFile(join(root, "src/site.js"), "utf8");

  assert.match(index, /Free: 19 ideas nobody has launched in South Africa yet/);
  assert.match(index, /get 19 overseas ideas today, then 3 proven ideas every week/);
  assert.match(index, /Get 19 ideas today and 3 more every week/);
  assert.match(thankYou, /Check your inbox for the 19 free ideas/);
  assert.match(site, /Check your inbox for the 19 free ideas/);
  assert.match(index, /10,000 on TikTok/);

  const build = await readFile(join(root, "scripts/build.mjs"), "utf8");
  assert.match(build, /19 free overseas business ideas/);
});

test("repo copy no longer promises a 10-idea list", async () => {
  for (const file of copyFiles) {
    const text = await readFile(join(root, file), "utf8");
    for (const phrase of stalePhrases) {
      assert.equal(text.includes(phrase), false, `${file} still says "${phrase}"`);
    }
  }
});

test("the approved guide is the public PDF", async () => {
  const pdf = await readFile(join(root, "public/19-business-ideas.pdf"));
  assert.equal(pdf.subarray(0, 5).toString("utf8"), "%PDF-");
  assert.ok(pdf.length > 100_000);
});
