import assert from "node:assert/strict";
import test from "node:test";
import { BEEHIIV_PUBLICATION_ID } from "../site.config.js";
import { MESSAGES, buildSubscriptionPayload, subscribeHandler } from "../lib/subscribe.js";

const API_KEY = "bh_test_key_should_not_leak";
const PUBLICATION_ID = "pub_12345678-abcd-1234";

function mockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    raw: undefined,
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    end(payload) {
      this.raw = payload;
      if (payload) this.body = JSON.parse(payload);
      this.ended = true;
    },
  };
}

function baseEnv(extra = {}) {
  return {
    SITE_URL: "https://copy-it.vercel.app",
    BEEHIIV_API_KEY: API_KEY,
    BEEHIIV_PUBLICATION_ID: PUBLICATION_ID,
    ...extra,
  };
}

async function invoke({ method = "POST", body = {}, headers = {}, env = baseEnv(), fetchImpl }) {
  const req = { method, body, headers };
  const res = mockRes();
  await subscribeHandler(req, res, { env, fetch: fetchImpl });
  return res;
}

test("builds the Beehiiv subscription body from the documented fields", () => {
  const payload = buildSubscriptionPayload(
    {
      email: "reader@example.com",
      source: "hero",
      utm_source: "tiktok",
      utm_medium: "social",
      utm_campaign: "launch",
      utm_term: "ideas",
      utm_content: "bio",
      referring_site: "https://copy-it.vercel.app/",
    },
    { sendWelcomeEmail: true, reactivateExisting: false },
  );

  assert.deepEqual(payload, {
    email: "reader@example.com",
    reactivate_existing: false,
    send_welcome_email: true,
    utm_source: "tiktok",
    utm_medium: "social",
    utm_campaign: "launch",
    utm_term: "ideas",
    utm_content: "bio",
    referring_site: "https://copy-it.vercel.app/",
    custom_fields: [
      { name: "brand", value: "copy-it" },
      { name: "source", value: "hero" },
      { name: "utm_source", value: "tiktok" },
      { name: "utm_medium", value: "social" },
      { name: "utm_campaign", value: "launch" },
      { name: "utm_term", value: "ideas" },
      { name: "utm_content", value: "bio" },
    ],
  });
});

test("posts a validated subscription and does not return upstream data", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          data: { id: "sub_secret", email: "reader@example.com" },
          warnings: [{ message: "ignored custom field", code: "custom_field" }],
        }),
    };
  };

  const res = await invoke({
    body: {
      email: "  Reader@Example.com ",
      source: "footer",
      utm_source: "instagram\n",
      utm_medium: "social",
      page_url: "https://copy-it.vercel.app/privacy?utm_source=instagram#form",
      ignored: "nope",
    },
    headers: { origin: "https://copy-it.vercel.app", referer: "https://copy-it.vercel.app/" },
    fetchImpl,
  });

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { ok: true, redirect: null });
  assert.equal(res.raw.includes("sub_secret"), false);
  assert.equal(res.raw.includes(API_KEY), false);
  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].url,
    `https://api.beehiiv.com/v2/publications/${PUBLICATION_ID}/subscriptions`,
  );
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.redirect, "error");
  assert.equal(calls[0].options.headers.Authorization, `Bearer ${API_KEY}`);
  const sent = JSON.parse(calls[0].options.body);
  assert.equal(sent.email, "reader@example.com");
  assert.equal(sent.reactivate_existing, false);
  assert.equal(sent.send_welcome_email, true);
  assert.equal(sent.utm_source, "instagram");
  assert.equal(sent.utm_medium, "social");
  assert.equal(sent.referring_site, "https://copy-it.vercel.app/privacy");
  assert.deepEqual(sent.custom_fields, [
    { name: "brand", value: "copy-it" },
    { name: "source", value: "footer" },
    { name: "utm_source", value: "instagram" },
    { name: "utm_medium", value: "social" },
  ]);
  assert.equal(res.headers["access-control-allow-origin"], "https://copy-it.vercel.app");
});

test("redirects only when the config toggle is on", async () => {
  const fetchImpl = async () => ({ ok: true, status: 200, text: async () => "" });
  const res = await invoke({
    body: { email: "reader@example.com", source: "hero" },
    env: baseEnv({ REDIRECT_TO_THANK_YOU: "true" }),
    fetchImpl,
  });
  assert.deepEqual(res.body, { ok: true, redirect: "/thank-you" });
});

test("rejects bad input without calling Beehiiv", async () => {
  let called = false;
  const fetchImpl = async () => {
    called = true;
    return { ok: true, status: 200, text: async () => "" };
  };
  const invalidEmail = await invoke({
    body: { email: "not-an-email", source: "hero" },
    fetchImpl,
  });
  assert.equal(invalidEmail.statusCode, 400);
  assert.equal(invalidEmail.body.error, MESSAGES.invalidEmail);

  const badSource = await invoke({
    body: { email: "reader@example.com", source: "banner" },
    fetchImpl,
  });
  assert.equal(badSource.statusCode, 400);
  assert.equal(badSource.body.error, MESSAGES.badRequest);

  const badJson = await invoke({ body: "{", fetchImpl });
  assert.equal(badJson.statusCode, 400);
  assert.equal(called, false);
});

test("sets referring_site to the Copy It page and falls back when the page URL is unsafe", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push(JSON.parse(options.body));
    return { ok: true, status: 200, text: async () => "" };
  };
  await invoke({
    body: {
      email: "reader@example.com",
      source: "hero",
      page_url: "https://copy-it.vercel.app/privacy",
    },
    fetchImpl,
  });
  await invoke({
    body: {
      email: "reader@example.com",
      source: "hero",
      page_url: "javascript:alert(1)",
    },
    headers: { referer: "https://copy-it.vercel.app/?utm_source=tiktok" },
    fetchImpl,
  });
  await invoke({
    body: { email: "reader@example.com", source: "hero", page_url: "javascript:alert(1)" },
    fetchImpl,
  });
  assert.equal(calls[0].referring_site, "https://copy-it.vercel.app/privacy");
  assert.equal(calls[1].referring_site, "https://copy-it.vercel.app/");
  assert.equal(calls[2].referring_site, "https://copy-it.vercel.app/");
  assert.equal(calls[0].custom_fields[0].name, "brand");
  assert.equal(calls[0].custom_fields[0].value, "copy-it");
});

test("uses the Fitsorted publication unless BEEHIIV_PUBLICATION_ID is set", async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    return { ok: true, status: 200, text: async () => "" };
  };
  await invoke({
    body: { email: "reader@example.com", source: "hero", page_url: "https://copy-it.vercel.app/" },
    env: { SITE_URL: "https://copy-it.vercel.app", BEEHIIV_API_KEY: API_KEY },
    fetchImpl,
  });
  await invoke({
    body: { email: "reader@example.com", source: "hero", page_url: "https://copy-it.vercel.app/" },
    env: baseEnv({ BEEHIIV_PUBLICATION_ID: "pub_override-1234" }),
    fetchImpl,
  });
  assert.equal(calls[0], `https://api.beehiiv.com/v2/publications/${BEEHIIV_PUBLICATION_ID}/subscriptions`);
  assert.equal(BEEHIIV_PUBLICATION_ID, "pub_cec2d599-5490-49b5-bb78-7cd7a9831890");
  assert.equal(calls[1], "https://api.beehiiv.com/v2/publications/pub_override-1234/subscriptions");
});

test("does not leak upstream errors", async () => {
  const fetchImpl = async () => ({
    ok: false,
    status: 500,
    text: async () => JSON.stringify({ errors: [{ message: "super secret upstream failure", code: "x" }] }),
  });
  const res = await invoke({
    body: { email: "reader@example.com", source: "hero" },
    fetchImpl,
  });
  assert.equal(res.statusCode, 502);
  assert.equal(res.body.error, MESSAGES.unavailable);
  assert.equal(JSON.stringify(res.body).includes("super secret"), false);
  assert.equal(JSON.stringify(res.body).includes(API_KEY), false);
});

test("maps rate limit and Beehiiv rejection to safe messages", async () => {
  const limited = await invoke({
    body: { email: "reader@example.com", source: "hero" },
    fetchImpl: async () => ({ ok: false, status: 429, text: async () => "slow down secret" }),
  });
  assert.equal(limited.statusCode, 429);
  assert.equal(limited.body.error, MESSAGES.rateLimit);
  assert.equal(JSON.stringify(limited.body).includes("slow down"), false);

  const rejected = await invoke({
    body: { email: "reader@example.com", source: "hero" },
    fetchImpl: async () => ({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({ errors: [{ message: "mailbox banned internally" }] }),
    }),
  });
  assert.equal(rejected.statusCode, 400);
  assert.equal(rejected.body.error, MESSAGES.rejected);
  assert.equal(JSON.stringify(rejected.body).includes("mailbox"), false);
});

test("hides a missing Beehiiv configuration", async () => {
  let called = false;
  const res = await invoke({
    body: { email: "reader@example.com", source: "hero" },
    env: { SITE_URL: "https://copy-it.vercel.app" },
    fetchImpl: async () => {
      called = true;
      return { ok: true, status: 200, text: async () => "" };
    },
  });
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.error, MESSAGES.unavailable);
  assert.equal(called, false);
});

test("allows POST and OPTIONS and rejects other methods", async () => {
  const options = await invoke({
    method: "OPTIONS",
    headers: { origin: "https://copy-it.vercel.app" },
  });
  assert.equal(options.statusCode, 204);
  assert.equal(options.headers.allow, "POST, OPTIONS");
  assert.equal(options.headers["access-control-allow-origin"], "https://copy-it.vercel.app");

  const get = await invoke({ method: "GET" });
  assert.equal(get.statusCode, 405);
  assert.equal(get.body.error, MESSAGES.method);

  const foreign = await invoke({
    method: "OPTIONS",
    headers: { origin: "https://evil.example" },
  });
  assert.equal(foreign.headers["access-control-allow-origin"], undefined);
});

test("the route module exports a function", async () => {
  const module = await import("../api/subscribe.js");
  assert.equal(typeof module.default, "function");
});

test("urlencoded posts redirect instead of returning JSON", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push(JSON.parse(options.body));
    return { ok: true, status: 200, text: async () => '{"data":{"email":"reader@example.com"}}' };
  };
  const ok = await invoke({
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "email=reader%40example.com&source=hero&page_url=https%3A%2F%2Fcopyit.studio%2F%3Futm_source%3Dtiktok&utm_medium=social",
    fetchImpl,
  });
  assert.equal(ok.statusCode, 303);
  assert.equal(ok.headers.location, "/thank-you");
  assert.equal(ok.raw, "");
  assert.equal(JSON.stringify(ok.headers).includes(API_KEY), false);
  assert.equal(calls[0].email, "reader@example.com");
  assert.equal(calls[0].referring_site, "https://copyit.studio/");
  assert.equal(calls[0].utm_medium, "social");
  assert.equal(calls[0].custom_fields[0].value, "copy-it");

  const invalid = await invoke({
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "email=not-an-email&source=footer",
    fetchImpl,
  });
  assert.equal(invalid.statusCode, 303);
  assert.equal(invalid.headers.location, "/?error=invalid_email#footer");

  const fromReferer = await invoke({
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      referer: "https://copyit.studio/?utm_source=tiktok&utm_campaign=launch",
    },
    body: "email=reader%40example.com&source=hero",
    fetchImpl,
  });
  assert.equal(fromReferer.statusCode, 303);
  assert.equal(calls[1].utm_source, "tiktok");
  assert.equal(calls[1].utm_campaign, "launch");
  assert.equal(calls[1].referring_site, "https://copyit.studio/");
});
