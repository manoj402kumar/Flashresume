import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const ref = searchParams.get('ref');

  const response = NextResponse.next();

  // If ?ref=XXXX is in the URL and no existing affiliate cookie, set it (first-touch attribution)
  if (ref && ref.match(/^[a-zA-Z0-9_-]{3,20}$/) && !request.cookies.get('affiliate_ref')) {
    response.cookies.set('affiliate_ref', ref, {
      httpOnly: false,      // readable by JS so we can send to backend on payment
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
  }

  return response;
}

export const config = {
  // Run on all page routes — skip API, static files, images
  matcher: ['/((?!_next/static|_next/image|favicon|api).*)'],
};
