import { NextResponse, type NextRequest } from 'next/server';
import { errorResponse, readJson } from '@/lib/api';
import { sessionFrom } from '@/lib/auth';
import { findFamily, handOver, undoHandOver } from '@/lib/dinnerStore';

export const dynamic = 'force-dynamic';

/** Admin only (middleware): records that a family's dinner boxes were handed over. 409 if someone already did. */
export async function POST(req: NextRequest) {
  try {
    const session = await sessionFrom(req);
    if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
    const { key } = await readJson<{ key: string }>(req);
    const family = await findFamily(String(key ?? ''));
    if (!family) return NextResponse.json({ error: 'That family is not in the dinner list. Refresh the page.' }, { status: 404 });

    const result = await handOver(family.key, session.name, family.boxes);
    return NextResponse.json(
      { status: result.created ? 'ok' : 'already', family: { ...family, handover: result.handover } },
      { status: result.created ? 200 : 409 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

/** Undoes a handed-over tick made by mistake. */
export async function DELETE(req: NextRequest) {
  try {
    const session = await sessionFrom(req);
    if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
    const { key } = await readJson<{ key: string }>(req);
    const family = await findFamily(String(key ?? ''));
    if (!family) return NextResponse.json({ error: 'That family is not in the dinner list. Refresh the page.' }, { status: 404 });

    await undoHandOver(family.key, session.name);
    return NextResponse.json({ status: 'ok', family: { ...family, handover: null } });
  } catch (error) {
    return errorResponse(error);
  }
}
