'use client';
import AddIcon from '@mui/icons-material/Add';
import CalendarViewWeekIcon from '@mui/icons-material/CalendarViewWeek';
import CallSplitIcon from '@mui/icons-material/CallSplit';
import DeleteIcon from '@mui/icons-material/Delete';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineRounded';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import LinkIcon from '@mui/icons-material/Link';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { minutes } from '@/components/format';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ExercisePickerDialog } from '@/components/exercises/ExercisePickerDialog';
import { adviseOnWeek } from '@/core/builder/advise';
import { materializeRoutine } from '@/core/builder/materializeRoutine';
import type { Routine } from '@/core/builder/types';
import { getExercise } from '@/core/library/exercises';
import type { Exercise } from '@/core/types';
import { archiveRoutine, renameRoutine, saveRoutineDays, scheduleRoutine } from '@/server/actions';
import { ADVISORY_COPY } from './advisoryCopy';
import { DayManagerDialog } from './DayManagerDialog';
import {
  fromRoutine, newItem, toRoutineDays,
  type EditableBlock, type EditableDay, type EditableItem,
} from './editable';
import { ItemEditorSheet } from './ItemEditorSheet';
import { MuscleCoverageStrip } from './MuscleCoverageStrip';
import { coverageFor } from './muscleCoverage';

interface Props {
  routine: Routine;
  trainingMaxes: Record<string, number>;
  increment: number;
  paceFactor: number;
}

function summarise(item: EditableItem): string {
  const reps = item.repLo && item.repHi && item.repLo !== item.repHi
    ? `${item.repLo}–${item.repHi}` : item.repLo ?? item.repHi ?? '';
  // A distance/duration item has no reps to show — just the set count; the
  // distance or time itself is reported below, in `target`.
  const setsPart = reps ? `${item.sets} × ${reps}${item.perSide ? '/side' : ''}` : `${item.sets} set${item.sets === 1 ? '' : 's'}`;
  const target = item.targetKind === 'percent_tm' && item.percentTm ? `@ ${item.percentTm}% TM`
    : item.targetKind === 'rpe' && item.rpe ? `@ RPE ${item.rpe}`
      : item.targetKind === 'weight' && item.weightKg ? `@ ${item.weightKg} kg`
        : item.targetKind === 'duration' && item.durationSec ? `${Math.round(item.durationSec / 60)} min${item.perSide ? '/side' : ''}`
          : item.targetKind === 'distance' && item.distanceM ? `${item.distanceM} m${item.perSide ? '/side' : ''}` : '';
  // A loaded carry/hold tracks weight independently of targetKind (the
  // builder's "Added weight" field) — surface it here too.
  const addedWeight = (item.targetKind === 'duration' || item.targetKind === 'distance') && item.weightKg
    ? `@ ${item.weightKg} kg` : '';
  return [setsPart, target, addedWeight].filter(Boolean).join(' ');
}

export function RoutineEditor({ routine, trainingMaxes, increment, paceFactor }: Props) {
  const router = useRouter();
  const [days, setDays] = useState<EditableDay[]>(() => fromRoutine(routine));
  const [dayTab, setDayTab] = useState(0);
  const [pickerFor, setPickerFor] = useState<'new' | string | null>(null); // 'new' or a block clientId
  const [editing, setEditing] = useState<EditableItem | null>(null);
  const [pending, setPending] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(routine.name);
  const [dayManagerOpen, setDayManagerOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const day = days[dayTab]!;

  const setDay = (updater: (d: EditableDay) => EditableDay) => {
    setDays((prev) => prev.map((d, i) => (i === dayTab ? updater(d) : d)));
  };

  // Adding/removing/reordering days can leave `dayTab` pointing past the end
  // (deleted the last day while it was selected) or at a day that shifted —
  // clamping here, in the one place days ever change shape, means every
  // caller (the dialog included) can just hand back a new array.
  function handleDaysChange(next: EditableDay[]) {
    setDays(next);
    setDayTab((prev) => Math.min(prev, next.length - 1));
  }

  async function handleRenameBlur() {
    const trimmed = name.trim() || 'My program';
    setName(trimmed);
    if (trimmed === routine.name) return;
    const result = await renameRoutine(routine.id, trimmed);
    if (result.ok) router.refresh();
    else setError(result.error);
  }

  async function handleDeleteRoutine() {
    setDeletePending(true);
    setDeleteError(null);
    const result = await archiveRoutine(routine.id);
    setDeletePending(false);
    if (result.ok) router.push('/program/builder');
    else setDeleteError(result.error);
  }

  // Pure src/core code — the estimate and advisories run instantly in the
  // browser, no server round trip, using the exact same cost model
  // (recost/estimateSet) and balance rules the generator itself runs.
  const plan = useMemo(() => {
    const draftRoutine: Routine = { ...routine, days: toRoutineDays(days) };
    return materializeRoutine(draftRoutine, { startDate: '2026-01-05', trainingMaxes, increment, paceFactor });
  }, [routine, days, trainingMaxes, increment, paceFactor]);

  const estimatedSec = plan[0]?.sessions[dayTab]?.estimatedSec ?? 0;
  const advisories = useMemo(
    () => (plan[0] ? adviseOnWeek(plan[0], days.length) : []),
    [plan, days.length],
  );
  const dayCoverage = useMemo(() => coverageFor([day]), [day]);
  const weekCoverage = useMemo(() => coverageFor(days), [days]);

  function addBlock(exercise: Exercise) {
    setDay((d) => ({ ...d, blocks: [...d.blocks, { clientId: `b${Date.now()}`, items: [newItem(exercise.id)] }] }));
    setPickerFor(null);
  }

  function addToBlock(blockClientId: string, exercise: Exercise) {
    setDay((d) => ({
      ...d,
      blocks: d.blocks.map((b) => (b.clientId === blockClientId ? { ...b, items: [...b.items, newItem(exercise.id)] } : b)),
    }));
    setPickerFor(null);
  }

  function removeItem(blockClientId: string, itemClientId: string) {
    setDay((d) => ({
      ...d,
      blocks: d.blocks
        .map((b) => (b.clientId === blockClientId ? { ...b, items: b.items.filter((i) => i.clientId !== itemClientId) } : b))
        .filter((b) => b.items.length > 0),
    }));
  }

  function splitOut(blockClientId: string, itemClientId: string) {
    setDay((d) => {
      const block = d.blocks.find((b) => b.clientId === blockClientId);
      const item = block?.items.find((i) => i.clientId === itemClientId);
      if (!block || !item || block.items.length < 2) return d;
      return {
        ...d,
        blocks: d.blocks.flatMap((b) => {
          if (b.clientId !== blockClientId) return [b];
          const rest = b.items.filter((i) => i.clientId !== itemClientId);
          return [{ ...b, items: rest }, { clientId: `b${Date.now()}`, items: [item] }];
        }),
      };
    });
  }

  function moveBlock(index: number, delta: 1 | -1) {
    setDay((d) => {
      const next = [...d.blocks];
      const target = index + delta;
      if (target < 0 || target >= next.length) return d;
      [next[index], next[target]] = [next[target]!, next[index]!];
      return { ...d, blocks: next };
    });
  }

  function updateItem(blockClientId: string, updated: EditableItem) {
    setDay((d) => ({
      ...d,
      blocks: d.blocks.map((b) => (
        b.clientId === blockClientId
          ? { ...b, items: b.items.map((i) => (i.clientId === updated.clientId ? updated : i)) }
          : b
      )),
    }));
    setEditing(null);
  }

  async function handleSave(): Promise<boolean> {
    setPending(true);
    setError(null);
    const result = await saveRoutineDays(routine.id, toRoutineDays(days));
    setPending(false);
    if (!result.ok) { setError(result.error); return false; }
    return true;
  }

  async function handleSchedule() {
    const saved = await handleSave();
    if (!saved) return;
    setPending(true);
    const result = await scheduleRoutine(routine.id);
    setPending(false);
    if (result.ok) router.push('/today');
    else setError(result.error);
  }

  return (
    <Stack spacing={2}>
      <TextField
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={handleRenameBlur}
        variant="standard"
        placeholder="Program name"
        slotProps={{ htmlInput: { 'aria-label': 'Program name', style: { fontSize: '1.25rem', fontWeight: 600 } } }}
        fullWidth
      />

      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <Tabs
          value={dayTab} onChange={(_, v) => setDayTab(v)} variant="scrollable" scrollButtons="auto"
          sx={{ flex: 1, minWidth: 0 }}
        >
          {days.map((d, i) => <Tab key={d.id} label={d.name} value={i} />)}
        </Tabs>
        <IconButton
          onClick={() => setDayManagerOpen(true)} aria-label="Manage training days"
          sx={{ width: 48, height: 48, flexShrink: 0 }}
        >
          <CalendarViewWeekIcon />
        </IconButton>
      </Stack>

      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <Chip size="small" label={`≈ ${minutes(estimatedSec)}`} className="tnum" />
        <Chip size="small" variant="outlined" label={`${day.blocks.length} block${day.blocks.length === 1 ? '' : 's'}`} />
      </Stack>

      <MuscleCoverageStrip label="This day trains" covered={dayCoverage} />

      {advisories.length > 0 && (
        <Alert severity="info" variant="outlined">
          <Stack spacing={1.25}>
            {advisories.map((v) => {
              const copy = ADVISORY_COPY[v.code];
              return (
                <Box key={v.code}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{v.message}</Typography>
                  {copy && (
                    <>
                      <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.25 }}>
                        {copy.why}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" component="p" sx={{ fontStyle: 'italic' }}>
                        {copy.suggest(v)}
                      </Typography>
                    </>
                  )}
                </Box>
              );
            })}
          </Stack>
        </Alert>
      )}

      <Stack spacing={1.5}>
        {day.blocks.map((block, index) => (
          <BlockCard
            key={block.clientId}
            block={block}
            index={index}
            isLast={index === day.blocks.length - 1}
            onMove={(delta) => moveBlock(index, delta)}
            onAddPartner={() => setPickerFor(block.clientId)}
            onEdit={(item) => setEditing(item)}
            onRemove={(itemClientId) => removeItem(block.clientId, itemClientId)}
            onSplit={(itemClientId) => splitOut(block.clientId, itemClientId)}
          />
        ))}
      </Stack>

      <Button startIcon={<AddIcon />} variant="outlined" onClick={() => setPickerFor('new')}>
        Add exercise
      </Button>

      <Divider />
      <MuscleCoverageStrip label="Whole program trains" covered={weekCoverage} />

      {error && <Alert severity="error">{error}</Alert>}

      <Stack direction="row" spacing={1.5} sx={{ pt: 1 }}>
        <Button variant="outlined" fullWidth disabled={pending} onClick={async () => { if (await handleSave()) setToast('Saved.'); }}>
          Save
        </Button>
        <Button fullWidth disabled={pending} onClick={handleSchedule}>
          {pending ? 'Working…' : 'Save & start training this'}
        </Button>
      </Stack>

      <Button
        variant="text" color="error" startIcon={<DeleteOutlineIcon />}
        onClick={() => setDeleteOpen(true)} sx={{ alignSelf: 'flex-start' }}
      >
        Delete this program
      </Button>

      <DayManagerDialog
        open={dayManagerOpen} days={days} onChange={handleDaysChange}
        onClose={() => setDayManagerOpen(false)}
      />
      <ConfirmDialog
        open={deleteOpen}
        title="Delete this program?"
        description={<>“{name}” will be removed from your builder. This can’t be undone.</>}
        confirmLabel="Delete program"
        pending={deletePending}
        error={deleteError}
        onConfirm={handleDeleteRoutine}
        onClose={() => { if (!deletePending) setDeleteOpen(false); }}
      />

      <ExercisePickerDialog
        open={pickerFor !== null}
        onClose={() => setPickerFor(null)}
        onPick={(ex) => (pickerFor === 'new' ? addBlock(ex) : pickerFor && addToBlock(pickerFor, ex))}
      />
      <ItemEditorSheet
        open={editing !== null}
        item={editing}
        onClose={() => setEditing(null)}
        onSave={(updated) => {
          const block = day.blocks.find((b) => b.items.some((i) => i.clientId === updated.clientId));
          if (block) updateItem(block.clientId, updated);
        }}
      />
      <Snackbar open={Boolean(toast)} autoHideDuration={3000} onClose={() => setToast(null)} message={toast ?? ''} />
    </Stack>
  );
}

function BlockCard({
  block, index, isLast, onMove, onAddPartner, onEdit, onRemove, onSplit,
}: {
  block: EditableBlock;
  index: number;
  isLast: boolean;
  onMove: (delta: 1 | -1) => void;
  onAddPartner: () => void;
  onEdit: (item: EditableItem) => void;
  onRemove: (itemClientId: string) => void;
  onSplit: (itemClientId: string) => void;
}) {
  const isSuperset = block.items.length > 1;
  return (
    <Card variant="outlined">
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', px: 1.5, pt: 1 }}>
        <Typography variant="overline" color="text.secondary" sx={{ flex: 1 }}>
          {isSuperset ? 'Superset' : 'Block'}
        </Typography>
        <IconButton
          size="small" disabled={index === 0} onClick={() => onMove(-1)} aria-label="Move up"
          sx={{ width: 48, height: 48 }}
        >
          <KeyboardArrowUpIcon fontSize="small" />
        </IconButton>
        <IconButton
          size="small" disabled={isLast} onClick={() => onMove(1)} aria-label="Move down"
          sx={{ width: 48, height: 48 }}
        >
          <KeyboardArrowDownIcon fontSize="small" />
        </IconButton>
      </Stack>
      <Stack divider={<Box sx={{ borderTop: 1, borderColor: 'divider' }} />}>
        {block.items.map((item) => {
          const exercise = getExercise(item.exerciseId);
          return (
            <Stack key={item.clientId} direction="row" spacing={1.5} sx={{ alignItems: 'center', pr: 1, py: 0.5 }}>
              <ButtonBase
                onClick={() => onEdit(item)}
                sx={{ flex: 1, minWidth: 0, justifyContent: 'flex-start', textAlign: 'left', px: 2, py: 0.75 }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="h3" noWrap>{exercise.name}</Typography>
                  <Typography variant="body2" color="text.secondary" className="tnum">{summarise(item)}</Typography>
                </Box>
              </ButtonBase>
              {isSuperset && (
                <IconButton
                  size="small" onClick={() => onSplit(item.clientId)} aria-label="Split out of superset"
                  sx={{ width: 48, height: 48 }}
                >
                  <CallSplitIcon fontSize="small" />
                </IconButton>
              )}
              <IconButton
                size="small" onClick={() => onRemove(item.clientId)} aria-label="Remove exercise"
                sx={{ width: 48, height: 48 }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Stack>
          );
        })}
      </Stack>
      <Button
        size="small" variant="text" startIcon={<LinkIcon fontSize="small" />} onClick={onAddPartner}
        sx={{ m: 1, alignSelf: 'flex-start' }}
      >
        {isSuperset ? 'Add to superset' : 'Superset with another exercise'}
      </Button>
    </Card>
  );
}
