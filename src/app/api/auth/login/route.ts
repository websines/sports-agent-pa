import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  const { password } = await request.json();
  const appPassword = process.env.APP_PASSWORD;

  if (!appPassword) {
    // No password set, allow access
    return NextResponse.json({ success: true });
  }

  if (password === appPassword) {
    const cookieStore = await cookies();
    // Set auth cookie - expires in 30 days
    cookieStore.set('auth_token', generateToken(appPassword), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    });

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
}

function generateToken(password: string): string {
  // Simple hash - not cryptographically secure but good enough for this use case
  const timestamp = Date.now().toString(36);
  const hash = Buffer.from(password + timestamp).toString('base64');
  return `${hash}.${timestamp}`;
}
