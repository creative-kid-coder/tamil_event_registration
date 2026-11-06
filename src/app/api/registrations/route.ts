import { NextResponse, type NextRequest } from 'next/server';
import { EVENT } from '@/config/event';
import { errorResponse } from '@/lib/api';
import { sessionFrom } from '@/lib/auth';
import { getData, getParties } from '@/lib/data';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await sessionFrom(req);
    return NextResponse.json({ session, event: EVENT, parties: getParties(), missing: getData().mapping.missing });
  } catch (error) {
    return errorResponse(error);
  }
}
