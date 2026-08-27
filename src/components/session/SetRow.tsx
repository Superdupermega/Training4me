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
  /**
   * `Exercise.loadable` — can external load be added to this movement.
   * Drives whether a *timed* set (a carry, a weighted hold) offers a weight
   * field at all; a rep-based set always does.
   */
  loadable?: boolean;
  /**
   * What to seed the weight with when the prescription itself carries none —
   * normally what was actually lifted last time, else what the training max
   * projects. Without it a goblet squat or a farmer's carry starts at 0 and
   * the quick ✓ records no load whatsoever.
   */
  suggestedWeightKg?: number | null;
}

const PAIN_LABEL: Record<PainArea, string> = {
  knee: 'Knee', shoulder: 'Shoulder', lower_back: 'Lower back',
  elbow: 'Elbow', hip: 'Hip', wrist: 'Wrist',
};

export function SetRow({
  set, logged, increment, expanded, onExpand, onComplete, barbell = false, microPlates = false,
  loadable = true, suggestedWeightKg = null,
}: Props) {
  // What this set should start at: what was already logged, else what the
  // plan prescribes, else what history/the training max suggests for this
  // movement. The last of those is the difference between a carry or a
  // goblet squat opening at a usable number and opening at zero.
  const startingWeight = logged?.weightKg ?? set.weightKg ?? suggestedWeightKg ?? 0;
  const [reps, setReps] = useState(logged?.reps ?? set.reps ?? 0);
  const [weight, setWeight] = useState(startingWeight);
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
    // Same fallback chain as the initial state — resyncing to `set.weightKg
    // ?? 0` here would wipe the suggested load back to zero on mount, which
    // is the whole thing this is meant to avoid.
    setWeight(set.weightKg ?? suggestedWeightKg ?? 0);
  }, [set.reps, set.weightKg, suggestedWeightKg, done]);
  const isRamp = set.kind === 'ramp';
  const target = set.distanceM
    ? `${set.distanceM} m${set.perSide ? '/side' : ''}`
    : set.durationSec
      ? `${Math.round(set.durationSec / 60)} min${set.perSide ? '/side' : ''}`
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
              {/* A timed set has no reps, so the weight must not carry a
                  leading "×" — a logged carry would otherwise read
                  "× 32.5 kg". Only join the two when both exist. */}
              {[
                logged?.reps ?? null,
                logged?.weightKg ? formatWeight(logged.weightKg) : null,
              ].filter(Boolean).join(' × ')}
              {logged?.rpe ? ` @${logged.rpe}` : ''}
            </Typography>
            <CheckIcon color="primary" fontSize="small" />
          </Stack>
        ) : (
          // An unlogged set used to render a filled grey circle around a
          // full-size tick, while a *logged* one rendered a small bare tick
          // — the same glyph on both, with the heavier mark on the state
          // that had not happened yet. A column of grey ticks reads as
          // "done, greyed out", which is the opposite of what it means.
          // Empty outlined ring = still to do; the filled primary tick above
          // = done. See the design review, finding #08.
          <IconButton
            aria-label={`Complete set ${set.setNumber}`}
            onClick={submit}
            sx={{
              // 48px is the theme's standard touch target (see
              // MuiListItemButton); the old 56px ring stood taller than the
              // row it sat in once it gained a visible border.
              width: 48, height: 48, flexShrink: 0,
              border: 2, borderColor: 'divider', color: 'transparent',
              '&:hover': { borderColor: 'primary.main', color: 'primary.main' },
              '&:focus-visible': { borderColor: 'primary.main', color: 'primary.main' },
            }}
          >
            <CheckIcon />
          </IconButton>
        )}
      </Stack>

      <Collapse in={expanded} unmountOnExit>
        <Stack spacing={2} sx={{ px: 2, pb: 2 }}>
          {!set.distanceM && !set.durationSec ? (
            <Stack spacing={0.5}>
              {/*
                Stacked on a phone, side by side from `sm` up. Two steppers
                sharing a 390px screen leave 42px for the number, and
                "147.5" needs 59 — so a real working weight was clipped in a
                field you cannot widen. Vertical room is the one thing this
                panel has plenty of.
              */}
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
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
          ) : loadable && (
            // A loaded carry or weighted hold: there are no reps to log, but
            // the load is the entire point of the movement.
            //
            // This used to be gated on `set.weightKg != null` — the weight
            // the *generator* prescribed. It never prescribes one for a
            // carry or a hold, because it cannot know which dumbbell you
            // will pick up. The result was that farmer's carries, front-rack
            // carries, suitcase carries and suitcase holds offered no weight
            // field at all: the one class of movement where the load is the
            // whole prescription was the one you could not record a load
            // for. Gate on whether the *exercise* can be loaded instead, so
            // bikes, stretches and mobility work still correctly show none.
            <Stepper label="Weight (kg)" value={weight} step={increment} onChange={setWeight} />
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
    // `minWidth: 0` is load-bearing, not tidiness. A flex item defaults to
    // `min-width: auto`, i.e. it refuses to shrink below its min-content —
    // and the min-content here is driven by the bare `<input>` below, which
    // with no `size` attribute reports its default 20-character intrinsic
    // width (254px at this font size). Two steppers side by side therefore
    // demanded 781px, so on any phone the entire Weight stepper sat off the
    // right edge of the screen: the set expanded, and the one control you
    // opened it for was not reachable. See the design review, finding #20.
    <Box sx={{ flex: 1, minWidth: 0 }}>
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
          // Without this the input reports the default 20-character
          // intrinsic width, which is what pushed the stepper off-screen
          // above. `flex: 1` gives it the real width; `size` only needs to
          // stop it claiming a large one of its own.
          size={1}
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
