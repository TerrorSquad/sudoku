// Prints the shipped JS and CSS sizes after `nuxt generate`, and warns when they pass a watch
// level. It never fails the build: Wavedash's only limit is 1 GB per upload. The warning is
// there because bloat creeps in unnoticed: importing every Nuxt UI locale once added 228 KB of
// JS, and theming every Nuxt UI component 120 KB of CSS.
import { readdirSync, statSync } from "node:fs";

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
