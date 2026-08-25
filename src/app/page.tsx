import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { redirect } from 'next/navigation';
import { connectionSummary } from '@/server/db';
import { getProfile } from '@/server/repo';

export const dynamic = 'force-dynamic';

export default async function Home() {
  let profile;
  try {
    profile = await getProfile();
  } catch (err) {
    // Next hides server exceptions in production behind a digest, so a
    // misconfigured key would otherwise show as "Application error" and nothing
    // else. Render the diagnosis instead.
    return <SetupNeeded message={err instanceof Error ? err.message : String(err)} />;
  }
  redirect(profile.onboardedAt ? '/today' : '/onboarding');
}

function SetupNeeded({ message }: { message: string }) {
  return (
    <Box sx={{ maxWidth: 640, mx: 'auto', p: 3 }}>
      <Stack spacing={2.5}>
        <Typography variant="h1">Almost there</Typography>
        <Typography color="text.secondary">
          The app is running, but it cannot reach the database yet.
        </Typography>

        <Alert severity="warning">{message}</Alert>

        <Box>
          <Typography variant="overline" color="text.secondary">
            What is configured right now
          </Typography>
          <Box
            component="pre"
            sx={{
              mt: 1, p: 2, borderRadius: 2, bgcolor: 'action.hover',
              fontSize: '0.8rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}
          >
            {connectionSummary()}
          </Box>
          <Typography variant="caption" color="text.secondary">
            The key itself is never shown — only what kind of key it is.
          </Typography>
        </Box>

        <Box>
          <Typography variant="overline" color="text.secondary">How to fix it</Typography>
          <Typography component="ol" sx={{ pl: 3, m: 0, '& li': { mb: 1 } }}>
            <li>
              Supabase dashboard → your project → <strong>Project Settings → API Keys</strong>.
            </li>
            <li>
              Under <strong>Secret keys</strong>, reveal and copy the key starting{' '}
              <code>sb_secret_</code>. Not the publishable one.
            </li>
            <li>
              Vercel → <strong>Settings → Environment Variables</strong> → set{' '}
              <code>SUPABASE_SECRET_KEY</code> for <strong>Production</strong>.
            </li>
            <li>Redeploy. Environment changes only apply to a new build.</li>
          </Typography>
        </Box>
      </Stack>
    </Box>
  );
}
