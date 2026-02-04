import { NextResponse } from 'next/server';
import { parseAgentMessage, parseInvoiceFromMessage, isLLMConfigured, type AgentIntent } from '@/lib/services/llm';
import { db, invoices, receipts, athletes, companies } from '@/lib/db';
import { desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';

// Basic fallback parser when LLM is not configured
function parseMessageBasic(message: string): AgentIntent {
  const lower = message.toLowerCase().trim();

  // List invoices
  if (lower.includes('invoice') && (lower.includes('show') || lower.includes('list') || lower.includes('view'))) {
    return { type: 'list_invoices' };
  }

  // List athletes
  if (lower.includes('athlete') && (lower.includes('show') || lower.includes('list') || lower.includes('view'))) {
    return { type: 'list_athletes' };
  }

  // Create receipt/expense - patterns like "$45 lunch" or "expense $50 taxi"
  const expenseMatch = message.match(/\$(\d+(?:\.\d{2})?)\s+(.+)/i) || message.match(/(\d+(?:\.\d{2})?)\s*(?:dollars?|usd)?\s+(.+)/i);
  if (expenseMatch || lower.includes('expense') || lower.includes('receipt')) {
    const amountMatch = message.match(/\$?(\d+(?:\.\d{2})?)/);
    const amount = amountMatch ? parseFloat(amountMatch[1]) : 0;
    // Get description - everything after the amount or after keywords
    let description = message.replace(/\$?\d+(?:\.\d{2})?/g, '').replace(/expense|receipt|add|for/gi, '').trim();
    if (!description) description = 'Expense';

    return {
      type: 'create_receipt',
      data: { amount, description, currency: 'USD' },
    };
  }

  // Create invoice - pattern like "invoice [client] $[amount]" or "create invoice for [client]"
  if (lower.includes('invoice') && (lower.includes('create') || lower.includes('new') || lower.includes('for'))) {
    const amountMatch = message.match(/\$(\d+(?:,\d{3})*(?:\.\d{2})?)/);
    const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : 0;

    // Try to extract client name - text after "for" or before the amount
    let clientName = '';
    const forMatch = message.match(/(?:for|to)\s+([^$\d]+?)(?:\s+\$|\s+\d|$)/i);
    if (forMatch) {
      clientName = forMatch[1].trim();
    }

    if (clientName && amount > 0) {
      return {
        type: 'create_invoice',
        data: {
          clientName,
          items: [{ description: 'Professional Services', quantity: 1, unitPrice: amount }],
        },
      };
    }
  }

  return { type: 'unknown', message: 'Could not understand the command.' };
}

// Generate invoice number
function generateInvoiceNumber(): string {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `INV-${year}${month}-${random}`;
}

export async function POST(request: Request) {
  try {
    const { message } = await request.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Parse the intent - use LLM if configured, otherwise use basic parser
    let intent: AgentIntent;
    if (isLLMConfigured()) {
      intent = await parseAgentMessage(message);
    } else {
      intent = parseMessageBasic(message);
    }

    // Handle different intents
    switch (intent.type) {
      case 'create_invoice':
        return handleCreateInvoice(message, intent.data);

      case 'create_receipt':
        return handleCreateReceipt(intent.data);

      case 'list_invoices':
        return handleListInvoices();

      case 'list_athletes':
        return handleListAthletes(intent.filters);

      case 'send_blast':
        return NextResponse.json({
          title: 'Blast',
          message: 'Please use the Athletes page to send blasts with contact selection.',
          action: { label: 'Go to Athletes', href: '/athletes' },
        });

      default:
        return NextResponse.json({
          title: 'Not sure',
          message: isLLMConfigured()
            ? "I couldn't understand that command. Try something like 'Create invoice for ABC Corp $5000' or 'Add expense $45 lunch'."
            : "Basic commands: 'Show invoices', 'Show athletes', '$45 lunch expense', 'Create invoice for [Client] $[Amount]'. For full AI features, configure LLM_API_KEY.",
        });
    }
  } catch (error) {
    console.error('Command error:', error);
    return NextResponse.json({ error: 'Failed to process command' }, { status: 500 });
  }
}

async function handleCreateInvoice(message: string, intentData?: { clientName?: string; items?: Array<{ description: string; quantity: number; unitPrice: number }> }) {
  // Get available companies
  const allCompanies = await db
    .select({ id: companies.id, name: companies.name, region: companies.region })
    .from(companies);

  if (allCompanies.length === 0) {
    return NextResponse.json({
      title: 'No Companies',
      message: 'Please add a company in Settings first.',
      action: { label: 'Go to Settings', href: '/settings' },
    });
  }

  // Parse the invoice - use LLM if available, otherwise use pre-parsed data from basic parser
  let parsed: { clientName: string; clientEmail: string; companyId: string; items: Array<{ description: string; quantity: number; unitPrice: number }>; notes: string } | null = null;

  if (isLLMConfigured()) {
    parsed = await parseInvoiceFromMessage(message, allCompanies);
  } else if (intentData?.clientName && intentData?.items?.length) {
    // Use data from basic parser
    parsed = {
      clientName: intentData.clientName,
      clientEmail: '',
      companyId: allCompanies[0].id,
      items: intentData.items,
      notes: '',
    };
  }

  if (!parsed || !parsed.clientName || parsed.items.length === 0) {
    return NextResponse.json({
      title: 'Could not parse',
      message: 'Try: "Create invoice for [Client Name] $[Amount]"',
    });
  }

  // Calculate total
  const totalAmount = parsed.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  // Add total to each item
  const itemsWithTotal = parsed.items.map((item) => ({
    ...item,
    total: item.quantity * item.unitPrice,
  }));

  // Create the invoice
  const invoiceId = nanoid();
  const invoiceNumber = generateInvoiceNumber();

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

  return NextResponse.json({
    title: 'Invoice Created',
    message: `Invoice #${invoiceNumber} for ${parsed.clientName} - $${totalAmount}`,
    action: { label: 'View Invoices', href: '/invoices' },
  });
}

async function handleCreateReceipt(data: {
  date?: string;
  amount?: number;
  currency?: string;
  description?: string;
  category?: string;
}) {
  const today = new Date();
  const dateStr =
    data.date ||
    `${(today.getMonth() + 1).toString().padStart(2, '0')}.${today.getDate().toString().padStart(2, '0')}`;

  const receiptId = nanoid();
  const amount = data.amount || 0;
  const description = data.description || 'Expense';
  const filename = `${dateStr} - $${amount} - ${description}`;

  await db.insert(receipts).values({
    id: receiptId,
    date: dateStr,
    amount,
    currency: data.currency || 'USD',
    description,
    category: data.category || 'other',
    generatedFilename: filename,
    status: 'done',
    processedAt: new Date(),
  });

  return NextResponse.json({
    title: 'Receipt Added',
    message: `${description} - $${amount} on ${dateStr}`,
    action: { label: 'View Receipts', href: '/receipts' },
  });
}

async function handleListInvoices() {
  const recentInvoices = await db
    .select({
      invoiceNumber: invoices.invoiceNumber,
      clientName: invoices.clientName,
      total: invoices.total,
      status: invoices.status,
    })
    .from(invoices)
    .orderBy(desc(invoices.createdAt))
    .limit(5);

  if (recentInvoices.length === 0) {
    return NextResponse.json({
      title: 'No Invoices',
      message: 'No invoices yet. Create one by saying "Create invoice for [client] $[amount]"',
    });
  }

  const list = recentInvoices
    .map((inv) => `${inv.invoiceNumber}: ${inv.clientName} - $${inv.total} (${inv.status})`)
    .join('\n');

  return NextResponse.json({
    title: `${recentInvoices.length} Recent Invoices`,
    message: list,
    action: { label: 'View All', href: '/invoices' },
  });
}

async function handleListAthletes(filters?: { position?: string }) {
  let query = db
    .select({
      name: athletes.name,
      position: athletes.position,
      nationality: athletes.nationality,
    })
    .from(athletes)
    .orderBy(athletes.position, athletes.name)
    .limit(10);

  const allAthletes = await query;

  if (allAthletes.length === 0) {
    return NextResponse.json({
      title: 'No Athletes',
      message: 'No athletes in your roster yet.',
      action: { label: 'Add Athletes', href: '/athletes' },
    });
  }

  // Group by position
  const grouped: Record<string, typeof allAthletes> = {};
  allAthletes.forEach((a) => {
    if (!grouped[a.position]) grouped[a.position] = [];
    grouped[a.position].push(a);
  });

  let message = '';
  for (const [position, athletes] of Object.entries(grouped)) {
    message += `${position}:\n`;
    athletes.forEach((a) => {
      message += `  • ${a.name} (${a.nationality})\n`;
    });
  }

  return NextResponse.json({
    title: `${allAthletes.length} Athletes`,
    message: message.trim(),
    action: { label: 'View All', href: '/athletes' },
  });
}
