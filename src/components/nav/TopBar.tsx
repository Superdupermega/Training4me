'use client';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { CONTENT_WIDTH, type ContentWidth } from '@/components/PageContainer';

interface Props {
  title: string;
  /** A back arrow, for full-screen routes that sit outside the nav shell. */
  backHref?: string;
  /** A trailing action — search on /exercises, "+" on /program, and so on. */
  action?: ReactNode;
  /**
   * The content column this bar sits above, so the title lands on the same
   * grid as the page's own heading rather than 224px to its left.
   */
  width?: ContentWidth;
}

export function TopBar({ title, backHref, action, width = 'narrow' }: Props) {
  return (
    <AppBar
      position="sticky" elevation={0} color="transparent"
      sx={{
        top: 0, backdropFilter: 'blur(8px)', bgcolor: 'background.default',
        borderBottom: 1, borderColor: 'divider',
      }}
    >
      {/*
        `maxWidth` is the column width *plus* this toolbar's own gutters,
        because a Toolbar's max-width bounds its border box while
        `PageContainer`'s bounds its content — the shell supplies that page's
        gutter from outside. Adding the 2×16px back here is what puts the
        title's left edge exactly on the heading's, rather than 16px inside
        it. `px` matches the shell's `px: 2` at every breakpoint for the same
        reason.
      */}
      <Toolbar
        // `disableGutters` because MUI's own `.MuiToolbar-gutters` rule is
        // media-queried (16px at xs, 24px at sm+) and so outranks a flat
        // `px` here — which left the title 8px off the heading even after
        // the column widths matched.
        disableGutters
        sx={{ maxWidth: CONTENT_WIDTH[width] + 32, mx: 'auto', width: '100%', px: 2 }}
      >
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
