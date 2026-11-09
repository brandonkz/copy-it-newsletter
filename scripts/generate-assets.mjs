import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { BRAND } from "../site.config.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const fontDir = join(root, "assets", "fonts");
const publicDir = join(root, "public");
const confDir = join(tmpdir(), "copy-it-fontconfig");

await mkdir(join(confDir, "cache"), { recursive: true });
await mkdir(publicDir, { recursive: true });

const fontsConf = `<?xml version="1.0"?>
<fontconfig>
  <dir>${fontDir}</dir>
  <cachedir>${join(confDir, "cache")}</cachedir>
  <alias>
    <family>sans-serif</family>
    <prefer><family>Space Grotesk</family></prefer>
  </alias>
</fontconfig>
`;
await writeFile(join(confDir, "fonts.conf"), fontsConf);
process.env.FONTCONFIG_FILE = join(confDir, "fonts.conf");

const sharp = (await import("sharp")).default;

const faviconSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="8" fill="${BRAND.deep}"/>
  <path d="M22.4 10.6a8 8 0 1 0 .1 10.8" fill="none" stroke="#F7F5EE" stroke-width="3.2" stroke-linecap="round"/>
</svg>
`;
await writeFile(join(publicDir, "favicon.svg"), faviconSvg);

const favicon32 = await sharp(Buffer.from(faviconSvg)).resize(32, 32).png().toBuffer();
const apple = await sharp(Buffer.from(faviconSvg)).resize(180, 180).png().toBuffer();
await writeFile(join(publicDir, "favicon-32.png"), favicon32);
await writeFile(join(publicDir, "apple-touch-icon.png"), apple);
await writeFile(join(publicDir, "favicon.ico"), pngToIco(favicon32, 32));

const line1 = "Business ideas working overseas.";
const line2 = "Before they hit South Africa.";
const ogSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="${BRAND.paper}"/>
  <rect width="1200" height="16" fill="${BRAND.deep}"/>
  <text x="80" y="168" fill="${BRAND.deep}" font-family="Space Grotesk" font-size="42" font-weight="700">${escapeXml(BRAND.name)}</text>
  <text x="80" y="300" fill="${BRAND.text}" font-family="Space Grotesk" font-size="52" font-weight="700">${escapeXml(line1)}</text>
  <rect x="76" y="352" width="780" height="16" fill="${BRAND.gold}"/>
  <text x="80" y="372" fill="${BRAND.text}" font-family="Space Grotesk" font-size="52" font-weight="700">${escapeXml(line2)}</text>
  <text x="80" y="540" fill="${BRAND.muted}" font-family="Space Grotesk" font-size="28" font-weight="500">Free weekly newsletter</text>
</svg>
`;

const ogPath = join(publicDir, "og.png");
await sharp(Buffer.from(ogSvg)).png({ compressionLevel: 9 }).toFile(ogPath);
const meta = await sharp(ogPath).metadata();
if (meta.width !== 1200 || meta.height !== 630) {
  throw new Error(`OG image is ${meta.width}x${meta.height}, expected 1200x630`);
}
console.log(`Wrote ${ogPath} (${meta.width}x${meta.height})`);

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function pngToIco(png, size) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  const entry = Buffer.alloc(16);
  entry.writeUInt8(size >= 256 ? 0 : size, 0);
  entry.writeUInt8(size >= 256 ? 0 : size, 1);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(22, 12);
  return Buffer.concat([header, entry, png]);
}
