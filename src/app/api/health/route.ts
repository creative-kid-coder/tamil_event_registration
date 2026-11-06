import { NextResponse } from 'next/server';
import { getData } from '@/lib/data';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = getData();
    const ok = data.mapping.missing.length === 0;
    return NextResponse.json(
      { ok, rows: data.registrations.length, missingColumns: data.mapping.missing },
      { status: ok ? 200 : 500 },
    );
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
