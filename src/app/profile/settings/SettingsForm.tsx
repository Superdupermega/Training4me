'use client';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { useColorScheme } from '@mui/material/styles';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { getExercise } from '@/core/library/exercises';
import { describeSkeleton } from '@/core/generator/split';
import { regenerateProgram, updateSettings } from '@/server/actions';
import type { Profile } from '@/server/repo';

const THEME_LABEL = { system: 'System', light: 'Light', dark: 'Dark' } as const;

export function SettingsForm({
  profile, trainingMaxes,
}: { profile: Profile; trainingMaxes: Record<string, number> }) {
  const router = useRouter();
  const { mode, setMode } = useColorScheme();
  const [days, setDays] = useState(profile.daysPerWeek ?? 3);
  const [cap, setCap] = useState(Math.round(profile.sessionCapSec / 60));
  const [weeks, setWeeks] = useState(profile.mesocycleWeeks);
  const [confirm, setConfirm] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const dirty = days !== profile.daysPerWeek
    || cap !== Math.round(profile.sessionCapSec / 60)
    || weeks !== profile.mesocycleWeeks;

  async function apply() {
    setPending(true);
    setError(null);
    const saved = await updateSettings({
      days_per_week: days, session_cap_sec: cap * 60, mesocycle_weeks: weeks,
    });
    if (!saved.ok) { setError(saved.error); setPending(false); return; }
    const rebuilt = await regenerateProgram();
    setPending(false);
    setConfirm(false);
    if (!rebuilt.ok) setError(rebuilt.error);
    else { setToast('New block built.'); router.refresh(); }
  }

  return (
    <Stack spacing={2}>
      <Card variant="outlined" sx={{ p: 2 }}>
        <Typography variant="overline" color="text.secondary">Appearance</Typography>
        <ToggleButtonGroup
          exclusive fullWidth value={mode ?? 'system'} sx={{ mt: 1 }}
          onChange={(_, value) => value && setMode(value)}
        >
          {(['system', 'light', 'dark'] as const).map((m) => (
            <ToggleButton key={m} value={m}>{THEME_LABEL[m]}</ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Card>

      <Card variant="outlined" sx={{ p: 2 }}>
        <Typography variant="overline" color="text.secondary">Training days per week</Typography>
        <ToggleButtonGroup
          exclusive fullWidth value={days} sx={{ mt: 1 }}
          onChange={(_, value) => value && setDays(value)}
        >
          {[2, 3, 4, 5, 6].map((n) => <ToggleButton key={n} value={n}>{n}</ToggleButton>)}
        </ToggleButtonGroup>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {describeSkeleton(days)}
        </Typography>
      </Card>

      <Card variant="outlined" sx={{ p: 2 }}>
        <Typography variant="overline" color="text.secondary">Session length</Typography>
        <ToggleButtonGroup
          exclusive fullWidth value={cap} sx={{ mt: 1 }}
          onChange={(_, value) => value && setCap(value)}
        >
          {[45, 60, 75].map((m) => <ToggleButton key={m} value={m}>{m} min</ToggleButton>)}
        </ToggleButtonGroup>
      </Card>

      <Card variant="outlined" sx={{ p: 2 }}>
        <Typography variant="overline" color="text.secondary">Block length</Typography>
        <ToggleButtonGroup
          exclusive fullWidth value={weeks} sx={{ mt: 1 }}
          onChange={(_, value) => value && setWeeks(value)}
        >
          {[4, 6].map((w) => <ToggleButton key={w} value={w}>{w} weeks</ToggleButton>)}
        </ToggleButtonGroup>
      </Card>

      <Card variant="outlined" sx={{ p: 2 }}>
        <Typography variant="overline" color="text.secondary">Training maxes</Typography>
        <Stack spacing={0.5} sx={{ mt: 1 }}>
          {Object.entries(trainingMaxes).length === 0 && (
            <Typography variant="body2" color="text.secondary">None set.</Typography>
          )}
          {Object.entries(trainingMaxes).map(([id, value]) => (
            <Stack key={id} direction="row" sx={{ justifyContent: 'space-between' }}>
              <Typography variant="body2">{getExercise(id).name}</Typography>
              <Typography variant="body2" className="tnum" sx={{ fontWeight: 600 }}>{value} kg</Typography>
            </Stack>
          ))}
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          These move at the end of a block, based on what your top sets actually did.
        </Typography>
      </Card>

      <Card variant="outlined" sx={{ p: 2 }}>
        <Typography variant="overline" color="text.secondary">Pace</Typography>
        <Typography variant="body2" sx={{ mt: 1 }}>
          Sessions are estimated at {Math.round(profile.paceFactor * 100)}% of the standard pace.
          This calibrates itself after five finished sessions.
        </Typography>
      </Card>

      {error && <Alert severity="error">{error}</Alert>}

      <Box>
        <Button size="large" fullWidth disabled={!dirty || pending} onClick={() => setConfirm(true)}>
          Save and rebuild block
        </Button>
        {!dirty && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, textAlign: 'center' }}>
            Change something above to rebuild.
          </Typography>
        )}
      </Box>

      <Dialog open={confirm} onClose={() => setConfirm(false)}>
        <DialogTitle>Rebuild your block?</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary">
            This replaces every session that is not yet done. Sessions you have already logged,
            your training maxes and your records are all kept.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="text" onClick={() => setConfirm(false)}>Cancel</Button>
          <Button disabled={pending} onClick={apply}>{pending ? 'Building…' : 'Rebuild'}</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(toast)} autoHideDuration={4000} onClose={() => setToast(null)} message={toast ?? ''}
      />
    </Stack>
  );
}
