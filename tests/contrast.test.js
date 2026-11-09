import assert from "node:assert/strict";
import test from "node:test";
import { BRAND } from "../site.config.js";

function channel(value) {
  const s = value / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const n = hex.replace("#", "");
  const r = Number.parseInt(n.slice(0, 2), 16);
  const g = Number.parseInt(n.slice(2, 4), 16);
  const b = Number.parseInt(n.slice(4, 6), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrast(a, b) {
  const lighter = Math.max(luminance(a), luminance(b));
  const darker = Math.min(luminance(a), luminance(b));
  return (lighter + 0.05) / (darker + 0.05);
}

test("money palette pairs meet WCAG AA", () => {
  assert.ok(contrast("#ffffff", BRAND.cta) >= 4.5, "white on CTA green");
  assert.ok(contrast("#ffffff", BRAND.deep) >= 4.5, "white on deep green");
  assert.ok(contrast(BRAND.paper, BRAND.deep) >= 4.5, "paper on deep green");
  assert.ok(contrast(BRAND.foam, BRAND.deep) >= 4.5, "foam on deep green");
  assert.ok(contrast(BRAND.text, BRAND.paper) >= 4.5, "ink on paper");
  assert.ok(contrast(BRAND.text, "#ffffff") >= 4.5, "ink on white");
  assert.ok(contrast(BRAND.text, BRAND.gold) >= 4.5, "ink on gold");
  assert.ok(contrast(BRAND.muted, BRAND.paper) >= 4.5, "muted on paper");
  assert.ok(contrast(BRAND.muted, "#ffffff") >= 4.5, "muted on white");
  assert.ok(contrast(BRAND.deep, BRAND.paper) >= 4.5, "deep green text on paper");
  assert.ok(contrast(BRAND.deep, "#ffffff") >= 4.5, "deep green text on white");
  assert.ok(contrast(BRAND.cta, BRAND.paper) >= 4.5, "CTA green text on paper");
  assert.ok(contrast(BRAND.cta, "#ffffff") >= 4.5, "CTA green text on white");
  assert.ok(contrast("#ffffff", BRAND.bright) < 4.5, "white on #16A34A is not AA for normal text");
  assert.ok(contrast(BRAND.gold, BRAND.paper) < 4.5, "gold text on paper is not AA");
});
