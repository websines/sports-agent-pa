import { NextResponse } from 'next/server';
import { db, blasts } from '@/lib/db';
import { desc, eq } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';

export async function GET() {
  try {
    const result = await db.select().from(blasts).orderBy(desc(blasts.createdAt));
    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to fetch blasts:', error);
    return NextResponse.json({ error: 'Failed to fetch blasts' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const newBlast = {
      id: uuid(),
      subject: body.subject,
      message: body.message || null,
      athleteIds: body.athleteIds,
      contactIds: body.contactIds,
      status: body.scheduledDate ? 'scheduled' : 'draft',
      scheduledDate: body.scheduledDate ? new Date(body.scheduledDate) : null,
      recipientCount: body.contactIds.length,
    };

    await db.insert(blasts).values(newBlast);

    const [inserted] = await db.select().from(blasts).where(eq(blasts.id, newBlast.id));
    return NextResponse.json(inserted, { status: 201 });
  } catch (error) {
    console.error('Failed to create blast:', error);
    return NextResponse.json({ error: 'Failed to create blast' }, { status: 500 });
  }
}
