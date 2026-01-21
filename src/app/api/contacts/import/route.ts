import { NextResponse } from 'next/server';
import { db, contacts } from '@/lib/db';
import { v4 as uuid } from 'uuid';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const contactsToImport = body.contacts as Array<{
      name: string;
      email: string;
      club?: string;
      country?: string;
      league?: string;
    }>;

    if (!contactsToImport || !Array.isArray(contactsToImport)) {
      return NextResponse.json({ error: 'Invalid contacts data' }, { status: 400 });
    }

    const newContacts = contactsToImport.map((c) => ({
      id: uuid(),
      name: c.name,
      email: c.email,
      club: c.club || null,
      country: c.country || null,
      league: c.league || null,
      role: null,
      notes: null,
      active: true,
    }));

    if (newContacts.length > 0) {
      await db.insert(contacts).values(newContacts);
    }

    return NextResponse.json({ imported: newContacts.length }, { status: 201 });
  } catch (error) {
    console.error('Failed to import contacts:', error);
    return NextResponse.json({ error: 'Failed to import contacts' }, { status: 500 });
  }
}
