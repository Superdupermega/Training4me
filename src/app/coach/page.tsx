import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { AppShell } from '@/components/AppShell';
import { PageContainer } from '@/components/PageContainer';
import { MessageInputLazy } from '@/components/coach/MessageInputLazy';
import { ProposalCardLazy } from '@/components/coach/ProposalCardLazy';
import { buildProposalDiff, type ProposalDiff } from '@/components/coach/proposalDiff';
import { proposedChangeSchema } from '@/core/coach/tools';
import { isCoachConfigured } from '@/server/coach/config';
import { getSession } from '@/server/repo';
import { type CoachMessage, listCoachMessages } from '@/server/coach/repo';

export const dynamic = 'force-dynamic';

/**
 * For every message carrying a `proposal`, resolves the session it targets
 * (once per distinct session, not once per message) and builds the diff
 * `ProposalCard` renders — a `null` entry means the stored `proposal` no
 * longer parses (shouldn't happen — it was zod-checked before it was ever
 * saved, `src/server/coach/actions.ts`) or its target session/block/slot is
 * gone; either way `ProposalCard` falls back to a plain "this has changed"
 * line rather than the page throwing.
 */
async function resolveProposalDiffs(messages: CoachMessage[]): Promise<Map<string, ProposalDiff | null>> {
  const withProposals = messages
    .map((m) => ({ m, parsed: m.proposal != null ? proposedChangeSchema.safeParse(m.proposal) : null }))
    .filter((x): x is { m: CoachMessage; parsed: NonNullable<typeof x.parsed> } => x.parsed != null);

  const sessionIds = [...new Set(withProposals.filter((x) => x.parsed.success).map((x) => x.parsed.data!.sessionId))];
  const sessions = await Promise.all(sessionIds.map((id) => getSession(id)));
  const sessionById = new Map(sessionIds.map((id, i) => [id, sessions[i] ?? null]));

  const diffs = new Map<string, ProposalDiff | null>();
  for (const { m, parsed } of withProposals) {
    diffs.set(m.id, parsed.success ? buildProposalDiff(sessionById.get(parsed.data.sessionId) ?? null, parsed.data) : null);
  }
  return diffs;
}

/**
 * `/coach` (chunk 25; proposals, chunk 28). Resolves either way — a direct
 * link must never 404 — but only renders a real chat when the coach is
 * actually configured (`docs/11-COACH-PLATFORM.md §1`). The thread itself is
 * server-rendered from `listCoachMessages()`; `MessageInputLazy`/
 * `ProposalCardLazy` are the only client islands, deferred out of this
 * route's initial JS the same way (`docs/chunks/chunk-29-coach-guardrails.md
 * §2`): most messages carry no proposal at all, so most page loads never
 * pay for `ProposalCard`'s Apply/Dismiss chrome.
 */
export default async function CoachPage() {
  if (!isCoachConfigured()) {
    return (
      <AppShell title="Coach">
        <PageContainer>
          <Stack spacing={2} sx={{ py: 6 }}>
            <Typography variant="h1">The coach isn&apos;t set up yet</Typography>
            <Typography color="text.secondary">
              The coach is an AI training partner for this one athlete — it reads your profile,
              program, recent sessions and PRs, and can talk through your training with you. It
              needs an <code>ANTHROPIC_API_KEY</code> to work, and that isn&apos;t set for this
              deployment, so nothing here can call out yet.
            </Typography>
            <Typography color="text.secondary">
              Nothing else about the app depends on this — everything you&apos;ve built and
              logged works exactly the same without it.
            </Typography>
          </Stack>
        </PageContainer>
      </AppShell>
    );
  }

  const messages = await listCoachMessages();
  // Cheap on every normal page load — most messages carry no proposal at
  // all, so `resolveProposalDiffs` only ever does real work (a session
  // fetch per distinct target) when there's something to show.
  const proposalDiffs = await resolveProposalDiffs(messages);

  return (
    <AppShell title="Coach">
      <PageContainer>
        <Stack spacing={2} sx={{ pb: 2 }}>
          {messages.length === 0 ? (
            <Alert severity="info" variant="outlined">
              Ask about your training — your training maxes, this week&apos;s sessions, your
              recent PRs, anything in your own log. It won&apos;t invent a number it doesn&apos;t
              actually have.
            </Alert>
          ) : (
            <Stack spacing={1.5}>
              {messages.map((m) => (
                <Box
                  key={m.id}
                  sx={{
                    display: 'flex', flexDirection: 'column', gap: 1,
                    alignItems: m.role === 'user' ? 'flex-end' : 'flex-start',
                  }}
                >
                  <Paper
                    variant={m.role === 'user' ? 'elevation' : 'outlined'}
                    elevation={0}
                    sx={{
                      px: 1.75, py: 1, maxWidth: '85%', borderRadius: 3,
                      bgcolor: m.role === 'user' ? 'primaryContainer.main' : 'transparent',
                      color: m.role === 'user' ? 'primaryContainer.contrastText' : 'text.primary',
                    }}
                  >
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                      {m.content}
                    </Typography>
                  </Paper>
                  {m.proposal != null && m.proposalStatus != null && (
                    <ProposalCardLazy
                      messageId={m.id}
                      status={m.proposalStatus}
                      diff={proposalDiffs.get(m.id) ?? null}
                    />
                  )}
                </Box>
              ))}
            </Stack>
          )}
        </Stack>
        <Box sx={{ position: 'sticky', bottom: { xs: 'calc(72px + env(safe-area-inset-bottom))', md: 16 }, pt: 1 }}>
          <MessageInputLazy />
        </Box>
      </PageContainer>
    </AppShell>
  );
}
