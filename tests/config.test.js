import assert from "node:assert/strict";
import test from "node:test";
import {
  BEEHIIV_PUBLICATION_ID,
  GA4_MEASUREMENT_ID,
  INSTAGRAM_URL,
  TIKTOK_URL,
  getSiteConfig,
  resolveGa4,
  resolvePublicationId,
  resolveSiteUrl,
} from "../site.config.js";

test("social links are the confirmed profiles", () => {
  assert.equal(TIKTOK_URL, "https://www.tiktok.com/@hecticza");
  assert.equal(INSTAGRAM_URL, "https://www.instagram.com/brandonkzar/");
  assert.equal(getSiteConfig({}).tiktokUrl, TIKTOK_URL);
});

test("Beehiiv publication defaults to Fitsorted and can be overridden", () => {
  assert.equal(BEEHIIV_PUBLICATION_ID, "pub_cec2d599-5490-49b5-bb78-7cd7a9831890");
  assert.equal(resolvePublicationId({}), BEEHIIV_PUBLICATION_ID);
  assert.equal(resolvePublicationId({ BEEHIIV_PUBLICATION_ID: "" }), BEEHIIV_PUBLICATION_ID);
  assert.equal(resolvePublicationId({ BEEHIIV_PUBLICATION_ID: "pub_other-1234" }), "pub_other-1234");
});

test("GA4 defaults to the public measurement ID and can be overridden", () => {
  assert.equal(GA4_MEASUREMENT_ID, "G-WP1K1WK42Y");
  assert.equal(resolveGa4({}), "G-WP1K1WK42Y");
  assert.equal(resolveGa4({ GA4_MEASUREMENT_ID: "" }), "G-WP1K1WK42Y");
  assert.equal(resolveGa4({ GA4_MEASUREMENT_ID: "G-OTHER123" }), "G-OTHER123");
  assert.equal(resolveGa4({ GA4_MEASUREMENT_ID: "off" }), "");
  assert.equal(resolveGa4({ GA4_MEASUREMENT_ID: "not-an-id" }), "");
  assert.equal(getSiteConfig({}).ga4MeasurementId, "G-WP1K1WK42Y");
});

test("SITE_URL is the single canonical origin and falls back in order", () => {
  assert.equal(resolveSiteUrl({ SITE_URL: "https://copy-it.vercel.app/path/" }), "https://copy-it.vercel.app");
  assert.equal(
    resolveSiteUrl({ VERCEL_PROJECT_PRODUCTION_URL: "copy-it.vercel.app" }),
    "https://copy-it.vercel.app",
  );
  assert.equal(resolveSiteUrl({ VERCEL_URL: "copy-it-git-preview.vercel.app" }), "https://copy-it-git-preview.vercel.app");
  assert.equal(resolveSiteUrl({}), "http://localhost:4173");
  assert.equal(getSiteConfig({}).redirectToThankYou, false);
  assert.equal(getSiteConfig({ REDIRECT_TO_THANK_YOU: "true" }).redirectToThankYou, true);
});
