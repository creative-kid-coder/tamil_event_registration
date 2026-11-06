import { NextResponse, type NextRequest } from 'next/server';
import { errorResponse, readJson } from '@/lib/api';
import { sessionFrom } from '@/lib/auth';
import { checkIn, undoCheckIn } from '@/lib/checkins';
import { findByTicket, getData } from '@/lib/data';

export const dynamic = 'force-dynamic';

/** Records that a party's badges were handed over. 409 if another desk already did. */
export async function POST(req: NextRequest) {
  try {
    const session = await sessionFrom(req);
    if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
    const { ticketId } = await readJson<{ ticketId: string }>(req);
    const reg = findByTicket(getData(), String(ticketId ?? ''));
    if (!reg) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });

    const result = checkIn(reg.ticketId, session.name, reg.badges);
    return NextResponse.json(
      { status: result.created ? 'ok' : 'already', party: { ...reg, checkIn: result.checkIn } },
      { status: result.created ? 200 : 409 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

/** Undoes a check-in made by mistake. */
export async function DELETE(req: NextRequest) {
  try {
    const session = await sessionFrom(req);
    if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
    const { ticketId } = await readJson<{ ticketId: string }>(req);
    const reg = findByTicket(getData(), String(ticketId ?? ''));
    if (!reg) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });

    undoCheckIn(reg.ticketId, session.name);
    return NextResponse.json({ status: 'ok', party: { ...reg, checkIn: null } });
  } catch (error) {
    return errorResponse(error);
  }
}
