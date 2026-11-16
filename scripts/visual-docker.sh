#!/usr/bin/env bash
# Runs the visual-regression suite inside the official Playwright Linux image (`pnpm visual`,
# `pnpm visual:update`), so baselines render the same on any host (Linux or macOS) and in CI, which
# runs in the same image (.github/workflows/visual.yml). Args go to `pnpm visual:run`.
# Pattern borrowed from moj-go's scripts/screenshots-docker.sh.
set -euo pipefail

# How package.json runs it: linux/amd64 everywhere (an Apple Silicon Mac emulates it), since arm64
# Skia rasterizes differently from CI. .nuxt and .data are throwaway volumes, so a host dev server
# never sees root-owned files or /work paths. node_modules is a volume per checkout (Linux binaries,
# never the host's; parallel worktrees can't install over each other); the pnpm store is shared.
# The container runs as root: hand what it writes into the bind-mounted repo back to the caller,
# even on Ctrl-C.
chown_back() {
  [ -n "${HOST_UID:-}" ] || return 0
  chown -R "${HOST_UID}:${HOST_GID:-$HOST_UID}" \
    /work/e2e/visual-regression-snapshots /work/test-results /work/playwright-report \
    2>/dev/null || true
}
trap chown_back EXIT
trap 'exit 130' INT TERM

command -v pnpm >/dev/null || npm install --global --silent pnpm@11
# The store is its own named volume (package.json): under /work it would land in the repo.
pnpm install --frozen-lockfile --store-dir /root/.pnpm-store --config.confirmModulesPurge=false
pnpm visual:run "$@"
