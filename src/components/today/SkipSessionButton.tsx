'use client';
import Button from '@mui/material/Button';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { skipSession } from '@/server/actions';

/** The 1-tap fallback for a missed day: move on without doing the wizard, without losing the block. */
export function SkipSessionButton({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <Button
      variant="text" disabled={pending}
      sx={{ color: 'inherit', opacity: 0.85 }}
      onClick={async () => {
        setPending(true);
        const result = await skipSession(sessionId);
        setPending(false);
        if (result.ok) router.refresh();
      }}
    >
      {pending ? 'Skipping…' : 'Skip and move on'}
    </Button>
  );
}
