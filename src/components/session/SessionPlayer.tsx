'use client';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { clock, minutes } from '@/components/format';
import { TopBar } from '@/components/nav/TopBar';
import { getExercise } from '@/core/library/exercises';
import type { BlockExercise, Readiness, SessionBlock } from '@/core/types';
import { applyAutoregulation, beginSession, finishSession, logSets } from '@/server/actions';
import type { ExerciseContext } from '@/server/exerciseContext';
import type { LoggedSetRow, SessionRow } from '@/server/repo';
import { visuallyHidden } from '@/components/visuallyHidden';
import { FocusView } from './FocusView';
import type { LoggedValue } from './SetRow';
import { drain, enqueue, peek } from './outbox';

// Both are conditionally rendered — ReadinessDialog only appears once, at
// session start, and RestTimer only while resting between sets — so
// neither needs to be in `/session/[id]`'s initial bundle. Split out here
// per docs/06-REDESIGN-PLAN.md §9's own named next-chunk candidate for this
// route's 62 kB budget overage (docs/07-PRODUCTION-REVIEW.md #22). `ssr:
// false` is safe for both: they're pure client interaction (a dialog, a
// countdown), never the first thing painted.
const ReadinessDialog = dynamic(
  () => import('./ReadinessDialog').then((m) => m.ReadinessDialog),
  { ssr: false },
);
const RestTimer = dynamic(
  () => import('./RestTimer').then((m) => m.RestTimer),
  { ssr: false },
);
// Focus mode is the default view of an in-progress session
// (docs/chunks/chunk-22-player-feel.md §2), so the whole-session accordion
// is never the first thing painted either — the same reasoning as the two
// above. `ssr: false` is safe: switching to it is a client interaction
// (tapping "List"), never a server-rendered first paint.
const ListView = dynamic(
  () => import('./ListView').then((m) => m.ListView),
  { ssr: false },
);

const key = (blockLetter: string, slot: string, setNumber: number) =>
  `${blockLetter}:${slot}:${setNumber}`;

/** One movement within this session — every set of it shares a weight decision. */
const slotKey = (blockLetter: string, slot: string) => `${blockLetter}:${slot}`;

/**
 * The weight already chosen for each movement in this session, rebuilt from
 * what is already logged. Later sets win, so a mid-exercise correction (set
 * 3 dropped to 90 kg) is what the rest of the exercise carries, not the
 * opening number — and a reload mid-session picks the decision back up
 * instead of asking for it again.
 *
 * `0` is a real entry: "bodyweight, no load, and I meant it." That is why
 * this is a `Record<string, number>` read with `?? null`, never a truthiness
 * test.
 */
function carriedFromLogged(
  blocks: SessionBlock[], logged: Record<string, LoggedValue>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const block of blocks) {
    for (const exercise of block.exercises) {
      for (const set of exercise.sets) {
        const entry = logged[key(block.letter, exercise.slot, set.setNumber)];
        if (entry) out[slotKey(block.letter, exercise.slot)] = entry.weightKg ?? 0;
      }
    }
  }
  return out;
}

/**
 * The load to *offer* for a set the plan prescribes none for — every
 * accessory, every carry, every hold. Prefers what was actually lifted last
 * time over what the training max projects, matching the priority the
 * context line right above the set already shows the athlete
 * (`summariseContext`), so the number on offer agrees with the number they
 * just read. Offered, never entered: see `SetRow`'s `carriedWeightKg`.
 */
function suggestedWeight(context: ExerciseContext | undefined): number | null {
  return context?.last?.topSet.weightKg ?? context?.expected?.weightKg ?? null;
}

interface Cursor {
  blockLetter: string;
  slot: string;
}

/** Every movement in the session, in the order the list view renders them. */
function allMovements(blocks: SessionBlock[]): Cursor[] {
  return blocks.flatMap((b) => b.exercises.map((e) => ({ blockLetter: b.letter, slot: e.slot })));
}

/**
 * Same rule `totals` and `blockDone` already use: a movement counts as done
 * when every *non-ramp* set of it is logged (vacuously true for a movement
 * with none, e.g. a ramp-only warm-up block, so the cursor never sticks on
 * one). See docs/07-PRODUCTION-REVIEW.md #14.
 */
function movementDone(blockLetter: string, exercise: BlockExercise, logged: Record<string, LoggedValue>): boolean {
  return exercise.sets
    .filter((s) => s.kind !== 'ramp')
    .every((s) => Boolean(logged[key(blockLetter, exercise.slot, s.setNumber)]));
}

/**
 * Where focus mode should open on mount: the first movement that still has
 * something left to log, walked in session order — the same "later sets
 * win" direction `carriedFromLogged` walks in, just stopping at the first
 * gap instead of the last write. A reload mid-session lands back where the
 * athlete was, not at block A. If everything is already done, land on the
 * last movement rather than nowhere.
 */
function seedCursor(blocks: SessionBlock[], logged: Record<string, LoggedValue>): Cursor {
  for (const block of blocks) {
    for (const exercise of block.exercises) {
      if (!movementDone(block.letter, exercise, logged)) {
        return { blockLetter: block.letter, slot: exercise.slot };
      }
    }
  }
  const lastBlock = blocks[blocks.length - 1];
  const lastExercise = lastBlock?.exercises[lastBlock.exercises.length - 1];
  return { blockLetter: lastBlock?.letter ?? '', slot: lastExercise?.slot ?? '' };
}

interface Props {
  session: SessionRow;
  increment: number;
  initialLogged: Record<string, LoggedValue>;
  contexts?: Record<string, ExerciseContext>;
  microPlates?: boolean;
}

export function SessionPlayer({ session, increment, initialLogged, contexts, microPlates = false }: Props) {
  const router = useRouter();
  const [logged, setLogged] = useState<Record<string, LoggedValue>>(initialLogged);
  const [blocks, setBlocks] = useState<SessionBlock[]>(session.blocks);
  // Weight is entered by hand, once per movement: the first set you log
  // decides what the rest of that exercise opens at.
  const [carried, setCarried] = useState<Record<string, number>>(
    () => carriedFromLogged(session.blocks, initialLogged),
  );
  const [openBlock, setOpenBlock] = useState<string>(() => {
    const next = session.blocks.find((b) => b.kind === 'main');
    return next?.letter ?? session.blocks[0]?.letter ?? 'A';
  });
  const [expandedSet, setExpandedSet] = useState<string | null>(null);
  // Focus mode is the default the moment there is a session actually in
  // progress to focus on; a still-`planned` session sits behind the
  // readiness dialog regardless, so which view is under it barely matters —
  // but seeding from `session.status` rather than always `'focus'` keeps a
  // fresh page load on an already-finished-loading session consistent with
  // `askReadiness` right below, which does the same. `startSession` flips
  // this explicitly on a successful start rather than relying on the
  // `router.refresh()` it also calls to re-derive it, matching how
  // `askReadiness` itself is a one-way flag, not a derived value.
  const [view, setView] = useState<'focus' | 'list'>(session.status === 'in_progress' ? 'focus' : 'list');
  const [cursor, setCursor] = useState<Cursor>(() => seedCursor(session.blocks, initialLogged));
  const [rest, setRest] = useState<{ endsAt: number; totalSec: number } | null>(null);
  const [queued, setQueued] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);
  const [askReadiness, setAskReadiness] = useState(session.status === 'planned');
  const [startedAt] = useState(() => (session.startedAt ? new Date(session.startedAt).getTime() : Date.now()));
  const [now, setNow] = useState(startedAt);
  // Reseeded from the session row rather than always starting at 0, so a
  // reload after a backoff already fired doesn't forget it happened. The
  // backoff factor only ever depends on "has this happened before" (>= 2 vs
  // < 2), never the exact count, so seeding to 1 whenever `autoregulated` is
  // already true reproduces the correct next factor in every case — a
  // session that already backed off once or several times both continue
  // straight into the 10% branch on the next hard set, matching what would
  // have happened without the reload. See docs/07-PRODUCTION-REVIEW.md #10.
  const hardSets = useRef(session.autoregulated ? 1 : 0);
  // A mirror of `logged`, kept for `complete()` to read synchronously —
  // `complete` is not recreated on every `logged` change (only on `blocks`),
  // so a plain closure over `logged` there would be stale. Updated the
  // render *after* `logged` changes, which is still "before this call" by
  // the time the next discrete user interaction reaches `complete`.
  const loggedRef = useRef(initialLogged);
  useEffect(() => { loggedRef.current = logged; }, [logged]);
  // Set inside `complete()` only when a movement *just* crossed from not
  // done to done, and consumed by the effect below the first time it runs
  // afterwards — never on a render where the cursor merely happens to sit on
  // an already-done movement. Without that distinction, going back to fix an
  // already-logged set (chunk 22 §2's own worked example) re-triggers the
  // advance the moment the correction is submitted, yanking the athlete
  // straight back off the movement they came back to fix.
  const pendingAdvance = useRef<Cursor | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Keep the screen on while the player is open; harmless where unsupported.
  // A screen wake lock is released by the browser automatically whenever the
  // document goes hidden — locking the phone, switching to a music app — and
  // does not come back on its own. Without re-requesting it on
  // visibilitychange this only ever covered the very first time the screen
  // would have slept, then behaved as if it had never been requested at all
  // for the rest of the workout. See docs/07-PRODUCTION-REVIEW.md #11.
  useEffect(() => {
    let sentinel: WakeLockSentinel | null = null;
    const acquire = () => {
      if (document.visibilityState !== 'visible') return;
      navigator.wakeLock?.request('screen').then((s) => { sentinel = s; }).catch(() => {});
    };
    acquire();
    document.addEventListener('visibilitychange', acquire);
    return () => {
      document.removeEventListener('visibilitychange', acquire);
      sentinel?.release().catch(() => {});
    };
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

      // Only a fresh not-done -> done crossing schedules an advance — never
      // an edit to a movement that was already fully logged (going back to
      // fix set 2 must not immediately push the cursor forward again the
      // moment the fix is submitted). `loggedRef` is the state as of just
      // before this call; `after` is what it becomes once this set lands.
      const exercise = block.exercises.find((e) => e.slot === slot);
      if (exercise) {
        const before = loggedRef.current;
        const wasDone = movementDone(block.letter, exercise, before);
        const after = { ...before, [id]: value };
        if (!wasDone && movementDone(block.letter, exercise, after)) {
          pendingAdvance.current = { blockLetter: block.letter, slot };
        }
      }

      setLogged((prev) => ({ ...prev, [id]: value }));
      setExpandedSet(null);
      if (restSec > 0) setRest({ endsAt: Date.now() + restSec * 1000, totalSec: restSec });

      // What this set was done with becomes what the rest of the movement
      // opens at — the backoff below may still take it down a notch.
      let carryOver = value.weightKg ?? 0;

      // A very hard main-lift set means the next one comes down. Computed
      // as a plain value (not inside the setBlocks updater) so the same
      // array can be persisted via applyAutoregulation right below — it
      // used to live only in this component's state, gone on reload (#10).
      if (block.kind === 'main' && (value.rpe ?? 0) >= 9.5) {
        hardSets.current += 1;
        const factor = hardSets.current >= 2 ? 0.9 : 0.95;
        const nextBlocks = blocks.map((b) => b !== block ? b : {
          ...b,
          exercises: b.exercises.map((e) => ({
            ...e,
            sets: e.sets.map((s) => s.setNumber > setNumber && s.weightKg
              ? { ...s, weightKg: Math.round(s.weightKg * factor / 2.5) * 2.5 } : s),
          })),
        });
        setBlocks(nextBlocks);
        // The prescription for the sets ahead came down; the weight they
        // would otherwise carry over from this one has to come down with
        // it, or the backoff is undone by the first tap on the next set.
        carryOver = Math.round((carryOver * factor) / increment) * increment;
        setToast(hardSets.current >= 2
          ? 'That is twice at the limit. Remaining sets dropped 10%.'
          : 'Backing the next set off 5%. Leave one in the tank.');
        applyAutoregulation(session.id, nextBlocks).catch(() => {});
      }

      setCarried((prev) => ({ ...prev, [slotKey(block.letter, slot)]: carryOver }));

      const row: LoggedSetRow = {
        sessionId: session.id, blockLetter: block.letter, slot, exerciseId, setNumber,
        reps: value.reps ?? null, weightKg: value.weightKg ?? null, rpe: value.rpe ?? null,
        distanceM: value.distanceM ?? null, durationSec: value.durationSec ?? null,
        skipped: false, painFlag: value.painFlag ?? null, clientLoggedAt: new Date().toISOString(),
      };
      setQueued(await enqueue(row));
      flush().catch(() => {});
    },
    [flush, session.id, blocks, increment],
  );

  const totals = useMemo(() => {
    const all = blocks.flatMap((b) => b.exercises.flatMap((e) =>
      e.sets.filter((s) => s.kind !== 'ramp').map((s) => key(b.letter, e.slot, s.setNumber))));
    return { total: all.length, done: all.filter((k) => logged[k]).length };
  }, [blocks, logged]);

  const movements = useMemo(() => allMovements(blocks), [blocks]);
  const cursorIndex = movements.findIndex((m) => m.blockLetter === cursor.blockLetter && m.slot === cursor.slot);
  const currentBlock = blocks.find((b) => b.letter === cursor.blockLetter);
  const currentExercise = currentBlock?.exercises.find((e) => e.slot === cursor.slot);

  // Consumes `pendingAdvance` the first time it runs after `complete()` sets
  // it — from either view, since both call the same `complete`. Only acts
  // while the cursor is still sitting on the movement that just finished
  // (the athlete hasn't already navigated elsewhere), and only ever one step
  // forward, so it can never leapfrog a movement with an unlogged set still
  // sitting in it (a skipped set is a decision, not a reason to jump —
  // docs/chunks/chunk-22-player-feel.md §2). Consumed unconditionally on
  // first sight, whether or not it ends up moving anything, so it is never
  // replayed by a later, unrelated render.
  useEffect(() => {
    const pending = pendingAdvance.current;
    if (!pending) return;
    pendingAdvance.current = null;
    if (pending.blockLetter !== cursor.blockLetter || pending.slot !== cursor.slot) return;
    const idx = movements.findIndex((m) => m.blockLetter === pending.blockLetter && m.slot === pending.slot);
    if (idx !== -1 && idx < movements.length - 1) setCursor(movements[idx + 1]!);
  }, [logged, cursor, movements]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedSet((prev) => (prev === id ? null : id));
  }, []);

  const elapsed = Math.max(0, Math.round((now - startedAt) / 1000));

  // Shared by both the readiness dialog's Skip and Start actions — either
  // way this is the same server call with the same failure mode. Previously
  // Skip fired beginSession without awaiting or checking the result at all:
  // on failure the session never got `started_at`, so the elapsed timer
  // silently restarted from zero on every reload, with an unhandled
  // rejection the only trace. See docs/07-PRODUCTION-REVIEW.md #9.
  const startSession = useCallback(async (readiness: Readiness | null) => {
    setAskReadiness(false);
    setView('focus');
    const result = await beginSession(session.id, readiness);
    if (result.ok) router.refresh();
    else setToast(`Could not start the session: ${result.error}`);
  }, [router, session.id]);

  return (
    <Box sx={{ minHeight: '100dvh', pb: rest ? 16 : 12 }}>
      <ReadinessDialog
        open={askReadiness}
        onSkip={() => startSession(null)}
        onSubmit={(readiness: Readiness) => startSession(readiness)}
      />

      <TopBar
        title={session.title}
        backHref="/today"
        action={
          // `displaySmall` per docs/04-DESIGN-SYSTEM.md §2 — but `TopBar` is
          // `position: sticky` with a fixed-height `Toolbar`, so `lineHeight`
          // is pinned to 1 here rather than the variant's own 1.15: the
          // extra leading was enough to grow the bar's box and shift every
          // block below it down on first paint.
          <Typography className="tnum" variant="displaySmall" color="text.secondary" sx={{ lineHeight: 1 }}>
            {clock(elapsed)}
          </Typography>
        }
      />
      {/*
        `totals` already excludes ramp sets — the same number the "x/y sets"
        chip below reads, just given a shape. Sits directly under the sticky
        `TopBar`, not inside the padded content column, so it reads as part
        of the bar rather than the page.
      */}
      <LinearProgress
        variant="determinate"
        value={totals.total > 0 ? (totals.done / totals.total) * 100 : 0}
        sx={{ height: 4 }}
      />

      <Box sx={{ maxWidth: 680, mx: 'auto', px: 2, pt: 2 }}>
      <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Chip size="small" label={`≈ ${minutes(session.estimatedSec)} planned`} />
        <Chip size="small" label={`${totals.done}/${totals.total} sets`} className="tnum" />
        {session.isDeload && <Chip size="small" color="info" label="Deload" />}
        {queued > 0 && <Chip size="small" color="warning" label={`${queued} queued`} />}
      </Stack>

      {view === 'focus' && currentBlock && currentExercise ? (
        <FocusView
          block={currentBlock}
          exercise={currentExercise}
          exerciseName={getExercise(currentExercise.exerciseId).name}
          logged={logged}
          carriedWeightKg={carried[slotKey(currentBlock.letter, currentExercise.slot)] ?? null}
          suggestedWeightKg={suggestedWeight(contexts?.[currentExercise.exerciseId])}
          increment={increment}
          barbell={getExercise(currentExercise.exerciseId).equipment.includes('barbell')}
          loadable={getExercise(currentExercise.exerciseId).loadable}
          microPlates={microPlates}
          context={contexts?.[currentExercise.exerciseId]}
          expandedSet={expandedSet}
          onExpand={toggleExpand}
          keyFor={(setNumber) => key(currentBlock.letter, currentExercise.slot, setNumber)}
          onComplete={(setNumber, restSec, value) =>
            complete(currentBlock, currentExercise.slot, currentExercise.exerciseId, setNumber, restSec, value)}
          position={{ index: Math.max(0, cursorIndex), total: movements.length }}
          onPrev={() => cursorIndex > 0 && setCursor(movements[cursorIndex - 1]!)}
          onNext={() => cursorIndex < movements.length - 1 && setCursor(movements[cursorIndex + 1]!)}
          canPrev={cursorIndex > 0}
          canNext={cursorIndex >= 0 && cursorIndex < movements.length - 1}
          onShowList={() => setView('list')}
        />
      ) : (
        <>
          <Button
            size="small" variant="outlined" onClick={() => setView('focus')}
            sx={{ mb: 1.5 }}
          >
            Focus view
          </Button>
          <ListView
            blocks={blocks}
            logged={logged}
            contexts={contexts}
            increment={increment}
            microPlates={microPlates}
            carried={carried}
            expandedSet={expandedSet}
            onExpand={toggleExpand}
            openBlock={openBlock}
            onToggleBlock={(letter, open) => setOpenBlock(open ? letter : '')}
            keyFor={key}
            slotKeyFor={slotKey}
            onComplete={complete}
          />
        </>
      )}
      </Box>

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

      <Dialog open={confirmFinish} onClose={() => (finishing ? undefined : setConfirmFinish(false))}>
        <DialogTitle>Finish this session?</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary">
            {totals.done} of {totals.total} working sets logged.
            {totals.done < totals.total && ' The rest will be left unlogged.'}
          </Typography>
          {queued > 0 && (
            <Alert severity="info" sx={{ mt: 2 }}>
              {queued} sets still to sync. They will send as soon as you are back online. PRs
              among them are still detected whenever they do.
            </Alert>
          )}
          {finishError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              Could not finish the session: {finishError}. Nothing was lost — try again.
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="text" onClick={() => setConfirmFinish(false)} disabled={finishing}>
            Keep going
          </Button>
          <Button
            disabled={finishing}
            onClick={async () => {
              setFinishing(true);
              setFinishError(null);
              await flush();
              const result = await finishSession(session.id, elapsed);
              if (result.ok) {
                router.push('/today');
                return;
              }
              // finishSession returned a real failure — previously this was
              // discarded outright and the app navigated away regardless,
              // telling the user the session was complete when it was not.
              // See docs/07-PRODUCTION-REVIEW.md #9.
              setFinishing(false);
              setFinishError(result.error);
            }}
          >
            {finishing ? 'Finishing…' : 'Finish'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(toast)} autoHideDuration={5000} onClose={() => setToast(null)}
        message={toast ?? ''} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      />
      <Box aria-live="polite" sx={visuallyHidden}>
        {totals.done} of {totals.total} sets logged
      </Box>
    </Box>
  );
}
