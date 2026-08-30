'use client';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ViewListIcon from '@mui/icons-material/ViewList';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { formatWeight, setTargetText } from '@/components/format';
import { ExerciseContextLine } from '@/components/exercises/ExerciseContext';
import type { BlockExercise, PrescribedSet, SessionBlock } from '@/core/types';
import type { ExerciseContext } from '@/server/exerciseContext';
import { BLOCK_KIND_META } from './blockKindMeta';
import { RampLadder } from './RampLadder';
import { SetRow, type LoggedValue } from './SetRow';

interface Props {
  block: SessionBlock;
  exercise: BlockExercise;
  exerciseName: string;
  logged: Record<string, LoggedValue>;
  carriedWeightKg: number | null;
  suggestedWeightKg: number | null;
  increment: number;
  barbell: boolean;
  loadable: boolean;
  microPlates: boolean;
  context: ExerciseContext | undefined;
  expandedSet: string | null;
  onExpand: (id: string) => void;
  keyFor: (setNumber: number) => string;
  onComplete: (setNumber: number, restSec: number, value: LoggedValue) => void;
  position: { index: number; total: number };
  onPrev: () => void;
  onNext: () => void;
  canPrev: boolean;
  canNext: boolean;
  onShowList: () => void;
}

/**
 * The screen you actually spend a set inside: this movement, its sets, the
 * weight, the clock — not the six-block accordion `SessionPlayer` renders as
 * its list view. A second presentation over the exact same state, per
 * docs/chunks/chunk-22-player-feel.md §2: `complete()`, the outbox, the
 * autoregulation branch and every server action stay in `SessionPlayer`
 * untouched. `SetRow` is reused verbatim — see that file's own comment on
 * why forking it loses behaviour.
 */
export function FocusView({
  block, exercise, exerciseName, logged, carriedWeightKg, suggestedWeightKg, increment,
  barbell, loadable, microPlates, context, expandedSet, onExpand, keyFor, onComplete,
  position, onPrev, onNext, canPrev, canNext, onShowList,
}: Props) {
  const nextUnlogged = exercise.sets.find((s) => !logged[keyFor(s.setNumber)]);
  const heroSet = nextUnlogged ?? exercise.sets[exercise.sets.length - 1];
  const { icon: BlockKindIcon, color: blockKindColor } = BLOCK_KIND_META[block.kind];

  return (
    <Box>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1.5 }}>
        <IconButton onClick={onPrev} disabled={!canPrev} aria-label="Previous movement">
          <ChevronLeftIcon />
        </IconButton>
        <Box sx={{ flex: 1, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary" className="tnum">
            Movement {position.index + 1} of {position.total}
          </Typography>
        </Box>
        <IconButton onClick={onNext} disabled={!canNext} aria-label="Next movement">
          <ChevronRightIcon />
        </IconButton>
        <Button
          size="small" variant="outlined" startIcon={<ViewListIcon />}
          onClick={onShowList} sx={{ ml: 1 }}
        >
          List
        </Button>
      </Stack>

      <Stack spacing={0.5} sx={{ mb: 1.5 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <BlockKindIcon aria-hidden fontSize="small" sx={{ color: blockKindColor }} />
          <Typography variant="overline" color="primary">{block.letter} · {exercise.slot}</Typography>
          <Chip size="small" variant="outlined" label={exercise.tempo} />
        </Stack>
        <Typography variant="h1">{exerciseName}</Typography>
        <Typography variant="body2" color="text.secondary">{exercise.cue}</Typography>
        <ExerciseContextLine context={context} />
      </Stack>

      {heroSet && (
        <Box sx={{ textAlign: 'center', py: 2 }}>
          <Typography variant="displayLarge" className="tnum">{setTargetText(heroSet)}</Typography>
          {heroSet.weightKg != null && (
            <Typography variant="h2" color="text.secondary" className="tnum">
              {formatWeight(heroSet.weightKg)}
            </Typography>
          )}
        </Box>
      )}

      {(() => {
        // Presentation only, same as the list view — see RampLadder.tsx.
        const ramps = exercise.sets.filter((s) => s.kind === 'ramp');
        const working = exercise.sets.filter((s) => s.kind !== 'ramp');
        const renderSet = (set: PrescribedSet) => {
          const id = keyFor(set.setNumber);
          return (
            <SetRow
              key={id}
              set={set}
              logged={logged[id]}
              increment={increment}
              barbell={barbell}
              microPlates={microPlates}
              loadable={loadable}
              suggestedWeightKg={suggestedWeightKg}
              carriedWeightKg={carriedWeightKg}
              expanded={expandedSet === id}
              onExpand={() => onExpand(id)}
              onComplete={(value) => onComplete(set.setNumber, set.restSec, value)}
            />
          );
        };
        return (
          <>
            <RampLadder ramps={ramps}>{ramps.map(renderSet)}</RampLadder>
            {working.map(renderSet)}
          </>
        );
      })()}
    </Box>
  );
}
