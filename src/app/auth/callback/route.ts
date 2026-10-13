import { NextRequest, NextResponse } from 'next/server';
import { serverClient } from '@/lib/supabase/server';
import { authDestination } from '@/lib/auth-destination';

export async function GET(request: NextRequest) {
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL;
  if (!configuredOrigin) return NextResponse.json({ error: 'Authentication is not configured.' }, { status: 503 });
  // Reverse proxies can expose an internal request URL. Redirect to the trusted
  // application origin so confirmation/recovery never send users to localhost.
  const origin = new URL(configuredOrigin).origin;
  const code = request.nextUrl.searchParams.get('code');
  const next = request.nextUrl.searchParams.get('next') === '/reset-password' ? '/reset-password' : authDestination(request.nextUrl.searchParams.get('next'));
  if (code) {
    const supabase = await serverClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }
  return NextResponse.redirect(new URL('/login?error=confirmation', origin));
}
