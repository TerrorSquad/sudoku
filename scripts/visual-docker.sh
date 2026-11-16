#!/usr/bin/env bash
# Runs the visual-regression suite inside the official Playwright Linux image (`pnpm visual`,
# `pnpm visual:update`), so baselines render the same on any host (Linux or macOS) and in CI, which
# runs in the same image (.github/workflows/visual.yml). Args go to `pnpm visual:run`.
# Pattern borrowed from moj-go's scripts/screenshots-docker.sh.
set -euo pipefail

# The container runs as root: hand what it writes into the bind-mounted repo back to the caller,
# even on Ctrl-C. node_modules is a named volume (Linux binaries, never the host's), left alone.
chown_back() {
  [ -n "${HOST_UID:-}" ] || return 0
  chown -R "${HOST_UID}:${HOST_GID:-$HOST_UID}" \
    /work/e2e/visual-regression-snapshots /work/test-results /work/playwright-report /work/.nuxt \
    2>/dev/null || true
}
trap chown_back EXIT
trap 'exit 130' INT TERM

command -v pnpm >/dev/null || npm install --global --silent pnpm@11
pnpm install --frozen-lockfile --config.confirmModulesPurge=false
pnpm visual:run "$@"
