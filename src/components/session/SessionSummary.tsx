'use client';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { minutes } from '@/components/format';
import { TopBar } from '@/components/nav/TopBar';
import { getExercise } from '@/core/library/exercises';
import type { SessionBlock } from '@/core/types';
import { logSets } from '@/server/actions';
import type { LoggedSetRow, Pr, SessionRow } from '@/server/repo';
import { SetRow, type LoggedValue } from './SetRow';

const key = (blockLetter: string, slot: string, setNumber: number) =>
  `${blockLetter}:${slot}:${setNumber}`;

const PR_LABEL: Record<string, string> = {
  e1rm: '1RM', rep_max_3: 'Triple', rep_max_5: 'Five', best_set: 'Best set',
};

function formatPr(pr: Pr): string {
  const value = Number(pr.value).toFixed(1).replace(/\.0$/, '');
  return `${PR_LABEL[pr.kind] ?? pr.kind}: ${value} kg`;
}

interface Props {
  session: SessionRow;
  increment: number;
  initialLogged: Record<string, LoggedValue>;
  prs: Pr[];
}

/**
 * A finished session, viewable and editable — the gap docs/07-PRODUCTION-
 * REVIEW.md #15 called the single biggest one in the app: `t4m_logged_set`
 * held every set ever logged, and nothing rendered it once a session was
 * marked complete. Reuses SetRow verbatim rather than forking it — SetRow
 * already renders a logged set as a static done-row that expands into the
 * exact same edit controls on tap, which is precisely "view, and edit if
 * you tap it." Each edit re-submits through the same `logSets` upsert the
 * live player uses, keyed on (session, block, slot, set), so correcting a
 * set here can never create a duplicate — and re-runs PR detection (#8),
 * so fixing a mistyped weight can retroactively award or revoke a PR.
 */
export function SessionSummary({ session, increment, initialLogged, prs }: Props) {
  const router = useRouter();
  const [logged, setLogged] = useState<Record<string, LoggedValue>>(initialLogged);
  const [expandedSet, setExpandedSet] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const prsByExercise = useMemo(() => {
    const map = new Map<string, Pr[]>();
    for (const pr of prs) map.set(pr.exercise_id, [...(map.get(pr.exercise_id) ?? []), pr]);
    return map;
  }, [prs]);

  const complete = useCallback(
    async (block: SessionBlock, slot: string, exerciseId: string, setNumber: number, value: LoggedValue) => {
      const id = key(block.letter, slot, setNumber);
      const previous = logged[id];
      setLogged((prev) => ({ ...prev, [id]: value }));
      setExpandedSet(null);

      const row: LoggedSetRow = {
        sessionId: session.id, blockLetter: block.letter, slot, exerciseId, setNumber,
        reps: value.reps ?? null, weightKg: value.weightKg ?? null, rpe: value.rpe ?? null,
        distanceM: value.distanceM ?? null, durationSec: value.durationSec ?? null,
        skipped: false, painFlag: value.painFlag ?? null, clientLoggedAt: new Date().toISOString(),
      };
      const result = await logSets([row]);
      if (!result.ok) {
        // Roll back the optimistic update — an edit that failed to save
        // must not look saved.
        setLogged((prev) => {
          const next = { ...prev };
          if (previous) next[id] = previous;
          else delete next[id];
          return next;
        });
        setToast(`Could not save that change: ${result.error}`);
        return;
      }
      // A correction can retroactively win (or, if never repeated, simply
      // never win) a PR — refresh so a newly awarded one's chip shows up
      // without a manual reload.
      router.refresh();
    },
    [logged, router, session.id],
  );

  const totals = useMemo(() => {
    const all = session.blocks.flatMap((b) => b.exercises.flatMap((e) =>
      e.sets.filter((s) => s.kind !== 'ramp').map((s) => key(b.letter, e.slot, s.setNumber))));
    return { total: all.length, done: all.filter((k) => logged[k]).length };
  }, [session.blocks, logged]);

  return (
    <Box sx={{ minHeight: '100dvh', pb: 6 }}>
      <TopBar title={session.title} backHref="/today" />

      <Box sx={{ maxWidth: 680, mx: 'auto', px: 2, pt: 2 }}>
        <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
          {session.completedAt && <Chip size="small" label={`Done ${session.completedAt.slice(0, 10)}`} />}
          {session.actualSec != null && (
            <Chip size="small" className="tnum" label={minutes(session.actualSec)} />
          )}
          <Chip size="small" className="tnum" label={`${totals.done}/${totals.total} sets`} />
          {prs.length > 0 && (
            <Chip
              size="small" color="primary" icon={<EmojiEventsIcon />}
              label={`${prs.length} PR${prs.length > 1 ? 's' : ''}`}
            />
          )}
        </Stack>

        {session.blocks.map((block) => (
          <Accordion
            key={block.letter}
            defaultExpanded={block.kind === 'main'}
            disableGutters elevation={0}
            sx={{ mb: 1.5, border: 1, borderColor: 'divider', borderRadius: 3, '&::before': { display: 'none' } }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', width: '100%' }}>
                <Typography variant="overline" color="text.secondary">{block.letter}</Typography>
                <Typography variant="h3" sx={{ flex: 1 }}>{block.name}</Typography>
              </Stack>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 0, pb: 1 }}>
              {block.exercises.map((be) => {
                const exercise = getExercise(be.exerciseId);
                const exercisePRs = prsByExercise.get(be.exerciseId) ?? [];
                return (
                  <Box key={be.slot} sx={{ mb: 1 }}>
                    <Stack sx={{ px: 2, pt: 1 }}>
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline' }}>
                        <Typography variant="overline" color="primary">{be.slot}</Typography>
                        <Typography variant="h3" sx={{ flex: 1 }}>{exercise.name}</Typography>
                      </Stack>
                      {exercisePRs.length > 0 && (
                        <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', mt: 0.5 }}>
                          {exercisePRs.map((pr) => (
                            <Chip
                              key={pr.id} size="small" color="primary" variant="outlined"
                              icon={<EmojiEventsIcon />} label={formatPr(pr)}
                            />
                          ))}
                        </Stack>
                      )}
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
                            complete(block, be.slot, be.exerciseId, set.setNumber, value)}
                        />
                      );
                    })}
                  </Box>
                );
              })}
            </AccordionDetails>
          </Accordion>
        ))}
      </Box>

      <Snackbar
        open={Boolean(toast)} autoHideDuration={5000} onClose={() => setToast(null)}
        message={toast ?? ''} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      />
    </Box>
  );
}
