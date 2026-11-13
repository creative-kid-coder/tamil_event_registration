import { NextResponse, type NextRequest } from 'next/server';
import { EVENT } from '@/config/event';
import { errorResponse } from '@/lib/api';
import { sessionFrom } from '@/lib/auth';
import { DinnerFileError, getDinner, saveDinner } from '@/lib/dinnerStore';

export const dynamic = 'force-dynamic';

const MAX_CHARS = 2_000_000;

/** Admin only (middleware): the dinner packing list with who has had their boxes. */
export async function GET(req: NextRequest) {
  const session = await sessionFrom(req);
  try {
    return NextResponse.json({ session, event: EVENT, ...(await getDinner()) });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ session, event: EVENT, error: message }, { status: 503 });
  }
}

/** Upload a new dinner packing list (the raw CSV as the request body). It's checked before it replaces the old one. */
export async function POST(req: NextRequest) {
  try {
    const csv = await req.text();
    if (!csv.trim()) return NextResponse.json({ error: 'That file is empty' }, { status: 400 });
    if (csv.length > MAX_CHARS) return NextResponse.json({ error: 'That file is too large for a dinner list' }, { status: 413 });
    await saveDinner(csv);
    return NextResponse.json(await getDinner());
  } catch (error) {
    if (error instanceof DinnerFileError) return NextResponse.json({ error: error.message }, { status: 400 });
    return errorResponse(error);
  }
}
