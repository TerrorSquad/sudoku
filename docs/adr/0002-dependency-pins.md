# 2. Dependency pins

Date: 2026-11-16. Status: accepted.

`pnpm update --latest` skips these (`updateConfig.ignoreDependencies` in `pnpm-workspace.yaml`).
Revisit each when its condition changes; remove the pin and its line there.

| Pin                  | Why                                                                                                                                                                                                                                                                                                                                                                                    | Unpin when                                                                                                                             |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `nuxt` 4.6.2 (exact) | 4.6.3's dot-segment check 404s every prerendered route under the `./` base, and Nitro answers with a "Redirecting..." body: 1.10.0 shipped that and never loaded. 4.6.3/4.6.4's security fixes are for the Nuxt/Nitro server, which this static SPA doesn't ship. Fixed upstream in nuxt/nuxt#36913 (merged to `4.x` 2026-11-10, unreleased; the `release/v4.7.0` branch predates it). | A release contains #36913. Check with `WAVEDASH=1 NUXT_APP_BASE_URL=./ pnpm generate && NUXT_APP_BASE_URL=./ node scripts/budget.mjs`. |
| `typescript` ^6      | `vue-tsc` (Volar) needs the JS compiler API; TypeScript 7 (the native port) ships none, and `nuxt typecheck` crashes on `./lib/tsc`.                                                                                                                                                                                                                                                   | `vue-tsc` supports TS 7.                                                                                                               |
| `@vueuse/nuxt` ^14   | v15 pins `@vueuse/core` 15, a second copy next to the 14 that `@nuxt/ui` uses.                                                                                                                                                                                                                                                                                                         | `@nuxt/ui` moves to `@vueuse/core` 15.                                                                                                 |

Not pinned but worth knowing: `tailwindcss` is not a direct dependency (`@nuxt/ui` brings it, and
`@import "tailwindcss"` resolves through it); `@nuxt/kit`/`@nuxt/schema` 4.6.4 also appear in the
lockfile through modules' own `^4` ranges, which is harmless.
