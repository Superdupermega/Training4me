'use client';
import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EditNoteIcon from '@mui/icons-material/EditNote';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { applyCoachProposal, dismissCoachProposal } from '@/server/coach/actions';
import type { ProposalDiff } from './proposalDiff';

interface Props {
  messageId: string;
  status: 'pending' | 'applied' | 'dismissed';
  diff: ProposalDiff | null;
}

/**
 * The one place a proposal can be applied — Apply/Dismiss call
 * `applyCoachProposal`/`dismissCoachProposal` (`src/server/coach/actions.ts`)
 * directly; neither ever runs on mount or on any timer, only on a tap
 * (`docs/11-COACH-PLATFORM.md §6.3`: "exercised by an explicit
 * athlete-initiated Apply, never by the reply arriving"). `status` drives
 * which UI shows, not local component state — a page reload after an apply
 * or dismiss from another tab renders the resolved state straight from
 * `proposal_status`, never the buttons again
 * (`docs/chunks/chunk-28-proposal.md §4`).
 */
export function ProposalCard({ messageId, status, diff }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState<'apply' | 'dismiss' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: 'apply' | 'dismiss') => {
    setPending(action);
    setError(null);
    const result = action === 'apply' ? await applyCoachProposal(messageId) : await dismissCoachProposal(messageId);
    setPending(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  };

  return (
    <Paper variant="outlined" elevation={0} sx={{ p: 2, borderRadius: 3, maxWidth: '85%' }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
        <EditNoteIcon fontSize="small" color="primary" />
        <Typography variant="overline" color="text.secondary">Proposed change</Typography>
      </Stack>

      <ProposalDiffBody diff={diff} />

      {status === 'pending' && (
        <Stack spacing={1} sx={{ mt: 1.5 }}>
          <Stack direction="row" spacing={1}>
            <Button
              variant="contained" size="small" disabled={pending !== null}
              onClick={() => run('apply')}
            >
              {pending === 'apply' ? 'Applying…' : 'Apply'}
            </Button>
            <Button
              variant="text" size="small" color="inherit" disabled={pending !== null}
              onClick={() => run('dismiss')}
            >
              {pending === 'dismiss' ? 'Dismissing…' : 'Dismiss'}
            </Button>
          </Stack>
          {error && <Typography variant="caption" color="error">{error}</Typography>}
        </Stack>
      )}
      {status === 'applied' && (
        <Chip
          sx={{ mt: 1.5 }} size="small" color="success" variant="outlined"
          icon={<CheckCircleIcon />} label="Applied"
        />
      )}
      {status === 'dismissed' && (
        <Chip
          sx={{ mt: 1.5 }} size="small" variant="outlined"
          icon={<CancelIcon />} label="Dismissed"
        />
      )}
    </Paper>
  );
}

function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

/** The real diff — a number changing, not a repeat of the model's own sentence (`docs/chunks/chunk-28-proposal.md §4`). */
function ProposalDiffBody({ diff }: { diff: ProposalDiff | null }) {
  if (!diff) {
    return (
      <Typography variant="body2" color="text.secondary">
        This session has changed since the proposal was made — reopen the chat to ask again.
      </Typography>
    );
  }

  const location = `${diff.sessionTitle} · ${diff.blockLetter}/${diff.slot}`;

  if (diff.kind === 'swap_exercise') {
    return (
      <Stack spacing={0.25}>
        <Typography variant="body2" color="text.secondary">{location}</Typography>
        <Typography variant="body2">
          <strong>{diff.fromName}</strong> → <strong>{diff.toName}</strong>
        </Typography>
        <Typography variant="body2" color="text.secondary">{diff.reason}</Typography>
      </Stack>
    );
  }

  if (diff.kind === 'adjust_sets') {
    return (
      <Stack spacing={0.25}>
        <Typography variant="body2" color="text.secondary">{location} · {diff.exerciseName}</Typography>
        <Typography variant="body2">
          Sets: <strong>{diff.fromSets}</strong> → <strong>{diff.toSets}</strong>
        </Typography>
      </Stack>
    );
  }

  const percentChanged = diff.toPercentTm != null && diff.toPercentTm !== diff.fromPercentTm;
  const rpeChanged = diff.toRpe != null && diff.toRpe !== diff.fromRpe;
  return (
    <Stack spacing={0.25}>
      <Typography variant="body2" color="text.secondary">
        {location} · {diff.exerciseName}, set {diff.setNumber}
      </Typography>
      {percentChanged && (
        <Typography variant="body2">
          % training max: <strong>{diff.fromPercentTm != null ? pct(diff.fromPercentTm) : '—'}</strong>
          {' → '}<strong>{pct(diff.toPercentTm!)}</strong>
        </Typography>
      )}
      {rpeChanged && (
        <Typography variant="body2">
          RPE: <strong>{diff.fromRpe ?? '—'}</strong> → <strong>{diff.toRpe}</strong>
        </Typography>
      )}
    </Stack>
  );
}
