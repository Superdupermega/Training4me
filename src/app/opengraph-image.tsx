import { ImageResponse } from 'next/og';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * There was no openGraph/twitter metadata at all, and no generated image —
 * pasting the link anywhere rendered a bare URL. See
 * docs/07-PRODUCTION-REVIEW.md #23. Colours match the app's dark palette
 * (src/theme/theme.ts) and the barbell mark reuses icon.svg's own shapes.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 32,
          background: '#0F1512', color: '#DFE4DF',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <svg width="120" height="120" viewBox="0 0 64 64">
          <rect width="64" height="64" rx="14" fill="#7EDBB4" />
          <g fill="#00382A">
            <rect x="8" y="27" width="6" height="10" rx="2" />
            <rect x="50" y="27" width="6" height="10" rx="2" />
            <rect x="16" y="23" width="7" height="18" rx="2" />
            <rect x="41" y="23" width="7" height="18" rx="2" />
            <rect x="23" y="29.5" width="18" height="5" rx="2.5" />
          </g>
        </svg>
        <div style={{ fontSize: 72, fontWeight: 700, letterSpacing: -1 }}>Training4me</div>
        <div style={{ fontSize: 32, color: '#BFC9C2' }}>Heavy basics, done well, in under an hour.</div>
      </div>
    ),
    { ...size },
  );
}
