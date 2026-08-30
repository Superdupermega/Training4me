'use client';
import Card from '@mui/material/Card';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useEffect, useState } from 'react';
import { getExercise } from '@/core/library/exercises';
import type { Pr } from '@/server/repo';

const PR_LABEL: Record<string, string> = {
  e1rm: '1RM', rep_max_3: 'Triple', rep_max_5: 'Five', best_set: 'Best set',
};

/**
 * A CSS animation has no JS text content to update — the "counts up" motion
 * genuinely cannot go through `Providers.tsx`'s global `prefers-reduced-
 * motion` override the way every other animation in this app does, so this
 * is the one place that needs its own check. Scoped to exactly this: not a
 * second general guard mechanism (rule 5), a necessity for the one kind of
 * motion the CSS override structurally cannot reach.
 */
function CountUpValue({ value }: { value: number }) {
  const [display, setDisplay] = useState(() => (
    typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
      ? value : 0
  ));

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setDisplay(value); return; }
    let raf = 0;
    const start = performance.now();
    const durationMs = 600;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      setDisplay(value * (1 - (1 - t) ** 3)); // ease-out cubic
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return <>{display.toFixed(1).replace(/\.0$/, '')}</>;
}

/**
 * The moment before the set-by-set summary, not a badge inside it. Renders
 * directly off the `prs` prop — no snapshot taken on mount — so editing a
 * set that turns out to no longer be a record (SessionSummary re-runs PR
 * detection on every edit) makes the card for it disappear on the very next
 * render, rather than going on celebrating a record that no longer exists.
 */
export function PRMoment({ prs }: { prs: Pr[] }) {
  if (prs.length === 0) return null;
  return (
    <Stack spacing={1.5} sx={{ mb: 2 }}>
      {prs.map((pr) => (
        <Card
          key={pr.id}
          sx={{
            p: 2.5, bgcolor: 'tertiaryContainer.main', color: 'tertiaryContainer.contrastText',
            // Arrives, doesn't interrupt — no modal, nothing to dismiss.
            animation: 'prArrive 400ms ease',
          }}
        >
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <EmojiEventsIcon />
            <Typography variant="overline">{PR_LABEL[pr.kind] ?? pr.kind} · New record</Typography>
          </Stack>
          <Typography variant="h2" sx={{ mt: 0.5 }}>{getExercise(pr.exercise_id).name}</Typography>
          <Typography variant="displayLarge" className="tnum">
            <CountUpValue value={Number(pr.value)} /> kg
          </Typography>
        </Card>
      ))}
    </Stack>
  );
}
