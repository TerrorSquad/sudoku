# 2. Dependency pins

Date: 2026-11-16. Status: accepted.

`pnpm update --latest` skips these (`updateConfig.ignoreDependencies` in `pnpm-workspace.yaml`).
Revisit each when its condition changes; remove the pin and its line there.

| Pin                | Why                                                                                                                                  | Unpin when                             |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------- |
| `typescript` ^6    | `vue-tsc` (Volar) needs the JS compiler API; TypeScript 7 (the native port) ships none, and `nuxt typecheck` crashes on `./lib/tsc`. | `vue-tsc` supports TS 7.               |
| `@vueuse/nuxt` ^14 | v15 pins `@vueuse/core` 15, a second copy next to the 14 that `@nuxt/ui` uses.                                                       | `@nuxt/ui` moves to `@vueuse/core` 15. |

Resolved: `nuxt` was pinned to 4.6.2 (2026-11-16 to 2026-11-17). With the Wavedash build's relative
base URL (`NUXT_APP_BASE_URL=./`), 4.6.3's dot-segment check 404'd every prerendered route and
Nitro answered with a "Redirecting..." body: 1.10.0 shipped that and never loaded (the fix,
nuxt/nuxt#36913, was unreleased). The same `./` base also made Nuxt's router rewrite `/game/` to
`/game/game/` on start, so any reload loaded a blank page. The build now keeps the base at `/` and
sets `NUXT_APP_CDN_URL=./` instead, which gives the same relative asset URLs without either
problem, so nuxt follows `^4` again. `scripts/budget.mjs` still fails a build whose `index.html` or
`200.html` isn't the app shell, and `pnpm test:prod` checks the address stays `/game/` across
reloads.

Not pinned but worth knowing: `tailwindcss` is not a direct dependency (`@nuxt/ui` brings it, and
`@import "tailwindcss"` resolves through it); `@nuxt/kit`/`@nuxt/schema` also appear in the
lockfile through modules' own `^4` ranges, which is harmless.
