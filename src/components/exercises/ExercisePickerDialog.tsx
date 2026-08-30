'use client';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Slide from '@mui/material/Slide';
import type { TransitionProps } from '@mui/material/transitions';
import TextField from '@mui/material/TextField';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { forwardRef, useEffect, useMemo, useState } from 'react';
import { summariseContext } from './ExerciseContext';
import { EXERCISES } from '@/core/library/exercises';
import { browseGroupsFor } from '@/core/library/query';
import { GROUP_LABEL, MUSCLE_GROUPS, MUSCLE_LABEL, type MuscleGroup } from '@/core/library/muscles';
import { getExerciseContexts } from '@/server/actions';
import type { ExerciseContext } from '@/server/exerciseContext';
import type { Exercise } from '@/core/types';
import { PatternGlyph } from './patternGlyphs';

const Transition = forwardRef(function Transition(
  props: TransitionProps & { children: React.ReactElement },
  ref: React.Ref<unknown>,
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (exercise: Exercise) => void;
}

export function ExercisePickerDialog({ open, onClose, onPick }: Props) {
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<MuscleGroup | null>(null);

  const [contexts, setContexts] = useState<Record<string, ExerciseContext>>({});

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return EXERCISES.filter((ex) => {
      if (q && !(ex.name.toLowerCase().includes(q) || ex.nameSv.toLowerCase().includes(q) || ex.id.includes(q))) return false;
      if (group && !browseGroupsFor(ex).includes(group)) return false;
      return true;
    }).slice(0, 100);
  }, [query, group]);

  // "What did I do last time" on every visible row — one batched call per
  // settled filter, not one query per row (that would undo chunk 14).
  useEffect(() => {
    if (!open || filtered.length === 0) return;
    const ids = filtered.map((ex) => ex.id);
    const timer = setTimeout(() => {
      getExerciseContexts(ids).then((result) => { if (result.ok) setContexts(result.data!); });
    }, 250);
    return () => clearTimeout(timer);
  }, [open, filtered]);

  return (
    <Dialog fullScreen open={open} onClose={onClose} slots={{ transition: Transition }}>
      <AppBar position="sticky" elevation={0} color="transparent" sx={{ bgcolor: 'background.default', borderBottom: 1, borderColor: 'divider' }}>
        <Toolbar>
          <Typography variant="h3" sx={{ flex: 1 }}>Add exercise</Typography>
          <IconButton onClick={onClose} aria-label="Close"><CloseIcon /></IconButton>
        </Toolbar>
      </AppBar>
      <Box sx={{ p: 2 }}>
        <TextField
          autoFocus placeholder="Search exercises" value={query} onChange={(e) => setQuery(e.target.value)}
          size="small" fullWidth
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
        />
        <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', mt: 1.5, pb: 0.5 }}>
          <Chip
            label="All" size="small" color={group === null ? 'primary' : 'default'}
            variant={group === null ? 'filled' : 'outlined'} onClick={() => setGroup(null)}
          />
          {MUSCLE_GROUPS.map((g) => (
            <Chip
              key={g} label={GROUP_LABEL[g]} size="small" color={group === g ? 'primary' : 'default'}
              variant={group === g ? 'filled' : 'outlined'}
              onClick={() => setGroup((prev) => (prev === g ? null : g))}
            />
          ))}
        </Box>
      </Box>
      <Box sx={{ borderTop: 1, borderColor: 'divider' }}>
        {filtered.length === 0 ? (
          <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>Nothing matches.</Typography>
        ) : (
          filtered.map((ex) => {
            const muscles = [...ex.primaryMuscles].map((m) => MUSCLE_LABEL[m]).join(', ');
            const contextLine = summariseContext(contexts[ex.id]);
            return (
              <ListItemButton key={ex.id} onClick={() => onPick(ex)} sx={{ py: 1.25, px: 2, gap: 1.5 }}>
                <PatternGlyph pattern={ex.pattern} />
                <ListItemText
                  primary={ex.name}
                  secondary={contextLine ? `${muscles} · ${contextLine}` : muscles}
                  slotProps={{ secondary: { noWrap: true } }}
                />
              </ListItemButton>
            );
          })
        )}
      </Box>
    </Dialog>
  );
}
