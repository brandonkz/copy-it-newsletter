import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, readFile, readdir, rm, stat, writeFile, copyFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { getSiteConfig, GA4_MEASUREMENT_ID } from "../site.config.js";
import ideasFile from "../data/ideas.json" with { type: "json" };

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

const ga = gaAssets(config.ga4MeasurementId);
if (ga.fileName) {
  await writeFile(join(dist, "assets", ga.fileName), ga.source);
}

const layout = await readFile(join(root, "src", "layout.html"), "utf8");
const header = await readFile(join(root, "src", "partials", "header.html"), "utf8");
const footer = await readFile(join(root, "src", "partials", "footer.html"), "utf8");
const ideaTemplate = await readFile(join(root, "src", "partials", "idea-card.html"), "utf8");
const ideasHtml = renderIdeas(ideasFile.ideas, ideaTemplate);

const shared = {
  TIKTOK_URL: config.tiktokUrl,
  INSTAGRAM_URL: config.instagramUrl,
  CONTACT_EMAIL: config.contactEmail,
  GA4_ID: config.ga4MeasurementId,
  CSS: `/assets/${cssName}`,
  JS: `/assets/${jsName}`,
  OG_IMAGE: `${config.siteUrl}/og.png`,
  OG_ALT: `${config.name}. ${config.h1}`,
  IDEAS: ideasHtml,
  AUTHOR: renderAuthor(config.author),
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
  await copyFile(join(root, "public", file), join(dist, file));
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

function renderAuthor(author) {
  if (!author?.photo || !author?.credential) return "";
  return `<p class="mt-6 flex items-center gap-3"><img src="${escapeHtml(author.photo)}" alt="" width="44" height="44" class="h-11 w-11 rounded-full object-cover"><span class="text-sm leading-5 text-ink"><span class="font-semibold">Written by ${escapeHtml(author.name || "Brandon K")}</span><span class="mt-0.5 block text-muted">${escapeHtml(author.credential)}</span></span></p>`;
}

function renderIdeas(ideas, template) {
  if (!Array.isArray(ideas) || ideas.length !== 3) {
    throw new Error("data/ideas.json must contain exactly 3 ideas");
  }
  return ideas
    .map((idea) => {
      for (const key of ["company", "place", "stat", "how", "sourceUrl", "sourceLabel"]) {
        if (typeof idea[key] !== "string" || !idea[key].trim()) {
          throw new Error(`Each idea needs a ${key}`);
        }
      }
      if (!/^https:\/\//.test(idea.sourceUrl)) {
        throw new Error(`Idea source must be an https URL: ${idea.company}`);
      }
      return applyTokens(template, {
        COMPANY: idea.company,
        PLACE: idea.place,
        STAT: idea.stat,
        HOW: idea.how,
        SOURCE_URL: idea.sourceUrl,
        SOURCE_LABEL: idea.sourceLabel,
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
  expect(index.includes("Before they hit South Africa."), "south africa headline");
  expect(index.includes("in South Africa. Free."), "south africa description");
  expect(!index.includes("your market") && !index.includes("Turn on JavaScript"), "old copy removed");
  expect(!index.includes("samples of the format"), "sample disclaimer removed");
  expect(index.includes('action="/api/subscribe"') && index.includes('method="post"'), "form post");
  expect(index.includes('value="hero"') && index.includes('value="footer"'), "form sources");
  expect(!index.includes("cdn.tailwindcss.com"), "no tailwind cdn");
  expect(!index.includes("gtm.js") && !index.includes("GTM-"), "no tag manager");
  expect(!jsText.includes("gtm.js") && !jsText.includes("GTM-"), "no tag manager in script");
  expect(cssText.includes("--color-accent"), "accent color");
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
