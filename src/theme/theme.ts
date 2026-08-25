'use client';
import { createTheme } from '@mui/material/styles';
import type { PaletteColor, PaletteColorOptions } from '@mui/material/styles';

// M3 has role pairs MUI's default palette does not: a "container" tone next
// to every accent colour (a tinted surface to put that colour's content on),
// plus a third accent (tertiary) and three surface elevations. Extend the
// palette with real PaletteColor groups — not a plain object export like the
// old CONTAINER — so they work everywhere a built-in colour does:
// `bgcolor: 'primaryContainer.main'`, `color: 'primaryContainer.contrastText'`,
// componentsProps, etc. `outlineVariant` is deliberately not added: MUI's own
// `divider` already carries that exact M3 role, at the same values below —
// a second token for the same colour would just be one more name to keep in
// sync.
declare module '@mui/material/styles' {
  interface Palette {
    primaryContainer: PaletteColor;
    secondaryContainer: PaletteColor;
    tertiary: PaletteColor;
    tertiaryContainer: PaletteColor;
    surfaceContainerLow: PaletteColor;
    surfaceContainer: PaletteColor;
    surfaceContainerHigh: PaletteColor;
  }
  interface PaletteOptions {
    primaryContainer?: PaletteColorOptions;
    secondaryContainer?: PaletteColorOptions;
    tertiary?: PaletteColorOptions;
    tertiaryContainer?: PaletteColorOptions;
    surfaceContainerLow?: PaletteColorOptions;
    surfaceContainer?: PaletteColorOptions;
    surfaceContainerHigh?: PaletteColorOptions;
  }
}

// Material 3 roles generated from a deep green source colour. Calm, not hype.
const light = {
  primary: { main: '#1E5F4B', contrastText: '#FFFFFF' },
  primaryContainer: { main: '#A6F2CD', contrastText: '#002014' },
  secondary: { main: '#4C6358', contrastText: '#FFFFFF' },
  secondaryContainer: { main: '#CEE9DA', contrastText: '#0A1F16' },
  // Warm gold — accents on PRs and achievements, deliberately distinct from
  // the green primary/secondary so a record actually stands out.
  tertiary: { main: '#6D5700', contrastText: '#FFFFFF' },
  tertiaryContainer: { main: '#FFDF9B', contrastText: '#231B00' },
  error: { main: '#BA1A1A' },
  warning: { main: '#7A5900' },
  success: { main: '#2E6B34' },
  background: { default: '#F6FBF6', paper: '#FFFFFF' },
  surfaceContainerLow: { main: '#F0F5F0', contrastText: '#171D19' },
  surfaceContainer: { main: '#ECF2ED', contrastText: '#171D19' },
  surfaceContainerHigh: { main: '#E1E9E3', contrastText: '#171D19' },
  text: { primary: '#171D19', secondary: '#3F4943' },
  divider: '#BFC9C2',
};

const dark = {
  primary: { main: '#7EDBB4', contrastText: '#00382A' },
  primaryContainer: { main: '#00513C', contrastText: '#A6F2CD' },
  secondary: { main: '#B3CCBF', contrastText: '#1E352B' },
  secondaryContainer: { main: '#334B40', contrastText: '#CEE9DA' },
  tertiary: { main: '#E0C374', contrastText: '#3B2F00' },
  tertiaryContainer: { main: '#544400', contrastText: '#FFDF9B' },
  error: { main: '#FFB4AB' },
  warning: { main: '#EFC148' },
  success: { main: '#8FD98F' },
  background: { default: '#0F1512', paper: '#161D19' },
  surfaceContainerLow: { main: '#161D19', contrastText: '#DFE4DF' },
  surfaceContainer: { main: '#1B221E', contrastText: '#DFE4DF' },
  surfaceContainerHigh: { main: '#252D28', contrastText: '#DFE4DF' },
  text: { primary: '#DFE4DF', secondary: '#BFC9C2' },
  divider: '#3F4943',
};

export const theme = createTheme({
  cssVariables: { colorSchemeSelector: 'data-mui-color-scheme' },
  colorSchemes: { light: { palette: light }, dark: { palette: dark } },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: 'var(--font-sans), system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
    h1: { fontSize: '1.75rem', fontWeight: 600, letterSpacing: '-0.01em' },
    h2: { fontSize: '1.375rem', fontWeight: 600 },
    h3: { fontSize: '1.125rem', fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 600, letterSpacing: 0 },
    overline: { textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, fontSize: '0.7rem' },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        // Numbers change constantly in the player; stop them jittering.
        '.tnum': { fontVariantNumeric: 'tabular-nums' },
        body: { overscrollBehaviorY: 'none' },
      },
    },
    MuiButton: {
      defaultProps: { variant: 'contained', disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 999, minHeight: 48, paddingInline: 20 },
        sizeLarge: { minHeight: 56, fontSize: '1rem' },
      },
    },
    MuiCard: { defaultProps: { elevation: 0 }, styleOverrides: { root: { borderRadius: 16 } } },
    MuiChip: { styleOverrides: { root: { fontWeight: 600 } } },
    MuiToggleButton: {
      styleOverrides: { root: { textTransform: 'none', minHeight: 44, borderRadius: 999 } },
    },
    MuiAppBar: { defaultProps: { elevation: 0, color: 'transparent' } },
    // Every tappable list/card row gets a real touch target, not whatever its
    // content happens to need.
    MuiListItemButton: { styleOverrides: { root: { minHeight: 48 } } },
    MuiCardActionArea: { styleOverrides: { root: { minHeight: 48 } } },
  },
});
