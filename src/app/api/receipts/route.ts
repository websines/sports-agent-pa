import { NextResponse } from 'next/server';
import { db, receipts } from '@/lib/db';
import { desc, eq } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { extractReceiptData, generateReceiptFilename } from '@/lib/services/llm';
import { uploadFileToDrive, isAuthenticated } from '@/lib/services/google-drive';
import { sendNotification } from '@/lib/services/email';

export async function GET() {
  try {
    const result = await db.select().from(receipts).orderBy(desc(receipts.createdAt));
    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to fetch receipts:', error);
    return NextResponse.json({ error: 'Failed to fetch receipts' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Convert file to base64
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');

    // Create initial receipt record
    const receiptId = uuid();
    const initialReceipt = {
      id: receiptId,
      date: 'XX.XX',
      amount: 0,
      currency: 'USD',
      description: 'Processing...',
      originalFilename: file.name,
      generatedFilename: 'processing.jpg',
      status: 'queued',
      rawImageBase64: base64,
    };

    await db.insert(receipts).values(initialReceipt);

    // Process asynchronously
    processReceipt(receiptId, base64, buffer, file.type).catch(console.error);

    const [inserted] = await db.select().from(receipts).where(eq(receipts.id, receiptId));
    return NextResponse.json(inserted, { status: 201 });
  } catch (error) {
    console.error('Failed to upload receipt:', error);
    return NextResponse.json({ error: 'Failed to upload receipt' }, { status: 500 });
  }
}

async function processReceipt(id: string, base64: string, buffer: Buffer, mimeType: string) {
  try {
    // Update status to processing
    await db.update(receipts).set({ status: 'processing' }).where(eq(receipts.id, id));

    // Extract data using Vision LLM
    const data = await extractReceiptData(base64);
    const filename = generateReceiptFilename(data);

    // Upload to Google Drive if connected
    let driveUrl = null;
    let driveFileId = null;

    if (isAuthenticated()) {
      try {
        const result = await uploadFileToDrive(
          `${filename}.${mimeType.includes('pdf') ? 'pdf' : 'jpg'}`,
          buffer,
          mimeType
        );
        driveUrl = result.webViewLink;
        driveFileId = result.id;
      } catch (e) {
        console.error('Failed to upload to Drive:', e);
      }
    }

    // Update receipt with extracted data
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
        rawImageBase64: null, // Clear the raw image to save space
        processedAt: new Date(),
      })
      .where(eq(receipts.id, id));

    // Send notification
    await sendNotification(
      'Receipt Processed',
      `Receipt processed: ${filename}\nAmount: ${data.currency === 'EUR' ? '€' : '$'}${data.amount}\n${driveUrl ? `View: ${driveUrl}` : ''}`
    );
  } catch (error) {
    console.error('Failed to process receipt:', error);

    await db
      .update(receipts)
      .set({
        status: 'failed',
        error: error instanceof Error ? error.message : 'Processing failed',
      })
      .where(eq(receipts.id, id));
  }
}
