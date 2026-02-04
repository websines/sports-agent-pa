// WhatsApp Business Cloud API (Meta)
// Docs: https://developers.facebook.com/docs/whatsapp/cloud-api

const GRAPH_API_VERSION = 'v18.0';
const GRAPH_API_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

function getConfig() {
  return {
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID!,
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN!,
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || 'sports-agent-pa',
  };
}

export function isWhatsAppConfigured(): boolean {
  return !!(process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN);
}

// Verify webhook (GET request from Meta)
export function verifyWebhook(searchParams: URLSearchParams): string | null {
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === getConfig().verifyToken) {
    return challenge;
  }
  return null;
}

// Send a text message
export async function sendWhatsAppMessage(to: string, message: string): Promise<string> {
  const { phoneNumberId, accessToken } = getConfig();

  const response = await fetch(`${GRAPH_API_URL}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to.replace('+', ''), // Remove + if present
      type: 'text',
      text: { body: message },
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    console.error('WhatsApp API error:', data);
    throw new Error(data.error?.message || 'Failed to send message');
  }

  return data.messages?.[0]?.id || '';
}

// Send interactive button message (up to 3 buttons)
export interface WhatsAppButton {
  id: string;
  title: string; // max 20 chars
}

export async function sendWhatsAppButtonMessage(
  to: string,
  body: string,
  buttons: WhatsAppButton[],
  header?: string,
  footer?: string
): Promise<string> {
  const { phoneNumberId, accessToken } = getConfig();

  const interactive: Record<string, unknown> = {
    type: 'button',
    body: { text: body },
    action: {
      buttons: buttons.slice(0, 3).map((btn) => ({
        type: 'reply',
        reply: {
          id: btn.id,
          title: btn.title.slice(0, 20),
        },
      })),
    },
  };

  if (header) {
    interactive.header = { type: 'text', text: header };
  }
  if (footer) {
    interactive.footer = { text: footer };
  }

  const response = await fetch(`${GRAPH_API_URL}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to.replace('+', ''),
      type: 'interactive',
      interactive,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    console.error('WhatsApp API error:', data);
    throw new Error(data.error?.message || 'Failed to send button message');
  }

  return data.messages?.[0]?.id || '';
}

// Send interactive list message (up to 10 items per section)
export interface WhatsAppListItem {
  id: string;
  title: string; // max 24 chars
  description?: string; // max 72 chars
}

export interface WhatsAppListSection {
  title: string;
  items: WhatsAppListItem[];
}

export async function sendWhatsAppListMessage(
  to: string,
  body: string,
  buttonText: string,
  sections: WhatsAppListSection[],
  header?: string,
  footer?: string
): Promise<string> {
  const { phoneNumberId, accessToken } = getConfig();

  const interactive: Record<string, unknown> = {
    type: 'list',
    body: { text: body },
    action: {
      button: buttonText.slice(0, 20),
      sections: sections.map((section) => ({
        title: section.title.slice(0, 24),
        rows: section.items.map((item) => ({
          id: item.id,
          title: item.title.slice(0, 24),
          description: item.description?.slice(0, 72),
        })),
      })),
    },
  };

  if (header) {
    interactive.header = { type: 'text', text: header };
  }
  if (footer) {
    interactive.footer = { text: footer };
  }

  const response = await fetch(`${GRAPH_API_URL}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to.replace('+', ''),
      type: 'interactive',
      interactive,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    console.error('WhatsApp API error:', data);
    throw new Error(data.error?.message || 'Failed to send list message');
  }

  return data.messages?.[0]?.id || '';
}

// Send image message
export async function sendWhatsAppImageMessage(
  to: string,
  imageUrl: string,
  caption?: string
): Promise<string> {
  const { phoneNumberId, accessToken } = getConfig();

  const response = await fetch(`${GRAPH_API_URL}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to.replace('+', ''),
      type: 'image',
      image: {
        link: imageUrl,
        caption,
      },
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    console.error('WhatsApp API error:', data);
    throw new Error(data.error?.message || 'Failed to send image');
  }

  return data.messages?.[0]?.id || '';
}

// Send document message
export async function sendWhatsAppDocumentMessage(
  to: string,
  documentUrl: string,
  filename: string,
  caption?: string
): Promise<string> {
  const { phoneNumberId, accessToken } = getConfig();

  const response = await fetch(`${GRAPH_API_URL}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to.replace('+', ''),
      type: 'document',
      document: {
        link: documentUrl,
        filename,
        caption,
      },
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    console.error('WhatsApp API error:', data);
    throw new Error(data.error?.message || 'Failed to send document');
  }

  return data.messages?.[0]?.id || '';
}

// Download media from WhatsApp
export async function downloadWhatsAppMedia(mediaId: string): Promise<Buffer> {
  const { accessToken } = getConfig();

  // First get the media URL
  const urlResponse = await fetch(`${GRAPH_API_URL}/${mediaId}`, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });

  const urlData = await urlResponse.json();
  if (!urlResponse.ok) {
    throw new Error(urlData.error?.message || 'Failed to get media URL');
  }

  // Then download the media
  const mediaResponse = await fetch(urlData.url, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });

  if (!mediaResponse.ok) {
    throw new Error('Failed to download media');
  }

  const arrayBuffer = await mediaResponse.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// Parse incoming webhook message
export interface IncomingWhatsAppMessage {
  from: string;
  name?: string;
  messageId: string;
  timestamp: string;
  type: 'text' | 'image' | 'document' | 'interactive' | 'button' | 'unknown';
  text?: string;
  mediaId?: string;
  mimeType?: string;
  buttonId?: string;
  buttonText?: string;
  listId?: string;
  listTitle?: string;
}

export function parseWebhookMessage(body: unknown): IncomingWhatsAppMessage | null {
  try {
    const data = body as {
      entry?: Array<{
        changes?: Array<{
          value?: {
            messages?: Array<{
              from: string;
              id: string;
              timestamp: string;
              type: string;
              text?: { body: string };
              image?: { id: string; mime_type: string };
              document?: { id: string; mime_type: string; filename: string };
              interactive?: {
                type: string;
                button_reply?: { id: string; title: string };
                list_reply?: { id: string; title: string };
              };
              button?: { payload: string; text: string };
            }>;
            contacts?: Array<{ profile: { name: string }; wa_id: string }>;
          };
        }>;
      }>;
    };

    const message = data.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    const contact = data.entry?.[0]?.changes?.[0]?.value?.contacts?.[0];

    if (!message) return null;

    const parsed: IncomingWhatsAppMessage = {
      from: message.from,
      name: contact?.profile?.name,
      messageId: message.id,
      timestamp: message.timestamp,
      type: 'unknown',
    };

    switch (message.type) {
      case 'text':
        parsed.type = 'text';
        parsed.text = message.text?.body;
        break;
      case 'image':
        parsed.type = 'image';
        parsed.mediaId = message.image?.id;
        parsed.mimeType = message.image?.mime_type;
        break;
      case 'document':
        parsed.type = 'document';
        parsed.mediaId = message.document?.id;
        parsed.mimeType = message.document?.mime_type;
        break;
      case 'interactive':
        parsed.type = 'interactive';
        if (message.interactive?.type === 'button_reply') {
          parsed.buttonId = message.interactive.button_reply?.id;
          parsed.buttonText = message.interactive.button_reply?.title;
        } else if (message.interactive?.type === 'list_reply') {
          parsed.listId = message.interactive.list_reply?.id;
          parsed.listTitle = message.interactive.list_reply?.title;
        }
        break;
      case 'button':
        parsed.type = 'button';
        parsed.buttonId = message.button?.payload;
        parsed.buttonText = message.button?.text;
        break;
    }

    return parsed;
  } catch (error) {
    console.error('Failed to parse webhook message:', error);
    return null;
  }
}

// ============= Helper functions for common messages =============

// Main menu with buttons
export async function sendMainMenu(to: string): Promise<string> {
  return sendWhatsAppButtonMessage(
    to,
    'What would you like to do?',
    [
      { id: 'menu_invoices', title: 'Invoices' },
      { id: 'menu_athletes', title: 'Athletes' },
      { id: 'menu_receipts', title: 'Receipts' },
    ],
    'Sports Agent PA',
    'Reply or tap a button'
  );
}

// Invoice list
export async function sendInvoiceList(
  to: string,
  invoices: { id: string; clientName: string; amount: number; status: string }[]
): Promise<string> {
  if (invoices.length === 0) {
    return sendWhatsAppMessage(to, 'No invoices found.');
  }

  const sections: WhatsAppListSection[] = [
    {
      title: 'Recent Invoices',
      items: invoices.slice(0, 10).map((inv) => ({
        id: `invoice_${inv.id}`,
        title: inv.clientName.slice(0, 24),
        description: `$${inv.amount} - ${inv.status}`,
      })),
    },
  ];

  return sendWhatsAppListMessage(
    to,
    `You have ${invoices.length} invoice(s)`,
    'View Invoices',
    sections,
    'Invoices'
  );
}

// Athlete list
export async function sendAthleteList(
  to: string,
  athletes: { id: string; name: string; position: string; nationality: string }[]
): Promise<string> {
  if (athletes.length === 0) {
    return sendWhatsAppMessage(to, 'No athletes found.');
  }

  // Group by position
  const byPosition = athletes.reduce((acc, ath) => {
    if (!acc[ath.position]) acc[ath.position] = [];
    acc[ath.position].push(ath);
    return acc;
  }, {} as Record<string, typeof athletes>);

  const sections: WhatsAppListSection[] = Object.entries(byPosition)
    .slice(0, 10)
    .map(([position, athlts]) => ({
      title: position,
      items: athlts.slice(0, 10).map((ath) => ({
        id: `athlete_${ath.id}`,
        title: ath.name.slice(0, 24),
        description: ath.nationality,
      })),
    }));

  return sendWhatsAppListMessage(
    to,
    `You have ${athletes.length} athlete(s)`,
    'View Athletes',
    sections,
    'Athletes'
  );
}

// Receipt confirmation with action buttons
export async function sendReceiptConfirmation(
  to: string,
  filename: string,
  amount: number,
  category: string
): Promise<string> {
  return sendWhatsAppButtonMessage(
    to,
    `*Receipt Processed*\n\nFile: ${filename}\nAmount: $${amount}\nCategory: ${category}`,
    [
      { id: 'receipt_another', title: 'Add Another' },
      { id: 'menu_main', title: 'Main Menu' },
    ],
    'Receipt Saved',
    'Uploaded to Google Drive'
  );
}

// Invoice created confirmation
export async function sendInvoiceConfirmation(
  to: string,
  invoiceNumber: string,
  clientName: string,
  amount: number
): Promise<string> {
  return sendWhatsAppButtonMessage(
    to,
    `*Invoice Created*\n\nInvoice #: ${invoiceNumber}\nClient: ${clientName}\nAmount: $${amount}\n\nStatus: Draft`,
    [
      { id: 'invoice_send', title: 'Send Now' },
      { id: 'invoice_edit', title: 'Edit in App' },
      { id: 'menu_main', title: 'Main Menu' },
    ],
    'Invoice Ready'
  );
}
