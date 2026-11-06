import { NextResponse, type NextRequest } from 'next/server';
import { errorResponse } from '@/lib/api';
import { ResponsesError, responsesInfo, saveResponses } from '@/lib/data';

export const dynamic = 'force-dynamic';

/** Vercel functions accept request bodies up to 4.5 MB; a 400-family CSV is about 100 KB. */
const MAX_CHARS = 4_000_000;

/** Admin only (middleware): where the responses are read from, and whether uploading works here. */
export async function GET() {
  try {
    return NextResponse.json(await responsesInfo());
  } catch (error) {
    return errorResponse(error);
  }
}

/** Upload a new responses CSV (the raw file as the request body). It's checked before it replaces the old one. */
export async function POST(req: NextRequest) {
  try {
    const csv = await req.text();
    if (!csv.trim()) return NextResponse.json({ error: 'That file is empty' }, { status: 400 });
    if (csv.length > MAX_CHARS) return NextResponse.json({ error: 'That file is too large for a responses CSV' }, { status: 413 });
    return NextResponse.json(await saveResponses(csv));
  } catch (error) {
    if (error instanceof ResponsesError) return NextResponse.json({ error: error.message }, { status: 400 });
    return errorResponse(error);
  }
}
