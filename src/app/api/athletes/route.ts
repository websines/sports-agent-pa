import { NextResponse } from 'next/server';
import { db, athletes } from '@/lib/db';
import { desc, eq } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';

export async function GET() {
  try {
    const result = await db.select().from(athletes).orderBy(desc(athletes.featured), athletes.position, athletes.name);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to fetch athletes:', error);
    return NextResponse.json({ error: 'Failed to fetch athletes' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const newAthlete = {
      id: uuid(),
      name: body.name,
      position: body.position,
      height: body.height || null,
      nationality: body.nationality,
      birthYear: body.birthYear || null,
      notes: body.notes || null,
      profileUrl: body.profileUrl || null,
      highlightUrls: body.highlightUrls || [],
      statsUrl: body.statsUrl || null,
      featured: body.featured || false,
      active: true,
    };

    await db.insert(athletes).values(newAthlete);

    const [inserted] = await db.select().from(athletes).where(eq(athletes.id, newAthlete.id));
    return NextResponse.json(inserted, { status: 201 });
  } catch (error) {
    console.error('Failed to create athlete:', error);
    return NextResponse.json({ error: 'Failed to create athlete' }, { status: 500 });
  }
}
