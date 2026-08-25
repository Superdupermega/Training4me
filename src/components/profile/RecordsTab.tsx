'use client';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useMemo, useState } from 'react';
import { getExercise } from '@/core/library/exercises';
import { GROUP_LABEL, MUSCLE_GROUPS, type MuscleGroup } from '@/core/library/muscles';
import { browseGroupsFor } from '@/core/library/query';
import type { Pr } from '@/server/repo';

const KIND_LABEL: Record<string, string> = {
  e1rm: 'Estimated 1RM', rep_max_3: 'Best triple', rep_max_5: 'Best five', best_set: 'Best set',
};

interface Props {
  prs: Pr[];
  trainingMaxes: Record<string, number>;
}

export function RecordsTab({ prs, trainingMaxes }: Props) {
  const [group, setGroup] = useState<MuscleGroup | null>(null);
  const usedGroups = useMemo(() => {
    const present = new Set<MuscleGroup>();
    for (const pr of prs) for (const g of browseGroupsFor(getExercise(pr.exercise_id))) present.add(g);
    return MUSCLE_GROUPS.filter((g) => present.has(g));
  }, [prs]);

  const filtered = group ? prs.filter((pr) => browseGroupsFor(getExercise(pr.exercise_id)).includes(group)) : prs;
  const maxEntries = Object.entries(trainingMaxes);

  return (
    <Stack spacing={2}>
      {usedGroups.length > 1 && (
        <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', pb: 0.5 }}>
          <Chip label="All" size="small" color={group === null ? 'primary' : 'default'} variant={group === null ? 'filled' : 'outlined'} onClick={() => setGroup(null)} />
          {usedGroups.map((g) => (
            <Chip
              key={g} label={GROUP_LABEL[g]} size="small" color={group === g ? 'primary' : 'default'}
              variant={group === g ? 'filled' : 'outlined'} onClick={() => setGroup((prev) => (prev === g ? null : g))}
            />
          ))}
        </Box>
      )}

      <Box>
        <Typography variant="overline" color="text.secondary">Training maxes</Typography>
        <Card variant="outlined" sx={{ mt: 1, p: 2 }}>
          {maxEntries.length === 0 ? (
            <Typography variant="body2" color="text.secondary">None set yet.</Typography>
          ) : (
            <Stack spacing={0.75}>
              {maxEntries.map(([id, value]) => (
                <Stack key={id} direction="row" sx={{ justifyContent: 'space-between' }}>
                  <Typography variant="body2">{getExercise(id).name}</Typography>
                  <Typography variant="body2" className="tnum" sx={{ fontWeight: 600 }}>{value} kg</Typography>
                </Stack>
              ))}
            </Stack>
          )}
        </Card>
      </Box>

      <Box>
        <Typography variant="overline" color="text.secondary">Personal records</Typography>
        {filtered.length === 0 ? (
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            Nothing yet. Log a few loaded sets and records will appear here on their own.
          </Typography>
        ) : (
          <Card variant="outlined" sx={{ mt: 1 }}>
            {filtered.slice(0, 30).map((pr, i) => (
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
                {i < Math.min(filtered.length, 30) - 1 && <Divider />}
              </Box>
            ))}
          </Card>
        )}
      </Box>
    </Stack>
  );
}
