import OpenAI from 'openai';

// Lazy-loaded OpenAI-compatible client
let _client: OpenAI | null = null;

export function isLLMConfigured(): boolean {
  return !!process.env.LLM_API_KEY;
}

function getClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({
      baseURL: process.env.LLM_BASE_URL || 'https://api.openai.com/v1',
      apiKey: process.env.LLM_API_KEY || '',
    });
  }
  return _client;
}

export interface ReceiptData {
  date: string; // MM.DD format
  amount: number;
  currency: string;
  description: string;
  category?: string;
}

export async function extractReceiptData(imageBase64: string): Promise<ReceiptData> {
  const client = getClient();
  const response = await client.chat.completions.create({
    model: process.env.LLM_MODEL || 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are a receipt data extractor. Extract the following from receipt images:
- date: Format as MM.DD (e.g., "07.16" for July 16th)
- amount: The total amount paid (number only, no currency symbol)
- currency: The currency code (USD, EUR, GBP, etc.)
- description: A short description of what this expense was (e.g., "Lunch Avignon", "Toll France", "Gas station")
- category: One of: food, transport, housing, gas, toll, other

Respond ONLY with valid JSON in this exact format:
{"date": "MM.DD", "amount": 123.45, "currency": "EUR", "description": "Short description", "category": "food"}`,
      },
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: `data:image/jpeg;base64,${imageBase64}`,
            },
          },
          {
            type: 'text',
            text: 'Extract the receipt data from this image.',
          },
        ],
      },
    ],
    max_tokens: 200,
  });

  const content = response.choices[0]?.message?.content || '';

  try {
    // Try to parse JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0]);
      return {
        date: data.date || 'XX.XX',
        amount: parseFloat(data.amount) || 0,
        currency: data.currency || 'USD',
        description: data.description || 'Unknown',
        category: data.category,
      };
    }
  } catch (e) {
    console.error('Failed to parse LLM response:', content);
  }

  throw new Error('Failed to extract receipt data');
}

export function generateReceiptFilename(data: ReceiptData): string {
  const currencySymbol = data.currency === 'EUR' ? '€' : data.currency === 'GBP' ? '£' : '$';
  return `${data.date} - ${currencySymbol}${data.amount} - ${data.description}`;
}

// Agentic message parsing
export type AgentIntent =
  | { type: 'create_invoice'; data: InvoiceIntent }
  | { type: 'create_receipt'; data: ReceiptIntent }
  | { type: 'list_invoices'; filters?: { status?: string } }
  | { type: 'list_athletes'; filters?: { position?: string } }
  | { type: 'send_blast'; data: BlastIntent }
  | { type: 'unknown'; message: string };

export interface InvoiceIntent {
  clientName: string;
  clientEmail?: string;
  companyRegion?: 'US' | 'EU';
  items: Array<{ description: string; quantity: number; unitPrice: number }>;
  notes?: string;
  scheduledDate?: string;
}

export interface ReceiptIntent {
  date?: string;
  amount?: number;
  currency?: string;
  description?: string;
  category?: string;
}

export interface BlastIntent {
  athleteNames?: string[];
  positions?: string[];
  targetCountries?: string[];
  targetLeagues?: string[];
  message?: string;
}

export async function parseAgentMessage(message: string): Promise<AgentIntent> {
  const client = getClient();
  const response = await client.chat.completions.create({
    model: process.env.LLM_MODEL || 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are an AI assistant for a sports agent. Parse user messages and determine their intent.

Possible intents:
1. create_invoice - User wants to create an invoice
   Extract: clientName, clientEmail (if mentioned), companyRegion (US or EU), items (description, quantity, unitPrice), notes, scheduledDate
   Example: "Invoice John Smith at ABC Corp for $5000 consulting fee" → create_invoice with clientName: "John Smith / ABC Corp", items: [{description: "Consulting fee", quantity: 1, unitPrice: 5000}]

2. create_receipt - User wants to log an expense/receipt manually
   Extract: date (MM.DD), amount, currency, description, category (food/transport/housing/gas/toll/other)
   Example: "Add receipt for lunch $45 today" → create_receipt with description: "Lunch", amount: 45

3. list_invoices - User wants to see invoices
   Extract: filters like status (draft/scheduled/sent/paid)

4. list_athletes - User wants to see athletes
   Extract: filters like position

5. send_blast - User wants to send athlete info to contacts
   Extract: athleteNames, positions, targetCountries, targetLeagues, message

6. unknown - Cannot determine intent

Respond ONLY with valid JSON:
{"type": "intent_type", "data": {...}, "filters": {...}, "message": "clarification if unknown"}`,
      },
      {
        role: 'user',
        content: message,
      },
    ],
    max_tokens: 500,
  });

  const content = response.choices[0]?.message?.content || '';

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed as AgentIntent;
    }
  } catch (e) {
    console.error('Failed to parse agent response:', content);
  }

  return { type: 'unknown', message: 'Could not understand the request. Please try again.' };
}

// Parse invoice from natural language with more context
export async function parseInvoiceFromMessage(
  message: string,
  companies: Array<{ id: string; name: string; region: string }>
): Promise<{
  clientName: string;
  clientEmail: string;
  companyId: string;
  items: Array<{ description: string; quantity: number; unitPrice: number }>;
  notes: string;
} | null> {
  const client = getClient();
  const companyList = companies.map((c) => `${c.id}: ${c.name} (${c.region})`).join('\n');

  const response = await client.chat.completions.create({
    model: process.env.LLM_MODEL || 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are an invoice parser for a sports agent. Extract invoice details from natural language.

Available companies:
${companyList}

Extract:
- clientName: Name of the client/company being invoiced
- clientEmail: Email if mentioned, otherwise leave empty
- companyId: ID of the company to invoice FROM (match to available companies based on region hints like "EU company" or company name)
- items: Array of {description, quantity, unitPrice}
- notes: Any additional notes

If amount is mentioned without description, use "Professional Services" as description.
If no company preference mentioned, pick the first available company.

Respond ONLY with valid JSON:
{"clientName": "...", "clientEmail": "", "companyId": "...", "items": [...], "notes": ""}`,
      },
      {
        role: 'user',
        content: message,
      },
    ],
    max_tokens: 500,
  });

  const content = response.choices[0]?.message?.content || '';

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error('Failed to parse invoice response:', content);
  }

  return null;
}
