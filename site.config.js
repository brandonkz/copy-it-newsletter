/**
 * Single source for public site settings.
 * Canonical and Open Graph URLs are baked into HTML at build time from getSiteConfig().
 * Beehiiv secrets are not stored here. api/subscribe reads them from the environment.
 */

export const BRAND = {
  name: "Copy It",
  accent: "#1F4FFF",
  text: "#0E1116",
  muted: "#4A5363",
  mist: "#F3F5F9",
  title: "Copy It | Overseas business ideas you can copy",
  description:
    "3 proven business ideas from overseas every week. How they make money and how to launch them locally. Free.",
  h1: "Business ideas working overseas. Before they hit your market.",
};

export const TIKTOK_URL = "https://www.tiktok.com/@hecticza";

export const INSTAGRAM_URL = "https://www.instagram.com/brandonkzar/";

// TODO: Replace with Brandon's real contact email before launch.
export const CONTACT_EMAIL = "hello@copyit.example";

/** Inline success message unless REDIRECT_TO_THANK_YOU=true. */
export const REDIRECT_TO_THANK_YOU_DEFAULT = false;

/**
 * The welcome email is how new readers get the 10-idea list.
 * Beehiiv's API defaults this to false, so it is set explicitly.
 */
export const SEND_WELCOME_EMAIL = true;

/**
 * false matches the Beehiiv default. A form submit will not reactivate
 * someone who already unsubscribed, so another person cannot opt them back in.
 */
export const REACTIVATE_EXISTING = false;

/** Public GA4 measurement ID. GA4_MEASUREMENT_ID overrides this at build time. */
export const GA4_MEASUREMENT_ID = "G-WP1K1WK42Y";

/**
 * Fitsorted publication. The list is shared with another brand.
 * The id is not a secret. BEEHIIV_PUBLICATION_ID overrides it per request.
 * The API key is never stored here.
 */
export const BEEHIIV_PUBLICATION_ID = "pub_cec2d599-5490-49b5-bb78-7cd7a9831890";

/** Sent on every signup so Copy It readers can be split out of the shared list. */
export const BEEHIIV_BRAND_VALUE = "copy-it";

const GA4_PATTERN = /^G-[A-Z0-9]+$/;
const LOCAL_SITE_URL = "http://localhost:4173";

export function getSiteConfig(env = process.env) {
  return {
    ...BRAND,
    siteUrl: resolveSiteUrl(env),
    tiktokUrl: TIKTOK_URL,
    instagramUrl: INSTAGRAM_URL,
    contactEmail: CONTACT_EMAIL,
    ga4MeasurementId: resolveGa4(env),
    redirectToThankYou: resolveRedirect(env),
    sendWelcomeEmail: SEND_WELCOME_EMAIL,
    reactivateExisting: REACTIVATE_EXISTING,
    noindex: env.VERCEL_ENV === "preview",
  };
}

/**
 * Blank or missing env uses the Fitsorted publication.
 * A non-empty value replaces it. The API key is not resolved here.
 */
export function resolvePublicationId(env = process.env) {
  const raw = env.BEEHIIV_PUBLICATION_ID;
  if (typeof raw !== "string" || raw.trim() === "") return BEEHIIV_PUBLICATION_ID;
  return raw.trim();
}

/**
 * Blank or missing env uses the committed default.
 * A valid G- ID replaces it. "off" (or an invalid value) loads no tag.
 */
export function resolveGa4(env = process.env) {
  const raw = env.GA4_MEASUREMENT_ID;
  if (typeof raw !== "string" || raw.trim() === "") return GA4_MEASUREMENT_ID;
  const id = raw.trim();
  if (/^(off|false|none)$/i.test(id)) return "";
  return GA4_PATTERN.test(id) ? id : "";
}

export function resolveSiteUrl(env = process.env) {
  const explicit = cleanOrigin(env.SITE_URL);
  if (explicit) return explicit;

  const production = cleanHost(env.VERCEL_PROJECT_PRODUCTION_URL);
  if (production) return production;

  const deployment = cleanHost(env.VERCEL_URL);
  if (deployment) return deployment;

  return LOCAL_SITE_URL;
}

function resolveRedirect(env) {
  if (env.REDIRECT_TO_THANK_YOU === "true") return true;
  if (env.REDIRECT_TO_THANK_YOU === "false") return false;
  return REDIRECT_TO_THANK_YOU_DEFAULT;
}

function cleanOrigin(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    if (url.username || url.password) return "";
    return url.origin;
  } catch {
    return "";
  }
}

function cleanHost(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  return cleanOrigin(`https://${value.trim().replace(/^https?:\/\//i, "")}`);
}
