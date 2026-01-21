import { NextResponse } from 'next/server';
import {
  parseIncomingMessage,
  sendMainMenu,
  sendWhatsAppMessage,
  sendInvoiceSummary,
  sendAthleteList,
  sendReceiptConfirmation,
  isWhatsAppConfigured,
  validateWebhook,
} from '@/lib/services/whatsapp';
import {
  extractReceiptData,
  generateReceiptFilename,
  parseAgentMessage,
  parseInvoiceFromMessage,
} from '@/lib/services/llm';
import { uploadFileToDrive, isAuthenticated } from '@/lib/services/google-drive';
import { db, invoices, athletes, receipts, companies } from '@/lib/db';
import { eq, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';

// Generate invoice number
function generateInvoiceNumber(): string {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `INV-${year}${month}-${random}`;
}

export const dynamic = 'force-dynamic';

// Store user conversation state (in production, use Redis or DB)
const userState = new Map<string, { state: string; data?: Record<string, unknown> }>();

export async function POST(request: Request) {
  if (!isWhatsAppConfigured()) {
    return NextResponse.json({ error: 'WhatsApp not configured' }, { status: 500 });
  }

  try {
    // Parse form data (Twilio sends form-encoded)
    const formData = await request.formData();
    const body: Record<string, string> = {};
    formData.forEach((value, key) => {
      body[key] = value.toString();
    });

    // Validate webhook signature in production
    const signature = request.headers.get('x-twilio-signature') || '';
    const url = process.env.WHATSAPP_WEBHOOK_URL || request.url;

    if (process.env.NODE_ENV === 'production' && process.env.TWILIO_AUTH_TOKEN) {
      if (!validateWebhook(signature, url, body)) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    const message = parseIncomingMessage(body);
    const from = message.from;
    const text = message.body.trim().toLowerCase();
    const currentState = userState.get(from) || { state: 'idle' };

    // Handle media (receipt photo)
    if (message.numMedia > 0 && message.mediaUrl) {
      await handleReceiptUpload(from, message.mediaUrl);
      return twilioResponse();
    }

    // Handle button responses
    if (message.buttonId) {
      await handleButtonResponse(from, message.buttonId);
      return twilioResponse();
    }

    // Handle text commands
    if (text === 'hi' || text === 'hello' || text === 'start' || text === 'menu') {
      await sendMainMenu(from);
      userState.set(from, { state: 'main_menu' });
      return twilioResponse();
    }

    // Handle numbered responses based on state
    if (/^[1-9]$/.test(text)) {
      const num = parseInt(text, 10);
      await handleNumberedResponse(from, num, currentState);
      return twilioResponse();
    }

    // Command shortcuts
    if (text === 'invoices' || text === '1') {
      await handleInvoicesCommand(from);
      return twilioResponse();
    }

    if (text === 'athletes' || text === '2') {
      await handleAthletesCommand(from);
      return twilioResponse();
    }

    if (text === 'receipts' || text === '3') {
      await sendWhatsAppMessage(
        from,
        '*Receipts*\n\nSend me a photo of a receipt and I\'ll process it automatically!'
      );
      userState.set(from, { state: 'awaiting_receipt' });
      return twilioResponse();
    }

    // Try agentic parsing for natural language commands
    const intent = await parseAgentMessage(message.body);

    if (intent.type === 'create_invoice') {
      await handleAgenticInvoice(from, message.body);
      return twilioResponse();
    }

    if (intent.type === 'create_receipt') {
      await handleAgenticReceipt(from, intent.data);
      return twilioResponse();
    }

    if (intent.type === 'list_invoices') {
      await handleInvoicesCommand(from);
      return twilioResponse();
    }

    if (intent.type === 'list_athletes') {
      await handleAthletesCommand(from);
      return twilioResponse();
    }

    // Default response
    await sendWhatsAppMessage(
      from,
      'Hi! I\'m your Sports Agent assistant.\n\nYou can:\n- Say "Create invoice for [client] $[amount]"\n- Say "Show invoices" or "Show athletes"\n- Send *menu* for options\n- Send a receipt photo to process it'
    );

    return twilioResponse();
  } catch (error) {
    console.error('WhatsApp webhook error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// Handle numbered menu responses
async function handleNumberedResponse(
  from: string,
  num: number,
  currentState: { state: string; data?: Record<string, unknown> }
) {
  if (currentState.state === 'main_menu') {
    switch (num) {
      case 1:
        await handleInvoicesCommand(from);
        break;
      case 2:
        await handleAthletesCommand(from);
        break;
      case 3:
        await sendWhatsAppMessage(
          from,
          '*Receipts*\n\nSend me a photo of a receipt and I\'ll process it automatically!'
        );
        userState.set(from, { state: 'awaiting_receipt' });
        break;
      default:
        await sendWhatsAppMessage(from, 'Invalid option. Send *menu* to see options.');
    }
  } else if (currentState.state === 'invoices_list') {
    const invoiceList = currentState.data?.invoices as Array<{
      id: string;
      clientName: string;
      amount: number;
      status: string;
    }>;
    if (invoiceList && num <= invoiceList.length) {
      const inv = invoiceList[num - 1];
      await sendWhatsAppMessage(
        from,
        `*Invoice Details*\n\nClient: ${inv.clientName}\nAmount: $${inv.amount}\nStatus: ${inv.status}\n\nReply *menu* for main menu.`
      );
    }
  } else if (currentState.state === 'athletes_list') {
    const athleteList = currentState.data?.athletes as Array<{
      id: string;
      name: string;
      position: string;
      nationality: string;
    }>;
    if (athleteList && num <= athleteList.length) {
      const ath = athleteList[num - 1];
      await sendWhatsAppMessage(
        from,
        `*Athlete Details*\n\nName: ${ath.name}\nPosition: ${ath.position}\nNationality: ${ath.nationality}\n\nReply *menu* for main menu.`
      );
    }
  } else {
    await sendMainMenu(from);
    userState.set(from, { state: 'main_menu' });
  }
}

// Handle button click responses
async function handleButtonResponse(from: string, buttonId: string) {
  switch (buttonId) {
    case 'menu_invoices':
      await handleInvoicesCommand(from);
      break;
    case 'menu_athletes':
      await handleAthletesCommand(from);
      break;
    case 'menu_receipts':
      await sendWhatsAppMessage(
        from,
        '*Receipts*\n\nSend me a photo of a receipt and I\'ll process it automatically!'
      );
      userState.set(from, { state: 'awaiting_receipt' });
      break;
    default:
      await sendMainMenu(from);
  }
}

// Handle invoices command
async function handleInvoicesCommand(from: string) {
  try {
    const recentInvoices = await db
      .select({
        id: invoices.id,
        clientName: invoices.clientName,
        amount: invoices.total,
        status: invoices.status,
      })
      .from(invoices)
      .orderBy(desc(invoices.createdAt))
      .limit(5);

    await sendInvoiceSummary(from, recentInvoices);
    userState.set(from, {
      state: 'invoices_list',
      data: { invoices: recentInvoices },
    });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    await sendWhatsAppMessage(from, 'Could not fetch invoices. Try again later.');
  }
}

// Handle athletes command
async function handleAthletesCommand(from: string) {
  try {
    const allAthletes = await db
      .select({
        id: athletes.id,
        name: athletes.name,
        position: athletes.position,
        nationality: athletes.nationality,
      })
      .from(athletes)
      .orderBy(athletes.name)
      .limit(10);

    await sendAthleteList(from, allAthletes);
    userState.set(from, {
      state: 'athletes_list',
      data: { athletes: allAthletes },
    });
  } catch (error) {
    console.error('Error fetching athletes:', error);
    await sendWhatsAppMessage(from, 'Could not fetch athletes. Try again later.');
  }
}

// Handle agentic invoice creation from natural language
async function handleAgenticInvoice(from: string, message: string) {
  try {
    await sendWhatsAppMessage(from, 'Creating invoice...');

    // Get available companies
    const allCompanies = await db
      .select({ id: companies.id, name: companies.name, region: companies.region })
      .from(companies);

    if (allCompanies.length === 0) {
      await sendWhatsAppMessage(
        from,
        'No companies configured yet. Please add a company in the web app first.'
      );
      return;
    }

    // Parse the invoice from natural language
    const parsed = await parseInvoiceFromMessage(message, allCompanies);

    if (!parsed || !parsed.clientName || parsed.items.length === 0) {
      await sendWhatsAppMessage(
        from,
        'Could not parse invoice details. Please try again with format:\n\n"Invoice [Client Name] $[Amount] for [Description]"'
      );
      return;
    }

    // Calculate total
    const totalAmount = parsed.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

    // Create the invoice
    const invoiceId = nanoid();
    const invoiceNumber = generateInvoiceNumber();

    // Add total to each item
    const itemsWithTotal = parsed.items.map((item) => ({
      ...item,
      total: item.quantity * item.unitPrice,
    }));

    await db.insert(invoices).values({
      id: invoiceId,
      invoiceNumber,
      companyId: parsed.companyId || allCompanies[0].id,
      clientName: parsed.clientName,
      clientEmail: parsed.clientEmail || '',
      clientAddress: '', // Not provided via chat
      description: parsed.items.map((i) => i.description).join(', '),
      items: itemsWithTotal,
      subtotal: totalAmount,
      total: totalAmount,
      currency: 'USD',
      status: 'draft',
      notes: parsed.notes || null,
    });

    // Send confirmation with details
    let itemsText = parsed.items
      .map((item) => `  • ${item.description}: $${item.unitPrice * item.quantity}`)
      .join('\n');

    await sendWhatsAppMessage(
      from,
      `*Invoice Created* ✅\n\n` +
        `Invoice #: ${invoiceNumber}\n` +
        `Client: ${parsed.clientName}\n` +
        `Amount: $${totalAmount}\n\n` +
        `Items:\n${itemsText}\n\n` +
        `Status: Draft\n\n` +
        `_Open the web app to send it._`
    );
  } catch (error) {
    console.error('Agentic invoice error:', error);
    await sendWhatsAppMessage(from, 'Failed to create invoice. Please try again.');
  }
}

// Handle agentic receipt creation (manual entry)
async function handleAgenticReceipt(
  from: string,
  data: { date?: string; amount?: number; currency?: string; description?: string; category?: string }
) {
  try {
    const today = new Date();
    const dateStr = data.date || `${(today.getMonth() + 1).toString().padStart(2, '0')}.${today.getDate().toString().padStart(2, '0')}`;

    const receiptId = nanoid();
    const filename = `${dateStr} - $${data.amount || 0} - ${data.description || 'Expense'}`;

    await db.insert(receipts).values({
      id: receiptId,
      date: dateStr,
      amount: data.amount || 0,
      currency: data.currency || 'USD',
      description: data.description || 'Expense',
      category: data.category || 'other',
      generatedFilename: filename,
      status: 'done',
      processedAt: new Date(),
    });

    await sendWhatsAppMessage(
      from,
      `*Receipt Added* ✅\n\n` +
        `Date: ${dateStr}\n` +
        `Amount: $${data.amount || 0}\n` +
        `Description: ${data.description || 'Expense'}\n` +
        `Category: ${data.category || 'other'}`
    );
  } catch (error) {
    console.error('Agentic receipt error:', error);
    await sendWhatsAppMessage(from, 'Failed to add receipt. Please try again.');
  }
}

// Handle receipt photo upload
async function handleReceiptUpload(from: string, mediaUrl: string) {
  try {
    await sendWhatsAppMessage(from, 'Processing your receipt...');

    // Download the image
    const response = await fetch(mediaUrl, {
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
        ).toString('base64')}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to download image');
    }

    const imageBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(imageBuffer).toString('base64');

    // Extract receipt data with LLM
    const data = await extractReceiptData(base64);
    const filename = generateReceiptFilename(data);

    // Save to database
    const receiptId = nanoid();
    let driveUrl: string | null = null;
    let driveFileId: string | null = null;

    // Upload to Google Drive if connected
    if (isAuthenticated()) {
      try {
        const result = await uploadFileToDrive(
          `${filename}.jpg`,
          Buffer.from(imageBuffer),
          'image/jpeg'
        );
        driveUrl = result.webViewLink;
        driveFileId = result.id;
      } catch (e) {
        console.error('Failed to upload to Drive:', e);
      }
    }

    await db.insert(receipts).values({
      id: receiptId,
      date: data.date,
      amount: data.amount,
      currency: data.currency,
      description: data.description,
      category: data.category || null,
      generatedFilename: filename,
      driveUrl,
      driveFileId,
      status: 'done',
      processedAt: new Date(),
    });

    // Send confirmation
    await sendReceiptConfirmation(from, filename, driveUrl || undefined);
    userState.set(from, { state: 'idle' });
  } catch (error) {
    console.error('Receipt processing error:', error);
    await sendWhatsAppMessage(
      from,
      'Sorry, I could not process that receipt. Please try again with a clearer photo.'
    );
  }
}

// Return empty TwiML response
function twilioResponse() {
  return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
    headers: { 'Content-Type': 'text/xml' },
  });
}

// GET for webhook verification
export async function GET() {
  return NextResponse.json({ status: 'WhatsApp webhook active' });
}
