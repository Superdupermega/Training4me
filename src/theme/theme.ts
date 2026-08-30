'use client';
import { createTheme } from '@mui/material/styles';
import type { PaletteColor, PaletteColorOptions } from '@mui/material/styles';
import type { CSSProperties } from 'react';

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

// Three display sizes M3 also has and MUI's default `h1`-capped scale does
// not: numbers meant to be read from across a room, not a paragraph heading.
// `docs/04-DESIGN-SYSTEM.md` §2 specified `displaySmall` for the current
// weight ("must read from 1 m away") and it was never built — `h1` topped
// out at 1.75rem, smaller than the body copy of a phone OS's own clock.
// Same augmentation pattern as the palette extension above: both the
// `TypographyVariants` / `TypographyVariantsOptions` pair (so `theme.ts` and
// callers typecheck) and `TypographyPropsVariantOverrides` (so
// `<Typography variant="displayLarge">` typechecks).
declare module '@mui/material/styles' {
  interface TypographyVariants {
    displayLarge: CSSProperties;
    displayMedium: CSSProperties;
    displaySmall: CSSProperties;
  }
  interface TypographyVariantsOptions {
    displayLarge?: CSSProperties;
    displayMedium?: CSSProperties;
    displaySmall?: CSSProperties;
  }
}
declare module '@mui/material/Typography' {
  interface TypographyPropsVariantOverrides {
    displayLarge: true;
    displayMedium: true;
    displaySmall: true;
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

// A card that just draws a 1px border and nothing else reads as a spreadsheet,
// not a product — real UI gives every surface a little lift off the page.
// Deliberately restrained (a phone-camera "premium" look is *softer* shadows,
// not bigger ones) and black-based rather than tinted to the palette, so it
// keeps working — quietly — over both the light and dark background.
const CARD_SHADOW = '0 1px 2px rgba(15, 23, 19, 0.06), 0 4px 12px -4px rgba(15, 23, 19, 0.10)';
const CARD_SHADOW_HOVER = '0 2px 4px rgba(15, 23, 19, 0.08), 0 8px 20px -6px rgba(15, 23, 19, 0.16)';

export const theme = createTheme({
  cssVariables: { colorSchemeSelector: 'data-mui-color-scheme' },
  colorSchemes: { light: { palette: light }, dark: { palette: dark } },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: 'var(--font-sans), system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
    h1: { fontSize: '1.75rem', fontWeight: 600, letterSpacing: '-0.01em' },
    h2: { fontSize: '1.375rem', fontWeight: 600 },
    h3: { fontSize: '1.125rem', fontWeight: 600 },
    // The numbers you read mid-set, from arm's length or further: the rest
    // countdown, the weight you are about to load, the running clock, an
    // e1RM headline. See the file-level comment above.
    displayLarge: { fontSize: '3rem', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.05 },
    displayMedium: { fontSize: '2.25rem', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.1 },
    displaySmall: { fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.15 },
    button: { textTransform: 'none', fontWeight: 600, letterSpacing: 0 },
    overline: { textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, fontSize: '0.7rem' },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        // Numbers change constantly in the player; stop them jittering.
        '.tnum': { fontVariantNumeric: 'tabular-nums' },
        body: { overscrollBehaviorY: 'none' },
        // Named globally, the same way `.tnum` is, rather than generated
        // per-component with `@emotion/react`'s `keyframes()` — that helper
        // only registers its `@keyframes` rule when the result is threaded
        // through emotion's own `css`/`styled` serializer; interpolated into
        // a plain inline `style` object (`SetRow`'s drawn check) it produces
        // nothing but an unregistered animation name that never animates. A
        // literal name declared once here and referenced as a plain string
        // has no such trap. Flattened automatically under
        // `prefers-reduced-motion` by `Providers.tsx`'s global override — no
        // second guard needed at either call site (rule 5).
        '@keyframes flashRow': {
          from: { backgroundColor: 'var(--mui-palette-primaryContainer-main)' },
          to: { backgroundColor: 'var(--mui-palette-action-hover)' },
        },
        '@keyframes drawCheck': {
          from: { strokeDashoffset: 1 },
          to: { strokeDashoffset: 0 },
        },
      },
    },
    MuiButton: {
      defaultProps: { variant: 'contained', disableElevation: true },
      styleOverrides: {
        root: ({ ownerState }) => ({
          borderRadius: 999, minHeight: 48, paddingInline: 20,
          transition: 'transform 120ms ease, box-shadow 120ms ease, filter 120ms ease',
          '&:active': { transform: 'scale(0.98)' },
          // Only the filled (contained) variant gets a hover lift — outlined
          // and text buttons stay flat, so the one button per screen that is
          // actually the primary action is the one that visibly responds.
          ...(ownerState.variant === 'contained' && {
            '&:hover': { boxShadow: CARD_SHADOW, filter: 'brightness(1.04)' },
          }),
        }),
        sizeLarge: { minHeight: 56, fontSize: '1rem' },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          borderRadius: 16, boxShadow: CARD_SHADOW,
          transition: 'box-shadow 160ms ease',
          // Lift the whole card, not just the tappable sub-area inside it —
          // most cards in this app are a CardActionArea plus a side control
          // (a delete icon, move arrows), so the hover feedback should read
          // as "this card is interactive", not "this odd-shaped slice is".
          '&:has(.MuiCardActionArea-root:hover)': { boxShadow: CARD_SHADOW_HOVER },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 600 },
        // Default MUI grey reads as an un-styled fallback; give it the M3
        // tonal surface instead — but only for a plain, colourless chip.
        // `color="warning"`/`"info"`/`"primary"` etc. (deload/queued/filter
        // pills) must keep their real semantic fill, so this only fires for
        // the untouched `color="default"` case.
        filled: ({ theme: t, ownerState }) => (
          // `theme.palette.x.main` is baked to one scheme's literal colour at
          // stylesheet-generation time; `theme.vars.palette.x.main` is the
          // live `var(--mui-palette-x-main)` reference that actually swaps
          // with `data-mui-color-scheme` — the difference between this chip
          // going invisible in dark mode and not.
          ownerState.color === 'default' ? { backgroundColor: t.vars.palette.surfaceContainerHigh.main } : {}
        ),
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        // Shape only used to be set here, which left `Mui-selected` on MUI's
        // default `action.selected` grey — the one place in the app where
        // "selected" wasn't the green used by the nav pill, the week strip
        // and the filter chips. In dark mode that grey also lands *dimmer*
        // than the unselected siblings next to it, so the chosen option read
        // as the disabled one. Use the tonal secondary container instead: it
        // is defined for both schemes and stays lighter than its neighbours
        // in each.
        root: ({ theme: t }) => ({
          textTransform: 'none', minHeight: 44, borderRadius: 999,
          '&.Mui-selected': {
            backgroundColor: t.vars.palette.secondaryContainer.main,
            color: t.vars.palette.secondaryContainer.contrastText,
            fontWeight: 700,
            // Without this the selected button reverts to the grey hover
            // fill the moment a pointer touches it.
            '&:hover': { backgroundColor: t.vars.palette.secondaryContainer.main },
          },
        }),
      },
    },
    MuiAppBar: { defaultProps: { elevation: 0, color: 'transparent' } },
    // Every tappable list/card row gets a real touch target, not whatever its
    // content happens to need.
    MuiListItemButton: { styleOverrides: { root: { minHeight: 48 } } },
    MuiCardActionArea: {
      styleOverrides: {
        root: {
          minHeight: 48,
          '& .MuiCardActionArea-focusHighlight': { transition: 'opacity 160ms ease' },
        },
      },
    },
    MuiDialog: { styleOverrides: { paper: { borderRadius: 20 } } },
  },
});
