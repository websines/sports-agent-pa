import { NextResponse } from 'next/server';
import { handleCallback, setTokens } from '@/lib/services/google-drive';
import { db, settings } from '@/lib/db';
import { eq } from 'drizzle-orm';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(new URL('/settings?error=google_auth_failed', request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL('/settings?error=no_code', request.url));
  }

  try {
    const tokens = await handleCallback(code);

    // Store tokens in database
    await db
      .insert(settings)
      .values({
        key: 'google_tokens',
        value: JSON.stringify(tokens),
      })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: JSON.stringify(tokens), updatedAt: new Date() },
      });

    return NextResponse.redirect(new URL('/settings?success=google_connected', request.url));
  } catch (error) {
    console.error('Google OAuth error:', error);
    return NextResponse.redirect(new URL('/settings?error=google_auth_failed', request.url));
  }
}
