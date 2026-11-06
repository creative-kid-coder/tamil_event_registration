import { NextResponse } from 'next/server';

export function errorResponse(error: unknown, status = 500) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(error);
  return NextResponse.json({ error: message }, { status });
}

export async function readJson<T>(req: Request): Promise<Partial<T>> {
  try {
    return (await req.json()) as Partial<T>;
  } catch {
    return {};
  }
}
