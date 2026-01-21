import { NextResponse } from 'next/server';
import { db, receipts, athletes, contacts, blasts, settings } from '@/lib/db';
import { eq, like, desc } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { extractReceiptData, generateReceiptFilename } from '@/lib/services/llm';
import { uploadFileToDrive, isAuthenticated } from '@/lib/services/google-drive';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

interface TelegramUpdate {
  message?: {
    chat: { id: number };
    from?: { id: number; first_name?: string };
    text?: string;
    photo?: Array<{ file_id: string; file_size: number }>;
    document?: { file_id: string; mime_type?: string };
  };
}

export async function POST(request: Request) {
  if (!TELEGRAM_BOT_TOKEN) {
    return NextResponse.json({ error: 'Bot not configured' }, { status: 500 });
  }

  try {
    const update: TelegramUpdate = await request.json();
    const message = update.message;

    if (!message) {
      return NextResponse.json({ ok: true });
    }

    const chatId = message.chat.id;
    const text = message.text?.trim();

    // Handle commands
    if (text?.startsWith('/')) {
      await handleCommand(chatId, text);
      return NextResponse.json({ ok: true });
    }

    // Handle photo (receipt)
    if (message.photo || message.document?.mime_type?.startsWith('image/')) {
      await handleReceiptPhoto(chatId, message);
      return NextResponse.json({ ok: true });
    }

    // Default response
    await sendMessage(chatId, `Send me a photo of a receipt to process it, or use these commands:

/start - Get started
/status - Check connection status
/athletes - List athletes
/contacts - List contacts
/blast [position] - Quick blast (e.g., /blast setters)`);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Telegram webhook error:', error);
    return NextResponse.json({ error: 'Webhook failed' }, { status: 500 });
  }
}

async function handleCommand(chatId: number, text: string) {
  const [command, ...args] = text.split(' ');

  switch (command.toLowerCase()) {
    case '/start':
      // Store chat ID for notifications
      await db
        .insert(settings)
        .values({ key: 'telegram_chat_id', value: JSON.stringify(chatId) })
        .onConflictDoUpdate({
          target: settings.key,
          set: { value: JSON.stringify(chatId), updatedAt: new Date() },
        });

      await sendMessage(
        chatId,
        `Welcome to Sports Agent PA! 🏐

I can help you with:
📸 *Receipt Processing* - Send me a photo of a receipt
📋 *Athlete Blasts* - Quick send athlete lists
📊 *Status Updates* - Get notified when tasks complete

Send /status to check your connections.`
      );
      break;

    case '/status':
      const googleConnected = isAuthenticated();
      await sendMessage(
        chatId,
        `*Connection Status*

Google Drive: ${googleConnected ? '✅ Connected' : '❌ Not connected'}
Telegram: ✅ Connected

${!googleConnected ? 'Connect Google Drive in the web app settings to enable receipt uploads.' : ''}`
      );
      break;

    case '/athletes':
      const athleteList = await db.select().from(athletes).limit(20);
      if (athleteList.length === 0) {
        await sendMessage(chatId, 'No athletes found. Add them in the web app.');
      } else {
        const grouped: Record<string, typeof athleteList> = {};
        athleteList.forEach((a) => {
          if (!grouped[a.position]) grouped[a.position] = [];
          grouped[a.position].push(a);
        });

        let response = '*Your Athletes*\n\n';
        for (const [position, athletes] of Object.entries(grouped)) {
          response += `*${position}*\n`;
          athletes.forEach((a) => {
            response += `• ${a.name}${a.featured ? ' ⭐' : ''}\n`;
          });
          response += '\n';
        }
        await sendMessage(chatId, response);
      }
      break;

    case '/contacts':
      const contactList = await db.select().from(contacts).limit(20);
      if (contactList.length === 0) {
        await sendMessage(chatId, 'No contacts found. Import them in the web app.');
      } else {
        let response = `*Your Contacts* (${contactList.length})\n\n`;
        contactList.slice(0, 10).forEach((c) => {
          response += `• ${c.name}${c.club ? ` - ${c.club}` : ''}${c.country ? ` (${c.country})` : ''}\n`;
        });
        if (contactList.length > 10) {
          response += `\n_+${contactList.length - 10} more..._`;
        }
        await sendMessage(chatId, response);
      }
      break;

    case '/blast':
      const positionFilter = args.join(' ').toLowerCase();
      await handleQuickBlast(chatId, positionFilter);
      break;

    default:
      await sendMessage(chatId, 'Unknown command. Send /start for help.');
  }
}

async function handleReceiptPhoto(chatId: number, message: TelegramUpdate['message']) {
  if (!message) return;

  await sendMessage(chatId, '📸 Processing receipt...');

  try {
    // Get the largest photo
    const photo = message.photo
      ? message.photo[message.photo.length - 1]
      : message.document;

    if (!photo) {
      await sendMessage(chatId, '❌ Could not read the image. Please try again.');
      return;
    }

    // Get file from Telegram
    const fileResponse = await fetch(`${TELEGRAM_API}/getFile?file_id=${photo.file_id}`);
    const fileData = await fileResponse.json();

    if (!fileData.ok) {
      throw new Error('Could not get file from Telegram');
    }

    const filePath = fileData.result.file_path;
    const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${filePath}`;

    // Download file
    const imageResponse = await fetch(fileUrl);
    const arrayBuffer = await imageResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');

    // Extract data
    const data = await extractReceiptData(base64);
    const filename = generateReceiptFilename(data);

    // Upload to Drive if connected
    let driveUrl = null;
    let driveFileId = null;

    if (isAuthenticated()) {
      try {
        const result = await uploadFileToDrive(`${filename}.jpg`, buffer, 'image/jpeg');
        driveUrl = result.webViewLink;
        driveFileId = result.id;
      } catch (e) {
        console.error('Drive upload failed:', e);
      }
    }

    // Save to database
    await db.insert(receipts).values({
      id: uuid(),
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

    const currencySymbol = data.currency === 'EUR' ? '€' : data.currency === 'GBP' ? '£' : '$';

    await sendMessage(
      chatId,
      `✅ *Receipt Processed*

📅 Date: ${data.date}
💰 Amount: ${currencySymbol}${data.amount}
📝 ${data.description}
${data.category ? `🏷️ Category: ${data.category}` : ''}

📁 Filename: \`${filename}\`
${driveUrl ? `\n[View in Drive](${driveUrl})` : '\n⚠️ Connect Google Drive to auto-upload'}`
    );
  } catch (error) {
    console.error('Receipt processing failed:', error);
    await sendMessage(chatId, '❌ Failed to process receipt. Please try again or use the web app.');
  }
}

async function handleQuickBlast(chatId: number, positionFilter: string) {
  const allAthletes = await db.select().from(athletes);
  const allContacts = await db.select().from(contacts);

  if (allAthletes.length === 0 || allContacts.length === 0) {
    await sendMessage(chatId, '❌ You need athletes and contacts to send a blast. Add them in the web app.');
    return;
  }

  // Filter athletes by position if specified
  let filteredAthletes = allAthletes;
  if (positionFilter) {
    filteredAthletes = allAthletes.filter((a) =>
      a.position.toLowerCase().includes(positionFilter)
    );
  }

  if (filteredAthletes.length === 0) {
    await sendMessage(chatId, `❌ No athletes found matching "${positionFilter}". Available positions: Setter, Outside Hitter, Opposite, Middle Blocker, Libero`);
    return;
  }

  await sendMessage(
    chatId,
    `Ready to blast ${filteredAthletes.length} athletes to ${allContacts.length} contacts.

Use the web app to customize and send, or I'll implement inline keyboards for quick confirmation in a future update!`
  );
}

async function sendMessage(chatId: number, text: string) {
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    }),
  });
}

// Function to send notifications from other parts of the app
export async function sendTelegramNotification(message: string) {
  if (!TELEGRAM_BOT_TOKEN) return;

  try {
    const [setting] = await db.select().from(settings).where(eq(settings.key, 'telegram_chat_id'));
    if (!setting?.value) return;

    const chatId = JSON.parse(setting.value as string);
    await sendMessage(chatId, message);
  } catch (error) {
    console.error('Failed to send Telegram notification:', error);
  }
}
