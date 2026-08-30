'use client';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Link from 'next/link';
import { useState } from 'react';
import { LineChart } from '@/components/charts/LineChart';
import { getExercise } from '@/core/library/exercises';
import { getE1rmSeries } from '@/server/actions';
import type { E1rmPoint } from '@/server/analytics';

const ANCHORS = [
  { id: 'back-squat', label: 'Back Squat' },
  { id: 'deadlift', label: 'Deadlift' },
  { id: 'bench-press', label: 'Bench Press' },
  { id: 'overhead-press', label: 'Overhead Press' },
] as const;

interface Props {
  initialExerciseId: string;
  initialSeries: E1rmPoint[];
  trainingMaxes: Record<string, number>;
}

export function StrengthTab({ initialExerciseId, initialSeries, trainingMaxes }: Props) {
  const [exerciseId, setExerciseId] = useState(initialExerciseId);
  const [series, setSeries] = useState(initialSeries);
  const [loading, setLoading] = useState(false);

  async function selectLift(id: string) {
    if (id === exerciseId) return;
    setExerciseId(id);
    setLoading(true);
    const result = await getE1rmSeries(id);
    setLoading(false);
    if (result.ok) setSeries(result.data!);
  }

  const first = series[0];
  const last = series[series.length - 1];
  const delta = first && last ? Math.round((last.e1rm - first.e1rm) * 10) / 10 : null;
  const exercise = getExercise(exerciseId);
  const tm = trainingMaxes[exerciseId];

  return (
    <Stack spacing={2}>
      <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', pb: 0.5 }}>
        {ANCHORS.map((a) => (
          <Chip
            key={a.id} label={a.label} size="small"
            color={exerciseId === a.id ? 'primary' : 'default'}
            variant={exerciseId === a.id ? 'filled' : 'outlined'}
            onClick={() => selectLift(a.id)}
          />
        ))}
      </Box>

      <Card variant="outlined" sx={{ p: 2 }}>
        <Typography variant="h3">{exercise.name} — estimated 1RM</Typography>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'baseline', mt: 0.5 }}>
          {/*
            The headline `docs/04-DESIGN-SYSTEM.md` §2 specified and this tab
            never had — the chart below carried the number, but nothing on
            the page said what it currently is without reading the last
            point off the SVG.
          */}
          <Typography variant="displayMedium" className="tnum">
            {last ? `${last.e1rm.toFixed(1)} kg` : '—'}
          </Typography>
          {delta != null && (
            <Typography variant="body2" className="tnum" color={delta >= 0 ? 'success.main' : 'text.secondary'}>
              {delta > 0 ? '+' : ''}{delta} kg over the shown range
            </Typography>
          )}
        </Stack>
        <Box sx={{ mt: 1.5, opacity: loading ? 0.5 : 1 }}>
          <LineChart
            points={series.map((p) => ({ label: p.date, value: p.e1rm, isPr: p.isPr }))}
            formatValue={(v) => v.toFixed(1)}
            unit=" kg"
          />
        </Box>
        {tm && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Current training max: {tm} kg
          </Typography>
        )}
      </Card>

      <Typography variant="body2" color="text.secondary">
        See every set for this lift on its{' '}
        <Box component={Link} href={`/exercises/${exerciseId}`} sx={{ color: 'primary.main' }}>
          exercise page
        </Box>.
      </Typography>
    </Stack>
  );
}
