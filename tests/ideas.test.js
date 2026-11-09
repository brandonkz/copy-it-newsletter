import assert from "node:assert/strict";
import test from "node:test";
import ideasFile from "../data/ideas.json" with { type: "json" };

test("idea cards name overseas businesses and cite a public source", () => {
  assert.ok(ideasFile.ideas.length >= 1);
  assert.doesNotMatch(JSON.stringify(ideasFile), /sample|not real|aren't real|are samples/i);
  for (const idea of ideasFile.ideas) {
    assert.equal(typeof idea.company, "string");
    assert.equal(typeof idea.place, "string");
    assert.equal(typeof idea.stat, "string");
    assert.equal(typeof idea.how, "string");
    assert.match(idea.sourceUrl, /^https:\/\//);
    assert.equal(typeof idea.sourceLabel, "string");
    assert.doesNotMatch(idea.place, /south africa/i);
    assert.doesNotMatch(idea.company, /south africa/i);
  }
});
