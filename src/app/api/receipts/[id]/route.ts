import { NextResponse } from 'next/server';
import { db, receipts } from '@/lib/db';
import { eq } from 'drizzle-orm';

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await db.delete(receipts).where(eq(receipts.id, id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete receipt:', error);
    return NextResponse.json({ error: 'Failed to delete receipt' }, { status: 500 });
  }
}
