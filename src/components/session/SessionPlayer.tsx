'use client';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Paper from '@mui/material/Paper';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { minutes } from '@/components/format';
import { getExercise } from '@/core/library/exercises';
import type { Readiness, SessionBlock } from '@/core/types';
import { beginSession, finishSession, logSets } from '@/server/actions';
import type { LoggedSetRow, SessionRow } from '@/server/repo';
import { ReadinessDialog } from './ReadinessDialog';
import { RestTimer } from './RestTimer';
import { SetRow, type LoggedValue } from './SetRow';
import { drain, enqueue, peek } from './outbox';

const key = (blockLetter: string, slot: string, setNumber: number) =>
  `${blockLetter}:${slot}:${setNumber}`;

interface Props {
  session: SessionRow;
  increment: number;
  initialLogged: Record<string, LoggedValue>;
}

export function SessionPlayer({ session, increment, initialLogged }: Props) {
  const router = useRouter();
  const [logged, setLogged] = useState<Record<string, LoggedValue>>(initialLogged);
  const [blocks, setBlocks] = useState<SessionBlock[]>(session.blocks);
  const [openBlock, setOpenBlock] = useState<string>(() => {
    const next = session.blocks.find((b) => b.kind === 'main');
    return next?.letter ?? session.blocks[0]?.letter ?? 'A';
  });
  const [expandedSet, setExpandedSet] = useState<string | null>(null);
  const [rest, setRest] = useState<{ endsAt: number; totalSec: number } | null>(null);
  const [queued, setQueued] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [askReadiness, setAskReadiness] = useState(session.status === 'planned');
  const [startedAt] = useState(() => (session.startedAt ? new Date(session.startedAt).getTime() : Date.now()));
  const [now, setNow] = useState(startedAt);
  const hardSets = useRef(0);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Keep the screen on while the player is open; harmless where unsupported.
  useEffect(() => {
    let sentinel: WakeLockSentinel | null = null;
    navigator.wakeLock?.request('screen').then((s) => { sentinel = s; }).catch(() => {});
    return () => { sentinel?.release().catch(() => {}); };
  }, []);

  const flush = useCallback(async () => {
    const remaining = await drain(async (rows) => logSets(rows));
    setQueued(remaining);
  }, []);

  useEffect(() => {
    peek().then((q) => setQueued(q.length));
    const id = window.setInterval(flush, 15000);
    window.addEventListener('online', flush);
    return () => { window.clearInterval(id); window.removeEventListener('online', flush); };
  }, [flush]);

  const complete = useCallback(
    async (block: SessionBlock, slot: string, exerciseId: string, setNumber: number, restSec: number, value: LoggedValue) => {
      const id = key(block.letter, slot, setNumber);
      setLogged((prev) => ({ ...prev, [id]: value }));
      setExpandedSet(null);
      if (restSec > 0) setRest({ endsAt: Date.now() + restSec * 1000, totalSec: restSec });

      // A very hard main-lift set means the next one comes down.
      if (block.kind === 'main' && (value.rpe ?? 0) >= 9.5) {
        hardSets.current += 1;
        const factor = hardSets.current >= 2 ? 0.9 : 0.95;
        setBlocks((prev) => prev.map((b) => b !== block ? b : {
          ...b,
          exercises: b.exercises.map((e) => ({
            ...e,
            sets: e.sets.map((s) => s.setNumber > setNumber && s.weightKg
              ? { ...s, weightKg: Math.round(s.weightKg * factor / 2.5) * 2.5 } : s),
          })),
        }));
        setToast(hardSets.current >= 2
          ? 'That is twice at the limit. Remaining sets dropped 10%.'
          : 'Backing the next set off 5%. Leave one in the tank.');
      }

      const row: LoggedSetRow = {
        sessionId: session.id, blockLetter: block.letter, slot, exerciseId, setNumber,
        reps: value.reps ?? null, weightKg: value.weightKg ?? null, rpe: value.rpe ?? null,
        distanceM: value.distanceM ?? null, durationSec: value.durationSec ?? null,
        skipped: false, painFlag: value.painFlag ?? null, clientLoggedAt: new Date().toISOString(),
      };
      setQueued(await enqueue(row));
      flush().catch(() => {});
    },
    [flush, session.id],
  );

  const totals = useMemo(() => {
    const all = blocks.flatMap((b) => b.exercises.flatMap((e) =>
      e.sets.filter((s) => s.kind !== 'ramp').map((s) => key(b.letter, e.slot, s.setNumber))));
    return { total: all.length, done: all.filter((k) => logged[k]).length };
  }, [blocks, logged]);

  const elapsed = Math.max(0, Math.round((now - startedAt) / 1000));

  return (
    <Box sx={{ maxWidth: 680, mx: 'auto', px: 2, pt: 2, pb: rest ? 16 : 12 }}>
      <ReadinessDialog
        open={askReadiness}
        onSkip={() => { setAskReadiness(false); beginSession(session.id, null); }}
        onSubmit={async (readiness: Readiness) => {
          setAskReadiness(false);
          const result = await beginSession(session.id, readiness);
          if (result.ok) router.refresh();
        }}
      />

      <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline', mb: 0.5 }}>
        <Typography variant="h1" sx={{ flex: 1 }}>{session.title}</Typography>
        <Typography className="tnum" variant="h3" color="text.secondary">
          {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}
        </Typography>
      </Stack>
      <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Chip size="small" label={`≈ ${minutes(session.estimatedSec)} planned`} />
        <Chip size="small" label={`${totals.done}/${totals.total} sets`} className="tnum" />
        {session.isDeload && <Chip size="small" color="info" label="Deload" />}
        {queued > 0 && <Chip size="small" color="warning" label={`${queued} queued`} />}
      </Stack>

      {blocks.map((block) => {
        const blockSets = block.exercises.flatMap((e) =>
          e.sets.map((s) => key(block.letter, e.slot, s.setNumber)));
        const blockDone = blockSets.every((k) => logged[k]);
        return (
          <Accordion
            key={block.letter}
            expanded={openBlock === block.letter}
            onChange={(_, open) => setOpenBlock(open ? block.letter : '')}
            disableGutters elevation={0}
            sx={{ mb: 1.5, border: 1, borderColor: 'divider', borderRadius: 3, '&::before': { display: 'none' } }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', width: '100%' }}>
                <Typography variant="overline" color={blockDone ? 'primary' : 'text.secondary'}>
                  {block.letter}
                </Typography>
                <Typography variant="h3" sx={{ flex: 1 }}>{block.name}</Typography>
                <Typography variant="body2" color="text.secondary" className="tnum">
                  {minutes(block.estimatedSec)}
                </Typography>
              </Stack>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 0, pb: 1 }}>
              {block.note && (
                <Typography variant="body2" color="text.secondary" sx={{ px: 2, pb: 1.5 }}>
                  {block.note}
                </Typography>
              )}
              {block.rounds && block.rounds > 1 && (
                <Typography variant="body2" sx={{ px: 2, pb: 1.5, fontWeight: 600 }}>
                  {block.rounds} rounds, alternating.
                </Typography>
              )}
              {block.exercises.map((be) => {
                const exercise = getExercise(be.exerciseId);
                return (
                  <Box key={be.slot} sx={{ mb: 1 }}>
                    <Stack sx={{ px: 2, pt: 1 }}>
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline' }}>
                        <Typography variant="overline" color="primary">{be.slot}</Typography>
                        <Typography variant="h3" sx={{ flex: 1 }}>{exercise.name}</Typography>
                        <Chip size="small" variant="outlined" label={be.tempo} />
                      </Stack>
                      <Typography variant="body2" color="text.secondary">{be.cue}</Typography>
                    </Stack>
                    {be.sets.map((set) => {
                      const id = key(block.letter, be.slot, set.setNumber);
                      return (
                        <SetRow
                          key={id}
                          set={set}
                          logged={logged[id]}
                          increment={increment}
                          expanded={expandedSet === id}
                          onExpand={() => setExpandedSet((prev) => (prev === id ? null : id))}
                          onComplete={(value) =>
                            complete(block, be.slot, be.exerciseId, set.setNumber, set.restSec, value)}
                        />
                      );
                    })}
                  </Box>
                );
              })}
            </AccordionDetails>
          </Accordion>
        );
      })}

      <Paper
        elevation={0}
        sx={{
          position: 'fixed', left: 0, right: 0, bottom: rest ? 96 : 0, zIndex: 15,
          p: 2, pb: rest ? 2 : 'calc(16px + env(safe-area-inset-bottom))',
          borderTop: 1, borderColor: 'divider', bgcolor: 'background.paper',
        }}
      >
        <Box sx={{ maxWidth: 680, mx: 'auto' }}>
          <Button size="large" fullWidth onClick={() => setConfirmFinish(true)}>
            Finish session
          </Button>
        </Box>
      </Paper>

      {rest && (
        <RestTimer
          endsAt={rest.endsAt} totalSec={rest.totalSec}
          onAdjust={(delta) => setRest((prev) => prev && {
            endsAt: prev.endsAt + delta * 1000, totalSec: Math.max(15, prev.totalSec + delta),
          })}
          onDismiss={() => setRest(null)}
        />
      )}

      <Dialog open={confirmFinish} onClose={() => setConfirmFinish(false)}>
        <DialogTitle>Finish this session?</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary">
            {totals.done} of {totals.total} working sets logged.
            {totals.done < totals.total && ' The rest will be left unlogged.'}
          </Typography>
          {queued > 0 && (
            <Alert severity="info" sx={{ mt: 2 }}>
              {queued} sets still to sync. They will send as soon as you are back online.
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="text" onClick={() => setConfirmFinish(false)}>Keep going</Button>
          <Button
            onClick={async () => {
              await flush();
              await finishSession(session.id, elapsed);
              router.push('/plan');
            }}
          >
            Finish
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(toast)} autoHideDuration={5000} onClose={() => setToast(null)}
        message={toast ?? ''} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      />
      <Box aria-live="polite" sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
        {totals.done} of {totals.total} sets logged
      </Box>
    </Box>
  );
}
