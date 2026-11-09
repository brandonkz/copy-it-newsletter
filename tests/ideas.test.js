import assert from "node:assert/strict";
import test from "node:test";
import ideasFile from "../data/ideas.json" with { type: "json" };

test("sample ideas are editable placeholders, not South African companies", () => {
  assert.equal(ideasFile.ideas.length, 3);
  assert.match(ideasFile.note, /SAMPLE/);
  for (const idea of ideasFile.ideas) {
    assert.equal(idea.sample, true);
    assert.equal(typeof idea.country, "string");
    assert.notEqual(idea.country.trim().toLowerCase(), "south africa");
    assert.doesNotMatch(`${idea.title} ${idea.summary}`, /\$\s?\d|R\s?\d{2,}|£\s?\d|€\s?\d/);
  }
  assert.deepEqual(
    ideasFile.ideas.map((idea) => idea.country),
    ["USA", "UK", "Japan"],
  );
});
