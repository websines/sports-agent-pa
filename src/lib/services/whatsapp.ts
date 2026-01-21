import twilio from 'twilio';

// Lazy-loaded Twilio client
let _client: twilio.Twilio | null = null;

function getClient(): twilio.Twilio {
  if (!_client) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!accountSid || !authToken) {
      throw new Error('Twilio credentials not configured');
    }
    _client = twilio(accountSid, authToken);
  }
  return _client;
}

const FROM_NUMBER = () => process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886'; // Sandbox default

export interface WhatsAppButton {
  id: string;
  title: string; // max 20 chars
}

export interface WhatsAppListItem {
  id: string;
  title: string; // max 24 chars
  description?: string; // max 72 chars
}

export interface WhatsAppListSection {
  title: string;
  items: WhatsAppListItem[];
}

// Send a simple text message
export async function sendWhatsAppMessage(to: string, message: string): Promise<string> {
  const client = getClient();
  const toNumber = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

  const result = await client.messages.create({
    from: FROM_NUMBER(),
    to: toNumber,
    body: message,
  });

  return result.sid;
}

// Send message with quick reply buttons (max 3 buttons)
export async function sendWhatsAppButtonMessage(
  to: string,
  body: string,
  buttons: WhatsAppButton[],
  header?: string,
  footer?: string
): Promise<string> {
  const client = getClient();
  const toNumber = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

  // Twilio uses ContentSid for templates or interactive messages
  // For button messages, we use the persistent content API
  const contentVariables = JSON.stringify({
    1: body,
  });

  // Create interactive button message
  const buttonActions = buttons.slice(0, 3).map((btn) => ({
    type: 'reply',
    reply: {
      id: btn.id,
      title: btn.title.slice(0, 20),
    },
  }));

  const result = await client.messages.create({
    from: FROM_NUMBER(),
    to: toNumber,
    contentSid: process.env.TWILIO_BUTTON_TEMPLATE_SID, // If using templates
    contentVariables,
    // Fallback to regular message with button simulation if no template
    body: !process.env.TWILIO_BUTTON_TEMPLATE_SID
      ? `${body}\n\n${buttons.map((b, i) => `${i + 1}. ${b.title}`).join('\n')}\n\nReply with a number to select.`
      : undefined,
  });

  return result.sid;
}

// Send interactive list message
export async function sendWhatsAppListMessage(
  to: string,
  body: string,
  buttonText: string,
  sections: WhatsAppListSection[],
  header?: string,
  footer?: string
): Promise<string> {
  const client = getClient();
  const toNumber = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

  // For list messages without templates, simulate with numbered options
  let messageBody = body + '\n\n';
  let optionNum = 1;

  for (const section of sections) {
    messageBody += `*${section.title}*\n`;
    for (const item of section.items) {
      messageBody += `${optionNum}. ${item.title}`;
      if (item.description) {
        messageBody += ` - ${item.description}`;
      }
      messageBody += '\n';
      optionNum++;
    }
    messageBody += '\n';
  }

  messageBody += 'Reply with a number to select.';

  const result = await client.messages.create({
    from: FROM_NUMBER(),
    to: toNumber,
    body: messageBody,
  });

  return result.sid;
}

// Send message with media (image, document)
export async function sendWhatsAppMediaMessage(
  to: string,
  mediaUrl: string,
  caption?: string
): Promise<string> {
  const client = getClient();
  const toNumber = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

  const result = await client.messages.create({
    from: FROM_NUMBER(),
    to: toNumber,
    mediaUrl: [mediaUrl],
    body: caption,
  });

  return result.sid;
}

// Validate Twilio webhook signature
export function validateWebhook(
  signature: string,
  url: string,
  params: Record<string, string>
): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) return false;

  return twilio.validateRequest(authToken, signature, url, params);
}

// Parse incoming webhook message
export interface IncomingWhatsAppMessage {
  from: string;
  body: string;
  messageId: string;
  mediaUrl?: string;
  mediaType?: string;
  buttonId?: string; // For button responses
  listId?: string; // For list responses
  numMedia: number;
}

export function parseIncomingMessage(body: Record<string, string>): IncomingWhatsAppMessage {
  return {
    from: body.From?.replace('whatsapp:', '') || '',
    body: body.Body || '',
    messageId: body.MessageSid || '',
    mediaUrl: body.MediaUrl0,
    mediaType: body.MediaContentType0,
    buttonId: body.ButtonPayload,
    listId: body.ListId,
    numMedia: parseInt(body.NumMedia || '0', 10),
  };
}

// Check if WhatsApp is configured
export function isWhatsAppConfigured(): boolean {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
}

// Main menu with buttons
export async function sendMainMenu(to: string): Promise<string> {
  const menuText = `*Sports Agent PA*\n\nWhat would you like to do?`;

  const buttons: WhatsAppButton[] = [
    { id: 'menu_invoices', title: 'Invoices' },
    { id: 'menu_athletes', title: 'Athletes' },
    { id: 'menu_receipts', title: 'Receipts' },
  ];

  // If templates aren't set up, use text-based menu
  if (!process.env.TWILIO_BUTTON_TEMPLATE_SID) {
    return sendWhatsAppMessage(
      to,
      `${menuText}\n\n1. Invoices\n2. Athletes\n3. Receipts\n\nReply with a number.`
    );
  }

  return sendWhatsAppButtonMessage(to, menuText, buttons);
}

// Send invoice summary
export async function sendInvoiceSummary(
  to: string,
  invoices: { id: string; clientName: string; amount: number; status: string }[]
): Promise<string> {
  if (invoices.length === 0) {
    return sendWhatsAppMessage(to, 'No recent invoices found.');
  }

  let message = '*Recent Invoices*\n\n';
  invoices.slice(0, 5).forEach((inv, i) => {
    const statusEmoji = inv.status === 'sent' ? '✅' : inv.status === 'scheduled' ? '🕐' : '📝';
    message += `${i + 1}. ${inv.clientName} - $${inv.amount} ${statusEmoji}\n`;
  });

  message += '\n_Reply with a number for details._';

  return sendWhatsAppMessage(to, message);
}

// Send athlete list
export async function sendAthleteList(
  to: string,
  athletes: { id: string; name: string; position: string }[]
): Promise<string> {
  if (athletes.length === 0) {
    return sendWhatsAppMessage(to, 'No athletes found.');
  }

  let message = '*Athletes*\n\n';
  athletes.slice(0, 10).forEach((ath, i) => {
    message += `${i + 1}. ${ath.name} (${ath.position})\n`;
  });

  if (athletes.length > 10) {
    message += `\n_...and ${athletes.length - 10} more_`;
  }

  return sendWhatsAppMessage(to, message);
}

// Send receipt confirmation
export async function sendReceiptConfirmation(
  to: string,
  filename: string,
  driveUrl?: string
): Promise<string> {
  let message = `*Receipt Processed*\n\n`;
  message += `Saved as: _${filename}_`;

  if (driveUrl) {
    message += `\n\nView in Drive: ${driveUrl}`;
  }

  return sendWhatsAppMessage(to, message);
}
