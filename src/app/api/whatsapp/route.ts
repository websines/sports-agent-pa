import { NextResponse } from 'next/server';
import {
  parseWebhookMessage,
  verifyWebhook,
  sendMainMenu,
  sendWhatsAppMessage,
  sendWhatsAppButtonMessage,
  sendInvoiceList,
  sendAthleteList,
  sendReceiptConfirmation,
  sendInvoiceConfirmation,
  isWhatsAppConfigured,
  downloadWhatsAppMedia,
} from '@/lib/services/whatsapp';
import {
  extractReceiptData,
  generateReceiptFilename,
  parseAgentMessage,
  parseInvoiceFromMessage,
} from '@/lib/services/llm';
import { uploadFileToDrive, isAuthenticated } from '@/lib/services/google-drive';
import { db, invoices, athletes, receipts, companies } from '@/lib/db';
import { desc } from 'drizzle-orm';
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

// GET - Webhook verification (Meta sends this when setting up webhook)
export async function GET(request: Request) {
  const url = new URL(request.url);
  const challenge = verifyWebhook(url.searchParams);

  if (challenge) {
    // Return the challenge as plain text for Meta verification
    return new NextResponse(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}

// POST - Incoming messages
export async function POST(request: Request) {
  if (!isWhatsAppConfigured()) {
    return NextResponse.json({ error: 'WhatsApp not configured' }, { status: 500 });
  }

  try {
    const body = await request.json();

    // Parse the incoming message
    const message = parseWebhookMessage(body);

    // Meta sends status updates too, ignore those
    if (!message) {
      return NextResponse.json({ status: 'ok' });
    }

    const from = message.from;
    const currentState = userState.get(from) || { state: 'idle' };

    // Handle different message types
    switch (message.type) {
      case 'text':
        await handleTextMessage(from, message.text || '', currentState);
        break;

      case 'image':
        if (message.mediaId) {
          await handleImageMessage(from, message.mediaId);
        }
        break;

      case 'interactive':
        // Button or list selection
        if (message.buttonId) {
          await handleButtonClick(from, message.buttonId, currentState);
        } else if (message.listId) {
          await handleListSelection(from, message.listId, currentState);
        }
        break;

      case 'button':
        // Template button click
        if (message.buttonId) {
          await handleButtonClick(from, message.buttonId, currentState);
        }
        break;

      default:
        await sendWhatsAppMessage(
          from,
          "I can process text messages and images. Send 'menu' to see options."
        );
    }

    // Always return 200 to acknowledge receipt
    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('WhatsApp webhook error:', error);
    // Still return 200 to prevent Meta from retrying
    return NextResponse.json({ status: 'error' });
  }
}

// Handle text messages
async function handleTextMessage(
  from: string,
  text: string,
  currentState: { state: string; data?: Record<string, unknown> }
) {
  const lowerText = text.toLowerCase().trim();

  // Basic commands
  if (['hi', 'hello', 'start', 'menu', 'help'].includes(lowerText)) {
    await sendMainMenu(from);
    userState.set(from, { state: 'main_menu' });
    return;
  }

  if (lowerText === 'invoices' || lowerText === '1') {
    await handleInvoicesCommand(from);
    return;
  }

  if (lowerText === 'athletes' || lowerText === '2') {
    await handleAthletesCommand(from);
    return;
  }

  if (lowerText === 'receipts' || lowerText === '3') {
    await sendWhatsAppButtonMessage(
      from,
      'Send me a photo of a receipt and I\'ll process it automatically!\n\nOr type an expense like:\n"$45 lunch meeting"',
      [{ id: 'menu_main', title: 'Back to Menu' }],
      'Receipts'
    );
    userState.set(from, { state: 'awaiting_receipt' });
    return;
  }

  // Try agentic parsing for natural language
  const intent = await parseAgentMessage(text);

  if (intent.type === 'create_invoice') {
    await handleAgenticInvoice(from, text);
    return;
  }

  if (intent.type === 'create_receipt') {
    await handleAgenticReceipt(from, intent.data);
    return;
  }

  if (intent.type === 'list_invoices') {
    await handleInvoicesCommand(from);
    return;
  }

  if (intent.type === 'list_athletes') {
    await handleAthletesCommand(from);
    return;
  }

  // Default help message with buttons
  await sendWhatsAppButtonMessage(
    from,
    'I can help you with:\n\n• "Create invoice for [client] $[amount]"\n• "Show invoices" or "Show athletes"\n• Send a receipt photo\n• "$50 taxi expense"',
    [
      { id: 'menu_invoices', title: 'Invoices' },
      { id: 'menu_athletes', title: 'Athletes' },
      { id: 'menu_receipts', title: 'Receipts' },
    ],
    'Sports Agent PA'
  );
}

// Handle button clicks
async function handleButtonClick(
  from: string,
  buttonId: string,
  currentState: { state: string; data?: Record<string, unknown> }
) {
  switch (buttonId) {
    case 'menu_invoices':
      await handleInvoicesCommand(from);
      break;
    case 'menu_athletes':
      await handleAthletesCommand(from);
      break;
    case 'menu_receipts':
      await sendWhatsAppButtonMessage(
        from,
        'Send me a photo of a receipt and I\'ll process it!\n\nOr type: "$45 lunch meeting"',
        [{ id: 'menu_main', title: 'Back to Menu' }],
        'Receipts'
      );
      userState.set(from, { state: 'awaiting_receipt' });
      break;
    case 'menu_main':
      await sendMainMenu(from);
      userState.set(from, { state: 'main_menu' });
      break;
    case 'receipt_another':
      await sendWhatsAppMessage(from, 'Send another receipt photo.');
      userState.set(from, { state: 'awaiting_receipt' });
      break;
    case 'invoice_send':
      // TODO: Send the invoice
      await sendWhatsAppMessage(from, 'Invoice sending not yet implemented via WhatsApp. Please use the web app.');
      break;
    case 'invoice_edit':
      await sendWhatsAppMessage(from, 'Open the web app to edit this invoice.');
      break;
    default:
      await sendMainMenu(from);
  }
}

// Handle list selections
async function handleListSelection(
  from: string,
  listId: string,
  currentState: { state: string; data?: Record<string, unknown> }
) {
  if (listId.startsWith('invoice_')) {
    const invoiceId = listId.replace('invoice_', '');
    // Fetch and show invoice details
    const invoice = await db.query.invoices.findFirst({
      where: (inv, { eq }) => eq(inv.id, invoiceId),
    });

    if (invoice) {
      await sendWhatsAppButtonMessage(
        from,
        `*Invoice Details*\n\nClient: ${invoice.clientName}\nAmount: $${invoice.total}\nStatus: ${invoice.status}\nDescription: ${invoice.description || 'N/A'}`,
        [
          { id: 'menu_invoices', title: 'All Invoices' },
          { id: 'menu_main', title: 'Main Menu' },
        ]
      );
    }
  } else if (listId.startsWith('athlete_')) {
    const athleteId = listId.replace('athlete_', '');
    const athlete = await db.query.athletes.findFirst({
      where: (ath, { eq }) => eq(ath.id, athleteId),
    });

    if (athlete) {
      let details = `*${athlete.name}*\n\nPosition: ${athlete.position}\nNationality: ${athlete.nationality}`;
      if (athlete.height) details += `\nHeight: ${athlete.height}`;
      if (athlete.birthYear) details += `\nBorn: ${athlete.birthYear}`;
      if (athlete.profileUrl) details += `\n\nProfile: ${athlete.profileUrl}`;

      await sendWhatsAppButtonMessage(
        from,
        details,
        [
          { id: 'menu_athletes', title: 'All Athletes' },
          { id: 'menu_main', title: 'Main Menu' },
        ]
      );
    }
  } else {
    await sendMainMenu(from);
  }
}

// Handle image messages (receipts)
async function handleImageMessage(from: string, mediaId: string) {
  try {
    await sendWhatsAppMessage(from, '📷 Processing your receipt...');

    // Download the image
    const imageBuffer = await downloadWhatsAppMedia(mediaId);
    const base64 = imageBuffer.toString('base64');

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
          imageBuffer,
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
      rawImageBase64: base64,
      status: 'done',
      processedAt: new Date(),
    });

    // Send confirmation with buttons
    await sendReceiptConfirmation(from, filename, data.amount, data.category || 'other');
    userState.set(from, { state: 'idle' });
  } catch (error) {
    console.error('Receipt processing error:', error);
    await sendWhatsAppButtonMessage(
      from,
      'Sorry, I could not process that receipt. Please try with a clearer photo.',
      [
        { id: 'receipt_another', title: 'Try Again' },
        { id: 'menu_main', title: 'Main Menu' },
      ]
    );
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
      .limit(10);

    await sendInvoiceList(from, recentInvoices);
    userState.set(from, { state: 'invoices_list', data: { invoices: recentInvoices } });
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
      .limit(20);

    await sendAthleteList(from, allAthletes);
    userState.set(from, { state: 'athletes_list', data: { athletes: allAthletes } });
  } catch (error) {
    console.error('Error fetching athletes:', error);
    await sendWhatsAppMessage(from, 'Could not fetch athletes. Try again later.');
  }
}

// Handle agentic invoice creation
async function handleAgenticInvoice(from: string, message: string) {
  try {
    await sendWhatsAppMessage(from, '📝 Creating invoice...');

    const allCompanies = await db
      .select({ id: companies.id, name: companies.name, region: companies.region })
      .from(companies);

    if (allCompanies.length === 0) {
      await sendWhatsAppButtonMessage(
        from,
        'No companies configured yet. Add a company in the web app first.',
        [{ id: 'menu_main', title: 'Main Menu' }]
      );
      return;
    }

    const parsed = await parseInvoiceFromMessage(message, allCompanies);

    if (!parsed || !parsed.clientName || parsed.items.length === 0) {
      await sendWhatsAppButtonMessage(
        from,
        'Could not parse invoice. Try:\n\n"Invoice ABC Corp $5000 for consulting"',
        [{ id: 'menu_main', title: 'Main Menu' }]
      );
      return;
    }

    const totalAmount = parsed.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

    const invoiceId = nanoid();
    const invoiceNumber = generateInvoiceNumber();

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
      clientAddress: '',
      description: parsed.items.map((i) => i.description).join(', '),
      items: itemsWithTotal,
      subtotal: totalAmount,
      total: totalAmount,
      currency: 'USD',
      status: 'draft',
      notes: parsed.notes || null,
    });

    // Send confirmation with action buttons
    await sendInvoiceConfirmation(from, invoiceNumber, parsed.clientName, totalAmount);
    userState.set(from, { state: 'idle', data: { lastInvoiceId: invoiceId } });
  } catch (error) {
    console.error('Agentic invoice error:', error);
    await sendWhatsAppMessage(from, 'Failed to create invoice. Please try again.');
  }
}

// Handle agentic receipt creation (text-based)
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

    await sendReceiptConfirmation(from, filename, data.amount || 0, data.category || 'other');
  } catch (error) {
    console.error('Agentic receipt error:', error);
    await sendWhatsAppMessage(from, 'Failed to add receipt. Please try again.');
  }
}
