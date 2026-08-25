'use client';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineRounded';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { archiveRoutine } from '@/server/actions';
import type { RoutineListItem } from '@/server/routines';
import { NewRoutineDialog } from './NewRoutineDialog';

export function RoutineList({ routines }: { routines: RoutineListItem[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [items, setItems] = useState(routines);
  const [toDelete, setToDelete] = useState<RoutineListItem | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmDelete() {
    if (!toDelete) return;
    setPending(true);
    setError(null);
    const result = await archiveRoutine(toDelete.id);
    setPending(false);
    if (result.ok) {
      setItems((prev) => prev.filter((r) => r.id !== toDelete.id));
      setToDelete(null);
      router.refresh();
    } else {
      setError(result.error);
    }
  }

  return (
    <Stack spacing={2}>
      <Button startIcon={<AddIcon />} variant="outlined" size="large" onClick={() => setCreating(true)}>
        Build a new program
      </Button>

      {items.length === 0 ? (
        <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
          Nothing built yet. Start one above, or duplicate your active generated block from
          the Program page to edit it as a starting point.
        </Typography>
      ) : (
        <Stack spacing={1.5}>
          {items.map((r) => (
            <Card key={r.id} variant="outlined">
              <Stack direction="row" sx={{ alignItems: 'stretch' }}>
                <CardActionArea component={Link} href={`/program/builder/${r.id}`} sx={{ p: 2, flex: 1, minWidth: 0 }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="h3" noWrap>{r.name}</Typography>
                    <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                      <Chip size="small" label={`${r.daysPerWeek} days / week`} />
                      <Chip size="small" label={`${r.weeks} weeks`} />
                    </Stack>
                  </Box>
                </CardActionArea>
                <Stack sx={{ alignItems: 'center', justifyContent: 'center', pr: 1 }}>
                  <IconButton
                    aria-label={`Delete ${r.name}`}
                    onClick={() => setToDelete(r)}
                  >
                    <DeleteOutlineIcon />
                  </IconButton>
                </Stack>
              </Stack>
            </Card>
          ))}
        </Stack>
      )}

      <NewRoutineDialog open={creating} onClose={() => setCreating(false)} />
      <ConfirmDialog
        open={toDelete !== null}
        title="Delete this program?"
        description={<>“{toDelete?.name}” will be removed from your builder. This can’t be undone.</>}
        confirmLabel="Delete"
        pending={pending}
        error={error}
        onConfirm={confirmDelete}
        onClose={() => {
          if (pending) return;
          setToDelete(null);
          setError(null);
        }}
      />
    </Stack>
  );
}
