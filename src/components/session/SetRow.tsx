'use client';
import CheckIcon from '@mui/icons-material/Check';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { formatWeight } from '@/components/format';
import { PAIN_AREAS, type PainArea, type PrescribedSet } from '@/core/types';

export interface LoggedValue {
  reps?: number;
  weightKg?: number;
  rpe?: number;
  distanceM?: number;
  durationSec?: number;
  skipped?: boolean;
  painFlag?: PainArea | null;
}

interface Props {
  set: PrescribedSet;
  logged: LoggedValue | undefined;
  increment: number;
  expanded: boolean;
  onExpand: () => void;
  onComplete: (value: LoggedValue) => void;
}

const PAIN_LABEL: Record<PainArea, string> = {
  knee: 'Knee', shoulder: 'Shoulder', lower_back: 'Lower back',
  elbow: 'Elbow', hip: 'Hip', wrist: 'Wrist',
};

export function SetRow({ set, logged, increment, expanded, onExpand, onComplete }: Props) {
  const [reps, setReps] = useState(logged?.reps ?? set.reps ?? 0);
  const [weight, setWeight] = useState(logged?.weightKg ?? set.weightKg ?? 0);
  const [rpe, setRpe] = useState<number | undefined>(logged?.rpe ?? undefined);
  const [pain, setPain] = useState<PainArea | ''>(logged?.painFlag ?? '');

  const done = Boolean(logged);
  const isRamp = set.kind === 'ramp';
  const target = set.distanceM
    ? `${set.distanceM} m`
    : set.durationSec
      ? `${Math.round(set.durationSec / 60)} min`
      : `${set.reps}${set.perSide ? '/side' : ''} reps`;

  const submit = () =>
    onComplete({
      reps: set.distanceM || set.durationSec ? undefined : reps,
      weightKg: weight || undefined,
      rpe,
      distanceM: set.distanceM,
      durationSec: set.durationSec,
      painFlag: pain || null,
    });

  return (
    <Box
      sx={{
        borderTop: 1, borderColor: 'divider',
        bgcolor: done ? 'action.hover' : undefined,
        opacity: isRamp && !done ? 0.75 : 1,
      }}
    >
      <Stack
        direction="row" spacing={1.5}
        sx={{ alignItems: 'center', px: 2, py: 1.25, cursor: 'pointer' }}
        onClick={onExpand}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onExpand(); } }}
        aria-expanded={expanded}
      >
        <Typography variant="overline" color="text.secondary" sx={{ minWidth: 44 }}>
          {isRamp ? 'Ramp' : `Set ${set.setNumber}`}
        </Typography>
        <Typography className="tnum" sx={{ flex: 1, fontWeight: done ? 400 : 600 }}>
          {target}{set.weightKg ? ` · ${formatWeight(set.weightKg)}` : ''}
          {set.rpe && !set.weightKg ? ` · RPE ${set.rpe}` : ''}
        </Typography>
        {done ? (
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Typography variant="body2" color="text.secondary" className="tnum">
              {logged?.reps ?? ''}{logged?.weightKg ? ` × ${formatWeight(logged.weightKg)}` : ''}
              {logged?.rpe ? ` @${logged.rpe}` : ''}
            </Typography>
            <CheckIcon color="primary" fontSize="small" />
          </Stack>
        ) : (
          <IconButton
            aria-label={`Complete set ${set.setNumber}`}
            onClick={(e) => { e.stopPropagation(); submit(); }}
            sx={{ width: 56, height: 56, bgcolor: 'action.selected' }}
          >
            <CheckIcon />
          </IconButton>
        )}
      </Stack>

      <Collapse in={expanded} unmountOnExit>
        <Stack spacing={2} sx={{ px: 2, pb: 2 }}>
          {!set.distanceM && !set.durationSec && (
            <Stack direction="row" spacing={2}>
              <Stepper label="Reps" value={reps} step={1} onChange={setReps} />
              <Stepper label="Weight (kg)" value={weight} step={increment} onChange={setWeight} />
            </Stack>
          )}
          <Box>
            <Typography variant="overline" color="text.secondary">How hard was it?</Typography>
            <ToggleButtonGroup
              exclusive size="small" value={rpe ?? null} sx={{ flexWrap: 'wrap', mt: 0.5 }}
              onChange={(_, value) => setRpe(value ?? undefined)}
            >
              {[6, 7, 7.5, 8, 8.5, 9, 9.5, 10].map((value) => (
                <ToggleButton key={value} value={value} aria-label={`RPE ${value}`}>{value}</ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>
          <TextField
            select size="small" label="Anything hurt?" value={pain}
            onChange={(e) => setPain(e.target.value as PainArea | '')}
          >
            <MenuItem value="">No</MenuItem>
            {PAIN_AREAS.map((area) => (
              <MenuItem key={area} value={area}>{PAIN_LABEL[area]}</MenuItem>
            ))}
          </TextField>
          <Button onClick={submit} size="large" fullWidth>Log set</Button>
        </Stack>
      </Collapse>
    </Box>
  );
}

function Stepper({
  label, value, step, onChange,
}: { label: string; value: number; step: number; onChange: (v: number) => void }) {
  return (
    <Box sx={{ flex: 1 }}>
      <Typography variant="overline" color="text.secondary">{label}</Typography>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mt: 0.5 }}>
        <Button
          variant="outlined" sx={{ minWidth: 48, px: 0 }} aria-label={`Decrease ${label}`}
          onClick={() => onChange(Math.max(0, Math.round((value - step) * 100) / 100))}
        >−</Button>
        <Typography className="tnum" sx={{ flex: 1, textAlign: 'center', fontSize: '1.4rem', fontWeight: 700 }}>
          {value}
        </Typography>
        <Button
          variant="outlined" sx={{ minWidth: 48, px: 0 }} aria-label={`Increase ${label}`}
          onClick={() => onChange(Math.round((value + step) * 100) / 100)}
        >+</Button>
      </Stack>
    </Box>
  );
}
