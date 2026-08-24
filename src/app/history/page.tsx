import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { AppShell } from '@/components/AppShell';
import { WEEKDAY } from '@/components/format';
import { getExercise } from '@/core/library/exercises';
import { readinessBand } from '@/core/progression/readiness';
import { listPRs, recentSessions } from '@/server/repo';

export const dynamic = 'force-dynamic';

const KIND_LABEL: Record<string, string> = {
  e1rm: 'Estimated 1RM', rep_max_3: 'Best triple', rep_max_5: 'Best five', best_set: 'Best set',
};

export default async function HistoryPage() {
  const [sessions, prs] = await Promise.all([recentSessions(), listPRs()]);

  return (
    <AppShell>
      <Stack spacing={3}>
        <Typography variant="h1">History</Typography>

        <Box>
          <Typography variant="overline" color="text.secondary">Personal records</Typography>
          {prs.length === 0 ? (
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              Nothing yet. Log a few loaded sets and records will appear here on their own.
            </Typography>
          ) : (
            <Card variant="outlined" sx={{ mt: 1 }}>
              {prs.slice(0, 12).map((pr, i) => (
                <Box key={pr.id}>
                  <Stack direction="row" spacing={2} sx={{ alignItems: 'center', p: 2 }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="h3">{getExercise(pr.exercise_id).name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {KIND_LABEL[pr.kind] ?? pr.kind} · {String(pr.achieved_at).slice(0, 10)}
                      </Typography>
                    </Box>
                    <Typography variant="h3" color="primary" className="tnum">
                      {Number(pr.value).toFixed(1).replace(/\.0$/, '')} kg
                    </Typography>
                  </Stack>
                  {i < Math.min(prs.length, 12) - 1 && <Divider />}
                </Box>
              ))}
            </Card>
          )}
        </Box>

        <Box>
          <Typography variant="overline" color="text.secondary">Sessions</Typography>
          {sessions.length === 0 ? (
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              No finished sessions yet. Your first one shows up here.
            </Typography>
          ) : (
            <Card variant="outlined" sx={{ mt: 1 }}>
              {sessions.map((session, i) => {
                const readiness = session.readiness
                  ? readinessBand(session.readiness.sleep + session.readiness.soreness + session.readiness.stress)
                  : null;
                return (
                  <Box key={session.id}>
                    <Stack direction="row" spacing={2} sx={{ alignItems: 'center', p: 2 }}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="h3" noWrap>{session.title}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {WEEKDAY[session.weekday]} {session.scheduledDate}
                          {session.actualSec ? ` · ${Math.round(session.actualSec / 60)} min` : ''}
                        </Typography>
                      </Box>
                      {session.status === 'skipped'
                        ? <Chip size="small" label="Skipped" />
                        : readiness && <Chip size="small" variant="outlined" label={`Readiness ${readiness.score}`} />}
                    </Stack>
                    {i < sessions.length - 1 && <Divider />}
                  </Box>
                );
              })}
            </Card>
          )}
        </Box>
      </Stack>
    </AppShell>
  );
}
