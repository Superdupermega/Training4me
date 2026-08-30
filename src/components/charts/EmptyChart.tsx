import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

/**
 * A muted, abstract glyph — a rising line with two points on it, nothing
 * more specific than that. One shape shared by every chart's empty state
 * (a line chart, a bar chart, a heatmap, the body map all show the same
 * one) rather than a different pictogram per chart type, matching
 * docs/chunks/chunk-24-craft.md §4's own instruction: no characters, no
 * mascots, just enough shape that a blank rectangle doesn't read as broken.
 */
function EmptyGlyph() {
  return (
    <Box component="svg" viewBox="0 0 48 48" width={48} height={48} aria-hidden sx={{ opacity: 0.4 }}>
      <path
        d="M6 34 L18 20 L28 28 L42 10" fill="none" stroke="currentColor"
        strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
      />
      <circle cx={18} cy={20} r={2.5} fill="currentColor" />
      <circle cx={28} cy={28} r={2.5} fill="currentColor" />
    </Box>
  );
}

/**
 * Every chart in `/profile` renders one of these below a certain number of
 * points rather than an empty axis — `t4m_logged_set` starts at zero rows
 * for a fresh account, and an unlabelled blank rectangle reads as broken,
 * not "nothing yet" (docs/06-REDESIGN-PLAN.md chunk 20 §4). The copy stays
 * exactly what each caller passes — it is specific and it is good; only the
 * glyph above it is new.
 */
export function EmptyChart({ message, height = 160 }: { message: string; height?: number }) {
  return (
    <Box
      sx={{
        height, display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', px: 3, borderRadius: 2, bgcolor: 'action.hover', color: 'text.secondary',
      }}
    >
      <EmptyGlyph />
      <Typography variant="body2" color="text.secondary">{message}</Typography>
    </Box>
  );
}
