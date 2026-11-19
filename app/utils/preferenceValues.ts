// The allowed values of the non-boolean preferences: usePreferences types them, progressBackup
// validates imported and synced files against them.

export const BOARD_THEMES = ["tiles", "newsprint", "contrast", "blueprint", "chalkboard"] as const;
export type BoardTheme = (typeof BOARD_THEMES)[number];

/** Display size: multiplies the root font-size (main.css) off the game screen. */
export const UI_SCALES = [1, 1.25, 1.5, 1.75] as const;
export type UiScale = (typeof UI_SCALES)[number];
