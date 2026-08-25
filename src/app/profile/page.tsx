import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import InsightsIcon from '@mui/icons-material/Insights';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Chip from '@mui/material/Chip';
import MuiLink from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { PageContainer } from '@/components/PageContainer';
import { getProfile, getTrainingMaxes, listPRs } from '@/server/repo';

export const dynamic = 'force-dynamic';

/**
 * The analysis home (Strength / Volume / Consistency / Records / Body tabs)
 * lands in chunk 20. For now this surfaces what the app already knows —
 * training maxes and recent PRs — plus the route into Settings, which moved
 * here from its own top-level tab.
 */
export default async function ProfilePage() {
  const [profile, trainingMaxes, prs] = await Promise.all([
    getProfile(), getTrainingMaxes(), listPRs(),
  ]);
  const maxEntries = Object.entries(trainingMaxes);

  return (
    <AppShell title="Profile">
      {/* grid=false: the header, settings row and footer card should each
          span the full width; only the two stat cards below go multi-column. */}
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

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
              gap: 2,
            }}
          >
            <Box>
              <Typography variant="overline" color="text.secondary">Training maxes</Typography>
              <Card variant="outlined" sx={{ mt: 1, p: 2 }}>
                {maxEntries.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">None set yet.</Typography>
                ) : (
                  <Stack spacing={0.75}>
                    {maxEntries.map(([id, value]) => (
                      <Stack key={id} direction="row" sx={{ justifyContent: 'space-between' }}>
                        <Typography variant="body2">{id.replace(/-/g, ' ')}</Typography>
                        <Typography variant="body2" className="tnum" sx={{ fontWeight: 600 }}>{value} kg</Typography>
                      </Stack>
                    ))}
                  </Stack>
                )}
              </Card>
            </Box>

            <Box>
              <Typography variant="overline" color="text.secondary">Recent records</Typography>
              <Card variant="outlined" sx={{ mt: 1, p: 2 }}>
                {prs.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    Nothing yet — log a few loaded sets and records show up here.
                  </Typography>
                ) : (
                  <Stack spacing={0.75}>
                    {prs.slice(0, 6).map((pr) => (
                      <Stack key={pr.id} direction="row" sx={{ justifyContent: 'space-between' }}>
                        <Typography variant="body2">{String(pr.exercise_id).replace(/-/g, ' ')}</Typography>
                        <Typography variant="body2" className="tnum" sx={{ fontWeight: 600 }}>
                          {Number(pr.value).toFixed(1).replace(/\.0$/, '')} kg
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>
                )}
              </Card>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                The full picture — see{' '}
                <MuiLink component={Link} href="/history">History</MuiLink> for every finished session.
              </Typography>
            </Box>
          </Box>

          <Card variant="outlined" sx={{ p: 2.5, bgcolor: 'surfaceContainer.main' }}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
              <InsightsIcon color="disabled" />
              <Box>
                <Typography variant="h3">Full analysis is coming</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  Strength trends, weekly volume by muscle group, consistency, and a deeper
                  records view will live here — with an honest empty state until there is
                  enough logged to chart.
                </Typography>
              </Box>
            </Stack>
          </Card>
        </Stack>
      </PageContainer>
    </AppShell>
  );
}
