// `pnpm wavedash:release`: builds and pushes to Wavedash (`pnpm wavedash`), then publishes that
// build. Right after the push the build is still processing and publish fails with "Only
// completed builds can be published", so that error (and only that one) is retried for ~2 minutes.
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const TRIES = 24;
const WAIT_MS = 5000;

/** Runs a command, streaming its output and keeping a copy. */
function run(cmd, args) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: ["inherit", "pipe", "pipe"] });
    let out = "";
    child.stdout.on("data", (d) => ((out += d), process.stdout.write(d)));
    child.stderr.on("data", (d) => ((out += d), process.stderr.write(d)));
    child.on("error", (e) => resolve({ code: 1, out: String(e) }));
    child.on("close", (code) => resolve({ code, out }));
  });
}

const push = await run("pnpm", ["wavedash"]);
if (push.code !== 0) process.exit(push.code || 1);
const id = push.out.match(/^Build ID: (\S+)/m)?.[1];
if (!id) {
  console.error("No Build ID in the push output; nothing to publish.");
  process.exit(1);
}

const args = ["publish", id, "--title", `v${process.env.npm_package_version}`, "-y"];
for (let attempt = 1; ; attempt++) {
  const { code, out } = await run("wavedash", args);
  if (code === 0) break;
  if (!out.includes("Only completed builds") || attempt === TRIES) process.exit(code || 1);
  console.error(`Build still processing; retrying in ${WAIT_MS / 1000} s (${attempt}/${TRIES})…`);
  await sleep(WAIT_MS);
}
