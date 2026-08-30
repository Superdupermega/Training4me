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
import { useEffect, useRef, useState, type ChangeEvent, type FocusEvent } from 'react';
import { formatWeight } from '@/components/format';
import { formatPlateBreakdown, plateBreakdown, STANDARD_BAR_KG, availablePlatesKg } from '@/core/plates';
import { PAIN_AREAS, type PainArea, type PrescribedSet } from '@/core/types';
import { PlateBar } from './PlateBar';

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
   * A *hint* only — what was actually lifted last time, else what the
   * training max projects. It is offered next to the empty field and as the
   * value the +/- steppers adopt on their first tap; it is never entered on
   * the athlete's behalf. See `carriedWeightKg` for why nothing pre-fills
   * itself here any more.
   */
  suggestedWeightKg?: number | null;
  /**
   * The weight the athlete already chose for *this movement* earlier in
   * this session, if any — the one thing that does pre-fill the field,
   * because they picked it themselves. `0` is a real, decided value
   * ("bodyweight, no load"), which is why this is `number | null` and not
   * a falsy check anywhere below.
   *
   * Everything else — the prescription's `weightKg`, the suggestion above —
   * is now shown rather than entered: a logged set records what was lifted,
   * and neither the plan nor last week's log knows that. The quick ✓ on a
   * loadable movement with nothing decided yet opens the row instead of
   * committing a number nobody typed.
   */
  carriedWeightKg?: number | null;
}

const PAIN_LABEL: Record<PainArea, string> = {
  knee: 'Knee', shoulder: 'Shoulder', lower_back: 'Lower back',
  elbow: 'Elbow', hip: 'Hip', wrist: 'Wrist',
};

/**
 * The tick that draws itself in ~250ms on the row that *just* transitioned
 * to logged — `animate` is false for a row that was already logged when the
 * component mounted (a reload mid-session), which renders finished instead
 * of replaying.
 */
function DrawnCheck({ animate }: { animate: boolean }) {
  return (
    <Box
      component="svg" viewBox="0 0 24 24" width={20} height={20} aria-hidden
      sx={{ color: 'primary.main', display: 'block' }}
    >
      <path
        d="M4.5 12.5l4.5 4.5L19.5 6.5" fill="none" stroke="currentColor"
        strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
        pathLength={1}
        style={{
          strokeDasharray: 1,
          strokeDashoffset: animate ? 1 : 0,
          animation: animate ? 'drawCheck 250ms ease forwards' : 'none',
        }}
      />
    </Box>
  );
}

export function SetRow({
  set, logged, increment, expanded, onExpand, onComplete, barbell = false, microPlates = false,
  loadable = true, suggestedWeightKg = null, carriedWeightKg = null,
}: Props) {
  // What this set starts at: what was already logged for it, else what the
  // athlete chose for this movement earlier in the session. Nothing else —
  // an empty field is the honest state for "you have not said what you are
  // lifting yet".
  const [reps, setReps] = useState(logged?.reps ?? set.reps ?? 0);
  const [weight, setWeight] = useState<number | null>(logged?.weightKg ?? carriedWeightKg);
  const [rpe, setRpe] = useState<number | undefined>(logged?.rpe ?? undefined);
  const [pain, setPain] = useState<PainArea | ''>(logged?.painFlag ?? '');
  // Set by a quick ✓ that could not be honoured because no weight has been
  // chosen yet — the row opens and says why rather than silently doing
  // nothing.
  const [askedForWeight, setAskedForWeight] = useState(false);

  const done = Boolean(logged);
  // Whether this row transitioned to logged *during this mount* — gated on
  // that, not on `Boolean(logged)` directly, so a reload mid-session (rows
  // arriving already logged via `initialLogged`) renders them finished
  // rather than replaying the flash and the tick draw on all of them at
  // once. `wasDone` seeds from the very first render and is never reset, so
  // it only ever answers "was this already true when I first saw it".
  const wasDone = useRef(done);
  const [justCompleted, setJustCompleted] = useState(false);
  useEffect(() => {
    if (!wasDone.current && done) setJustCompleted(true);
    wasDone.current = done;
  }, [done]);
  // The number to offer, never to assume: the plan's own prescription first
  // (an 82%-of-training-max main set), else last time / the training-max
  // projection for this movement.
  const hintKg = set.weightKg ?? suggestedWeightKg ?? null;
  // A movement that can hold load needs a decision before the one-tap ✓ can
  // stand for anything. A stretch or an assault bike does not.
  const needsWeight = loadable && weight == null;

  // This row's own `key` never changes, so React never remounts it: the
  // initial `useState` above runs once, and everything that arrives later —
  // the reps a readiness trim rewrote, the weight the athlete has just
  // chosen for an earlier set of the same movement — has to be picked up
  // here instead. Only while the set is still unlogged: once submitted, the
  // row shows what was actually done, not a moving target.
  useEffect(() => {
    if (done) return;
    setReps(set.reps ?? 0);
    // Adopt the carried-over weight only into a field nobody has filled in
    // yet: a number typed into set 4 while set 2 was still open is the
    // athlete's, and logging set 2 must not overwrite it. The autoregulation
    // backoff scales what SessionPlayer carries over, so an untouched later
    // set still comes down 5% or 10% the moment a hard set is logged.
    setWeight((prev) => (prev == null ? carriedWeightKg : prev));
  }, [set.reps, carriedWeightKg, done]);
  const isRamp = set.kind === 'ramp';
  const target = set.distanceM
    ? `${set.distanceM} m${set.perSide ? '/side' : ''}`
    : set.durationSec
      ? `${Math.round(set.durationSec / 60)} min${set.perSide ? '/side' : ''}`
      : `${set.reps}${set.perSide ? '/side' : ''} reps`;

  const submit = () => {
    setAskedForWeight(false);
    // A single short pulse — deliberately distinguishable from the rest
    // timer's `[120, 60, 120]` "your rest is over" pattern. Optional
    // chaining is required: iOS Safari has no `navigator.vibrate` at all,
    // and calling a missing method throws rather than no-oping.
    navigator.vibrate?.(15);
    onComplete({
      reps: set.distanceM || set.durationSec ? undefined : reps,
      // A decided 0 is "bodyweight, no external load" — a real answer, and
      // one that still carries over to the rest of the movement, but not a
      // load worth writing to the log.
      weightKg: weight ? weight : undefined,
      rpe,
      distanceM: set.distanceM,
      durationSec: set.durationSec,
      painFlag: pain || null,
    });
  };

  /**
   * The one-tap ✓. It logs the set as it stands — unless the movement takes
   * load and no weight has been chosen for it yet, in which case it opens
   * the row and asks, rather than committing the plan's number as though it
   * were what happened.
   */
  const quickComplete = () => {
    if (!needsWeight) { submit(); return; }
    setAskedForWeight(true);
    if (!expanded) onExpand();
  };

  const plates = barbell && weight != null && weight > STANDARD_BAR_KG
    ? plateBreakdown(weight, STANDARD_BAR_KG, availablePlatesKg(microPlates))
    : null;

  return (
    <Box
      sx={{
        borderTop: 1, borderColor: 'divider',
        bgcolor: done ? 'action.hover' : undefined,
        opacity: isRamp && !done ? 0.75 : 1,
        // A CSS animation on an sx trigger, not a `setTimeout` that flips
        // state back after ~400ms — a timer racing the next set's own
        // re-render is exactly the kind of thing that fights React here.
        // `flashRow` is declared globally in `theme.ts`'s `MuiCssBaseline`
        // override, next to `drawCheck` used below — see the comment there
        // for why a literal name, not `@emotion/react`'s `keyframes()`.
        ...(justCompleted && { animation: 'flashRow 400ms ease' }),
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
            <DrawnCheck animate={justCompleted} />
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
            onClick={quickComplete}
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
                <Stepper label="Reps" value={reps} step={1} onChange={(v) => setReps(v ?? 0)} />
                <Stepper
                  label="Weight (kg)" value={weight} step={increment} hint={hintKg}
                  onChange={setWeight}
                />
              </Stack>
              <WeightPrompt
                weight={weight} hintKg={hintKg} asked={askedForWeight}
                onUseHint={() => { setWeight(hintKg); setAskedForWeight(false); }}
              />
              {plates && (
                <Box>
                  <Typography variant="caption" color="text.secondary" className="tnum">
                    {plates.perSide.length === 0
                      ? 'Empty bar'
                      : `${formatPlateBreakdown(plates)} per side`}
                    {!plates.exact && ` (closest at ${formatWeight(plates.totalKg)})`}
                  </Typography>
                  <PlateBar
                    breakdown={plates}
                    label={`${formatPlateBreakdown(plates)} per side${plates.exact ? '' : `, closest to ${formatWeight(plates.totalKg)}`}`}
                  />
                </Box>
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
            <Stack spacing={0.5}>
              <Stepper
                label="Weight (kg)" value={weight} step={increment} hint={hintKg}
                onChange={setWeight}
              />
              <WeightPrompt
                weight={weight} hintKg={hintKg} asked={askedForWeight}
                onUseHint={() => { setWeight(hintKg); setAskedForWeight(false); }}
              />
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

/**
 * The line under the weight field: what the plan or your log suggests, as an
 * offer you tap, plus the nudge a quick ✓ leaves behind when it could not
 * log the set because nothing had been chosen yet.
 */
function WeightPrompt({
  weight, hintKg, asked, onUseHint,
}: { weight: number | null; hintKg: number | null; asked: boolean; onUseHint: () => void }) {
  if (weight != null) return null;
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 0.5 }}>
      {hintKg != null && (
        <Button size="small" variant="text" onClick={onUseHint} sx={{ px: 1 }}>
          Use {formatWeight(hintKg)}
        </Button>
      )}
      <Typography variant="caption" color={asked ? 'error' : 'text.secondary'}>
        {asked
          ? 'Enter the weight first — it carries over to the rest of this exercise.'
          : 'Enter what you are actually lifting.'}
      </Typography>
    </Stack>
  );
}

function Stepper({
  label, value, step, hint = null, onChange,
}: {
  label: string;
  /** `null` = nothing entered yet, which is a state the field can sit in. */
  value: number | null;
  step: number;
  /** What the +/- buttons adopt on their first tap from empty. */
  hint?: number | null;
  onChange: (v: number | null) => void;
}) {
  // A tap-to-edit numeric field, not just +/- buttons — a real correction (a
  // lighter dumbbell, a different unit, a bodyweight movement you loaded)
  // used to mean tapping "+" as many as 40+ times from zero. Local `text`
  // state (rather than binding the input straight to the numeric `value`) so
  // the field can sit empty — both mid-edit and as its genuine starting
  // state for a weight nobody has decided yet.
  const [text, setText] = useState(value == null ? '' : String(value));
  useEffect(() => setText(value == null ? '' : String(value)), [value]);

  const round = (n: number) => Math.round(n * 100) / 100;
  // From empty, one tap on either button adopts the suggestion rather than
  // stepping away from a zero nobody chose: "−" lands on it exactly, "+"
  // takes it as the floor. It is still the athlete's tap that puts the
  // number in the field.
  const decrement = () => onChange(value == null ? (hint ?? 0) : Math.max(0, round(value - step)));
  const increment = () => onChange(value == null ? (hint ?? step) : round(value + step));

  const commit = (raw: string) => {
    if (raw.trim() === '') { onChange(null); return; } // cleared on purpose — not decided
    const next = Number(raw);
    if (Number.isFinite(next)) onChange(Math.max(0, next));
    else setText(value == null ? '' : String(value)); // gibberish — snap back to the last real value
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
          onClick={decrement}
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
          placeholder={hint != null ? String(hint) : '—'}
          value={text}
          onFocus={(e: FocusEvent<HTMLInputElement>) => e.target.select()}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            const raw = e.target.value;
            setText(raw);
            if (raw.trim() === '') { onChange(null); return; }
            const next = Number(raw);
            if (Number.isFinite(next)) onChange(Math.max(0, next));
          }}
          onBlur={(e: FocusEvent<HTMLInputElement>) => commit(e.target.value)}
          className="tnum"
          sx={(t) => ({
            // `theme.typography.displaySmall` rather than the old hardcoded
            // `fontSize: '1.4rem'` — docs/04-DESIGN-SYSTEM.md §2's "must
            // read from 1 m away" size, applied directly since this is a
            // bare `<input>`, not a `Typography`, so it can't take the
            // `variant` prop.
            ...t.typography.displaySmall,
            flex: 1, minWidth: 0, textAlign: 'center',
            fontFamily: 'inherit', color: 'inherit', border: 'none', outline: 'none',
            background: 'transparent', p: 0,
            '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button': { WebkitAppearance: 'none', m: 0 },
            '&::placeholder': { color: 'text.disabled', fontWeight: 400 },
          })}
        />
        <Button
          variant="outlined" sx={{ minWidth: 48, px: 0 }} aria-label={`Increase ${label}`}
          onClick={increment}
        >+</Button>
      </Stack>
    </Box>
  );
}
