'use client';
import AddIcon from '@mui/icons-material/Add';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Link from 'next/link';
import { useState } from 'react';
import type { RoutineListItem } from '@/server/routines';
import { NewRoutineDialog } from './NewRoutineDialog';

export function RoutineList({ routines }: { routines: RoutineListItem[] }) {
  const [creating, setCreating] = useState(false);

  return (
    <Stack spacing={2}>
      <Button startIcon={<AddIcon />} variant="outlined" size="large" onClick={() => setCreating(true)}>
        Build a new program
      </Button>

      {routines.length === 0 ? (
        <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
          Nothing built yet. Start one above, or duplicate your active generated block from
          the Program page to edit it as a starting point.
        </Typography>
      ) : (
        <Stack spacing={1.5}>
          {routines.map((r) => (
            <Card key={r.id} variant="outlined">
              <CardActionArea component={Link} href={`/program/builder/${r.id}`} sx={{ p: 2 }}>
                <Box>
                  <Typography variant="h3">{r.name}</Typography>
                  <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                    <Chip size="small" label={`${r.daysPerWeek} days / week`} />
                    <Chip size="small" label={`${r.weeks} weeks`} />
                  </Stack>
                </Box>
              </CardActionArea>
            </Card>
          ))}
        </Stack>
      )}

      <NewRoutineDialog open={creating} onClose={() => setCreating(false)} />
    </Stack>
  );
}
