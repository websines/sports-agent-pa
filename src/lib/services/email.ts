import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@apex8sports.com';
const NOTIFICATION_EMAIL = process.env.NOTIFICATION_EMAIL || '';

interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
  }>;
}

export async function sendEmail(options: SendEmailOptions) {
  const result = await resend.emails.send({
    from: FROM_EMAIL,
    to: options.to,
    subject: options.subject,
    html: options.html,
    attachments: options.attachments,
  });

  return result;
}

export async function sendInvoiceEmail(
  to: string,
  invoiceNumber: string,
  clientName: string,
  pdfBuffer: Buffer,
  companyName: string
) {
  return sendEmail({
    to,
    subject: `Invoice ${invoiceNumber} from ${companyName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Invoice ${invoiceNumber}</h2>
        <p>Dear ${clientName},</p>
        <p>Please find attached the invoice ${invoiceNumber} from ${companyName}.</p>
        <p>If you have any questions, please don't hesitate to contact us.</p>
        <p>Best regards,<br>${companyName}</p>
      </div>
    `,
    attachments: [
      {
        filename: `Invoice-${invoiceNumber}.pdf`,
        content: pdfBuffer,
      },
    ],
  });
}

export async function sendAthleteBlastEmail(
  to: string,
  subject: string,
  athletesHtml: string,
  customMessage?: string
) {
  return sendEmail({
    to,
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; background: #f9f9f9; padding: 20px;">
        <div style="background: #ff6b35; padding: 20px; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0;">Apex 8 Sports</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0;">Athletes Available</p>
        </div>

        <div style="background: white; padding: 20px; border-radius: 0 0 8px 8px;">
          ${customMessage ? `<p style="color: #333; margin-bottom: 20px;">${customMessage}</p>` : ''}
          ${athletesHtml}
        </div>

        <p style="color: #666; font-size: 12px; margin-top: 20px; text-align: center;">
          Apex 8 Sports | Sports Management Agency
        </p>
      </div>
    `,
  });
}

export async function sendNotification(subject: string, message: string) {
  if (!NOTIFICATION_EMAIL) {
    console.log('No notification email configured');
    return;
  }

  return sendEmail({
    to: NOTIFICATION_EMAIL,
    subject: `[Sports Agent PA] ${subject}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h3 style="color: #ff6b35;">${subject}</h3>
        <p>${message}</p>
        <p style="color: #666; font-size: 12px; margin-top: 20px;">
          This is an automated notification from Sports Agent PA
        </p>
      </div>
    `,
  });
}
