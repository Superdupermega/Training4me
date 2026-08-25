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
import { getExercise } from '@/core/library/exercises';
import { BLOCK_KINDS, type BlockKind } from '@/core/types';
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
  useEffect(() => setDraft(item), [item]);

  if (!draft) return null;
  const exercise = getExercise(draft.exerciseId);
  const set = (patch: Partial<EditableItem>) => setDraft((prev) => (prev ? { ...prev, ...patch } : prev));

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{exercise.name}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
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
            <TextField
              label="Reps low" type="number" size="small" value={draft.repLo ?? ''}
              onChange={(e) => set({ repLo: e.target.value ? Number(e.target.value) : null })}
            />
            <TextField
              label="Reps high" type="number" size="small" value={draft.repHi ?? ''}
              onChange={(e) => set({ repHi: e.target.value ? Number(e.target.value) : null })}
            />
          </Stack>

          <FormControlLabel
            control={<Switch checked={draft.perSide} onChange={(e) => set({ perSide: e.target.checked })} />}
            label="Reps are per side"
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
            onChange={(e) => set({ targetKind: e.target.value as EditableItem['targetKind'] })}
          >
            {Object.entries(TARGET_LABEL).map(([k, label]) => (
              <MenuItem key={k} value={k}>{label}</MenuItem>
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
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button variant="text" onClick={onClose}>Cancel</Button>
        <Button onClick={() => onSave(draft)}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}
