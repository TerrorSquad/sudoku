// `node scripts/serve-static.mjs <port>`: serves .output/public under /game/, the way Wavedash
// serves the game from a subfolder, so the prod smoke test (e2e/prod.spec.ts) loads the real build
// with its relative (./) asset URLs. Static files only; a directory gets its index.html.

import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, sep } from "node:path";

const ROOT = ".output/public";
const PREFIX = "/game/";
const TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json",
};

createServer(async (req, res) => {
  let path;
  try {
    path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  } catch {
    return res.writeHead(400).end();
  }
  if (!path.startsWith(PREFIX)) return res.writeHead(404).end();
  let file = normalize(join(ROOT, path.slice(PREFIX.length)));
  if (file !== ROOT && !file.startsWith(ROOT + sep)) return res.writeHead(403).end();
  if (path.endsWith("/")) file = join(file, "index.html");
  try {
    const body = await readFile(file);
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
}).listen(Number(process.argv[2] ?? 3120));
