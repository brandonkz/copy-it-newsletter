/**
 * Beehiiv API v2 create-subscription.
 * Docs: https://developers.beehiiv.com/api-reference/subscriptions/create
 *
 * POST https://api.beehiiv.com/v2/publications/{publicationId}/subscriptions
 * Authorization: Bearer <api key>
 *
 * Body fields used here, matching the current docs:
 * - email
 * - reactivate_existing (boolean, API default false)
 * - send_welcome_email (boolean, API default false)
 * - utm_source, utm_medium, utm_campaign, utm_term, utm_content (top-level)
 * - referring_site (the Copy It page URL, so this shared list can be segmented)
 * - custom_fields: array of { name, value }
 *   Always includes brand=copy-it, plus source and any UTM values.
 *   Unknown custom field names are dropped by Beehiiv. The subscription is still created.
 */

import { BEEHIIV_BRAND_VALUE, getSiteConfig, resolvePublicationId } from "../site.config.js";

export const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];

export const MESSAGES = {
  invalidEmail: "Enter a valid email address.",
  badRequest: "Something went wrong. Please try again.",
  method: "Method not allowed.",
  unavailable: "Signup is temporarily unavailable.",
  rateLimit: "Too many attempts. Please try again in a little while.",
  rejected: "We could not subscribe that email. If you already joined, check your inbox.",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PUBLICATION_RE = /^pub_[A-Za-z0-9-]{8,80}$/;
const MAX_EMAIL = 254;
const MAX_UTM = 120;
const MAX_REFERRER = 300;
const MAX_BODY = 10_000;

export async function subscribeHandler(req, res, deps = {}) {
  const env = deps.env ?? process.env;
  const fetchImpl = deps.fetch ?? globalThis.fetch;
  const config = getSiteConfig(env);

  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "no-store");
  applyCors(res, header(req, "origin"), config.siteUrl);

  const method = String(req.method || "").toUpperCase();

  if (method === "OPTIONS") {
    res.setHeader("Allow", "POST, OPTIONS");
    res.statusCode = 204;
    res.end();
    return;
  }

  if (method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return send(res, 405, { ok: false, error: MESSAGES.method });
  }

  let body;
  try {
    body = readBody(req);
  } catch {
    return finish(req, res, 400, { ok: false, error: MESSAGES.badRequest }, "hero");
  }

  const email = normalizeEmail(body.email);
  if (!email) {
    return finish(req, res, 400, { ok: false, error: MESSAGES.invalidEmail }, knownSource(body.source));
  }

  const source = knownSource(body.source);
  if (source !== body.source) {
    return finish(req, res, 400, { ok: false, error: MESSAGES.badRequest }, "hero");
  }

  const input = { email, source };
  const refererUtms = utmsFromUrl(header(req, "referer") || header(req, "referrer"));
  for (const key of UTM_KEYS) {
    const clean = sanitizeUtm(body[key]);
    if (clean) input[key] = clean;
    else if (refererUtms[key]) input[key] = refererUtms[key];
  }

  input.referring_site = pageUrlForSignup(body.page_url, header(req, "referer") || header(req, "referrer"), config.siteUrl);

  const apiKey = typeof env.BEEHIIV_API_KEY === "string" ? env.BEEHIIV_API_KEY.trim() : "";
  const publicationId = resolvePublicationId(env);

  if (!apiKey || !PUBLICATION_RE.test(publicationId)) {
    console.error("Beehiiv signup is not configured.");
    return finish(req, res, 503, { ok: false, error: MESSAGES.unavailable }, source);
  }

  const payload = buildSubscriptionPayload(input, config);
  const url = `https://api.beehiiv.com/v2/publications/${encodeURIComponent(publicationId)}/subscriptions`;

  let upstream;
  try {
    upstream = await fetchImpl(url, {
      method: "POST",
      redirect: "error",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    console.error("Beehiiv signup request failed before a response.");
    return finish(req, res, 502, { ok: false, error: MESSAGES.badRequest }, source);
  }

  await drain(upstream);

  if (upstream.status === 429) {
    return finish(req, res, 429, { ok: false, error: MESSAGES.rateLimit }, source);
  }

  if (upstream.status === 400) {
    return finish(req, res, 400, { ok: false, error: MESSAGES.rejected }, source);
  }

  if (!upstream.ok) {
    console.error(`Beehiiv signup failed with status ${upstream.status}.`);
    return finish(req, res, 502, { ok: false, error: MESSAGES.unavailable }, source);
  }

  return finish(req, res, 200, {
    ok: true,
    redirect: config.redirectToThankYou ? "/thank-you" : null,
  }, source);
}

function knownSource(value) {
  return value === "hero" || value === "footer" ? value : "";
}

function isFormPost(req) {
  return header(req, "content-type").toLowerCase().includes("application/x-www-form-urlencoded");
}

function finish(req, res, status, payload, source) {
  if (!isFormPost(req)) return send(res, status, payload);
  if (payload.ok) return redirect(res, "/thank-you");
  const code = errorCode(payload.error);
  const hash = source === "footer" || source === "hero" ? source : "hero";
  return redirect(res, `/?error=${code}#${hash}`);
}

function errorCode(message) {
  if (message === MESSAGES.invalidEmail) return "invalid_email";
  if (message === MESSAGES.rejected) return "rejected";
  if (message === MESSAGES.rateLimit) return "rate_limit";
  if (message === MESSAGES.unavailable) return "unavailable";
  return "bad_request";
}

function redirect(res, location) {
  res.statusCode = 303;
  res.setHeader("Location", location);
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end("");
}

function utmsFromUrl(value) {
  const found = {};
  if (typeof value !== "string" || !value) return found;
  let url;
  try {
    url = new URL(value);
  } catch {
    return found;
  }
  for (const key of UTM_KEYS) {
    const clean = sanitizeUtm(url.searchParams.get(key) || "");
    if (clean) found[key] = clean;
  }
  return found;
}

export function buildSubscriptionPayload(input, options) {
  const customFields = [
    { name: "brand", value: BEEHIIV_BRAND_VALUE },
    { name: "source", value: input.source },
  ];
  const payload = {
    email: input.email,
    reactivate_existing: Boolean(options.reactivateExisting),
    send_welcome_email: Boolean(options.sendWelcomeEmail),
    custom_fields: customFields,
  };

  for (const key of UTM_KEYS) {
    if (!input[key]) continue;
    payload[key] = input[key];
    customFields.push({ name: key, value: input[key] });
  }

  if (input.referring_site) payload.referring_site = input.referring_site;
  return payload;
}

export function sanitizeUtm(value) {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, MAX_UTM);
}

/**
 * referring_site is the Copy It page the person signed up on, without the
 * query string. That marks the signup on the shared Fitsorted list.
 * Preference: page_url from the browser, then the request Referer, then SITE_URL.
 */
export function pageUrlForSignup(pageUrl, referer, siteUrl) {
  return sanitizePageUrl(pageUrl) || sanitizePageUrl(referer) || fallbackPageUrl(siteUrl);
}

export function sanitizePageUrl(value) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_REFERRER) return "";

  let url;
  try {
    url = new URL(trimmed);
  } catch {
    return "";
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return "";
  if (url.username || url.password) return "";
  url.search = "";
  url.hash = "";
  const serialized = url.toString();
  return serialized.length <= MAX_REFERRER ? serialized : "";
}

function fallbackPageUrl(siteUrl) {
  try {
    return new URL(siteUrl).origin + "/";
  } catch {
    return "";
  }
}

function normalizeEmail(value) {
  if (typeof value !== "string") return "";
  const email = value.trim().toLowerCase();
  if (!email || email.length > MAX_EMAIL || !EMAIL_RE.test(email)) return "";
  return email;
}

function readBody(req) {
  const body = req.body;
  if (body && typeof body === "object" && !Buffer.isBuffer(body)) return body;
  if (typeof body === "string") {
    if (body.length > MAX_BODY) throw new Error("too large");
    if (!body.trim()) return {};
    if (isFormPost(req)) return Object.fromEntries(new URLSearchParams(body));
    return JSON.parse(body);
  }
  if (Buffer.isBuffer(body)) {
    if (body.length > MAX_BODY) throw new Error("too large");
    const text = body.toString("utf8");
    if (!text.trim()) return {};
    return JSON.parse(text);
  }
  return {};
}

function applyCors(res, origin, siteUrl) {
  if (!origin || !siteUrl) return;
  let allowed = false;
  try {
    allowed = new URL(origin).origin === new URL(siteUrl).origin;
  } catch {
    allowed = false;
  }
  if (!allowed) return;
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");
}

function header(req, name) {
  const headers = req.headers || {};
  const value = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

async function drain(response) {
  try {
    if (response && typeof response.text === "function") await response.text();
  } catch {
    /* The status code is enough. Never forward the body. */
  }
}
