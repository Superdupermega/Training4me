'use client';
import SendIcon from '@mui/icons-material/Send';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { sendCoachMessage } from '@/server/coach/actions';

/**
 * The one client island on `/coach` (`docs/11-COACH-PLATFORM.md §8`: don't
 * pay for chat chrome JS on every other route) — same shape
 * `BodyweightCard`/`SkipSessionButton` already use for a small client
 * control inside a server-rendered page: plain `useState` for the pending/
 * error flags, then `router.refresh()` on success so the server component
 * re-fetches `listCoachMessages()` with the new turn in it.
 */
export function MessageInput() {
  const router = useRouter();
  const [text, setText] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    setPending(true);
    setError(null);
    const result = await sendCoachMessage(trimmed);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setText('');
    router.refresh();
  };

  return (
    <Stack spacing={0.5}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-end' }}>
        <TextField
          fullWidth multiline maxRows={4} size="small"
          placeholder="Ask about your training…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          disabled={pending}
        />
        <IconButton
          color="primary" aria-label="Send"
          onClick={submit}
          disabled={pending || !text.trim()}
        >
          <SendIcon />
        </IconButton>
      </Stack>
      {error && <Typography variant="caption" color="error">{error}</Typography>}
    </Stack>
  );
}
