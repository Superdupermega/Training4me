'use client';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { describeSkeleton } from '@/core/generator/split';
import { EQUIPMENT_LABEL, PROFILE_EQUIPMENT, PROFILE_LABEL } from '@/core/library/equipment';
import { estimateTrainingMax, trainingMaxFromOneRepMax, defaultTrainingMaxes } from '@/core/progression/trainingMax';
import {
  EQUIPMENT_PROFILES, type Equipment, type EquipmentProfile, type Experience,
} from '@/core/types';
import { completeOnboarding } from '@/server/actions';

const ANCHORS = [
  { id: 'back-squat', label: 'Back Squat' },
  { id: 'deadlift', label: 'Deadlift' },
  { id: 'bench-press', label: 'Bench Press' },
  { id: 'overhead-press', label: 'Overhead Press' },
] as const;

const EXPERIENCE_COPY: Record<Experience, string> = {
  beginner: 'Under a year of consistent lifting',
  intermediate: 'One to five years, the basics feel familiar',
  advanced: 'Five years or more, you know your numbers',
};

type Entry = { mode: 'orm' | 'reps' | 'skip'; orm: string; weight: string; reps: string };

const emptyEntry: Entry = { mode: 'reps', orm: '', weight: '', reps: '' };

const TOGGLES: Equipment[] = [
  'barbell', 'rack', 'bench', 'dumbbell', 'kettlebell', 'pullup_bar',
  'dip_station', 'bands', 'cardio_machine', 'sled', 'box', 'trap_bar', 'cable',
];

interface Props {
  bodyweightKg: number;
  isEdit?: boolean;
  currentTrainingMaxes?: Record<string, number>;
}

export function OnboardingWizard({ bodyweightKg, isEdit = false, currentTrainingMaxes = {} }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const [daysPerWeek, setDaysPerWeek] = useState<number | null>(null);
  const [experience, setExperience] = useState<Experience | null>(null);
  const [profile, setProfile] = useState<EquipmentProfile | null>(null);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [bodyweight, setBodyweight] = useState(String(bodyweightKg));
  const [microPlates, setMicroPlates] = useState(false);
  const [entries, setEntries] = useState<Record<string, Entry>>(
    Object.fromEntries(ANCHORS.map((a) => [a.id, { ...emptyEntry }])),
  );
  const [capMinutes, setCapMinutes] = useState(60);
  const [weeks, setWeeks] = useState<4 | 6>(4);

  const trainingMaxes = useMemo(() => {
    const out: Record<string, number> = {};
    for (const anchor of ANCHORS) {
      const entry = entries[anchor.id]!;
      if (entry.mode === 'orm' && Number(entry.orm) > 0) {
        out[anchor.id] = trainingMaxFromOneRepMax(Number(entry.orm));
      } else if (entry.mode === 'reps' && Number(entry.weight) > 0 && Number(entry.reps) > 0) {
        out[anchor.id] = estimateTrainingMax(Number(entry.weight), Number(entry.reps));
      }
    }
    return out;
  }, [entries]);

  const barbellAvailable = equipment.includes('barbell');
  const steps = ['Days', 'Experience', 'Kit', 'Strength', 'Length', 'Block'];
  const canAdvance = [
    daysPerWeek != null,
    experience != null,
    profile != null && equipment.length > 0,
    true,
    true,
    true,
  ][step];

  const setEntry = (id: string, patch: Partial<Entry>) =>
    setEntries((prev) => ({ ...prev, [id]: { ...prev[id]!, ...patch } }));

  async function submit() {
    setPending(true);
    setError(null);
    const bw = Number(bodyweight) || bodyweightKg;
    // Typed numbers always win. Otherwise: first-time onboarding needs a
    // starting estimate, but re-running this wizard just to change gear or
    // days must never silently replace real, trained maxes with a fresh
    // bodyweight guess — so an edit with nothing typed leaves them untouched.
    const maxes = Object.keys(trainingMaxes).length
      ? trainingMaxes
      : isEdit ? {} : defaultTrainingMaxes(bw, experience ?? 'intermediate');

    const result = await completeOnboarding({
      daysPerWeek: daysPerWeek ?? 3,
      experience: experience ?? 'intermediate',
      equipmentProfile: profile ?? 'full_gym',
      equipment,
      sessionCapSec: capMinutes * 60,
      mesocycleWeeks: weeks,
      bodyweightKg: bw,
      microPlates,
      trainingMaxes: maxes,
    });
    setPending(false);
    if (result.ok) router.replace('/today');
    else setError(result.error);
  }

  return (
    <Box sx={{ maxWidth: 560, mx: 'auto', px: 2, py: 3, minHeight: '100dvh' }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
        <IconButton
          aria-label="Back" disabled={step === 0}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
        >
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="overline" color="text.secondary">
          Step {step + 1} of 6 · {steps[step]}
        </Typography>
      </Stack>
      <LinearProgress variant="determinate" value={((step + 1) / 6) * 100} sx={{ mb: 3, borderRadius: 2 }} />

      {step === 0 && (
        <Stack spacing={2}>
          <Typography variant="h1">How many days a week can you train?</Typography>
          <Typography color="text.secondary">
            This is the only number that really shapes your plan. Pick what you can hold for a month,
            not what you wish you could do.
          </Typography>
          {[2, 3, 4, 5, 6].map((n) => (
            <Card key={n} variant={daysPerWeek === n ? 'elevation' : 'outlined'}
              sx={{ bgcolor: daysPerWeek === n ? 'primary.main' : undefined,
                    color: daysPerWeek === n ? 'primary.contrastText' : undefined }}>
              <CardActionArea onClick={() => setDaysPerWeek(n)} sx={{ p: 2 }}>
                <Typography variant="h3">{n} days</Typography>
                <Typography variant="body2" sx={{ opacity: 0.85 }}>{describeSkeleton(n)}</Typography>
              </CardActionArea>
            </Card>
          ))}
        </Stack>
      )}

      {step === 1 && (
        <Stack spacing={2}>
          <Typography variant="h1">How long have you been lifting?</Typography>
          {(['beginner', 'intermediate', 'advanced'] as Experience[]).map((value) => (
            <Card key={value} variant={experience === value ? 'elevation' : 'outlined'}
              sx={{ bgcolor: experience === value ? 'primary.main' : undefined,
                    color: experience === value ? 'primary.contrastText' : undefined }}>
              <CardActionArea onClick={() => setExperience(value)} sx={{ p: 2 }}>
                <Typography variant="h3" sx={{ textTransform: 'capitalize' }}>{value}</Typography>
                <Typography variant="body2" sx={{ opacity: 0.85 }}>{EXPERIENCE_COPY[value]}</Typography>
              </CardActionArea>
            </Card>
          ))}
        </Stack>
      )}

      {step === 2 && (
        <Stack spacing={2}>
          <Typography variant="h1">What do you have to train with?</Typography>
          <Stack spacing={1}>
            {EQUIPMENT_PROFILES.map((value) => (
              <Card key={value} variant={profile === value ? 'elevation' : 'outlined'}
                sx={{ bgcolor: profile === value ? 'primary.main' : undefined,
                      color: profile === value ? 'primary.contrastText' : undefined }}>
                <CardActionArea
                  onClick={() => { setProfile(value); setEquipment(PROFILE_EQUIPMENT[value]); }}
                  sx={{ p: 1.5 }}
                >
                  <Typography variant="h3">{PROFILE_LABEL[value]}</Typography>
                </CardActionArea>
              </Card>
            ))}
          </Stack>
          {profile && (
            <>
              <Typography variant="overline" color="text.secondary">Fine tune</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {TOGGLES.map((item) => {
                  const on = equipment.includes(item);
                  return (
                    <Chip
                      key={item} label={EQUIPMENT_LABEL[item]}
                      color={on ? 'primary' : 'default'} variant={on ? 'filled' : 'outlined'}
                      onClick={() => setEquipment((prev) => (
                        // `'none'` (bodyweight) is already set once, on the profile
                        // card itself — every PROFILE_EQUIPMENT list includes it —
                        // so a fine-tune toggle only ever needs to add or remove
                        // the one item it represents.
                        on ? prev.filter((e) => e !== item) : [...prev, item]
                      ))}
                    />
                  );
                })}
              </Box>
            </>
          )}
        </Stack>
      )}

      {step === 3 && (
        <Stack spacing={2}>
          <Typography variant="h1">How strong are you right now?</Typography>
          <Typography color="text.secondary">
            {isEdit
              ? 'Leave anything blank to keep what you already have — nothing here gets overwritten unless you type a new number.'
              : 'Skip anything you do not know. We start conservatively and week one recalibrates.'}
          </Typography>
          <TextField
            label="Bodyweight (kg)" value={bodyweight} onChange={(e) => setBodyweight(e.target.value)}
            slotProps={{ htmlInput: { inputMode: 'decimal' } }} size="small" sx={{ maxWidth: 200 }}
          />
          {barbellAvailable ? ANCHORS.map((anchor) => {
            const entry = entries[anchor.id]!;
            const tm = trainingMaxes[anchor.id];
            return (
              <Card key={anchor.id} variant="outlined" sx={{ p: 2 }}>
                <Typography variant="h3" gutterBottom>{anchor.label}</Typography>
                <ToggleButtonGroup
                  exclusive size="small" value={entry.mode} sx={{ mb: 1.5, flexWrap: 'wrap' }}
                  onChange={(_, value) => value && setEntry(anchor.id, { mode: value })}
                >
                  <ToggleButton value="reps">Weight × reps</ToggleButton>
                  <ToggleButton value="orm">I know my 1RM</ToggleButton>
                  <ToggleButton value="skip">Skip</ToggleButton>
                </ToggleButtonGroup>
                {entry.mode === 'reps' && (
                  <Stack direction="row" spacing={1}>
                    <TextField label="kg" size="small" value={entry.weight}
                      onChange={(e) => setEntry(anchor.id, { weight: e.target.value })}
                      slotProps={{ htmlInput: { inputMode: 'decimal' } }} />
                    <TextField label="reps" size="small" value={entry.reps}
                      onChange={(e) => setEntry(anchor.id, { reps: e.target.value })}
                      slotProps={{ htmlInput: { inputMode: 'numeric' } }} />
                  </Stack>
                )}
                {entry.mode === 'orm' && (
                  <TextField label="1RM (kg)" size="small" value={entry.orm}
                    onChange={(e) => setEntry(anchor.id, { orm: e.target.value })}
                    slotProps={{ htmlInput: { inputMode: 'decimal' } }} />
                )}
                {tm != null ? (
                  <Typography variant="body2" color="primary" sx={{ mt: 1 }}>
                    Training max {tm} kg — week one starts at {Math.round(tm * 0.7 * 2) / 2} kg
                  </Typography>
                ) : isEdit && currentTrainingMaxes[anchor.id] != null && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Current training max: {currentTrainingMaxes[anchor.id]} kg — kept as is unless you enter a new number above.
                  </Typography>
                )}
              </Card>
            );
          }) : (
            <Alert severity="info">
              No barbell in your setup, so there are no training maxes to enter. Loads come from
              reps and how hard each set feels.
            </Alert>
          )}
          <FormControlLabel
            control={<Switch checked={microPlates} onChange={(e) => setMicroPlates(e.target.checked)} />}
            label="I have 1.25 kg plates"
          />
        </Stack>
      )}

      {step === 4 && (
        <Stack spacing={2}>
          <Typography variant="h1">How long can a session be?</Typography>
          <Typography color="text.secondary">
            Every session gets built to fit inside this. Accessories get cut before the main lift does.
          </Typography>
          <ToggleButtonGroup
            exclusive fullWidth value={capMinutes} size="large"
            onChange={(_, value) => value && setCapMinutes(value)}
          >
            {[45, 60, 75].map((m) => <ToggleButton key={m} value={m}>{m} min</ToggleButton>)}
          </ToggleButtonGroup>
        </Stack>
      )}

      {step === 5 && (
        <Stack spacing={2}>
          <Typography variant="h1">How long should the block be?</Typography>
          <Card variant={weeks === 4 ? 'elevation' : 'outlined'}
            sx={{ bgcolor: weeks === 4 ? 'primary.main' : undefined, color: weeks === 4 ? 'primary.contrastText' : undefined }}>
            <CardActionArea onClick={() => setWeeks(4)} sx={{ p: 2 }}>
              <Typography variant="h3">4 weeks</Typography>
              <Typography variant="body2" sx={{ opacity: 0.85 }}>
                Three weeks building, one week easy. Recommended.
              </Typography>
            </CardActionArea>
          </Card>
          <Card variant={weeks === 6 ? 'elevation' : 'outlined'}
            sx={{ bgcolor: weeks === 6 ? 'primary.main' : undefined, color: weeks === 6 ? 'primary.contrastText' : undefined }}>
            <CardActionArea onClick={() => setWeeks(6)} sx={{ p: 2 }}>
              <Typography variant="h3">6 weeks</Typography>
              <Typography variant="body2" sx={{ opacity: 0.85 }}>
                A longer, slower climb. Better if life is unpredictable.
              </Typography>
            </CardActionArea>
          </Card>
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      )}

      <Box sx={{ mt: 4 }}>
        {step < 5 ? (
          <Button size="large" fullWidth disabled={!canAdvance} onClick={() => setStep((s) => s + 1)}>
            Next
          </Button>
        ) : (
          <Button size="large" fullWidth disabled={pending} onClick={submit}>
            {pending ? 'Building your block…' : 'Build my plan'}
          </Button>
        )}
        {!canAdvance && step === 2 && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, textAlign: 'center' }}>
            Pick a setup to continue.
          </Typography>
        )}
      </Box>
    </Box>
  );
}
