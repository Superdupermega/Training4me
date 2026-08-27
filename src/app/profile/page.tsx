import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { PageContainer } from '@/components/PageContainer';
import { AnalysisTabs } from '@/components/profile/AnalysisTabs';
import { today } from '@/core/dates';
import {
  calendarActivity, consistency, e1rmSeries, volumeByMuscleGroup, weeklyVolume,
} from '@/server/analytics';
import { getProfile, getTrainingMaxes, listPRs, recentBodyweights } from '@/server/repo';

export const dynamic = 'force-dynamic';

const DEFAULT_LIFT = 'back-squat';

/**
 * The analysis home: Strength / Volume / Consistency / Body / Records.
 * Body (bodyweight over time) was scoped out of the original chunk 20 pass
 * for needing its own table (docs/DECISIONS.md, 2026-08-25) — that table now
 * exists (docs/07-PRODUCTION-REVIEW.md #19).
 */
export default async function ProfilePage() {
  const profile = await getProfile();
  const [trainingMaxes, prs, weekly, byMuscleGroup, consistencySummary, calendar, strengthSeries, bodyweights] =
    await Promise.all([
      getTrainingMaxes(profile.timezone), listPRs(),
      weeklyVolume(8, profile.timezone), volumeByMuscleGroup(4),
      consistency(profile.timezone), calendarActivity(84, profile.timezone),
      e1rmSeries(DEFAULT_LIFT, profile.timezone), recentBodyweights(),
    ]);

  return (
    <AppShell title="Profile" width="wide">
      <PageContainer width="wide" grid={false}>
        <Stack spacing={2.5}>
          <Box>
            <Typography variant="h1">{profile.displayName ?? 'Your profile'}</Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }}>
              <Chip size="small" label={profile.experience} sx={{ textTransform: 'capitalize' }} />
              <Chip size="small" label={`${profile.bodyweightKg} kg bodyweight`} />
              <Chip size="small" label={`${Math.round(profile.paceFactor * 100)}% pace`} />
            </Stack>
          </Box>

          <Card variant="outlined">
            <CardActionArea component={Link} href="/profile/settings" sx={{ p: 2 }}>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h3">Settings</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Training days, session length, block length, appearance
                  </Typography>
                </Box>
                <ChevronRightIcon color="disabled" />
              </Stack>
            </CardActionArea>
            <Divider />
            <CardActionArea component={Link} href="/profile/export" sx={{ p: 2 }}>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h3">Export your data</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Download every logged set as a CSV, or a full JSON backup
                  </Typography>
                </Box>
                <ChevronRightIcon color="disabled" />
              </Stack>
            </CardActionArea>
          </Card>

          <AnalysisTabs
            strength={{ exerciseId: DEFAULT_LIFT, series: strengthSeries }}
            weekly={weekly}
            byMuscleGroup={byMuscleGroup}
            consistencySummary={consistencySummary}
            calendar={calendar}
            paceFactor={profile.paceFactor}
            prs={prs}
            trainingMaxes={trainingMaxes}
            bodyweights={bodyweights}
            today={today(profile.timezone)}
          />
        </Stack>
      </PageContainer>
    </AppShell>
  );
}
