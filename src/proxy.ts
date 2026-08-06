import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect all /admin routes — access only via secret URL /lkopwhg23
  if (pathname.startsWith('/admin')) {
    const adminSession = request.cookies.get('admin_session');

    if (!adminSession || adminSession.value !== 'authenticated') {
      // Return 404 instead of exposing a login page
      return new NextResponse(null, { status: 404 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
