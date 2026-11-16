// Runs after `nuxt generate`, before `pnpm wavedash` uploads. First it fails the build when
// index.html isn't the app shell: 1.10.0 shipped every page as "Redirecting..." (Nuxt 4.6.3+ with
// the relative base URL) and never loaded. Then it prints the shipped JS and CSS sizes and warns
// past a watch level; size never fails the build, as Wavedash's only limit is 1 GB per upload.
// The warning is there because bloat creeps in unnoticed: importing every Nuxt UI locale once added 228 KB of
// JS, and theming every Nuxt UI component 120 KB of CSS.
import { readFileSync, readdirSync, statSync } from "node:fs";

// With the relative base Wavedash needs, assets must load from ./_nuxt/, not /_nuxt/.
const assets = process.env.NUXT_APP_BASE_URL === "./" ? 'src="./_nuxt/' : "_nuxt/";
for (const page of ["index.html", "200.html"]) {
  const html = readFileSync(`.output/public/${page}`, "utf8");
  if (!html.includes("<!DOCTYPE html>") || !html.includes(assets)) {
    console.error(
      `${page} is not the app shell (${html.length} bytes: ${html.slice(0, 60)}); not uploading.`,
    );
    process.exit(1);
  }
}

const WARN_AT = { js: 1100, css: 180 }; // KB, raw: 922 and 142 at v1.6.0 (pattern lines, lessons)
const dir = ".output/public/_nuxt";
const kb = { js: 0, css: 0 };
for (const f of readdirSync(dir)) {
  const ext = f.split(".").pop();
  if (ext in kb) kb[ext] += statSync(`${dir}/${f}`).size / 1024;
}
for (const [ext, level] of Object.entries(WARN_AT)) {
  const size = Math.round(kb[ext]);
  console.log(`${ext}: ${size} KB`);
  if (size > level) {
    console.warn(
      `  ${ext} is past ${level} KB: check what grew (source maps + source-map-explorer).`,
    );
  }
}
