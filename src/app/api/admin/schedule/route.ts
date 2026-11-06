import { NextResponse, type NextRequest } from 'next/server';
import { errorResponse, readJson } from '@/lib/api';
import { sessionFrom } from '@/lib/auth';
import { isStatus } from '@/lib/schedule';
import { completeAndStartNext, getScheduleWithStatus, loadSchedule, setNote, setStatus } from '@/lib/scheduleStore';

export const dynamic = 'force-dynamic';

interface Body {
  itemId: string;
  status: string;
  note: string;
  action: 'next';
}

/** Admin only (middleware): change an item's status or note, or complete it and start the next. */
export async function POST(req: NextRequest) {
  try {
    const session = await sessionFrom(req);
    if (session?.role !== 'admin') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

    const body = await readJson<Body>(req);
    const itemId = String(body.itemId ?? '');
    if (!loadSchedule().items.some((item) => item.id === itemId)) {
      return NextResponse.json({ error: 'That programme item no longer exists — refresh the page' }, { status: 400 });
    }

    let startedNext: string | null = null;
    if (body.action === 'next') {
      startedNext = completeAndStartNext(itemId, session.name);
    } else if (body.status !== undefined || body.note !== undefined) {
      if (body.status !== undefined) {
        if (!isStatus(body.status)) return NextResponse.json({ error: `Unknown status "${body.status}"` }, { status: 400 });
        setStatus(itemId, body.status, session.name);
      }
      if (body.note !== undefined) setNote(itemId, String(body.note), session.name);
    } else {
      return NextResponse.json({ error: 'Nothing to change' }, { status: 400 });
    }

    const { items, error } = getScheduleWithStatus();
    return NextResponse.json({ items, error, startedNext, updatedAt: new Date().toISOString() });
  } catch (error) {
    return errorResponse(error);
  }
}
