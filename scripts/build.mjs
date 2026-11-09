import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdir, readFile, readdir, rm, stat, writeFile, copyFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { getSiteConfig, GA4_MEASUREMENT_ID } from "../site.config.js";
import videosFile from "../data/videos.json" with { type: "json" };
import { optimizeVideos, videoSources } from "./optimize-videos.mjs";

const execFileAsync = promisify(execFile);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const config = getSiteConfig();
const RAW = new Set([
  "HEADER",
  "FOOTER",
  "CONTENT",
  "GA_SNIPPET",
  "IDEAS",
  "AUTHOR",
  "EXTRA_PROOF",
  "ABOUT_CARD",
  "HALFTONE_SCRIPT",
  "STAT_HTML",
  "PRIORITY",
  "ANALYTICS_ITEM",
  "ANALYTICS_PROCESSORS",
]);

const pages = [
  {
    file: "index.html",
    path: "/",
    title: config.title,
    description: config.description,
    robots: config.noindex ? "noindex, nofollow" : "index, follow",
  },
  {
    file: "thank-you.html",
    path: "/thank-you",
    title: "You're in | Copy It",
    description: "You are subscribed to Copy It. Check your inbox for 10 free overseas business ideas.",
    robots: "noindex, nofollow",
  },
  {
    file: "privacy.html",
    path: "/privacy",
    title: "Privacy notice | Copy It",
    description: "How Copy It handles your email address, signup details, and analytics under POPIA.",
    robots: config.noindex ? "noindex, nofollow" : "index, follow",
  },
  {
    file: "about.html",
    path: "/about",
    title: "About | Copy It",
    description: "Copy It is a free weekly email of overseas business ideas for South Africa.",
    robots: config.noindex ? "noindex, nofollow" : "index, follow",
  },
];

await rm(dist, { recursive: true, force: true });
await mkdir(join(dist, "assets"), { recursive: true });

if (process.env.GA4_MEASUREMENT_ID && process.env.GA4_MEASUREMENT_ID.trim() && !config.ga4MeasurementId) {
  console.warn("GA4_MEASUREMENT_ID is not a G- ID or off. Analytics is disabled for this build.");
}

const cssUnhashed = join(dist, "assets", "styles.css");
await execFileAsync(
  join(root, "node_modules", ".bin", "tailwindcss"),
  ["-i", join(root, "src", "styles.css"), "-o", cssUnhashed, "--minify"],
  { cwd: root },
);
const css = await readFile(cssUnhashed);
const cssName = `styles.${hash(css)}.css`;
await writeFile(join(dist, "assets", cssName), css);
await rm(cssUnhashed);

const siteJs = await readFile(join(root, "src", "site.js"));
const jsName = `site.${hash(siteJs)}.js`;
await writeFile(join(dist, "assets", jsName), siteJs);

const halftone = await halftoneAsset(config.author);

const ga = gaAssets(config.ga4MeasurementId);
if (ga.fileName) {
  await writeFile(join(dist, "assets", ga.fileName), ga.source);
}

const layout = await readFile(join(root, "src", "layout.html"), "utf8");
const header = await readFile(join(root, "src", "partials", "header.html"), "utf8");
const footer = await readFile(join(root, "src", "partials", "footer.html"), "utf8");
const videoTemplate = await readFile(join(root, "src", "partials", "video-card.html"), "utf8");
const videoManifest = await optimizeVideos(join(root, "assets", "video-thumbs"), join(root, "public", "videos"));
const videosHtml = renderVideos(videosFile.videos, videoTemplate, videoManifest);

const shared = {
  TIKTOK_URL: config.tiktokUrl,
  INSTAGRAM_URL: config.instagramUrl,
  CONTACT_EMAIL: config.contactEmail,
  GA4_ID: config.ga4MeasurementId,
  CSS: `/assets/${cssName}`,
  JS: `/assets/${jsName}`,
  OG_IMAGE: `${config.siteUrl}/og.png`,
  OG_ALT: `${config.name}. ${config.h1}`,
  IDEAS: videosHtml,
  AUTHOR: renderAuthor(config.author),
  EXTRA_PROOF: renderExtraProof(config.extraSocialProof),
  ABOUT_CARD: renderAboutCard(config.author),
  HALFTONE_SCRIPT: halftone.tag,
  ANALYTICS_ITEM: config.ga4MeasurementId
    ? "If you browse the site: pages you view, plus general device, browser, and approximate location data, through Google Analytics 4. The tag is Google's gtag.js library, added on this site directly. Google Tag Manager is not used."
    : "Analytics is not loaded on this version of the site.",
  ANALYTICS_PROCESSORS: config.ga4MeasurementId
    ? "Google Analytics processes usage data through that direct gtag.js tag."
    : "Google Analytics is not used on this version of the site.",
  GA_SNIPPET: ga.snippet,
};

const headerHtml = applyTokens(header, shared);
const footerHtml = applyTokens(footer, shared);

for (const page of pages) {
  const content = await readFile(join(root, "src", "pages", page.file), "utf8");
  const canonical = `${config.siteUrl}${page.path === "/" ? "/" : page.path}`;
  const html = applyTokens(layout, {
    ...shared,
    HEADER: headerHtml,
    FOOTER: footerHtml,
    CONTENT: applyTokens(content, shared),
    TITLE: page.title,
    DESCRIPTION: page.description,
    CANONICAL: canonical,
    ROBOTS: page.robots,
  });
  if (/\{\{[A-Z0-9_]+\}\}/.test(html)) {
    throw new Error(`Unresolved template token in ${page.file}`);
  }
  await writeFile(join(dist, page.file), html);
}

const publicFiles = await readdir(join(root, "public"));
for (const file of publicFiles) {
  const from = join(root, "public", file);
  const to = join(dist, file);
  if ((await stat(from)).isDirectory()) await cp(from, to, { recursive: true });
  else await copyFile(from, to);
}

await writeFile(
  join(dist, "robots.txt"),
  `User-agent: *\nAllow: /\n\nSitemap: ${config.siteUrl}/sitemap.xml\n`,
);
await writeFile(
  join(dist, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${config.siteUrl}/</loc></url>\n  <url><loc>${config.siteUrl}/about</loc></url>\n  <url><loc>${config.siteUrl}/privacy</loc></url>\n</urlset>\n`,
);

await verify(cssName, jsName);

function renderExtraProof(items) {
  if (!Array.isArray(items) || items.length === 0) return "";
  const rows = items
    .filter((item) => item && typeof item.text === "string" && item.text.trim())
    .map((item) => `<li>${escapeHtml(item.text)}</li>`);
  if (!rows.length) return "";
  return `<ul class="mt-3 space-y-1 text-sm text-muted">${rows.join("")}</ul>`;
}

function authorReady(author) {
  return Boolean(author?.credential && author.credential.trim() && photoReady(author.photo));
}

function photoReady(photo) {
  if (typeof photo !== "string" || !photo.trim()) return false;
  if (/^https:\/\//.test(photo)) return true;
  const relative = photo.replace(/^\//, "");
  if (relative.includes("..")) return false;
  return existsSync(join(root, "public", relative));
}

function portrait(author, sizeClass, size) {
  return `<span data-halftone class="${sizeClass} inline-block overflow-hidden rounded-full"><img src="${escapeHtml(author.photo)}" alt="" width="${size}" height="${size}"></span>`;
}

function renderAuthor(author) {
  if (!authorReady(author)) return "";
  return `<p class="mt-6 flex items-center gap-3">${portrait(author, "h-11 w-11", 44)}<span class="text-sm leading-5 text-ink"><span class="font-semibold">Written by Brandon</span><span class="mt-0.5 block text-muted">${escapeHtml(author.credential)}</span></span></p>`;
}

function renderAboutCard(author) {
  if (!authorReady(author)) {
    return `<div class="lift mt-10 rounded-2xl border border-dashed border-ink/30 bg-white p-6 sm:p-8"><div class="flex h-16 w-16 items-center justify-center rounded-full border border-dashed border-ink/30 text-xs font-semibold uppercase tracking-wide text-muted" role="img" aria-label="TODO: Brandon's photo">TODO</div><h2 class="mt-5 font-display text-2xl font-semibold tracking-tight text-ink">TODO: Brandon's photo, name, and credential line</h2><p class="mt-3 text-base leading-relaxed text-muted">This block is a placeholder. No photo, bio, or credentials are published until Brandon adds them.</p></div>`;
  }
  return `<div class="mt-10 flex items-center gap-4 rounded-2xl border border-ink/10 bg-white p-6 sm:p-8">${portrait(author, "h-24 w-24", 96)}<div><h2 class="font-display text-2xl font-semibold tracking-tight text-ink">Written by Brandon</h2><p class="mt-2 text-base leading-relaxed text-muted">${escapeHtml(author.credential)}</p></div></div>`;
}

async function halftoneAsset(author) {
  if (!authorReady(author)) return { tag: "" };
  const source = await readFile(join(root, "src", "halftone.js"));
  const name = `halftone.${hash(source)}.js`;
  await writeFile(join(dist, "assets", name), source);
  return { tag: `<script src="/assets/${name}" defer></script>` };
}

function renderVideos(videos, template, manifest) {
  if (!Array.isArray(videos) || videos.length !== 6) {
    throw new Error("data/videos.json must contain exactly 6 videos");
  }
  return videos
    .map((video, index) => {
      for (const key of ["slug", "title", "place", "description", "platform", "url", "videoId", "alt"]) {
        if (typeof video[key] !== "string" || !video[key].trim()) {
          throw new Error(`Each video needs a ${key}`);
        }
      }
      if (video.stat != null && typeof video.stat !== "string") {
        throw new Error(`Stat for ${video.slug} must be a string`);
      }
      const sources = videoSources(video.slug, manifest[video.slug]);
      if (!sources) throw new Error(`Missing thumbnail for ${video.slug}`);
      const eager = index < 3;
      return applyTokens(template, {
        URL: video.url,
        VIDEO_ID: video.videoId,
        PLATFORM: video.platform,
        PLACE: video.place,
        TITLE: video.title,
        DESCRIPTION: video.description,
        ALT: video.alt,
        AVIF_SRCSET: sources.avif,
        WEBP_SRCSET: sources.webp,
        JPG_SRCSET: sources.jpg,
        JPG_SRC: sources.src,
        LOADING: eager ? "eager" : "lazy",
        PRIORITY: "",
        STAT_HTML: video.stat
          ? `<span class="stat mt-2 block text-sm font-semibold text-ink">${escapeHtml(video.stat)}</span>`
          : "",
      });
    })
    .join("\n");
}

function gaAssets(measurementId) {
  if (!measurementId) return { fileName: "", snippet: "", source: "" };
  const source = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag("js",new Date());gtag("config","${measurementId}");\n`;
  const fileName = `gtag-config.${hash(Buffer.from(source))}.js`;
  const snippet = [
    "<!-- Google tag (gtag.js), installed directly. Not Google Tag Manager. -->",
    '<link rel="preconnect" href="https://www.googletagmanager.com">',
    '<link rel="preconnect" href="https://www.google-analytics.com">',
    `<script async src="https://www.googletagmanager.com/gtag/js?id=${measurementId}"></script>`,
    `<script src="/assets/${fileName}"></script>`,
  ].join("\n    ");
  return { fileName, snippet, source };
}

function applyTokens(template, tokens) {
  let html = template;
  for (const [key, value] of Object.entries(tokens)) {
    const replacement = RAW.has(key) ? String(value ?? "") : escapeHtml(value ?? "");
    html = html.replaceAll(`{{${key}}}`, replacement);
  }
  return html;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function hash(buffer) {
  return createHash("sha256").update(buffer).digest("hex").slice(0, 10);
}

async function verify(cssName, jsName) {
  const index = await readFile(join(dist, "index.html"), "utf8");
  const cssText = await readFile(join(dist, "assets", cssName), "utf8");
  const jsText = await readFile(join(dist, "assets", jsName), "utf8");
  const missing = [];
  const expect = (ok, label) => {
    if (!ok) missing.push(label);
  };
  expect(index.includes(config.title), "title");
  expect(index.includes(config.description), "description");
  expect(index.includes(`<link rel="canonical" href="${config.siteUrl}/">`), "canonical");
  expect(index.includes(`${config.siteUrl}/og.png`), "og image");
  expect(index.includes(config.tiktokUrl), "tiktok");
  expect(index.includes(config.instagramUrl), "instagram");
  expect(index.includes("Get the ideas"), "hero button");
  expect(index.includes(">Replicate<") && index.includes(">success.<") && index.includes(">Don't<") && index.includes(">reinvent<") && index.includes(">ideas.<"), "headline");
  expect(index.includes("in South Africa. Free."), "south africa description");
  expect(!index.includes("your market") && !index.includes("Turn on JavaScript"), "old copy removed");
  expect(!index.includes("samples of the format"), "sample disclaimer removed");
  expect(index.includes('action="/api/subscribe"') && index.includes('method="post"'), "form post");
  expect(index.includes('value="hero"') && index.includes('value="footer"'), "form sources");
  expect(!index.includes("cdn.tailwindcss.com"), "no tailwind cdn");
  expect(!index.includes("gtm.js") && !index.includes("GTM-"), "no tag manager");
  expect(!jsText.includes("gtm.js") && !jsText.includes("GTM-"), "no tag manager in script");
  expect(cssText.includes("--color-cta:#15803d") || cssText.includes("--color-cta: #15803d"), "cta color");
  expect(!cssText.includes("#1f4fff") && !index.includes("#1F4FFF"), "old blue removed");
  expect(jsText.includes("form_submit_hero") && jsText.includes("form_submit_footer"), "form events");
  expect(jsText.includes("social_click"), "social event");
  if (config.ga4MeasurementId) {
    expect(
      index.includes(`https://www.googletagmanager.com/gtag/js?id=${config.ga4MeasurementId}`),
      "gtag.js",
    );
    const match = index.match(/\/assets\/(gtag-config\.[a-f0-9]+\.js)/);
    expect(Boolean(match), "gtag config script");
    if (match) {
      const gaText = await readFile(join(dist, "assets", match[1]), "utf8");
      expect(gaText.includes(`gtag("config","${config.ga4MeasurementId}")`), "gtag config");
      expect(!gaText.includes("gtm.js"), "gtag config is not tag manager");
    }
  } else {
    expect(!index.includes("/gtag/js"), "analytics omitted");
  }
  const about = await readFile(join(dist, "about.html"), "utf8");
  expect(about.includes("TODO: Brandon's photo, name, and credential line"), "about placeholder");
  expect(about.includes("mailto:"), "contact mailto");
  if (missing.length) throw new Error(`Build checks failed: ${missing.join(", ")}`);

  const og = await readFile(join(dist, "og.png"));
  const width = og.readUInt32BE(16);
  const height = og.readUInt32BE(20);
  if (width !== 1200 || height !== 630) {
    throw new Error(`public/og.png is ${width}x${height}, expected 1200x630. Run npm run og.`);
  }

  const files = [
    ["index.html", (await stat(join(dist, "index.html"))).size],
    [cssName, (await stat(join(dist, "assets", cssName))).size],
    [jsName, (await stat(join(dist, "assets", jsName))).size],
    ["favicon.svg", (await stat(join(dist, "favicon.svg"))).size],
    ["favicon.ico", (await stat(join(dist, "favicon.ico"))).size],
  ];
  if (config.ga4MeasurementId) {
    const gaName = index.match(/\/assets\/(gtag-config\.[a-f0-9]+\.js)/)[1];
    files.push([gaName, (await stat(join(dist, "assets", gaName))).size]);
  }
  const total = files.reduce((sum, [, size]) => sum + size, 0);
  const gzipTotal = gzipSync(Buffer.concat(await Promise.all(files.map(async ([name]) => {
    const path = name.includes(".css") || name.includes(".js")
      ? join(dist, "assets", name)
      : join(dist, name);
    return readFile(path);
  })))).length;
  console.log(`Site URL: ${config.siteUrl}`);
  console.log(`GA4: ${config.ga4MeasurementId || "(disabled)"} (default ${GA4_MEASUREMENT_ID})`);
  for (const [name, size] of files) console.log(`  ${name}: ${size} bytes`);
  console.log(`First-party weight uncompressed: ${total} bytes`);
  console.log(`First-party weight gzip (combined): ${gzipTotal} bytes`);
  console.log("Excludes Google Fonts and the gtag.js library, which load from Google.");
  if (total > 300 * 1024) {
    throw new Error(`First-party page weight ${total} exceeds 300 KB`);
  }
}
