import { NextResponse } from 'next/server';
import { db, receipts } from '@/lib/db';
import { eq } from 'drizzle-orm';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [receipt] = await db.select().from(receipts).where(eq(receipts.id, id));

  if (!receipt) {
    return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
  }

  if (!receipt.rawImageBase64) {
    return NextResponse.json({ error: 'No image available' }, { status: 404 });
  }

  // Convert base64 to buffer
  const buffer = Buffer.from(receipt.rawImageBase64, 'base64');

  // Return image with proper content type
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'image/jpeg',
      'Content-Length': buffer.length.toString(),
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
