import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutlineRounded';
import Box from '@mui/material/Box';
import CardActionArea from '@mui/material/CardActionArea';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Link from 'next/link';
import { mainLiftOf, minutes, WEEKDAY } from '@/components/format';
import type { SessionRow as Row } from '@/server/repo';

export function SessionRow({ session, divider }: { session: Row; divider: boolean }) {
  const main = mainLiftOf(session.blocks);
  const Icon = session.status === 'completed' ? CheckCircleIcon
    : session.status === 'skipped' ? RemoveCircleOutlineIcon
      : RadioButtonUncheckedIcon;

  return (
    <>
      <CardActionArea component={Link} href={`/session/${session.id}`} sx={{ p: 2 }}>
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
          <Icon fontSize="small" color={session.status === 'completed' ? 'primary' : 'disabled'} />
          <Box sx={{ minWidth: 44 }}>
            <Typography variant="overline" color="text.secondary">
              {WEEKDAY[session.weekday]}
            </Typography>
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h3" noWrap>{session.title}</Typography>
            <Typography variant="body2" color="text.secondary" noWrap>
              {main ? `${main.name} · ${main.summary}` : 'Easy day'}
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" className="tnum">
            {minutes(session.estimatedSec)}
          </Typography>
        </Stack>
      </CardActionArea>
      {divider && <Divider />}
    </>
  );
}
