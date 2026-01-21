import { NextResponse } from 'next/server';
import { db, invoices, blasts, receipts, athletes, contacts, companies } from '@/lib/db';
import { eq, lte, and, inArray } from 'drizzle-orm';
import { sendInvoiceEmail, sendAthleteBlastEmail, sendNotification } from '@/lib/services/email';
import { generateInvoicePDF } from '@/lib/services/pdf';
import { extractReceiptData, generateReceiptFilename } from '@/lib/services/llm';
import { uploadFileToDrive, isAuthenticated } from '@/lib/services/google-drive';

// Vercel cron - runs every hour
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  // Verify cron secret in production
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results = {
    invoices: { processed: 0, failed: 0 },
    blasts: { processed: 0, failed: 0 },
    receipts: { processed: 0, failed: 0 },
  };

  try {
    // 1. Process scheduled invoices
    const now = new Date();
    const scheduledInvoices = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.status, 'scheduled'), lte(invoices.scheduledDate, now)));

    for (const invoice of scheduledInvoices) {
      try {
        const [company] = await db.select().from(companies).where(eq(companies.id, invoice.companyId));

        if (company) {
          const pdfBuffer = await generateInvoicePDF(invoice, company);
          await sendInvoiceEmail(
            invoice.clientEmail,
            invoice.invoiceNumber,
            invoice.clientName,
            pdfBuffer,
            company.name
          );

          await db
            .update(invoices)
            .set({ status: 'sent', sentAt: new Date(), updatedAt: new Date() })
            .where(eq(invoices.id, invoice.id));

          results.invoices.processed++;
        }
      } catch (error) {
        console.error(`Failed to send invoice ${invoice.id}:`, error);
        results.invoices.failed++;
      }
    }

    // 2. Process scheduled blasts
    const scheduledBlasts = await db
      .select()
      .from(blasts)
      .where(and(eq(blasts.status, 'scheduled'), lte(blasts.scheduledDate, now)));

    for (const blast of scheduledBlasts) {
      try {
        const athleteIds = blast.athleteIds as string[];
        const contactIds = blast.contactIds as string[];

        const selectedAthletes = await db
          .select()
          .from(athletes)
          .where(inArray(athletes.id, athleteIds));

        const selectedContacts = await db
          .select()
          .from(contacts)
          .where(inArray(contacts.id, contactIds));

        const athletesHtml = generateAthletesHtml(selectedAthletes);

        let successCount = 0;
        for (const contact of selectedContacts) {
          try {
            await sendAthleteBlastEmail(contact.email, blast.subject, athletesHtml, blast.message || undefined);
            successCount++;
          } catch (e) {
            console.error(`Failed to send blast to ${contact.email}:`, e);
          }
        }

        await db
          .update(blasts)
          .set({ status: 'sent', sentAt: new Date(), recipientCount: successCount })
          .where(eq(blasts.id, blast.id));

        results.blasts.processed++;
      } catch (error) {
        console.error(`Failed to send blast ${blast.id}:`, error);
        results.blasts.failed++;
      }
    }

    // 3. Process queued receipts
    const queuedReceipts = await db
      .select()
      .from(receipts)
      .where(eq(receipts.status, 'queued'));

    for (const receipt of queuedReceipts) {
      if (!receipt.rawImageBase64) continue;

      try {
        await db.update(receipts).set({ status: 'processing' }).where(eq(receipts.id, receipt.id));

        const data = await extractReceiptData(receipt.rawImageBase64);
        const filename = generateReceiptFilename(data);

        let driveUrl = null;
        let driveFileId = null;

        if (isAuthenticated()) {
          try {
            const buffer = Buffer.from(receipt.rawImageBase64, 'base64');
            const result = await uploadFileToDrive(`${filename}.jpg`, buffer, 'image/jpeg');
            driveUrl = result.webViewLink;
            driveFileId = result.id;
          } catch (e) {
            console.error('Failed to upload to Drive:', e);
          }
        }

        await db
          .update(receipts)
          .set({
            date: data.date,
            amount: data.amount,
            currency: data.currency,
            description: data.description,
            category: data.category || null,
            generatedFilename: filename,
            driveUrl,
            driveFileId,
            status: 'done',
            rawImageBase64: null,
            processedAt: new Date(),
          })
          .where(eq(receipts.id, receipt.id));

        results.receipts.processed++;
      } catch (error) {
        console.error(`Failed to process receipt ${receipt.id}:`, error);
        await db
          .update(receipts)
          .set({ status: 'failed', error: error instanceof Error ? error.message : 'Unknown error' })
          .where(eq(receipts.id, receipt.id));
        results.receipts.failed++;
      }
    }

    // Send summary notification if anything was processed
    const totalProcessed =
      results.invoices.processed + results.blasts.processed + results.receipts.processed;
    if (totalProcessed > 0) {
      await sendNotification(
        'Cron Job Summary',
        `Processed: ${results.invoices.processed} invoices, ${results.blasts.processed} blasts, ${results.receipts.processed} receipts`
      );
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error('Cron job failed:', error);
    return NextResponse.json({ error: 'Cron job failed' }, { status: 500 });
  }
}

function generateAthletesHtml(athleteList: typeof athletes.$inferSelect[]): string {
  const grouped: Record<string, typeof athleteList> = {};
  athleteList.forEach((a) => {
    if (!grouped[a.position]) grouped[a.position] = [];
    grouped[a.position].push(a);
  });

  let html = '';
  for (const [position, athletes] of Object.entries(grouped)) {
    html += `<div style="margin-bottom: 24px;"><h3 style="color: #ff6b35; font-size: 14px; text-transform: uppercase; margin-bottom: 12px; border-bottom: 2px solid #ff6b35; padding-bottom: 4px;">${position}</h3>`;
    for (const athlete of athletes) {
      const highlights = (athlete.highlightUrls as string[]) || [];
      html += `<div style="background: #f9f9f9; border-radius: 8px; padding: 16px; margin-bottom: 12px;"><h4 style="margin: 0 0 4px 0; color: #111;">${athlete.name}${athlete.featured ? ' <span style="color: #eab308;">★</span>' : ''}</h4><p style="margin: 0; color: #666; font-size: 14px;">${athlete.height ? `${athlete.height} · ` : ''}${athlete.nationality}${athlete.birthYear ? ` · ${athlete.birthYear}` : ''}</p><div style="margin-top: 12px; display: flex; gap: 12px; flex-wrap: wrap;">${athlete.profileUrl ? `<a href="${athlete.profileUrl}" style="color: #ff6b35; text-decoration: none; font-size: 13px;">Profile →</a>` : ''}${highlights.length > 0 ? `<a href="${highlights[0]}" style="color: #ff6b35; text-decoration: none; font-size: 13px;">Highlights →</a>` : ''}${athlete.statsUrl ? `<a href="${athlete.statsUrl}" style="color: #ff6b35; text-decoration: none; font-size: 13px;">Stats/Video →</a>` : ''}</div></div>`;
    }
    html += '</div>';
  }
  return html;
}
