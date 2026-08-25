'use client';
import SearchIcon from '@mui/icons-material/Search';
import StarIcon from '@mui/icons-material/Star';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import InputAdornment from '@mui/material/InputAdornment';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import ListSubheader from '@mui/material/ListSubheader';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { EQUIPMENT_LABEL } from '@/core/library/equipment';
import { EXERCISES } from '@/core/library/exercises';
import { browseGroupsFor } from '@/core/library/query';
import {
  EXERCISE_STYLES, GROUP_LABEL, MUSCLE_GROUPS, MUSCLE_LABEL,
  type ExerciseStyle, type MuscleGroup,
} from '@/core/library/muscles';
import type { Equipment, Exercise } from '@/core/types';
import { STYLE_LABEL } from './labels';

function matches(ex: Exercise, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return ex.name.toLowerCase().includes(q) || ex.nameSv.toLowerCase().includes(q) || ex.id.includes(q);
}

function equipmentSummary(ex: Exercise): string {
  if (ex.equipment.length === 1 && ex.equipment[0] === 'none') return 'Bodyweight';
  return ex.equipment.filter((e) => e !== 'none').map((e) => EQUIPMENT_LABEL[e]).join(' · ');
}

function Row({ ex }: { ex: Exercise }) {
  const muscles = [...ex.primaryMuscles, ...ex.secondaryMuscles].map((m) => MUSCLE_LABEL[m]).join(', ');
  return (
    <ListItemButton component={Link} href={`/exercises/${ex.id}`} sx={{ py: 1.25, px: 2 }}>
      <ListItemText
        primary={ex.name}
        secondary={`${muscles}${equipmentSummary(ex) ? ` · ${equipmentSummary(ex)}` : ''}`}
        slotProps={{ secondary: { noWrap: true } }}
      />
    </ListItemButton>
  );
}

interface Props {
  myEquipment: Equipment[];
}

/**
 * `EXERCISES` is a static, build-time array — imported directly here rather
 * than threaded through as a server-rendered prop, so it ships once in the
 * client bundle instead of being serialised twice (once into the RSC
 * payload, once into client state). Only `myEquipment`, which is real
 * per-profile data, comes from the server.
 */
export function ExerciseBrowser({ myEquipment }: Props) {
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<MuscleGroup | null>(null);
  const [style, setStyle] = useState<ExerciseStyle | null>(null);
  const [equipmentFilter, setEquipmentFilter] = useState(true); // true = only what I have

  const filtered = useMemo(() => {
    return EXERCISES.filter((ex) => {
      if (!matches(ex, query)) return false;
      if (group && !browseGroupsFor(ex).includes(group)) return false;
      if (style && !ex.styles.includes(style)) return false;
      if (equipmentFilter && !ex.equipment.every((item) => myEquipment.includes(item))) return false;
      return true;
    });
  }, [query, group, style, equipmentFilter, myEquipment]);

  const grouped = useMemo(() => {
    if (query.trim() || group) return null;
    const byGroup = new Map<MuscleGroup, Exercise[]>();
    for (const g of MUSCLE_GROUPS) byGroup.set(g, []);
    for (const ex of filtered) {
      for (const g of browseGroupsFor(ex)) byGroup.get(g)!.push(ex);
    }
    return byGroup;
  }, [filtered, query, group]);

  return (
    <Stack spacing={1.5}>
      <TextField
        placeholder="Search exercises" value={query} onChange={(e) => setQuery(e.target.value)}
        size="small" fullWidth
        slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
      />

      <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', pb: 0.5, '&::-webkit-scrollbar': { display: 'none' } }}>
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

      <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', pb: 0.5, '&::-webkit-scrollbar': { display: 'none' } }}>
        <Chip
          label="Any style" size="small" color={style === null ? 'primary' : 'default'}
          variant={style === null ? 'filled' : 'outlined'} onClick={() => setStyle(null)}
        />
        {EXERCISE_STYLES.map((s) => (
          <Chip
            key={s} label={STYLE_LABEL[s]} size="small" color={style === s ? 'primary' : 'default'}
            variant={style === s ? 'filled' : 'outlined'}
            onClick={() => setStyle((prev) => (prev === s ? null : s))}
            icon={s === 'functional_bodybuilding' ? <StarIcon fontSize="small" /> : undefined}
          />
        ))}
      </Box>

      <FormControlLabel
        sx={{ ml: 0 }}
        control={<Switch size="small" checked={equipmentFilter} onChange={(e) => setEquipmentFilter(e.target.checked)} />}
        label={<Typography variant="body2" color="text.secondary">Only what I have</Typography>}
      />

      <Box sx={{ borderTop: 1, borderColor: 'divider' }}>
        {grouped ? (
          MUSCLE_GROUPS.filter((g) => grouped.get(g)!.length > 0).map((g) => (
            <Box key={g}>
              <ListSubheader sx={{ px: 2, bgcolor: 'background.default' }}>
                {GROUP_LABEL[g]} · {grouped.get(g)!.length}
              </ListSubheader>
              {grouped.get(g)!.map((ex) => <Row key={ex.id} ex={ex} />)}
            </Box>
          ))
        ) : filtered.length === 0 ? (
          <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
            Nothing matches. Try a different search or turn off &ldquo;Only what I have&rdquo;.
          </Typography>
        ) : (
          filtered.map((ex) => <Row key={ex.id} ex={ex} />)
        )}
      </Box>
    </Stack>
  );
}
