# Sports Agent PA - Setup Guide

A personal assistant for sports agents to manage invoices, athlete rosters, and expense receipts.

## Prerequisites

- Node.js 18+
- npm or pnpm

## Quick Start

```bash
# Install dependencies
npm install

# Run database migrations
npm run db:push

# Start development server
npm run dev
```

Visit `http://localhost:3000`

## Environment Variables

Create a `.env.local` file in the root directory:

```env
# ===================
# REQUIRED
# ===================

# Email (Resend - https://resend.com)
RESEND_API_KEY=re_xxxxxxxxxxxx
FROM_EMAIL=invoices@yourdomain.com

# ===================
# OPTIONAL
# ===================

# LLM for Receipt Processing (OpenAI-compatible)
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=sk-xxxxxxxxxxxx
LLM_MODEL=gpt-4o

# Google Drive (for receipt uploads)
GOOGLE_CLIENT_ID=xxxxxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxx
GOOGLE_REDIRECT_URI=https://yourapp.vercel.app/api/auth/google/callback

# Telegram Bot
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_WEBHOOK_SECRET=your-random-secret

# WhatsApp Business API (Meta)
WHATSAPP_PHONE_NUMBER_ID=123456789012345
WHATSAPP_ACCESS_TOKEN=EAAxxxxxxxxxxxxxxxx
WHATSAPP_VERIFY_TOKEN=your-random-verify-token

# App Auth
APP_PASSWORD=your-secure-password

# Cron Job Security
CRON_SECRET=your-random-secret-for-cron

# Notifications (optional - receive processing summaries)
NOTIFICATION_EMAIL=your@email.com
```

## Service Setup

### 1. Resend (Email)

1. Sign up at [resend.com](https://resend.com)
2. Verify your domain or use their test domain
3. Get your API key from the dashboard
4. Add `RESEND_API_KEY` and `FROM_EMAIL` to env

### 2. LLM Provider (Receipt OCR)

The app uses an OpenAI-compatible API for receipt processing. Options:

**OpenAI (recommended)**
```env
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=sk-your-key
LLM_MODEL=gpt-4o
```

**Groq (fast & cheap)**
```env
LLM_BASE_URL=https://api.groq.com/openai/v1
LLM_API_KEY=gsk_your-key
LLM_MODEL=llama-3.2-90b-vision-preview
```

**Together AI**
```env
LLM_BASE_URL=https://api.together.xyz/v1
LLM_API_KEY=your-key
LLM_MODEL=meta-llama/Llama-3.2-90B-Vision-Instruct-Turbo
```

### 3. Google Drive (Receipt Storage)

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project
3. Enable the Google Drive API
4. Create OAuth 2.0 credentials (Web application)
5. Add authorized redirect URI: `https://yourapp.vercel.app/api/auth/google/callback`
6. Copy Client ID and Client Secret to env
7. In the app, go to Settings and click "Connect Google Drive"

### 4. Telegram Bot (Optional)

1. Message [@BotFather](https://t.me/BotFather) on Telegram
2. Send `/newbot` and follow instructions
3. Copy the bot token to `TELEGRAM_BOT_TOKEN`
4. Generate a random secret for `TELEGRAM_WEBHOOK_SECRET`
5. Set webhook (after deploying):
   ```bash
   curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://yourapp.vercel.app/api/telegram&secret_token=<SECRET>"
   ```

### 5. WhatsApp Business API (Meta)

Native WhatsApp Business Cloud API integration with interactive buttons and lists.

**Setup Steps:**

1. Go to [Meta for Developers](https://developers.facebook.com)
2. Create a new app → Select "Business" type
3. Add "WhatsApp" product to your app
4. In WhatsApp settings, get:
   - **Phone Number ID** (from "From" dropdown)
   - **Permanent Access Token** (System User token recommended for production)
5. Add to env:
   ```env
   WHATSAPP_PHONE_NUMBER_ID=123456789012345
   WHATSAPP_ACCESS_TOKEN=EAAxxxxxxxxxxxxxxxx
   WHATSAPP_VERIFY_TOKEN=your-random-verify-token
   ```
6. Configure webhook in Meta dashboard:
   - **Callback URL**: `https://yourapp.vercel.app/api/whatsapp`
   - **Verify Token**: Same as `WHATSAPP_VERIFY_TOKEN`
   - **Subscribed Fields**: `messages`

**WhatsApp Features:**
- **Interactive Buttons**: Tap to select Invoices, Athletes, Receipts
- **List Messages**: Browse invoices/athletes in a scrollable list
- **Natural Language**: "Create invoice for ABC Corp $5000 for consulting"
- **Receipt Photos**: Send a photo and AI extracts the data
- **Quick Actions**: Buttons on confirmations (Send Now, Add Another, etc.)

### 6. Cron Job (Scheduled Tasks)

Since Vercel cron requires Pro plan, use [cron-job.org](https://cron-job.org) (free):

1. Create account at cron-job.org
2. Create new cron job:
   - **URL**: `https://yourapp.vercel.app/api/cron`
   - **Method**: POST
   - **Schedule**: Every hour (or as needed)
   - **Headers**: `Authorization: Bearer YOUR_CRON_SECRET`
3. Set `CRON_SECRET` in your Vercel env to match

## Deployment (Vercel)

1. Push code to GitHub
2. Import project in [Vercel](https://vercel.com)
3. Add all environment variables
4. Deploy

**Important**: Update `GOOGLE_REDIRECT_URI` to match your Vercel domain.

## Database

The app uses SQLite with Drizzle ORM. The database file is stored at `./data/sports-agent.db`.

**Commands:**
```bash
# Push schema changes to database
npm run db:push

# Open Drizzle Studio (database UI)
npm run db:studio
```

**Note**: On Vercel, SQLite won't persist between deployments. For production, consider:
- Turso (SQLite edge database)
- PlanetScale (MySQL)
- Neon (Postgres)

## Features

### Invoices
- Create invoices with line items
- Select US or EU company
- Generate PDF
- Send immediately or schedule for later
- Track sent/pending status

### Athletes
- Manage athlete roster
- Filter by position, nationality
- Import contacts via CSV
- Send blast emails to selected contacts
- Schedule blast emails

### Receipts
- Upload receipt photos
- AI extracts date, amount, description
- Auto-generates filename: `MM.DD - $AMOUNT - Description`
- Uploads to Google Drive (if connected)
- **Auto-sync from Drive**: Put receipts in `Receipts-Inbox` folder, they'll be processed automatically
- Images stored in DB for reference/verification

### AI Command Bar
- Press `Ctrl+K` or tap the floating sparkle button to open
- Natural language commands: "Create invoice for [client] $[amount]"
- Add expenses: "Add expense $45 lunch meeting"
- View invoices and athletes
- Suggestions and contextual help included

### WhatsApp/Telegram Bot
- Natural language commands: "Create invoice for [client] $[amount]"
- View invoices and athletes
- Send receipt photos for processing
- Interactive menus with buttons

## CSV Import Format

For importing contacts, use this CSV format:

```csv
name,email,club,country,league
John Smith,john@club.com,FC Example,USA,MLS
Jane Doe,jane@team.com,Team Pro,Germany,Bundesliga
```

Column headers are case-insensitive (Name, EMAIL, Club all work).

## Telegram Commands

If Telegram bot is configured:

- `/receipts` - View recent receipts
- `/invoices` - View recent invoices
- `/athletes` - View athlete count
- Send a photo - Process as receipt

## Troubleshooting

**Build fails with SQLite error**
- The database is lazy-loaded, so this shouldn't happen
- If it does, check that `better-sqlite3` is in `serverExternalPackages` in `next.config.js`

**Emails not sending**
- Verify `RESEND_API_KEY` is correct
- Check that `FROM_EMAIL` domain is verified in Resend

**Receipt processing fails**
- Verify `LLM_API_KEY` is correct
- Check that the model supports vision (image input)

**Google Drive upload fails**
- Re-authenticate in Settings
- Check that Drive API is enabled in Google Cloud Console

## Tech Stack

- **Framework**: Next.js 16 (React 19)
- **Database**: SQLite + Drizzle ORM
- **State**: Zustand + React Query
- **Styling**: Tailwind CSS
- **PDF**: @react-pdf/renderer
- **Email**: Resend
- **LLM**: OpenAI-compatible API
- **Storage**: Google Drive API
- **Messaging**: Telegram Bot API, WhatsApp Business Cloud API (Meta)
