import { NextResponse, type NextRequest } from 'next/server';
import { EVENT } from '@/config/event';
import { sessionFrom } from '@/lib/auth';
import { getData, getParties } from '@/lib/data';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await sessionFrom(req);
  try {
    const [parties, data] = await Promise.all([getParties(), getData()]);
    return NextResponse.json({ session, event: EVENT, parties, missing: data.mapping.missing });
  } catch (error) {
    console.error(error);
    // Still say who's signed in, so the page header (and sign-out) keep working
    // while there are no responses yet.
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ session, event: EVENT, error: message }, { status: 503 });
  }
}
