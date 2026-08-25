import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { PageContainer } from '@/components/PageContainer';
import { AnalysisTabs } from '@/components/profile/AnalysisTabs';
import {
  calendarActivity, consistency, e1rmSeries, volumeByMuscleGroup, weeklyVolume,
} from '@/server/analytics';
import { getProfile, getTrainingMaxes, listPRs } from '@/server/repo';

export const dynamic = 'force-dynamic';

const DEFAULT_LIFT = 'back-squat';

/**
 * The analysis home: Strength / Volume / Consistency / Records (chunk 20).
 * A Body tab (bodyweight over time) was scoped out of this pass — it needs
 * its own table and is the smallest of the five originally sketched tabs;
 * see docs/DECISIONS.md.
 */
export default async function ProfilePage() {
  const [profile, trainingMaxes, prs, weekly, byMuscleGroup, consistencySummary, calendar, strengthSeries] =
    await Promise.all([
      getProfile(), getTrainingMaxes(), listPRs(),
      weeklyVolume(8), volumeByMuscleGroup(4), consistency(), calendarActivity(84),
      e1rmSeries(DEFAULT_LIFT),
    ]);

  return (
    <AppShell title="Profile">
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
          />
        </Stack>
      </PageContainer>
    </AppShell>
  );
}
