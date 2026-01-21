import { NextResponse } from 'next/server';
import { db, invoices } from '@/lib/db';
import { desc, eq } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';

export async function GET() {
  try {
    const result = await db.select().from(invoices).orderBy(desc(invoices.createdAt));
    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to fetch invoices:', error);
    return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Generate invoice number
    const lastInvoice = await db
      .select()
      .from(invoices)
      .orderBy(desc(invoices.createdAt))
      .limit(1);

    let nextNumber = 1;
    if (lastInvoice.length > 0) {
      const match = lastInvoice[0].invoiceNumber.match(/INV-(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1]) + 1;
      }
    }

    const invoiceNumber = `INV-${String(nextNumber).padStart(4, '0')}`;

    const newInvoice = {
      id: uuid(),
      invoiceNumber,
      companyId: body.companyId,
      clientName: body.clientName,
      clientEmail: body.clientEmail,
      clientAddress: body.clientAddress,
      clientVatNumber: body.clientVatNumber || null,
      description: body.description,
      items: body.items,
      subtotal: body.subtotal,
      taxRate: body.taxRate || 0,
      taxAmount: body.taxAmount || 0,
      total: body.total,
      currency: body.currency || 'USD',
      status: body.status || 'draft',
      scheduledDate: body.scheduledDate ? new Date(body.scheduledDate) : null,
      notes: body.notes || null,
    };

    await db.insert(invoices).values(newInvoice);

    const [inserted] = await db.select().from(invoices).where(eq(invoices.id, newInvoice.id));
    return NextResponse.json(inserted, { status: 201 });
  } catch (error) {
    console.error('Failed to create invoice:', error);
    return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 });
  }
}
