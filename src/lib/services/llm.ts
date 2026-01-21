import OpenAI from 'openai';

// Lazy-loaded OpenAI-compatible client
let _client: OpenAI | null = null;

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
