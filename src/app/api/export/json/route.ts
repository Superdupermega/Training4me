import { requireUnlocked } from '@/server/authGuard';
import { exportFullJson } from '@/server/export';

/** See src/app/api/export/csv/route.ts for why requireUnlocked() runs here too. */
export async function GET(): Promise<Response> {
  try {
    await requireUnlocked();
  } catch {
    return new Response('Locked', { status: 401 });
  }

  const dump = await exportFullJson();
  return new Response(JSON.stringify(dump, null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="training4me-backup-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
