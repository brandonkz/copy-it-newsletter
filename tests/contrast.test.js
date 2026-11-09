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

function contrast(a, b) {
  const lighter = Math.max(luminance(a), luminance(b));
  const darker = Math.min(luminance(a), luminance(b));
  return (lighter + 0.05) / (darker + 0.05);
}

test("brand colours meet WCAG AA for the text that uses them", () => {
  assert.ok(contrast("#ffffff", BRAND.accent) >= 4.5, "white on accent");
  assert.ok(contrast(BRAND.accent, "#ffffff") >= 4.5, "accent on white");
  assert.ok(contrast(BRAND.muted, BRAND.mist) >= 4.5, "muted on mist");
  assert.ok(contrast(BRAND.muted, "#ffffff") >= 4.5, "muted on white");
  assert.ok(contrast(BRAND.text, "#ffffff") >= 4.5, "text on white");
  assert.ok(contrast(BRAND.text, BRAND.mist) >= 4.5, "text on mist");
  assert.ok(contrast("#ffffff", BRAND.text) >= 4.5, "white on ink");
  assert.ok(contrast(BRAND.accent, BRAND.mist) >= 4.5, "accent on mist");
  assert.ok(contrast("#9f1239", "#ffffff") >= 4.5, "error on white");
});
