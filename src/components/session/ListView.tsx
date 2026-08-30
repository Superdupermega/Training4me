'use client';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { minutes } from '@/components/format';
import { ExerciseContextLine } from '@/components/exercises/ExerciseContext';
import { getExercise } from '@/core/library/exercises';
import type { SessionBlock } from '@/core/types';
import type { ExerciseContext } from '@/server/exerciseContext';
import { SetRow, type LoggedValue } from './SetRow';

interface Props {
  blocks: SessionBlock[];
  logged: Record<string, LoggedValue>;
  contexts?: Record<string, ExerciseContext>;
  increment: number;
  microPlates: boolean;
  carried: Record<string, number>;
  expandedSet: string | null;
  onExpand: (id: string) => void;
  openBlock: string;
  onToggleBlock: (letter: string, open: boolean) => void;
  keyFor: (blockLetter: string, slot: string, setNumber: number) => string;
  slotKeyFor: (blockLetter: string, slot: string) => string;
  onComplete: (block: SessionBlock, slot: string, exerciseId: string, setNumber: number, restSec: number, value: LoggedValue) => void;
}

/**
 * The original whole-session view — every block, every set, an accordion
 * per block with the main lift pre-expanded. Unchanged behaviourally from
 * before focus mode existed; this is just that same markup pulled out of
 * `SessionPlayer` so it can be shown or hidden as a unit (and, if
 * `/session/[id]`'s JS budget needs it, `next/dynamic`'d the same way
 * `ReadinessDialog` and `RestTimer` already are).
 */
export function ListView({
  blocks, logged, contexts, increment, microPlates, carried, expandedSet, onExpand,
  openBlock, onToggleBlock, keyFor, slotKeyFor, onComplete,
}: Props) {
  return (
    <>
      {blocks.map((block) => {
        // Same rule as `totals` in SessionPlayer: ramp sets are warm-ups,
        // not working sets. See docs/07-PRODUCTION-REVIEW.md #14.
        const blockSets = block.exercises.flatMap((e) =>
          e.sets.filter((s) => s.kind !== 'ramp').map((s) => keyFor(block.letter, e.slot, s.setNumber)));
        const blockDone = blockSets.length > 0 && blockSets.every((k) => logged[k]);
        return (
          <Accordion
            key={block.letter}
            expanded={openBlock === block.letter}
            onChange={(_, open) => onToggleBlock(block.letter, open)}
            disableGutters elevation={0}
            sx={{ mb: 1.5, border: 1, borderColor: 'divider', borderRadius: 3, '&::before': { display: 'none' } }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', width: '100%' }}>
                <Typography variant="overline" color={blockDone ? 'primary' : 'text.secondary'}>
                  {block.letter}
                </Typography>
                <Typography variant="h3" sx={{ flex: 1 }}>{block.name}</Typography>
                <Typography variant="body2" color="text.secondary" className="tnum">
                  {minutes(block.estimatedSec)}
                </Typography>
              </Stack>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 0, pb: 1 }}>
              {block.note && (
                <Typography variant="body2" color="text.secondary" sx={{ px: 2, pb: 1.5 }}>
                  {block.note}
                </Typography>
              )}
              {block.rounds && block.rounds > 1 && (
                <Typography variant="body2" sx={{ px: 2, pb: 1.5, fontWeight: 600 }}>
                  {block.rounds} rounds, alternating.
                </Typography>
              )}
              {block.exercises.map((be) => {
                const exercise = getExercise(be.exerciseId);
                return (
                  <Box key={be.slot} sx={{ mb: 1 }}>
                    <Stack sx={{ px: 2, pt: 1 }}>
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline' }}>
                        <Typography variant="overline" color="primary">{be.slot}</Typography>
                        <Typography variant="h3" sx={{ flex: 1 }}>{exercise.name}</Typography>
                        <Chip size="small" variant="outlined" label={be.tempo} />
                      </Stack>
                      <Typography variant="body2" color="text.secondary">{be.cue}</Typography>
                      <ExerciseContextLine context={contexts?.[be.exerciseId]} />
                    </Stack>
                    {be.sets.map((set) => {
                      const id = keyFor(block.letter, be.slot, set.setNumber);
                      return (
                        <SetRow
                          key={id}
                          set={set}
                          logged={logged[id]}
                          increment={increment}
                          barbell={exercise.equipment.includes('barbell')}
                          microPlates={microPlates}
                          loadable={exercise.loadable}
                          suggestedWeightKg={contexts?.[be.exerciseId]?.last?.topSet.weightKg
                            ?? contexts?.[be.exerciseId]?.expected?.weightKg ?? null}
                          carriedWeightKg={carried[slotKeyFor(block.letter, be.slot)] ?? null}
                          expanded={expandedSet === id}
                          onExpand={() => onExpand(id)}
                          onComplete={(value) =>
                            onComplete(block, be.slot, be.exerciseId, set.setNumber, set.restSec, value)}
                        />
                      );
                    })}
                  </Box>
                );
              })}
            </AccordionDetails>
          </Accordion>
        );
      })}
    </>
  );
}
