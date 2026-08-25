'use client';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import type { ReactNode } from 'react';

interface Props {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  /** Red, for anything destructive — the default red "contained" reads as the
   * one dangerous button in an otherwise calm-green app, which is the point. */
  danger?: boolean;
  pending?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * The one confirm-before-you-destroy-it dialog for the whole app — a native
 * `confirm()` is what "cheap" looks like; this matches the rest of the UI
 * (rounded corners, themed danger colour, a disabled/pending confirm button)
 * instead of dropping out to the browser chrome.
 */
export function ConfirmDialog({
  open, title, description, confirmLabel = 'Delete', danger = true, pending = false, error, onConfirm, onClose,
}: Props) {
  return (
    <Dialog open={open} onClose={pending ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText component="div">{description}</DialogContentText>
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button variant="text" onClick={onClose} disabled={pending}>Cancel</Button>
        <Button
          onClick={onConfirm}
          disabled={pending}
          color={danger ? 'error' : 'primary'}
        >
          {pending ? 'Working…' : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
