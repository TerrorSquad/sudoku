// Publishes a pushed Wavedash build: `node scripts/publish.mjs <build id>`. Right after
// `wavedash build push` the build is still processing and publish fails with "Only completed
// builds can be published", so retry until it's done.
import { execFileSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const id = process.argv[2];
const args = ["publish", id, "--title", `v${process.env.npm_package_version}`, "-y"];
for (let attempt = 1; ; attempt++) {
  try {
    execFileSync("wavedash", args, { stdio: "inherit" });
    break;
  } catch {
    if (attempt === 10) process.exit(1);
    console.error(`Publish attempt ${attempt} failed, retrying in 5 s…`);
    await sleep(5000);
  }
}
