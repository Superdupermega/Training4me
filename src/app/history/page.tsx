import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { PageContainer } from '@/components/PageContainer';
import { WEEKDAY } from '@/components/format';
import { getExercise } from '@/core/library/exercises';
import { readinessBand } from '@/core/progression/readiness';
import { listPRs, recentSessions } from '@/server/repo';

export const dynamic = 'force-dynamic';

const KIND_LABEL: Record<string, string> = {
  e1rm: 'Estimated 1RM', rep_max_3: 'Best triple', rep_max_5: 'Best five', best_set: 'Best set',
};

const PAGE_SIZE = 40;
const PR_PREVIEW = 12;

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ before?: string; allPrs?: string }>;
}) {
  const { before, allPrs } = await searchParams;
  const [sessions, prs] = await Promise.all([recentSessions(PAGE_SIZE, before), listPRs()]);

  // A full page came back, so there may be more before the oldest row shown
  // — recentSessions' own `before` cursor is what makes anything past the
  // 40th-most-recent session reachable at all (docs/07-PRODUCTION-REVIEW.md
  // #13); previously it was simply never shown again, ever, though the rows
  // stayed in the database the whole time.
  const oldestShown = sessions[sessions.length - 1]?.scheduledDate;
  const hasMore = sessions.length === PAGE_SIZE && Boolean(oldestShown);
  const showAllPrs = allPrs === '1';
  const visiblePrs = showAllPrs ? prs : prs.slice(0, PR_PREVIEW);

  return (
    <AppShell title="History">
      <PageContainer width="wide">
        <Box>
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Typography variant="overline" color="text.secondary">Personal records</Typography>
            {prs.length > PR_PREVIEW && (
              <Button
                component={Link} href={showAllPrs ? '/history' : '/history?allPrs=1'}
                size="small" variant="text"
              >
                {showAllPrs ? 'Show fewer' : `See all ${prs.length}`}
              </Button>
            )}
          </Stack>
          {prs.length === 0 ? (
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              Nothing yet. Log a few loaded sets and records will appear here on their own.
            </Typography>
          ) : (
            <Card variant="outlined" sx={{ mt: 1 }}>
              {visiblePrs.map((pr, i) => (
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
                  {i < visiblePrs.length - 1 && <Divider />}
                </Box>
              ))}
            </Card>
          )}
        </Box>

        <Box>
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Typography variant="overline" color="text.secondary">Sessions</Typography>
            {before && (
              <Button component={Link} href="/history" size="small" variant="text">
                Back to most recent
              </Button>
            )}
          </Stack>
          {sessions.length === 0 ? (
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              {before ? 'Nothing further back than this.' : 'No finished sessions yet. Your first one shows up here.'}
            </Typography>
          ) : (
            <Card variant="outlined" sx={{ mt: 1 }}>
              {sessions.map((session, i) => {
                const readiness = session.readiness
                  ? readinessBand(session.readiness.sleep + session.readiness.soreness + session.readiness.stress)
                  : null;
                return (
                  <Box key={session.id}>
                    <CardActionArea component={Link} href={`/session/${session.id}`} sx={{ p: 2 }}>
                      <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
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
                    </CardActionArea>
                    {i < sessions.length - 1 && <Divider />}
                  </Box>
                );
              })}
            </Card>
          )}
          {hasMore && (
            <Button
              component={Link} href={`/history?before=${oldestShown}`}
              fullWidth variant="outlined" sx={{ mt: 1.5 }}
            >
              Load older sessions
            </Button>
          )}
        </Box>
      </PageContainer>
    </AppShell>
  );
}
