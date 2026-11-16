# 1. Ship on Wavedash only

Date: 2026-11-16. Status: accepted.

## Context

The game was deployed twice: a GitHub Pages site (with a PWA service worker for offline play) and
Wavedash. On Wavedash the service worker was already off: the game runs in a cross-origin frame,
where a worker at best does nothing and at worst keeps serving an old build after a new publish.

## Decision

Wavedash is the only distribution. The Pages workflow, the Pages site, `@vite-pwa/nuxt`, its icons
and the manifest/apple meta are gone (PR #59). The README links the Wavedash game page.

## Consequences

- No offline play outside Wavedash, and no install-to-home-screen.
- Anyone who installed the old PWA keeps a frozen copy: deleting the site doesn't unregister a
  service worker (a 404 on `sw.js` leaves it in place). Accepted rather than publishing a
  self-unregistering worker first.
- `pnpm wavedash` builds with the relative base URL `./`; that is now the build that matters, and
  `scripts/budget.mjs` checks it before every upload (see ADR 2).
