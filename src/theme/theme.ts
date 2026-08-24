'use client';
import { createTheme } from '@mui/material/styles';

// Material 3 roles generated from a deep green source colour. Calm, not hype.
const light = {
  primary: { main: '#1E5F4B', contrastText: '#FFFFFF' },
  secondary: { main: '#4C6358', contrastText: '#FFFFFF' },
  error: { main: '#BA1A1A' },
  warning: { main: '#7A5900' },
  success: { main: '#2E6B34' },
  background: { default: '#F6FBF6', paper: '#FFFFFF' },
  text: { primary: '#171D19', secondary: '#3F4943' },
  divider: '#BFC9C2',
};

const dark = {
  primary: { main: '#7EDBB4', contrastText: '#00382A' },
  secondary: { main: '#B3CCBF', contrastText: '#1E352B' },
  error: { main: '#FFB4AB' },
  warning: { main: '#EFC148' },
  success: { main: '#8FD98F' },
  background: { default: '#0F1512', paper: '#161D19' },
  text: { primary: '#DFE4DF', secondary: '#BFC9C2' },
  divider: '#3F4943',
};

export const CONTAINER = {
  light: { primary: '#A6F2CD', onPrimary: '#002014', surface: '#ECF2ED', surfaceHigh: '#E1E9E3' },
  dark: { primary: '#00513C', onPrimary: '#A6F2CD', surface: '#1B221E', surfaceHigh: '#252D28' },
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
  },
});
