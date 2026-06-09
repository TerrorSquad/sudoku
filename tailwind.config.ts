import type { Config } from 'tailwindcss'

export default {
  theme: {
    extend: {
      fontFamily: {
        game: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      screens: {
        '3xl': '1920px',
      },
    },
  },
} satisfies Config
