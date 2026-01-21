import { NextResponse } from 'next/server';
import { db, athletes } from '@/lib/db';
import { eq } from 'drizzle-orm';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const [athlete] = await db.select().from(athletes).where(eq(athletes.id, id));

    if (!athlete) {
      return NextResponse.json({ error: 'Athlete not found' }, { status: 404 });
    }

    return NextResponse.json(athlete);
  } catch (error) {
    console.error('Failed to fetch athlete:', error);
    return NextResponse.json({ error: 'Failed to fetch athlete' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();

    await db
      .update(athletes)
      .set({
        ...body,
        updatedAt: new Date(),
      })
      .where(eq(athletes.id, id));

    const [updated] = await db.select().from(athletes).where(eq(athletes.id, id));
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Failed to update athlete:', error);
    return NextResponse.json({ error: 'Failed to update athlete' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await db.delete(athletes).where(eq(athletes.id, id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete athlete:', error);
    return NextResponse.json({ error: 'Failed to delete athlete' }, { status: 500 });
  }
}
