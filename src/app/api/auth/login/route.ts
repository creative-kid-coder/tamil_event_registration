import { NextResponse } from 'next/server';
import { errorResponse, readJson } from '@/lib/api';
import { createSession, roleForPin, SESSION_COOKIE, SESSION_HOURS } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const body = await readJson<{ name: string; pin: string }>(req);
    const name = String(body.name ?? '').trim().slice(0, 40);
    const pin = String(body.pin ?? '').trim();
    if (!name) return NextResponse.json({ error: 'Enter your name or desk' }, { status: 400 });

    const role = roleForPin(pin);
    if (!role) {
      await new Promise((resolve) => setTimeout(resolve, 1000)); // slow down guessing
      return NextResponse.json({ error: 'Wrong PIN' }, { status: 401 });
    }

    const res = NextResponse.json({ role });
    res.cookies.set(SESSION_COOKIE, await createSession({ name, role }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_HOURS * 3600,
    });
    return res;
  } catch (error) {
    return errorResponse(error);
  }
}
