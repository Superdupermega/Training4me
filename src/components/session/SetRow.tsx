'use client';
import CheckIcon from '@mui/icons-material/Check';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { useEffect, useState, type ChangeEvent, type FocusEvent } from 'react';
import { formatWeight } from '@/components/format';
import { formatPlateBreakdown, plateBreakdown, STANDARD_BAR_KG, availablePlatesKg } from '@/core/plates';
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
  /** Show plate math under the weight stepper — only meaningful for a barbell-loaded exercise. */
  barbell?: boolean;
  microPlates?: boolean;
}

const PAIN_LABEL: Record<PainArea, string> = {
  knee: 'Knee', shoulder: 'Shoulder', lower_back: 'Lower back',
  elbow: 'Elbow', hip: 'Hip', wrist: 'Wrist',
};

export function SetRow({
  set, logged, increment, expanded, onExpand, onComplete, barbell = false, microPlates = false,
}: Props) {
  const [reps, setReps] = useState(logged?.reps ?? set.reps ?? 0);
  const [weight, setWeight] = useState(logged?.weightKg ?? set.weightKg ?? 0);
  const [rpe, setRpe] = useState<number | undefined>(logged?.rpe ?? undefined);
  const [pain, setPain] = useState<PainArea | ''>(logged?.painFlag ?? '');

  const done = Boolean(logged);

  // The RPE ≥ 9.5 autoregulation (SessionPlayer) rewrites `set.weightKg` on
  // sets further down the same lift after a very hard one. This row's own
  // `key` never changes, so React never remounts it and the initial
  // useState above would otherwise keep offering the stale, pre-drop
  // weight. Resync from the prescription whenever it changes — but only
  // while the set is still unlogged; once submitted, the row shows what was
  // actually done, not a moving target.
  useEffect(() => {
    if (done) return;
    setReps(set.reps ?? 0);
    setWeight(set.weightKg ?? 0);
  }, [set.reps, set.weightKg, done]);
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

  const plates = barbell && weight > STANDARD_BAR_KG
    ? plateBreakdown(weight, STANDARD_BAR_KG, availablePlatesKg(microPlates))
    : null;

  return (
    <Box
      sx={{
        borderTop: 1, borderColor: 'divider',
        bgcolor: done ? 'action.hover' : undefined,
        opacity: isRamp && !done ? 0.75 : 1,
      }}
    >
      {/*
        Two real, sibling interactive elements — not an IconButton nested
        inside a role="button" row, which broke keyboard and screen-reader
        navigation (a button can't contain another button). ButtonBase
        covers the expand toggle; the completion control is a plain sibling.
      */}
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', pr: 2 }}>
        <ButtonBase
          onClick={onExpand}
          aria-expanded={expanded}
          sx={{ flex: 1, minWidth: 0, justifyContent: 'flex-start', gap: 1.5, px: 2, py: 1.25 }}
        >
          <Typography variant="overline" color="text.secondary" sx={{ minWidth: 44, textAlign: 'left' }}>
            {isRamp ? 'Ramp' : `Set ${set.setNumber}`}
          </Typography>
          <Typography className="tnum" sx={{ flex: 1, textAlign: 'left', fontWeight: done ? 400 : 600 }}>
            {target}{set.weightKg ? ` · ${formatWeight(set.weightKg)}` : ''}
            {set.rpe && !set.weightKg ? ` · RPE ${set.rpe}` : ''}
          </Typography>
        </ButtonBase>
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
            onClick={submit}
            sx={{ width: 56, height: 56, bgcolor: 'action.selected' }}
          >
            <CheckIcon />
          </IconButton>
        )}
      </Stack>

      <Collapse in={expanded} unmountOnExit>
        <Stack spacing={2} sx={{ px: 2, pb: 2 }}>
          {!set.distanceM && !set.durationSec && (
            <Stack spacing={0.5}>
              <Stack direction="row" spacing={2}>
                <Stepper label="Reps" value={reps} step={1} onChange={setReps} />
                <Stepper label="Weight (kg)" value={weight} step={increment} onChange={setWeight} />
              </Stack>
              {plates && (
                <Typography variant="caption" color="text.secondary" className="tnum">
                  {plates.perSide.length === 0
                    ? 'Empty bar'
                    : `${formatPlateBreakdown(plates)} per side`}
                  {!plates.exact && ` (closest at ${formatWeight(plates.totalKg)})`}
                </Typography>
              )}
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
  // A tap-to-edit numeric field, not just +/- buttons — the prescription
  // usually pre-fills the right number, but any real correction (a lighter
  // dumbbell, a different unit, a bodyweight movement you loaded) used to
  // mean tapping "+" as many as 40+ times from zero. Local `text` state
  // (rather than binding the input straight to the numeric `value`) so the
  // field can sit empty mid-edit instead of snapping back to "0" the
  // instant it's cleared — see docs/07-PRODUCTION-REVIEW.md #18.
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);

  const commit = (raw: string) => {
    const next = Number(raw);
    if (raw.trim() !== '' && Number.isFinite(next)) onChange(Math.max(0, next));
    else setText(String(value)); // invalid or empty on blur — snap back to the last real value
  };

  return (
    <Box sx={{ flex: 1 }}>
      <Typography variant="overline" color="text.secondary">{label}</Typography>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mt: 0.5 }}>
        <Button
          variant="outlined" sx={{ minWidth: 48, px: 0 }} aria-label={`Decrease ${label}`}
          onClick={() => onChange(Math.max(0, Math.round((value - step) * 100) / 100))}
        >−</Button>
        <Box
          component="input"
          type="text"
          inputMode="decimal"
          aria-label={label}
          value={text}
          onFocus={(e: FocusEvent<HTMLInputElement>) => e.target.select()}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            const raw = e.target.value;
            setText(raw);
            const next = Number(raw);
            if (raw.trim() !== '' && Number.isFinite(next)) onChange(Math.max(0, next));
          }}
          onBlur={(e: FocusEvent<HTMLInputElement>) => commit(e.target.value)}
          className="tnum"
          sx={{
            flex: 1, minWidth: 0, textAlign: 'center', fontSize: '1.4rem', fontWeight: 700,
            fontFamily: 'inherit', color: 'inherit', border: 'none', outline: 'none',
            background: 'transparent', p: 0,
            '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button': { WebkitAppearance: 'none', m: 0 },
          }}
        />
        <Button
          variant="outlined" sx={{ minWidth: 48, px: 0 }} aria-label={`Increase ${label}`}
          onClick={() => onChange(Math.round((value + step) * 100) / 100)}
        >+</Button>
      </Stack>
    </Box>
  );
}
