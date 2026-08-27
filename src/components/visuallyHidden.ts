import type { SxProps, Theme } from '@mui/material/styles';

/**
 * Hide an element from sight while leaving it in the accessibility tree.
 *
 * The trap this exists to close: in MUI's `sx`, a **unitless** value for
 * `width`/`height` is a *fraction*, not pixels — `width: 1` compiles to
 * `width: 100%`. Every sr-only block in this app used to be written
 * `sx={{ position: 'absolute', width: 1, height: 1, … }}`, which made each
 * one a 100% × 100% absolutely-positioned box measured against the initial
 * containing block. `clip` kept them invisible and un-clickable, so nothing
 * looked wrong — but they still counted towards the document's scroll
 * extents. On `/profile` at 1440 × 900 the chart's hidden data table alone
 * pushed the document to 1577 × 1581: a horizontal scrollbar on a page
 * whose visible content was *narrower* than the window, plus ~640px of dead
 * space under the fold. See the design review, finding #02.
 *
 * `clipPath` is the current property; `clip` is deprecated but kept for
 * older engines, and the two agree.
 */
export const visuallyHidden = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  margin: '-1px',
  padding: 0,
  border: 0,
  overflow: 'hidden',
  whiteSpace: 'nowrap',
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
} as const satisfies SxProps<Theme>;
