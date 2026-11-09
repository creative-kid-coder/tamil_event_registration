import { NextResponse, type NextRequest } from 'next/server';
import { sessionFrom } from '@/lib/auth';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = await sessionFrom(req);

  // The home page is for guests; signed-in volunteers and organisers go straight to the desk.
  if (pathname === '/') {
    if (!session) return NextResponse.next();
    const url = req.nextUrl.clone();
    url.pathname = '/desk';
    return NextResponse.redirect(url);
  }

  const adminOnly = pathname.startsWith('/admin') || pathname.startsWith('/api/admin');

  if (session && (!adminOnly || session.role === 'admin')) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return NextResponse.json(
      { error: session ? 'Admin access required' : 'Not signed in' },
      { status: session ? 403 : 401 },
    );
  }
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = session ? '?error=admin_only' : `?next=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/', '/desk/:path*', '/admin/:path*', '/api/registrations/:path*', '/api/checkin/:path*', '/api/admin/:path*'],
};
