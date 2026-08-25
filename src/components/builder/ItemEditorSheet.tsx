'use client';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { useEffect, useState } from 'react';
import { ExerciseContextPanel } from '@/components/exercises/ExerciseContext';
import { showsSeparateWeightField, targetOptionsFor, usesReps } from '@/core/builder/targeting';
import { getExercise } from '@/core/library/exercises';
import { BLOCK_KINDS, type BlockKind } from '@/core/types';
import { getExerciseContexts } from '@/server/actions';
import type { ExerciseContext } from '@/server/exerciseContext';
import type { EditableItem } from './editable';

const BLOCK_KIND_LABEL: Record<BlockKind, string> = {
  primer: 'Primer', main: 'Main lift', secondary: 'Secondary',
  superset: 'Superset', finisher: 'Finisher', downregulate: 'Cool-down',
};

const TARGET_LABEL = {
  percent_tm: '% of training max', rpe: 'RPE (effort)', weight: 'Fixed weight',
  bodyweight: 'Bodyweight', duration: 'Duration', distance: 'Distance',
} as const;

const RPE_VALUES = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];

interface Props {
  open: boolean;
  item: EditableItem | null;
  onClose: () => void;
  onSave: (item: EditableItem) => void;
}

/** Plain-English tempo explainer — 4 digits: eccentric / pause / concentric / pause. */
function tempoHint(tempo: string): string {
  if (tempo.length !== 4) return 'Four characters: down, pause, up, pause. X = fast, A = hold.';
  const [ecc, pause1, con, pause2] = tempo.split('');
  const label = (ch: string, verb: string) => (ch === 'X' ? `explosive ${verb}` : ch === 'A' ? 'hold' : `${ch}s ${verb}`);
  return `${label(ecc!, 'down')}, ${pause1 === '0' ? 'no pause' : `${pause1}s pause`}, ${label(con!, 'up')}, ${pause2 === '0' ? 'no pause at top' : `${pause2}s pause at top`}.`;
}

export function ItemEditorSheet({ open, item, onClose, onSave }: Props) {
  const [draft, setDraft] = useState<EditableItem | null>(item);
  const [context, setContext] = useState<ExerciseContext | undefined>(undefined);
  useEffect(() => setDraft(item), [item]);

  // "What did I do last time, or what does my training max say to expect" —
  // fetched fresh whenever a different exercise's sheet opens.
  useEffect(() => {
    setContext(undefined);
    if (!item) return;
    let cancelled = false;
    getExerciseContexts([item.exerciseId], { percentTm: item.percentTm ?? undefined }).then((result) => {
      if (!cancelled && result.ok) setContext(result.data![item.exerciseId]);
    });
    return () => { cancelled = true; };
  }, [item]);

  if (!draft) return null;
  const exercise = getExercise(draft.exerciseId);
  const set = (patch: Partial<EditableItem>) => setDraft((prev) => (prev ? { ...prev, ...patch } : prev));

  // Only the target kinds that actually make sense for this movement — a
  // distance exercise never offers %TM/RPE/reps, and vice versa. The saved
  // value is kept in the list even if it's since fallen outside that set
  // (older data, or a movement whose metric changed), so it's never silently
  // dropped out from under the athlete.
  const targetOptions = targetOptionsFor(exercise);
  const menuOptions = targetOptions.includes(draft.targetKind) ? targetOptions : [draft.targetKind, ...targetOptions];
  const reps = usesReps(draft.targetKind);
  const showWeightField = showsSeparateWeightField(exercise, draft.targetKind);
  const perSideLabel = reps ? 'Reps are per side' : draft.targetKind === 'distance' ? 'Distance is per side' : 'Duration is per side';

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{exercise.name}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          <ExerciseContextPanel context={context} />
          <TextField
            select label="Block" size="small" value={draft.blockKind}
            onChange={(e) => set({ blockKind: e.target.value as BlockKind })}
          >
            {BLOCK_KINDS.filter((k) => k !== 'superset').map((k) => (
              <MenuItem key={k} value={k}>{BLOCK_KIND_LABEL[k]}</MenuItem>
            ))}
          </TextField>

          <Stack direction="row" spacing={2}>
            <TextField
              label="Sets" type="number" size="small" value={draft.sets}
              onChange={(e) => set({ sets: Math.max(1, Number(e.target.value) || 1) })}
              slotProps={{ htmlInput: { min: 1, max: 20 } }}
            />
            {reps && (
              <>
                <TextField
                  label="Reps low" type="number" size="small" value={draft.repLo ?? ''}
                  onChange={(e) => set({ repLo: e.target.value ? Number(e.target.value) : null })}
                />
                <TextField
                  label="Reps high" type="number" size="small" value={draft.repHi ?? ''}
                  onChange={(e) => set({ repHi: e.target.value ? Number(e.target.value) : null })}
                />
              </>
            )}
          </Stack>

          <FormControlLabel
            control={<Switch checked={draft.perSide} onChange={(e) => set({ perSide: e.target.checked })} />}
            label={perSideLabel}
          />

          <Stack direction="row" spacing={2}>
            <TextField
              label="Tempo" size="small" value={draft.tempo}
              onChange={(e) => set({ tempo: e.target.value.toUpperCase().slice(0, 4) })}
              slotProps={{ htmlInput: { maxLength: 4 } }}
            />
            <TextField
              label="Rest (sec)" type="number" size="small" value={draft.restSec}
              onChange={(e) => set({ restSec: Math.max(0, Number(e.target.value) || 0) })}
            />
          </Stack>
          <Typography variant="caption" color="text.secondary">{tempoHint(draft.tempo)}</Typography>

          <TextField
            select label="Target" size="small" value={draft.targetKind}
            helperText={`Options are limited to what makes sense for ${exercise.name} — it's measured in ${exercise.metric}.`}
            onChange={(e) => {
              const targetKind = e.target.value as EditableItem['targetKind'];
              const nowReps = usesReps(targetKind);
              set({
                targetKind,
                // Reps and distance/duration are mutually exclusive on a set
                // — switching families clears the one that no longer applies
                // instead of leaving a stale number behind.
                repLo: nowReps ? (draft.repLo ?? exercise.repLo) : null,
                repHi: nowReps ? (draft.repHi ?? exercise.repHi) : null,
                durationSec: targetKind === 'duration' ? (draft.durationSec ?? 45) : null,
                distanceM: targetKind === 'distance' ? (draft.distanceM ?? 30) : null,
              });
            }}
          >
            {menuOptions.map((k) => (
              <MenuItem key={k} value={k}>{TARGET_LABEL[k]}</MenuItem>
            ))}
          </TextField>

          {draft.targetKind === 'percent_tm' && (
            <TextField
              label="% of training max" type="number" size="small" value={draft.percentTm ?? ''}
              onChange={(e) => set({ percentTm: e.target.value ? Number(e.target.value) : null })}
              helperText="Falls back to RPE automatically if there's no training max on file for this lift."
            />
          )}
          {(draft.targetKind === 'percent_tm' || draft.targetKind === 'rpe') && (
            <Stack spacing={0.5}>
              <Typography variant="overline" color="text.secondary">RPE (optional fallback)</Typography>
              <ToggleButtonGroup
                exclusive size="small" value={draft.rpe} sx={{ flexWrap: 'wrap' }}
                onChange={(_, v) => set({ rpe: v })}
              >
                {RPE_VALUES.map((v) => <ToggleButton key={v} value={v}>{v}</ToggleButton>)}
              </ToggleButtonGroup>
            </Stack>
          )}
          {draft.targetKind === 'weight' && (
            <TextField
              label="Weight (kg)" type="number" size="small" value={draft.weightKg ?? ''}
              onChange={(e) => set({ weightKg: e.target.value ? Number(e.target.value) : null })}
            />
          )}
          {draft.targetKind === 'duration' && (
            <TextField
              label="Duration (seconds)" type="number" size="small" value={draft.durationSec ?? ''}
              onChange={(e) => set({ durationSec: e.target.value ? Number(e.target.value) : null })}
            />
          )}
          {draft.targetKind === 'distance' && (
            <TextField
              label="Distance (metres)" type="number" size="small" value={draft.distanceM ?? ''}
              onChange={(e) => set({ distanceM: e.target.value ? Number(e.target.value) : null })}
            />
          )}
          {showWeightField && (
            <TextField
              label="Added weight (kg)" type="number" size="small" value={draft.weightKg ?? ''}
              onChange={(e) => set({ weightKg: e.target.value ? Number(e.target.value) : null })}
              helperText="What's carried/held for this movement — leave blank for bodyweight only."
            />
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button variant="text" onClick={onClose}>Cancel</Button>
        <Button onClick={() => onSave(draft)}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}
