import { NextResponse } from 'next/server';
import { db, companies } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';

export async function GET() {
  try {
    const result = await db.select().from(companies);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to fetch companies:', error);
    return NextResponse.json({ error: 'Failed to fetch companies' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const newCompany = {
      id: uuid(),
      name: body.name,
      address: body.address,
      city: body.city,
      country: body.country,
      postalCode: body.postalCode || null,
      vatNumber: body.vatNumber || null,
      email: body.email,
      phone: body.phone || null,
      currency: body.currency || 'USD',
      logoUrl: body.logoUrl || null,
      region: body.region || 'US',
    };

    await db.insert(companies).values(newCompany);

    const [inserted] = await db.select().from(companies).where(eq(companies.id, newCompany.id));
    return NextResponse.json(inserted, { status: 201 });
  } catch (error) {
    console.error('Failed to create company:', error);
    return NextResponse.json({ error: 'Failed to create company' }, { status: 500 });
  }
}
