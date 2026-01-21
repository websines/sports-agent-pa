import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

// Companies (US and EU)
export const companies = sqliteTable('companies', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  address: text('address').notNull(),
  city: text('city').notNull(),
  country: text('country').notNull(),
  postalCode: text('postal_code'),
  vatNumber: text('vat_number'),
  email: text('email').notNull(),
  phone: text('phone'),
  currency: text('currency').notNull().default('USD'),
  logoUrl: text('logo_url'),
  region: text('region').notNull(), // 'US' | 'EU'
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Invoices
export const invoices = sqliteTable('invoices', {
  id: text('id').primaryKey(),
  invoiceNumber: text('invoice_number').notNull().unique(),
  companyId: text('company_id').notNull().references(() => companies.id),

  // Client details
  clientName: text('client_name').notNull(),
  clientEmail: text('client_email').notNull(),
  clientAddress: text('client_address').notNull(),
  clientVatNumber: text('client_vat_number'),

  // Invoice details
  description: text('description').notNull(),
  items: text('items', { mode: 'json' }).$type<InvoiceItem[]>().notNull(),
  subtotal: real('subtotal').notNull(),
  taxRate: real('tax_rate').default(0),
  taxAmount: real('tax_amount').default(0),
  total: real('total').notNull(),
  currency: text('currency').notNull().default('USD'),

  // Status and scheduling
  status: text('status').notNull().default('draft'), // draft | scheduled | sent | paid
  scheduledDate: integer('scheduled_date', { mode: 'timestamp' }),
  sentAt: integer('sent_at', { mode: 'timestamp' }),
  paidAt: integer('paid_at', { mode: 'timestamp' }),

  notes: text('notes'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export type InvoiceItem = {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

// Athletes
export const athletes = sqliteTable('athletes', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  position: text('position').notNull(), // Setter | Outside Hitter | Opposite | Middle Blocker | Libero
  height: text('height'), // e.g., "185cm"
  nationality: text('nationality').notNull(),
  birthYear: integer('birth_year'),
  notes: text('notes'), // e.g., "left-handed", Japanese description

  // Links
  profileUrl: text('profile_url'), // volleybox link
  highlightUrls: text('highlight_urls', { mode: 'json' }).$type<string[]>(),
  statsUrl: text('stats_url'), // Google Drive link

  // Status
  featured: integer('featured', { mode: 'boolean' }).default(false), // the ** players
  active: integer('active', { mode: 'boolean' }).default(true),

  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Contacts (clubs, scouts, etc.)
export const contacts = sqliteTable('contacts', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  club: text('club'),
  country: text('country'),
  league: text('league'),
  role: text('role'), // e.g., "Sporting Director", "Scout", "Manager"
  notes: text('notes'),
  active: integer('active', { mode: 'boolean' }).default(true),

  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Athlete Blasts (email campaigns)
export const blasts = sqliteTable('blasts', {
  id: text('id').primaryKey(),
  subject: text('subject').notNull(),
  message: text('message'),

  // Filters used
  athleteIds: text('athlete_ids', { mode: 'json' }).$type<string[]>().notNull(),
  contactIds: text('contact_ids', { mode: 'json' }).$type<string[]>().notNull(),

  // Status
  status: text('status').notNull().default('draft'), // draft | scheduled | sent
  scheduledDate: integer('scheduled_date', { mode: 'timestamp' }),
  sentAt: integer('sent_at', { mode: 'timestamp' }),
  recipientCount: integer('recipient_count').default(0),

  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Receipts
export const receipts = sqliteTable('receipts', {
  id: text('id').primaryKey(),

  // Extracted data
  date: text('date').notNull(), // MM.DD format
  amount: real('amount').notNull(),
  currency: text('currency').notNull().default('USD'),
  description: text('description').notNull(),
  category: text('category'), // food | transport | housing | gas | toll | other

  // File info
  originalFilename: text('original_filename'),
  generatedFilename: text('generated_filename').notNull(),
  driveUrl: text('drive_url'),
  driveFileId: text('drive_file_id'),

  // Processing status
  status: text('status').notNull().default('queued'), // queued | processing | done | failed
  error: text('error'),

  // Raw data
  rawImageBase64: text('raw_image_base64'), // stored temporarily until processed
  llmResponse: text('llm_response'), // raw response from vision model

  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  processedAt: integer('processed_at', { mode: 'timestamp' }),
});

// Settings (for storing config)
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value', { mode: 'json' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Types
export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;
export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
export type Athlete = typeof athletes.$inferSelect;
export type NewAthlete = typeof athletes.$inferInsert;
export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;
export type Blast = typeof blasts.$inferSelect;
export type NewBlast = typeof blasts.$inferInsert;
export type Receipt = typeof receipts.$inferSelect;
export type NewReceipt = typeof receipts.$inferInsert;
