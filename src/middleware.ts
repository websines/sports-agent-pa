import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Routes that don't require auth
const publicRoutes = ['/login', '/api/auth/login', '/api/cron', '/api/telegram'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (publicRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Allow static files and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Check if APP_PASSWORD is set
  const appPassword = process.env.APP_PASSWORD;
  if (!appPassword) {
    // No password configured, allow all access
    return NextResponse.next();
  }

  // Check for auth cookie
  const authToken = request.cookies.get('auth_token')?.value;

  if (!authToken) {
    // Redirect to login for page requests, return 401 for API
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Validate token
  try {
    const [hash, timestamp] = authToken.split('.');
    const expectedHash = Buffer.from(appPassword + timestamp).toString('base64');

    if (hash !== expectedHash) {
      throw new Error('Invalid token');
    }

    // Check if token is expired (30 days)
    const tokenAge = Date.now() - parseInt(timestamp, 36);
    if (tokenAge > 30 * 24 * 60 * 60 * 1000) {
      throw new Error('Token expired');
    }
  } catch {
    // Invalid token, redirect to login
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('auth_token');
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
