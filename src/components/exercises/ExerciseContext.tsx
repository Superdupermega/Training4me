import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { formatWeight } from '@/components/format';
import type { ExerciseContext } from '@/server/exerciseContext';

/**
 * "What did I do last time, or what does my training max say to expect" —
 * chunk 19. One compact line for rows in the picker/history list; the
 * fuller panel for the item editor and the exercise detail page. Priority
 * always favours *last time* over *expected* — a real number beats a
 * projection — and never claims a number it doesn't have.
 */
export function summariseContext(ctx: ExerciseContext | undefined): string {
  if (!ctx) return '';
  if (ctx.last) {
    const { topSet, daysAgo } = ctx.last;
    const load = topSet.weightKg != null
      ? `${formatWeight(topSet.weightKg)}${topSet.reps ? ` × ${topSet.reps}` : ''}`
      : topSet.reps ? `${topSet.reps} reps` : null;
    const when = daysAgo === 0 ? 'today' : daysAgo === 1 ? 'yesterday' : `${daysAgo} days ago`;
    return load ? `Last: ${load}${topSet.rpe ? ` @${topSet.rpe}` : ''} · ${when}` : `Last session: ${when}`;
  }
  if (ctx.expected && ctx.trainingMax) {
    return `Expected: ${ctx.expected.percentTm}% of ${formatWeight(ctx.trainingMax.valueKg)} → ${formatWeight(ctx.expected.weightKg)}`;
  }
  return 'No history yet — first session sets the baseline';
}

export function ExerciseContextLine({ context }: { context: ExerciseContext | undefined }) {
  const text = summariseContext(context);
  if (!text) return null;
  return (
    <Typography variant="body2" color="text.secondary" className="tnum" noWrap>
      {text}
    </Typography>
  );
}

export function ExerciseContextPanel({ context }: { context: ExerciseContext | undefined }) {
  if (!context || (!context.last && !context.expected)) {
    return (
      <Typography variant="body2" color="text.secondary">
        No history yet — first session sets the baseline.
      </Typography>
    );
  }

  const delta = context.last?.topSet.weightKg != null && context.expected
    ? Math.round((context.expected.weightKg - context.last.topSet.weightKg) * 10) / 10
    : null;

  return (
    <Stack spacing={1.5}>
      {context.last && (
        <Box>
          <Typography variant="overline" color="text.secondary">Last time</Typography>
          <Typography className="tnum">
            {context.last.topSet.weightKg != null ? formatWeight(context.last.topSet.weightKg) : '—'}
            {context.last.topSet.reps ? ` × ${context.last.topSet.reps}` : ''}
            {context.last.topSet.rpe ? ` @${context.last.topSet.rpe}` : ''}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {context.last.sessionTitle ?? 'Session'} · {context.last.date}
          </Typography>
        </Box>
      )}
      {context.expected && context.trainingMax && (
        <Box>
          <Typography variant="overline" color="text.secondary">Expected from your training max</Typography>
          <Typography className="tnum">
            {context.expected.percentTm}% of {formatWeight(context.trainingMax.valueKg)}
            {' → '}{formatWeight(context.expected.weightKg)}
          </Typography>
          {delta != null && (
            <Typography variant="body2" color={delta >= 0 ? 'success.main' : 'text.secondary'} className="tnum">
              {delta > 0 ? '+' : ''}{delta} kg vs last time
            </Typography>
          )}
        </Box>
      )}
    </Stack>
  );
}
