import { NextResponse } from 'next/server';
import { db, contacts } from '@/lib/db';
import { desc, eq } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';

export async function GET() {
  try {
    const result = await db.select().from(contacts).orderBy(contacts.country, contacts.name);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to fetch contacts:', error);
    return NextResponse.json({ error: 'Failed to fetch contacts' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const newContact = {
      id: uuid(),
      name: body.name,
      email: body.email,
      club: body.club || null,
      country: body.country || null,
      league: body.league || null,
      role: body.role || null,
      notes: body.notes || null,
      active: true,
    };

    await db.insert(contacts).values(newContact);

    const [inserted] = await db.select().from(contacts).where(eq(contacts.id, newContact.id));
    return NextResponse.json(inserted, { status: 201 });
  } catch (error) {
    console.error('Failed to create contact:', error);
    return NextResponse.json({ error: 'Failed to create contact' }, { status: 500 });
  }
}
