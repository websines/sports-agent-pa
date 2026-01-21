# Sports Agent PA

A personal assistant application for sports agents to manage invoices, athlete rosters, and expense receipts. Built with Next.js 16 and designed mobile-first with a dark theme.

## Overview

This app helps sports agents (specifically volleyball agents) with three core workflows:

1. **Invoice Management** - Create, schedule, and send invoices to clients
2. **Athlete Blast Emails** - Manage athlete rosters and send profiles to club contacts
3. **Receipt Processing** - AI-powered expense tracking with auto-naming and Drive storage

## Features

### Invoice Tool
- Create invoices with multiple line items
- Select from US or EU billing company
- Auto-generate PDF with professional formatting
- Send immediately via email or schedule for later
- Track invoice status (draft → scheduled → sent → paid)
- **Agentic creation via WhatsApp**: "Create invoice for ABC Corp $5000 for consulting"

### Athlete Blast Tool
- Manage volleyball player roster by position (Setter, Outside Hitter, Opposite, Middle Blocker, Libero)
- Store athlete details: height, nationality, birth year, profile links, highlight videos
- Import club contacts via CSV
- Filter contacts by country/league
- Select athletes and contacts, compose message, blast in a few clicks
- Schedule blast emails for optimal timing

### Receipt Scanner
- Upload receipt photos from mobile
- AI (Vision LLM) extracts: date, amount, currency, description, category
- Auto-generates filename: `MM.DD - $AMOUNT - Description.jpg`
- Uploads to Google Drive in organized folders (`Expenses/2026/`)
- **Auto-sync from Drive**: Drop receipts in `Receipts-Inbox` folder, processed automatically by cron
- Images stored in database for reference/verification

### WhatsApp & Telegram Bots
- Natural language commands via chat
- Create invoices: "Invoice John Smith $3000 for agent fees"
- Add receipts: "Add expense $45 lunch today"
- View invoices and athletes
- Send receipt photos for instant processing
- Interactive menus with buttons

### Scheduled Tasks (Cron)
- Processes scheduled invoices when due
- Sends scheduled athlete blast emails
- Processes queued receipts
- Syncs new files from Google Drive inbox folder
- Sends notification summaries

## Tech Stack

### Frontend
- **Next.js 16** - React 19 with App Router
- **Tailwind CSS** - Utility-first styling with custom dark theme
- **Zustand** - Client-side state management
- **React Query (TanStack Query)** - Server state & caching
- **Framer Motion** - Animations
- **Lucide React** - Icons

### Backend
- **Next.js API Routes** - RESTful endpoints
- **Drizzle ORM** - Type-safe database queries
- **SQLite** - Local database (better-sqlite3)

### Services
- **Resend** - Email delivery (3000 free/month)
- **OpenAI-compatible LLM** - Receipt OCR & agentic parsing (swappable: OpenAI, Groq, Together)
- **Google Drive API** - Receipt storage & folder sync
- **Twilio** - WhatsApp integration
- **Telegram Bot API** - Telegram integration
- **@react-pdf/renderer** - Invoice PDF generation

## Project Structure

```
src/
├── app/
│   ├── (app)/                    # Authenticated app routes
│   │   ├── athletes/page.tsx     # Athlete roster & blast UI
│   │   ├── invoices/page.tsx     # Invoice list & creation
│   │   ├── receipts/page.tsx     # Receipt upload & list
│   │   ├── settings/page.tsx     # Company & connection settings
│   │   └── layout.tsx            # App shell with bottom nav
│   ├── api/
│   │   ├── athletes/             # CRUD for athletes
│   │   ├── auth/                 # Login, logout, Google OAuth
│   │   ├── blasts/               # Athlete blast campaigns
│   │   ├── companies/            # Billing company management
│   │   ├── contacts/             # Contact CRUD & CSV import
│   │   ├── cron/                 # Scheduled task handler
│   │   ├── invoices/             # Invoice CRUD & send
│   │   ├── receipts/             # Receipt CRUD & image endpoint
│   │   ├── telegram/             # Telegram bot webhook
│   │   └── whatsapp/             # WhatsApp bot webhook
│   ├── login/page.tsx            # Password authentication
│   ├── layout.tsx                # Root layout with fonts
│   └── page.tsx                  # Home/dashboard
├── components/
│   ├── athletes/
│   │   ├── AthleteForm.tsx       # Add/edit athlete modal
│   │   ├── BlastForm.tsx         # Compose & send blast
│   │   └── ContactsModal.tsx     # Manage contacts + CSV import
│   ├── invoices/
│   │   └── InvoiceForm.tsx       # Create/edit invoice form
│   ├── layout/
│   │   ├── AppShell.tsx          # Main app container
│   │   ├── BottomNav.tsx         # Mobile navigation
│   │   └── PageHeader.tsx        # Page title component
│   ├── settings/
│   │   └── CompanyForm.tsx       # Add/edit company
│   └── ui/
│       └── Toast.tsx             # Notification toasts
├── lib/
│   ├── db/
│   │   ├── index.ts              # Database connection (lazy-loaded)
│   │   └── schema.ts             # Drizzle schema definitions
│   ├── query/
│   │   ├── hooks.ts              # React Query hooks
│   │   └── provider.tsx          # Query client provider
│   ├── services/
│   │   ├── email.ts              # Resend email service
│   │   ├── google-drive.ts       # Drive upload, sync, OAuth
│   │   ├── llm.ts                # Receipt OCR & agentic parsing
│   │   ├── pdf.ts                # Invoice PDF generation
│   │   └── whatsapp.ts           # Twilio WhatsApp service
│   └── stores/
│       └── index.ts              # Zustand stores
└── middleware.ts                 # Auth middleware
```

## Database Schema

### Companies
Billing entities (US and EU companies):
- name, address, city, country, postalCode
- vatNumber, email, phone, currency
- logoUrl, region (US/EU)

### Invoices
- invoiceNumber (unique)
- companyId (reference)
- clientName, clientEmail, clientAddress, clientVatNumber
- description, items (JSON array)
- subtotal, taxRate, taxAmount, total, currency
- status (draft/scheduled/sent/paid)
- scheduledDate, sentAt, paidAt, notes

### Athletes
- name, position, height, nationality, birthYear
- notes (e.g., "left-handed")
- profileUrl, highlightUrls (JSON array), statsUrl
- featured (starred athletes), active

### Contacts
- name, email, club, country, league
- role (e.g., "Sporting Director")
- notes, active

### Blasts
- subject, message
- athleteIds, contactIds (JSON arrays)
- status (draft/scheduled/sent)
- scheduledDate, sentAt, recipientCount

### Receipts
- date (MM.DD format), amount, currency
- description, category (food/transport/housing/gas/toll/other)
- originalFilename, generatedFilename
- driveUrl, driveFileId
- status (queued/processing/done/failed), error
- rawImageBase64 (stored for reference), llmResponse

### Settings
- key-value store for app configuration

## API Endpoints

### Authentication
- `POST /api/auth/login` - Password login
- `POST /api/auth/logout` - Clear session
- `GET /api/auth/google` - Start Google OAuth
- `GET /api/auth/google/callback` - OAuth callback

### Invoices
- `GET/POST /api/invoices` - List/create invoices
- `GET/PUT/DELETE /api/invoices/[id]` - Single invoice
- `POST /api/invoices/[id]/send` - Send invoice email

### Athletes
- `GET/POST /api/athletes` - List/create athletes
- `GET/PUT/DELETE /api/athletes/[id]` - Single athlete

### Contacts
- `GET/POST /api/contacts` - List/create contacts
- `GET/PUT/DELETE /api/contacts/[id]` - Single contact
- `POST /api/contacts/import` - CSV import

### Blasts
- `GET/POST /api/blasts` - List/create blasts
- `POST /api/blasts/[id]/send` - Send blast

### Companies
- `GET/POST /api/companies` - List/create companies
- `GET/PUT/DELETE /api/companies/[id]` - Single company

### Receipts
- `GET/POST /api/receipts` - List/create receipts
- `GET/PUT/DELETE /api/receipts/[id]` - Single receipt
- `GET /api/receipts/[id]/image` - Serve receipt image

### Webhooks
- `GET/POST /api/cron` - Cron job handler
- `POST /api/telegram` - Telegram bot webhook
- `POST /api/whatsapp` - WhatsApp bot webhook

## State Management

### Zustand Stores
- **InvoiceStore** - Invoice list, loading state, CRUD actions
- **AthleteStore** - Athletes, selection, position filter
- **ContactStore** - Contacts, selection, country/league filters
- **ReceiptStore** - Receipts, processing state
- **CompanyStore** - Companies
- **UIStore** - Sidebar, modals, notifications
- **SettingsStore** (persisted) - Google/Telegram/WhatsApp connection status, notification email

### React Query
All data fetching uses React Query hooks for:
- Automatic caching and refetching
- Optimistic updates
- Loading/error states

## Services

### Email Service (Resend)
- `sendInvoiceEmail()` - Send invoice with PDF attachment
- `sendAthleteBlastEmail()` - Send athlete profiles to contacts
- `sendNotification()` - Send summary notifications

### LLM Service (OpenAI-compatible)
- `extractReceiptData()` - Vision model extracts date, amount, description from receipt image
- `generateReceiptFilename()` - Creates `MM.DD - $AMOUNT - Description` format
- `parseAgentMessage()` - Determines user intent from natural language
- `parseInvoiceFromMessage()` - Extracts invoice details from chat message

### Google Drive Service
- `getAuthUrl()` / `handleCallback()` - OAuth flow
- `uploadFileToDrive()` - Upload to Expenses/[Year] folder
- `listFilesInFolder()` - List files in Receipts-Inbox
- `downloadFileFromDrive()` - Download file content
- `moveFileToDrive()` - Move processed files
- `getProcessedFolderId()` - Get/create organized folder structure

### WhatsApp Service (Twilio)
- `sendWhatsAppMessage()` - Send text message
- `sendWhatsAppButtonMessage()` - Send with quick reply buttons
- `sendWhatsAppListMessage()` - Send list selection
- `sendWhatsAppMediaMessage()` - Send with image
- `sendMainMenu()` - Interactive main menu
- `sendInvoiceSummary()` / `sendAthleteList()` - Formatted lists
- `validateWebhook()` - Verify Twilio signature

### PDF Service
- `generateInvoicePDF()` - Creates professional invoice PDF with company branding

## Authentication

Simple password-based auth:
- Set `APP_PASSWORD` env variable to enable
- Login page at `/login`
- Auth cookie stored for 30 days
- Middleware protects all routes except:
  - `/login`
  - `/api/auth/login`
  - `/api/cron` (uses CRON_SECRET)
  - `/api/telegram` (uses webhook secret)
  - `/api/whatsapp` (uses Twilio signature)

## Cron Job Flow

The `/api/cron` endpoint (called hourly) processes:

1. **Scheduled Invoices**
   - Find invoices with status=scheduled and scheduledDate <= now
   - Generate PDF, send email, update status to sent

2. **Scheduled Blasts**
   - Find blasts with status=scheduled and scheduledDate <= now
   - Generate athlete HTML, send to all contacts, update status

3. **Queued Receipts**
   - Find receipts with status=queued
   - Extract data with LLM, upload to Drive, update record

4. **Drive Inbox Sync**
   - List images in `Receipts-Inbox` folder
   - Download, process with LLM, move to `Expenses/[Year]`
   - Create receipt record with image stored

5. **Notification**
   - Send summary email if anything was processed

## Environment Variables

```env
# Required
RESEND_API_KEY=re_xxxxxxxxxxxx
FROM_EMAIL=invoices@yourdomain.com

# LLM (Receipt OCR & Agentic)
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=sk-xxxxxxxxxxxx
LLM_MODEL=gpt-4o

# Google Drive
GOOGLE_CLIENT_ID=xxxxxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxx
GOOGLE_REDIRECT_URI=https://yourapp.vercel.app/api/auth/google/callback

# Telegram
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_WEBHOOK_SECRET=your-random-secret

# WhatsApp (Twilio)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886

# Auth
APP_PASSWORD=your-secure-password

# Cron
CRON_SECRET=your-random-secret-for-cron

# Notifications
NOTIFICATION_EMAIL=your@email.com
```

## Design

### Theme
- Dark background (#0a0a0a)
- Primary accent: Orange (#ff6b35)
- Secondary: Teal accents
- Card backgrounds: #111, #1a1a1a
- Text: White primary, #888 secondary

### Mobile-First
- Bottom navigation bar
- Touch-friendly targets
- Swipe gestures where appropriate
- Responsive grid layouts

### Components
- Cards with hover states
- Badges for status/category
- Modal forms for creation/editing
- Toast notifications
- Loading spinners

## Deployment

### Vercel (Recommended)
1. Push to GitHub
2. Import in Vercel
3. Add environment variables
4. Deploy

### Database Note
SQLite doesn't persist on Vercel. For production use:
- **Turso** - SQLite at the edge
- **PlanetScale** - MySQL
- **Neon** - Postgres

### Cron Setup
Vercel cron requires Pro plan. Use cron-job.org (free):
1. Create job pointing to `/api/cron`
2. Set `Authorization: Bearer YOUR_CRON_SECRET` header
3. Schedule hourly or as needed

## Development

```bash
# Install dependencies
npm install

# Push database schema
npm run db:push

# Start dev server
npm run dev

# Open database UI
npm run db:studio

# Build for production
npm run build
```

## Future Improvements

- [ ] Multi-user support with proper auth
- [ ] Invoice payment tracking integration
- [ ] Athlete contract management
- [ ] Expense reports and analytics
- [ ] PWA with offline support
- [ ] Push notifications
- [ ] Calendar integration for scheduling
