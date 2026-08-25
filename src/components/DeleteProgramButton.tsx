'use client';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineRounded';
import Button from '@mui/material/Button';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { deleteActiveProgram } from '@/server/actions';

export function DeleteProgramButton({ programName }: { programName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setPending(true);
    setError(null);
    const result = await deleteActiveProgram();
    setPending(false);
    if (result.ok) {
      setOpen(false);
      router.refresh();
    } else {
      setError(result.error);
    }
  }

  return (
    <>
      <Button
        variant="text" color="error" size="large" startIcon={<DeleteOutlineIcon />}
        onClick={() => setOpen(true)}
        sx={{ alignSelf: 'flex-start' }}
      >
        Delete program
      </Button>
      <ConfirmDialog
        open={open}
        title="Delete this program?"
        description={
          <>
            “{programName}” will stop being your active plan. Everything you’ve already logged
            stays in your history — this only clears the plan itself, so you can start fresh or
            build a new one.
          </>
        }
        confirmLabel="Delete program"
        pending={pending}
        error={error}
        onConfirm={confirm}
        onClose={() => { if (!pending) setOpen(false); }}
      />
    </>
  );
}
