import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { PageContainer } from '@/components/PageContainer';
import { ExerciseContextPanel } from '@/components/exercises/ExerciseContext';
import { STYLE_LABEL, TIER_LABEL } from '@/components/exercises/labels';
import { PatternGlyph } from '@/components/exercises/patternGlyphs';
import { EQUIPMENT_LABEL } from '@/core/library/equipment';
import { BY_ID, getExercise } from '@/core/library/exercises';
import { GROUP_LABEL, MUSCLE_LABEL } from '@/core/library/muscles';
import { browseGroupsFor } from '@/core/library/query';
import { exerciseContext } from '@/server/exerciseContext';
import { historyForExercise } from '@/server/repo';

export const dynamic = 'force-dynamic';

function formatLog(log: { reps: number | null; weight_kg: unknown; rpe: unknown; distance_m: number | null; duration_sec: number | null }): string {
  if (log.distance_m) return `${log.distance_m} m`;
  if (log.duration_sec) return `${Math.round(log.duration_sec / 60)} min`;
  const parts = [log.reps != null ? `${log.reps} reps` : null, log.weight_kg != null ? `${Number(log.weight_kg)} kg` : null];
  const line = parts.filter(Boolean).join(' × ');
  return log.rpe != null ? `${line} @${Number(log.rpe)}` : line;
}

export default async function ExerciseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!BY_ID.has(id)) notFound();
  const ex = getExercise(id);
  const groups = browseGroupsFor(ex);
  const [history, contexts] = await Promise.all([historyForExercise(id), exerciseContext([id])]);
  const context = contexts[id];

  return (
    <AppShell title={ex.name} backHref="/exercises">
      <PageContainer>
        <Stack spacing={2.5}>
          <Box>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
              <PatternGlyph pattern={ex.pattern} size={32} />
              <Typography variant="h1">{ex.name}</Typography>
            </Stack>
            <Typography color="text.secondary">{ex.nameSv}</Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: 'wrap', gap: 1 }}>
              <Chip size="small" label={TIER_LABEL[ex.tier] ?? ex.tier} />
              <Chip size="small" variant="outlined" label={ex.mechanic === 'isolation' ? 'Isolation' : 'Compound'} />
              {ex.unilateral && <Chip size="small" variant="outlined" label="Unilateral" />}
              {ex.skillGated && <Chip size="small" color="warning" variant="outlined" label="Needs coaching" />}
              {ex.styles.map((s) => (
                <Chip key={s} size="small" color="primary" variant="outlined" label={STYLE_LABEL[s] ?? s} />
              ))}
            </Stack>
          </Box>

          <Box>
            <Typography variant="overline" color="text.secondary">Muscles</Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap', gap: 1 }}>
              {ex.primaryMuscles.map((m) => (
                <Chip key={m} size="small" label={MUSCLE_LABEL[m]} />
              ))}
              {ex.secondaryMuscles.map((m) => (
                <Chip key={m} size="small" variant="outlined" label={MUSCLE_LABEL[m]} />
              ))}
            </Stack>
            {groups.length > 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Filed under: {groups.map((g) => GROUP_LABEL[g]).join(', ')}
              </Typography>
            )}
          </Box>

          <Card variant="outlined" sx={{ p: 2 }}>
            <Typography variant="overline" color="text.secondary">Cue</Typography>
            <Typography sx={{ mt: 0.5 }}>{ex.cue}</Typography>
            {ex.howTo && (
              <Typography component="ol" sx={{ mt: 1.5, pl: 3, m: 0, '& li': { mb: 0.5 } }}>
                {ex.howTo.map((step, i) => <li key={i}>{step}</li>)}
              </Typography>
            )}
          </Card>

          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
            {ex.equipment.map((eq) => (
              <Chip key={eq} size="small" variant="outlined" label={EQUIPMENT_LABEL[eq]} />
            ))}
          </Stack>

          <Card variant="outlined" sx={{ p: 2 }}>
            <Typography variant="overline" color="text.secondary">Your numbers</Typography>
            <Box sx={{ mt: 1 }}>
              <ExerciseContextPanel context={context} />
            </Box>
            {context?.best && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                Best estimated 1RM: {context.best.e1rm} kg (from {context.best.weightKg} kg × {context.best.reps}
                {' '}on {context.best.date})
              </Typography>
            )}
          </Card>

          <Box>
            <Typography variant="overline" color="text.secondary">History</Typography>
            {history.length === 0 ? (
              <Typography color="text.secondary" sx={{ mt: 1 }}>
                Nothing logged yet — the first session with this exercise sets the baseline.
              </Typography>
            ) : (
              <Card variant="outlined" sx={{ mt: 1 }}>
                {history.slice(0, 30).map((log, i) => (
                  <Box key={log.id}>
                    <Stack direction="row" spacing={2} sx={{ alignItems: 'center', p: 2 }}>
                      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 90 }}>
                        {String(log.created_at).slice(0, 10)}
                      </Typography>
                      <Typography className="tnum" sx={{ flex: 1 }}>{formatLog(log)}</Typography>
                    </Stack>
                    {i < Math.min(history.length, 30) - 1 && <Divider />}
                  </Box>
                ))}
              </Card>
            )}
          </Box>

          {ex.alternatives.length > 0 && (
            <Box>
              <Typography variant="overline" color="text.secondary">Alternatives</Typography>
              <Card variant="outlined" sx={{ mt: 1 }}>
                {ex.alternatives.filter((altId) => BY_ID.has(altId)).map((altId, i, arr) => {
                  const alt = getExercise(altId);
                  return (
                    <Box key={altId}>
                      <ListItemButton component={Link} href={`/exercises/${altId}`} sx={{ py: 1.25, px: 2, gap: 1.5 }}>
                        <PatternGlyph pattern={alt.pattern} />
                        <ListItemText primary={alt.name} secondary={alt.nameSv} />
                      </ListItemButton>
                      {i < arr.length - 1 && <Divider />}
                    </Box>
                  );
                })}
              </Card>
            </Box>
          )}
        </Stack>
      </PageContainer>
    </AppShell>
  );
}
