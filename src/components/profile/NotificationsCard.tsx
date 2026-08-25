'use client';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useEffect, useState } from 'react';
import { vapidPublicKeyBytes } from '@/core/push';
import { subscribeToPush, unsubscribeFromPush } from '@/server/actions';

type Status = 'checking' | 'unsupported' | 'denied' | 'off' | 'on';

/**
 * The one manual step (VAPID_PRIVATE_KEY — docs/09-PUSH-NOTIFICATIONS.md)
 * this depends on is invisible from here; asking the server to send a push
 * with no subscribers configured just quietly never fires, which is the
 * right failure mode for a card that shouldn't need to explain server
 * configuration to fix a training reminder. See
 * docs/07-PRODUCTION-REVIEW.md #24.
 */
export function NotificationsCard() {
  const [status, setStatus] = useState<Status>('checking');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('unsupported');
      return;
    }
    if (Notification.permission === 'denied') {
      setStatus('denied');
      return;
    }
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setStatus(sub ? 'on' : 'off'))
      .catch(() => setStatus('off'));
  }, []);

  const enable = async () => {
    setPending(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus('denied');
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidPublicKeyBytes(),
      });
      const json = sub.toJSON();
      const result = await subscribeToPush({
        endpoint: sub.endpoint,
        keys: { p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '' },
      });
      if (!result.ok) {
        await sub.unsubscribe();
        setError(result.error);
        return;
      }
      setStatus('on');
    } catch {
      setError('Could not turn on reminders on this device.');
    } finally {
      setPending(false);
    }
  };

  const disable = async () => {
    setPending(true);
    setError(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await unsubscribeFromPush(sub.endpoint);
        await sub.unsubscribe();
      }
      setStatus('off');
    } catch {
      setError('Could not turn off reminders on this device.');
    } finally {
      setPending(false);
    }
  };

  if (status === 'checking') return null;

  return (
    <Card variant="outlined" sx={{ p: 2 }}>
      <Typography variant="h3">Reminders</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1.5 }}>
        A push on this device when today has a session, and a nudge if one gets left open overnight.
      </Typography>

      {status === 'unsupported' && (
        <Alert severity="info">Not supported in this browser.</Alert>
      )}
      {status === 'denied' && (
        <Alert severity="warning">
          Blocked at the browser level. Allow notifications for this site to turn reminders on.
        </Alert>
      )}
      {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
      {(status === 'off' || status === 'on') && (
        <Stack direction="row" spacing={1}>
          {status === 'off' ? (
            <Button onClick={enable} disabled={pending} variant="contained">
              {pending ? 'Turning on…' : 'Turn on for this device'}
            </Button>
          ) : (
            <Button onClick={disable} disabled={pending} variant="outlined">
              {pending ? 'Turning off…' : 'Turn off for this device'}
            </Button>
          )}
        </Stack>
      )}
    </Card>
  );
}
