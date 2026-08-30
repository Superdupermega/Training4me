import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { PageContainer } from '@/components/PageContainer';
import { getExercise } from '@/core/library/exercises';
import { buildBlockRetrospective } from '@/core/progression/retrospective';
import { getLogsForProgram, getProgram, listPRs, listSessions } from '@/server/repo';

export const dynamic = 'force-dynamic';

const KIND_LABEL: Record<string, string> = {
  e1rm: 'Estimated 1RM', rep_max_3: 'Best triple', rep_max_5: 'Best five', best_set: 'Best set',
};

/**
 * The block retrospective — docs/chunks/chunk-23-reward-loop.md §1, finding
 * #4. "All the data for a retrospective already exists" was true: this page
 * assembles it (`buildBlockRetrospective`, `src/core`) rather than computing
 * anything new. Shape 2 from the brief's own two options: recomputed here
 * from the just-completed program by id, not threaded through component
 * state from `startNextBlock`'s result — a retrospective that vanished on
 * refresh would be the same non-event this page exists to fix.
 */
export default async function ProgramCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ programId?: string }>;
}) {
  const { programId } = await searchParams;
  if (!programId) notFound();
  const program = await getProgram(programId);
  if (!program) notFound();

  const [sessions, logs, prs] = await Promise.all([
    listSessions(programId), getLogsForProgram(programId), listPRs(),
  ]);

  const retro = buildBlockRetrospective({
    sessions: sessions.map((s) => ({
      id: s.id, weekNumber: s.weekNumber, status: s.status, isDeload: s.isDeload,
      mainPattern: s.mainPattern,
      blocks: s.blocks.map((b) => ({
        kind: b.kind,
        exercises: b.exercises.map((e) => ({
          exerciseId: e.exerciseId, sets: e.sets.map((set) => ({ kind: set.kind })),
        })),
      })),
    })),
    loggedSets: logs.map((l) => ({
      sessionId: l.session_id as string, exerciseId: l.exercise_id as string,
      reps: l.reps as number | null,
      weightKg: l.weight_kg != null ? Number(l.weight_kg) : null,
      skipped: Boolean(l.skipped),
    })),
    prs: prs.map((p) => ({
      exerciseId: p.exercise_id, kind: p.kind, value: Number(p.value), reps: p.reps,
      weightKg: p.weight_kg != null ? Number(p.weight_kg) : null,
      achievedAt: p.achieved_at, sessionId: p.session_id,
    })),
    // `null` until `startNextBlock` actually runs — there is no roll-over
    // decision to show before that, and recomputing one here (rather than
    // reading what actually happened) risks disagreeing with it once one
    // does exist. See DECISIONS.md.
    tmChanges: program.tmChanges ?? [],
  });

  const adherencePct = Math.round(retro.adherence * 100);

  return (
    <AppShell title={program.name} backHref="/today">
      <PageContainer>
        <Stack spacing={2.5}>
          <Box>
            <Typography variant="overline" color="text.secondary">Block finished</Typography>
            <Typography variant="displayMedium" className="tnum">
              {retro.tonnageKg.toLocaleString()} kg
            </Typography>
            <Typography color="text.secondary">total tonnage lifted</Typography>
          </Box>

          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
            <Chip className="tnum" label={`${retro.setsLogged}/${retro.setsPlanned} sets logged`} />
            <Chip className="tnum" label={`${retro.sessionsCompleted}/${retro.sessionsTotal} sessions done`} />
            <Chip className="tnum" color={adherencePct >= 80 ? 'primary' : 'default'} label={`${adherencePct}% adherence`} />
            {retro.sessionsSkipped > 0 && (
              <Chip className="tnum" color="warning" label={`${retro.sessionsSkipped} skipped`} />
            )}
          </Stack>

          {retro.prs.length > 0 && (
            <Box>
              <Typography variant="overline" color="text.secondary">PRs this block</Typography>
              <Card variant="outlined" sx={{ mt: 1 }}>
                {retro.prs.map((pr, i) => (
                  <Box key={`${pr.exerciseId}-${pr.kind}-${pr.achievedAt}`}>
                    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', p: 2 }}>
                      <EmojiEventsIcon sx={{ color: 'tertiary.main' }} />
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="h3">{getExercise(pr.exerciseId).name}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {KIND_LABEL[pr.kind] ?? pr.kind}
                        </Typography>
                      </Box>
                      <Typography variant="h3" className="tnum" sx={{ color: 'tertiary.main' }}>
                        {pr.value.toFixed(1).replace(/\.0$/, '')} kg
                      </Typography>
                    </Stack>
                    {i < retro.prs.length - 1 && <Divider />}
                  </Box>
                ))}
              </Card>
            </Box>
          )}

          {retro.peakWeekTopSets.length > 0 && (
            <Box>
              <Typography variant="overline" color="text.secondary">Peak week top sets</Typography>
              <Card variant="outlined" sx={{ mt: 1 }}>
                {retro.peakWeekTopSets.map((s, i) => (
                  <Box key={s.exerciseId}>
                    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', p: 2 }}>
                      <Typography variant="h3" sx={{ flex: 1 }}>{getExercise(s.exerciseId).name}</Typography>
                      <Typography className="tnum" color="text.secondary">
                        {s.weightKg != null ? `${s.weightKg} kg` : '—'}{s.reps ? ` × ${s.reps}` : ''}
                      </Typography>
                    </Stack>
                    {i < retro.peakWeekTopSets.length - 1 && <Divider />}
                  </Box>
                ))}
              </Card>
            </Box>
          )}

          <Box>
            <Typography variant="overline" color="text.secondary">Training maxes</Typography>
            {(() => {
              const tmChanges = program.tmChanges;
              if (tmChanges == null) {
                return (
                  <Typography color="text.secondary" sx={{ mt: 1 }}>
                    Not decided yet — training maxes move when you start the next block.
                  </Typography>
                );
              }
              if (tmChanges.length === 0) {
                return <Typography color="text.secondary" sx={{ mt: 1 }}>Nothing moved this block.</Typography>;
              }
              return (
                <Card variant="outlined" sx={{ mt: 1 }}>
                  {tmChanges.map((c, i) => (
                    <Box key={c.exerciseId}>
                      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', p: 2 }}>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="h3">{getExercise(c.exerciseId).name}</Typography>
                          <Typography variant="body2" color="text.secondary">{c.reason}</Typography>
                        </Box>
                        <Typography className="tnum" color={c.to > c.from ? 'success.main' : c.to < c.from ? 'error.main' : 'text.secondary'}>
                          {c.from} → {c.to} kg
                        </Typography>
                      </Stack>
                      {i < tmChanges.length - 1 && <Divider />}
                    </Box>
                  ))}
                </Card>
              );
            })()}
          </Box>
        </Stack>
      </PageContainer>
    </AppShell>
  );
}
