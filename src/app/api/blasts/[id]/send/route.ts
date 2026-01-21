import { NextResponse } from 'next/server';
import { db, blasts, athletes, contacts } from '@/lib/db';
import { eq, inArray } from 'drizzle-orm';
import { sendAthleteBlastEmail, sendNotification } from '@/lib/services/email';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    // Get blast
    const [blast] = await db.select().from(blasts).where(eq(blasts.id, id));

    if (!blast) {
      return NextResponse.json({ error: 'Blast not found' }, { status: 404 });
    }

    // Get athletes
    const athleteIds = blast.athleteIds as string[];
    const selectedAthletes = await db
      .select()
      .from(athletes)
      .where(inArray(athletes.id, athleteIds));

    // Get contacts
    const contactIds = blast.contactIds as string[];
    const selectedContacts = await db
      .select()
      .from(contacts)
      .where(inArray(contacts.id, contactIds));

    // Generate athlete HTML
    const athletesHtml = generateAthletesHtml(selectedAthletes);

    // Send to each contact
    let successCount = 0;
    for (const contact of selectedContacts) {
      try {
        await sendAthleteBlastEmail(
          contact.email,
          blast.subject,
          athletesHtml,
          blast.message || undefined
        );
        successCount++;
      } catch (e) {
        console.error(`Failed to send to ${contact.email}:`, e);
      }
    }

    // Update blast status
    await db
      .update(blasts)
      .set({
        status: 'sent',
        sentAt: new Date(),
        recipientCount: successCount,
      })
      .where(eq(blasts.id, id));

    // Send notification
    await sendNotification(
      'Athlete Blast Sent',
      `Blast "${blast.subject}" sent to ${successCount} of ${selectedContacts.length} contacts`
    );

    const [updated] = await db.select().from(blasts).where(eq(blasts.id, id));
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Failed to send blast:', error);
    return NextResponse.json({ error: 'Failed to send blast' }, { status: 500 });
  }
}

function generateAthletesHtml(athleteList: typeof athletes.$inferSelect[]): string {
  // Group by position
  const grouped: Record<string, typeof athleteList> = {};
  athleteList.forEach((a) => {
    if (!grouped[a.position]) grouped[a.position] = [];
    grouped[a.position].push(a);
  });

  let html = '';

  for (const [position, athletes] of Object.entries(grouped)) {
    html += `
      <div style="margin-bottom: 24px;">
        <h3 style="color: #ff6b35; font-size: 14px; text-transform: uppercase; margin-bottom: 12px; border-bottom: 2px solid #ff6b35; padding-bottom: 4px;">
          ${position}
        </h3>
    `;

    for (const athlete of athletes) {
      const highlights = (athlete.highlightUrls as string[]) || [];

      html += `
        <div style="background: #f9f9f9; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
          <h4 style="margin: 0 0 4px 0; color: #111;">
            ${athlete.name}
            ${athlete.featured ? '<span style="color: #eab308;">★</span>' : ''}
          </h4>
          <p style="margin: 0; color: #666; font-size: 14px;">
            ${athlete.height ? `${athlete.height} · ` : ''}${athlete.nationality}${athlete.birthYear ? ` · ${athlete.birthYear}` : ''}
          </p>

          <div style="margin-top: 12px; display: flex; gap: 12px; flex-wrap: wrap;">
            ${
              athlete.profileUrl
                ? `<a href="${athlete.profileUrl}" style="color: #ff6b35; text-decoration: none; font-size: 13px;">Profile →</a>`
                : ''
            }
            ${
              highlights.length > 0
                ? `<a href="${highlights[0]}" style="color: #ff6b35; text-decoration: none; font-size: 13px;">Highlights →</a>`
                : ''
            }
            ${
              athlete.statsUrl
                ? `<a href="${athlete.statsUrl}" style="color: #ff6b35; text-decoration: none; font-size: 13px;">Stats/Video →</a>`
                : ''
            }
          </div>
        </div>
      `;
    }

    html += '</div>';
  }

  return html;
}
