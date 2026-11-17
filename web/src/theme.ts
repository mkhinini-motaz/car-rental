import { createTheme, PaletteColor, PaletteColorOptions } from '@mui/material/styles';
import { BAR_GREEN, DEFAULT_THEME, PALETTES, Scheme, ThemeId } from './classes/Theme';

export { DEFAULT_THEME, isThemeId, PALETTES, THEME_FAMILIES } from './classes/Theme';
export type { ThemeId } from './classes/Theme';

declare module '@mui/material/styles' {
  interface Palette { nav: PaletteColor, muted: PaletteColor, ink: PaletteColor }
  interface PaletteOptions { nav?: PaletteColorOptions, muted?: PaletteColorOptions, ink?: PaletteColorOptions }
}

// One scheme of a palette: its tones are the palette's (`color='success'` and a Badge's 'ok' are the
// same green), and each tone's `contrastText` is the text on it when filled.
const palette = (id: ThemeId, scheme: Scheme) => {
  const colors = PALETTES[id][scheme];
  const tone = (main: string) => ({ main, contrastText: colors.on });
  return {
    primary: { main: colors.primary, contrastText: colors.onPrimary },
    success: { ...tone(colors.ok), light: BAR_GREEN[scheme] }, // `success.light`: a progress bar's green
    info: tone(colors.info),
    warning: tone(colors.warn),
    error: tone(colors.danger),
    muted: tone(colors.mutedFill),
    ink: tone(colors.ink),
    nav: { main: colors.nav, contrastText: colors.onNav },
    background: { default: colors.canvas, paper: colors.surface },
    text: { primary: colors.ink, secondary: colors.muted },
    divider: colors.line,
  };
};

// Light and dark are CSS variables switched on <html>, so `COLORS` (constants.ts) follows the scheme.
export const makeTheme = (direction: 'ltr'|'rtl', id: ThemeId = DEFAULT_THEME) => createTheme({
  direction,
  cssVariables: { colorSchemeSelector: 'data' },
  colorSchemes: {
    light: { palette: palette(id, 'light') },
    dark: { palette: palette(id, 'dark') },
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans Arabic", Tahoma, sans-serif',
    h5: { fontWeight: 700 },
    h6: { fontWeight: 700 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    MuiPaper: { defaultProps: { elevation: 0 } },
    MuiCard: { defaultProps: { variant: 'outlined' } },
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiTextField: { defaultProps: { size: 'small', fullWidth: true } },
    // Under the page's h1 every section title is an h2, whatever its size; field labels aren't headings.
    MuiTypography: { defaultProps: { variantMapping: { h5: 'h2', h6: 'h2', subtitle1: 'p', subtitle2: 'p' } } },
  },
});
