import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { AppShell } from '@/components/AppShell';
import { PageContainer } from '@/components/PageContainer';
import { MessageInput } from '@/components/coach/MessageInput';
import { isCoachConfigured } from '@/server/coach/config';
import { listCoachMessages } from '@/server/coach/repo';

export const dynamic = 'force-dynamic';

/**
 * `/coach` (chunk 25). Resolves either way — a direct link must never
 * 404 — but only renders a real chat when the coach is actually
 * configured (`docs/11-COACH-PLATFORM.md §1`). The thread itself is
 * server-rendered from `listCoachMessages()`; `MessageInput` is the one
 * small client island that posts a new turn and asks the server component
 * to re-render (`docs/11-COACH-PLATFORM.md §8`: don't pay for chat chrome
 * JS on every other route).
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
                    display: 'flex',
                    justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
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
                </Box>
              ))}
            </Stack>
          )}
        </Stack>
        <Box sx={{ position: 'sticky', bottom: { xs: 'calc(72px + env(safe-area-inset-bottom))', md: 16 }, pt: 1 }}>
          <MessageInput />
        </Box>
      </PageContainer>
    </AppShell>
  );
}
