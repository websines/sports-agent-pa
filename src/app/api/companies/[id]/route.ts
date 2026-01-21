import { NextResponse } from 'next/server';
import { db, companies } from '@/lib/db';
import { eq } from 'drizzle-orm';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();

    await db.update(companies).set(body).where(eq(companies.id, id));

    const [updated] = await db.select().from(companies).where(eq(companies.id, id));
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Failed to update company:', error);
    return NextResponse.json({ error: 'Failed to update company' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await db.delete(companies).where(eq(companies.id, id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete company:', error);
    return NextResponse.json({ error: 'Failed to delete company' }, { status: 500 });
  }
}
