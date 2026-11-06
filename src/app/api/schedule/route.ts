import { NextResponse, type NextRequest } from 'next/server';
import { EVENT } from '@/config/event';
import { errorResponse } from '@/lib/api';
import { sessionFrom } from '@/lib/auth';
import { getScheduleWithStatus } from '@/lib/scheduleStore';

export const dynamic = 'force-dynamic';

/** Public: the programme with live statuses. Contains no personal data. */
export async function GET(req: NextRequest) {
  try {
    const { items, error } = getScheduleWithStatus();
    const session = await sessionFrom(req);
    const canManage = session?.role === 'admin';
    return NextResponse.json({
      event: EVENT,
      items,
      updatedAt: new Date().toISOString(),
      canManage,
      // The caller's own sign-in (for the staff header), never anyone else's.
      session,
      // Guests keep seeing the last good programme; only the admin needs the details.
      error: canManage ? error : null,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
