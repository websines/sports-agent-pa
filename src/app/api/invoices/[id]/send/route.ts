import { NextResponse } from 'next/server';
import { db, invoices, companies } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { sendInvoiceEmail, sendNotification } from '@/lib/services/email';
import { generateInvoicePDF } from '@/lib/services/pdf';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    // Get invoice with company
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id));

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const [company] = await db.select().from(companies).where(eq(companies.id, invoice.companyId));

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // Generate PDF
    const pdfBuffer = await generateInvoicePDF(invoice, company);

    // Send email
    await sendInvoiceEmail(
      invoice.clientEmail,
      invoice.invoiceNumber,
      invoice.clientName,
      pdfBuffer,
      company.name
    );

    // Update invoice status
    await db
      .update(invoices)
      .set({
        status: 'sent',
        sentAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(invoices.id, id));

    // Send notification
    await sendNotification(
      'Invoice Sent',
      `Invoice ${invoice.invoiceNumber} was sent to ${invoice.clientName} (${invoice.clientEmail})`
    );

    const [updated] = await db.select().from(invoices).where(eq(invoices.id, id));
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Failed to send invoice:', error);
    return NextResponse.json({ error: 'Failed to send invoice' }, { status: 500 });
  }
}
