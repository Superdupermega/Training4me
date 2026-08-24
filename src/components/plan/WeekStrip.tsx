import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

interface Props {
  weeks: number;
  currentWeek: number;
  sessions: { weekNumber: number; status: string; isDeload: boolean }[];
}

export function WeekStrip({ weeks, currentWeek, sessions }: Props) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${weeks}, 1fr)`, gap: 1 }}>
      {Array.from({ length: weeks }, (_, i) => i + 1).map((week) => {
        const inWeek = sessions.filter((s) => s.weekNumber === week);
        const done = inWeek.filter((s) => s.status === 'completed').length;
        const isCurrent = week === currentWeek;
        const isDeload = inWeek[0]?.isDeload ?? false;
        return (
          <Box
            key={week}
            sx={{
              borderRadius: 2, py: 1, textAlign: 'center',
              bgcolor: isCurrent ? 'primary.main' : 'action.hover',
              color: isCurrent ? 'primary.contrastText' : 'text.secondary',
              border: 1, borderColor: isCurrent ? 'primary.main' : 'divider',
            }}
          >
            <Typography variant="overline" sx={{ display: 'block', lineHeight: 1.4 }}>
              {isDeload ? 'Easy' : `W${week}`}
            </Typography>
            <Typography variant="caption" className="tnum">
              {done}/{inWeek.length}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}
