'use client';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineRounded';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { newDay, renumberDays, type EditableDay } from './editable';

interface Props {
  open: boolean;
  days: EditableDay[];
  onChange: (days: EditableDay[]) => void;
  onClose: () => void;
}

/**
 * Add, rename, reorder and delete training days — the day list a routine is
 * created with was permanent until now. Operates directly on the editor's
 * live `days` state (same "no separate draft" philosophy as the rest of the
 * builder); `dayIndex`/`weekday` are always re-derived from list order via
 * `renumberDays` so they can never drift out of sync with what's shown.
 */
export function DayManagerDialog({ open, days, onChange, onClose }: Props) {
  function rename(id: string, name: string) {
    onChange(days.map((d) => (d.id === id ? { ...d, name } : d)));
  }

  function move(index: number, delta: 1 | -1) {
    const target = index + delta;
    if (target < 0 || target >= days.length) return;
    const next = [...days];
    [next[index], next[target]] = [next[target]!, next[index]!];
    onChange(renumberDays(next));
  }

  function remove(id: string) {
    if (days.length <= 1) return;
    onChange(renumberDays(days.filter((d) => d.id !== id)));
  }

  function add() {
    onChange(renumberDays([...days, newDay(`Day ${days.length + 1}`)]));
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Training days</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ pt: 0.5 }}>
          {days.map((day, index) => (
            <Stack key={day.id} direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
              <DragIndicatorIcon fontSize="small" color="disabled" sx={{ flexShrink: 0 }} />
              <TextField
                value={day.name} size="small" fullWidth
                onChange={(e) => rename(day.id, e.target.value)}
                slotProps={{ htmlInput: { 'aria-label': `Day ${index + 1} name` } }}
              />
              <IconButton
                size="small" disabled={index === 0} onClick={() => move(index, -1)}
                aria-label="Move day up" sx={{ width: 40, height: 40 }}
              >
                <KeyboardArrowUpIcon fontSize="small" />
              </IconButton>
              <IconButton
                size="small" disabled={index === days.length - 1} onClick={() => move(index, 1)}
                aria-label="Move day down" sx={{ width: 40, height: 40 }}
              >
                <KeyboardArrowDownIcon fontSize="small" />
              </IconButton>
              <IconButton
                size="small" disabled={days.length <= 1} onClick={() => remove(day.id)}
                aria-label={`Delete ${day.name}`} sx={{ width: 40, height: 40 }}
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Stack>
          ))}
          {days.length <= 1 && (
            <Typography variant="caption" color="text.secondary">
              A program needs at least one training day.
            </Typography>
          )}
          <Button startIcon={<AddIcon />} variant="outlined" onClick={add} sx={{ alignSelf: 'flex-start' }}>
            Add day
          </Button>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Done</Button>
      </DialogActions>
    </Dialog>
  );
}
