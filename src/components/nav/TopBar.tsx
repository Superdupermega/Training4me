'use client';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Link from 'next/link';
import type { ReactNode } from 'react';

interface Props {
  title: string;
  /** A back arrow, for full-screen routes that sit outside the nav shell. */
  backHref?: string;
  /** A trailing action — search on /exercises, "+" on /program, and so on. */
  action?: ReactNode;
}

export function TopBar({ title, backHref, action }: Props) {
  return (
    <AppBar
      position="sticky" elevation={0} color="transparent"
      sx={{
        top: 0, backdropFilter: 'blur(8px)', bgcolor: 'background.default',
        borderBottom: 1, borderColor: 'divider',
      }}
    >
      <Toolbar sx={{ maxWidth: 1200, mx: 'auto', width: '100%', px: { xs: 1, sm: 2 } }}>
        {backHref && (
          <IconButton component={Link} href={backHref} aria-label="Back" edge="start" sx={{ mr: 1 }}>
            <ArrowBackIcon />
          </IconButton>
        )}
        <Typography variant="h3" sx={{ flex: 1 }} noWrap>{title}</Typography>
        {action && <Box sx={{ ml: 1 }}>{action}</Box>}
      </Toolbar>
    </AppBar>
  );
}
