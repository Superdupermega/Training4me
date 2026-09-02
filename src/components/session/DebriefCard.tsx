'use client';
import ForumIcon from '@mui/icons-material/Forum';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useEffect, useState } from 'react';
import { generateSessionDebrief } from '@/server/coach/actions';

interface Props {
  sessionId: string;
}

/**
 * The "coach's take" card (`docs/chunks/chunk-27-debrief.md §3`) — its own
 * small client island next to `SessionSummary`'s Notes field, not a reason
 * to touch the rest of that already-client component's state. Only ever
 * mounted by `SessionSummary` when the server page it's rendered from has
 * already confirmed `isCoachConfigured()`
 * (`docs/11-COACH-PLATFORM.md §1`: checked server-side, not re-checked
 * here), so there is nothing to gate on mount beyond calling the action.
 *
 * Calls `generateSessionDebrief` once, immediately — that action itself is
 * the cache: a debrief already generated for this session is returned
 * straight from `t4m_coach_message`, no second model call
 * (`src/server/coach/actions.ts`). A skeleton stands in while it's in
 * flight (this app's motion language has no blocking spinners,
 * `docs/04-DESIGN-SYSTEM.md`); a failure (not configured after all, over
 * cap, a network error) simply renders nothing — no broken-looking card, no
 * retry loop, on a screen the athlete is trying to finish and move on from
 * (`docs/chunks/chunk-27-debrief.md §4`).
 */
export function DebriefCard({ sessionId }: Props) {
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    generateSessionDebrief(sessionId)
      .then((result) => {
        if (cancelled) return;
        if (result.ok && result.data) setText(result.data.text);
      })
      .catch(() => {
        // Swallowed deliberately — this card simply doesn't appear.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (!loading && !text) return null;

  return (
    <Paper
      variant="outlined" elevation={0}
      sx={{ p: 2, mb: 2, borderRadius: 3 }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
        <ForumIcon fontSize="small" color="primary" />
        <Typography variant="overline" color="text.secondary">Coach&apos;s take</Typography>
      </Stack>
      {loading ? (
        <Stack spacing={0.5}>
          <Skeleton variant="text" width="92%" />
          <Skeleton variant="text" width="55%" />
        </Stack>
      ) : (
        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{text}</Typography>
      )}
    </Paper>
  );
}
