import { mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

const widths = [360, 720];

export async function optimizeVideos(sourceDir, outDir) {
  await mkdir(outDir, { recursive: true });
  const files = (await readdir(sourceDir)).filter((name) => name.endsWith(".jpg"));
  const manifest = {};

  for (const file of files) {
    const slug = file.replace(/\.jpg$/, "");
    const input = join(sourceDir, file);
    const image = sharp(input);
    const meta = await image.metadata();
    const made = [];

    for (const width of widths) {
      if (meta.width < width && width !== 360) continue;
      const resized = sharp(input).rotate().resize({ width, withoutEnlargement: true });
      const base = join(outDir, `${slug}-${width}`);
      await resized.clone().avif({ quality: 28, effort: 6 }).toFile(`${base}.avif`);
      await resized.clone().webp({ quality: 68 }).toFile(`${base}.webp`);
      await resized.clone().jpeg({ quality: 72, mozjpeg: true }).toFile(`${base}.jpg`);
      made.push(width);
    }

    manifest[slug] = made;
  }

  return manifest;
}

function srcset(slug, ext, widthsMade) {
  return widthsMade.map((width) => `/videos/${slug}-${width}.${ext} ${width}w`).join(", ");
}

export function videoSources(slug, widthsMade) {
  const fallback = widthsMade[0];
  return {
    avif: srcset(slug, "avif", widthsMade),
    webp: srcset(slug, "webp", widthsMade),
    jpg: srcset(slug, "jpg", widthsMade),
    src: `/videos/${slug}-${fallback}.jpg`,
  };
}
