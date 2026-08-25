import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

/**
 * Every chart in `/profile` renders one of these below a certain number of
 * points rather than an empty axis — `t4m_logged_set` starts at zero rows
 * for a fresh account, and an unlabelled blank rectangle reads as broken,
 * not "nothing yet" (docs/06-REDESIGN-PLAN.md chunk 20 §4).
 */
export function EmptyChart({ message, height = 160 }: { message: string; height?: number }) {
  return (
    <Box
      sx={{
        height, display: 'flex', alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', px: 3, borderRadius: 2, bgcolor: 'action.hover',
      }}
    >
      <Typography variant="body2" color="text.secondary">{message}</Typography>
    </Box>
  );
}
