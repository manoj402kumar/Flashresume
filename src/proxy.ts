import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// No admin route protection — dashboard is at secret URL /lkopwhg23
export function proxy(request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [],
};
