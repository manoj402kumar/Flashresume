import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// This project uses Next.js "proxy" convention (not "middleware")
export function proxy(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const ref = searchParams.get('ref');

  const response = NextResponse.next();

  // Capture ?ref=XXXX affiliate code — first-touch attribution, 30-day cookie
  if (ref && /^[a-zA-Z0-9_-]{3,20}$/.test(ref) && !request.cookies.get('affiliate_ref')) {
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
  matcher: ['/((?!_next/static|_next/image|favicon|api).*)'],
};
