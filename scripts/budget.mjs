// Fails the build when the shipped JS or CSS outgrows its budget. Run after `nuxt generate`.
// Importing every Nuxt UI locale once added 228 KB of JS, and theming every Nuxt UI component
// 120 KB of CSS, without anyone noticing.
import { readdirSync, statSync } from "node:fs";

const BUDGET = { js: 850, css: 160 }; // KB, raw: 804 and 139 at the last raise
const dir = ".output/public/_nuxt";
const kb = { js: 0, css: 0 };
for (const f of readdirSync(dir)) {
  const ext = f.split(".").pop();
  if (ext in kb) kb[ext] += statSync(`${dir}/${f}`).size / 1024;
}
let over = false;
for (const [ext, max] of Object.entries(BUDGET)) {
  const size = Math.round(kb[ext]);
  console.log(`${ext}: ${size} KB of ${max} KB`);
  over ||= size > max;
}
if (over) {
  console.error(
    "Over budget: find what grew (source maps + source-map-explorer) before raising it.",
  );
  process.exit(1);
}
