import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vercel from "../vercel.json" with { type: "json" };
import { subscribeHandler } from "../lib/subscribe.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const port = Number(process.env.PORT || 4173);
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".pdf": "application/pdf",
};

const securityHeaders = headersFor("/(.*)");

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://127.0.0.1:${port}`);
  for (const header of securityHeaders) res.setHeader(header.key, header.value);

  if (url.pathname === "/api/subscribe") {
    await handleSubscribe(req, res);
    return;
  }

  const pathname = decodeURIComponent(url.pathname).replace(/\/+$/, "") || "/";
  if (pathname.includes("\0") || pathname.includes("..")) {
    res.statusCode = 400;
    res.end("Bad path");
    return;
  }

  for (const header of cacheHeaders(pathname)) res.setHeader(header.key, header.value);

  const relative = pathname === "/" ? "index.html" : pathname.slice(1);
  const candidates = [
    join(dist, relative),
    join(dist, `${relative}.html`),
    join(dist, relative, "index.html"),
  ];
  for (const file of candidates) {
    const safe = normalize(file);
    if (!safe.startsWith(dist)) continue;
    try {
      const info = await stat(safe);
      if (!info.isFile()) continue;
      res.statusCode = 200;
      res.setHeader("Content-Type", types[extname(safe)] || "application/octet-stream");
      createReadStream(safe).pipe(res);
      return;
    } catch {
      /* try the next candidate */
    }
  }

  res.statusCode = 404;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.end("Not found");
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Copy It is at http://127.0.0.1:${port}`);
});

async function handleSubscribe(req, res) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks);
  if (raw.length > 10_000) {
    res.statusCode = 413;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: false, error: "Something went wrong. Please try again." }));
    return;
  }
  const text = raw.toString("utf8");
  const type = String(req.headers["content-type"] || "");
  if (type.includes("application/x-www-form-urlencoded")) {
    req.body = text;
  } else {
    try {
      req.body = text ? JSON.parse(text) : {};
    } catch {
      req.body = text;
    }
  }

  const env = { ...process.env };
  let fetchImpl = globalThis.fetch;
  if (process.env.BEEHIIV_MOCK === "true") {
    env.BEEHIIV_API_KEY = env.BEEHIIV_API_KEY || "local_mock_key";
    fetchImpl = async () => ({ ok: true, status: 200, text: async () => "" });
  }

  await subscribeHandler(req, res, { env, fetch: fetchImpl });
}

function headersFor(source) {
  const rule = vercel.headers.find((item) => item.source === source);
  return rule ? rule.headers : [];
}

function cacheHeaders(pathname) {
  if (pathname.startsWith("/assets/")) return headersFor("/assets/(.*)");
  if (pathname === "/") return headersFor("/");
  if (pathname === "/privacy") return headersFor("/privacy");
  if (pathname === "/thank-you") return headersFor("/thank-you");
  if (pathname === "/og.png") return headersFor("/og.png");
  return [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }];
}
