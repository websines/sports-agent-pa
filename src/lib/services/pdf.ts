import { renderToBuffer } from '@react-pdf/renderer';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { createElement } from 'react';
import type { Invoice, Company } from '@/lib/db/schema';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 40,
  },
  companyInfo: {
    maxWidth: '50%',
  },
  companyName: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 8,
    color: '#111111',
  },
  companyDetails: {
    color: '#666666',
    lineHeight: 1.5,
  },
  invoiceTitle: {
    fontSize: 28,
    fontFamily: 'Helvetica-Bold',
    color: '#ff6b35',
    textAlign: 'right',
  },
  invoiceNumber: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'right',
    marginTop: 4,
  },
  invoiceDate: {
    fontSize: 10,
    color: '#666666',
    textAlign: 'right',
    marginTop: 2,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#999999',
    textTransform: 'uppercase',
    marginBottom: 8,
    letterSpacing: 1,
  },
  clientName: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#111111',
    marginBottom: 4,
  },
  clientDetails: {
    color: '#666666',
    lineHeight: 1.5,
  },
  table: {
    marginTop: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    padding: 10,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  tableHeaderCell: {
    fontFamily: 'Helvetica-Bold',
    color: '#666666',
    fontSize: 9,
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eeeeee',
  },
  descriptionCol: {
    flex: 3,
  },
  qtyCol: {
    flex: 1,
    textAlign: 'center',
  },
  priceCol: {
    flex: 1,
    textAlign: 'right',
  },
  totalCol: {
    flex: 1,
    textAlign: 'right',
  },
  totalsSection: {
    marginTop: 20,
    alignItems: 'flex-end',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingVertical: 4,
    width: 200,
  },
  totalLabel: {
    flex: 1,
    color: '#666666',
  },
  totalValue: {
    width: 80,
    textAlign: 'right',
  },
  grandTotal: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingVertical: 8,
    marginTop: 8,
    borderTopWidth: 2,
    borderTopColor: '#111111',
    width: 200,
  },
  grandTotalLabel: {
    flex: 1,
    fontFamily: 'Helvetica-Bold',
    fontSize: 14,
    color: '#111111',
  },
  grandTotalValue: {
    width: 80,
    textAlign: 'right',
    fontFamily: 'Helvetica-Bold',
    fontSize: 14,
    color: '#ff6b35',
  },
  notes: {
    marginTop: 40,
    padding: 16,
    backgroundColor: '#f9f9f9',
    borderRadius: 4,
  },
  notesTitle: {
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
    color: '#666666',
  },
  notesText: {
    color: '#666666',
    lineHeight: 1.5,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    color: '#999999',
    fontSize: 8,
    borderTopWidth: 1,
    borderTopColor: '#eeeeee',
    paddingTop: 10,
  },
});

function getCurrencySymbol(currency: string) {
  switch (currency) {
    case 'EUR':
      return '€';
    case 'GBP':
      return '£';
    default:
      return '$';
  }
}

function formatDate(date: Date | null | undefined) {
  if (!date) return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function InvoiceDocument({ invoice, company }: { invoice: Invoice; company: Company }) {
  const currencySymbol = getCurrencySymbol(invoice.currency);
  const items = invoice.items as Array<{ description: string; quantity: number; unitPrice: number; total: number }>;

  return createElement(
    Document,
    null,
    createElement(
      Page,
      { size: 'A4', style: styles.page },
      // Header
      createElement(
        View,
        { style: styles.header },
        createElement(
          View,
          { style: styles.companyInfo },
          createElement(Text, { style: styles.companyName }, company.name),
          createElement(
            Text,
            { style: styles.companyDetails },
            `${company.address}\n${company.city}, ${company.postalCode || ''}\n${company.country}\n${company.email}${company.vatNumber ? `\nVAT: ${company.vatNumber}` : ''}`
          )
        ),
        createElement(
          View,
          null,
          createElement(Text, { style: styles.invoiceTitle }, 'INVOICE'),
          createElement(Text, { style: styles.invoiceNumber }, invoice.invoiceNumber),
          createElement(Text, { style: styles.invoiceDate }, formatDate(invoice.createdAt))
        )
      ),
      // Bill To
      createElement(
        View,
        { style: styles.section },
        createElement(Text, { style: styles.sectionTitle }, 'Bill To'),
        createElement(Text, { style: styles.clientName }, invoice.clientName),
        createElement(
          Text,
          { style: styles.clientDetails },
          `${invoice.clientAddress}${invoice.clientVatNumber ? `\nVAT: ${invoice.clientVatNumber}` : ''}`
        )
      ),
      // Description
      createElement(
        View,
        { style: styles.section },
        createElement(Text, { style: styles.sectionTitle }, 'Description'),
        createElement(Text, { style: styles.clientDetails }, invoice.description)
      ),
      // Items Table
      createElement(
        View,
        { style: styles.table },
        createElement(
          View,
          { style: styles.tableHeader },
          createElement(Text, { style: [styles.tableHeaderCell, styles.descriptionCol] }, 'Item'),
          createElement(Text, { style: [styles.tableHeaderCell, styles.qtyCol] }, 'Qty'),
          createElement(Text, { style: [styles.tableHeaderCell, styles.priceCol] }, 'Price'),
          createElement(Text, { style: [styles.tableHeaderCell, styles.totalCol] }, 'Total')
        ),
        ...items.map((item, index) =>
          createElement(
            View,
            { key: index, style: styles.tableRow },
            createElement(Text, { style: styles.descriptionCol }, item.description),
            createElement(Text, { style: styles.qtyCol }, String(item.quantity)),
            createElement(Text, { style: styles.priceCol }, `${currencySymbol}${item.unitPrice.toFixed(2)}`),
            createElement(Text, { style: styles.totalCol }, `${currencySymbol}${item.total.toFixed(2)}`)
          )
        )
      ),
      // Totals
      createElement(
        View,
        { style: styles.totalsSection },
        createElement(
          View,
          { style: styles.totalRow },
          createElement(Text, { style: styles.totalLabel }, 'Subtotal'),
          createElement(Text, { style: styles.totalValue }, `${currencySymbol}${invoice.subtotal.toFixed(2)}`)
        ),
        invoice.taxAmount && invoice.taxAmount > 0
          ? createElement(
              View,
              { style: styles.totalRow },
              createElement(Text, { style: styles.totalLabel }, `Tax (${invoice.taxRate}%)`),
              createElement(Text, { style: styles.totalValue }, `${currencySymbol}${invoice.taxAmount.toFixed(2)}`)
            )
          : null,
        createElement(
          View,
          { style: styles.grandTotal },
          createElement(Text, { style: styles.grandTotalLabel }, 'Total'),
          createElement(Text, { style: styles.grandTotalValue }, `${currencySymbol}${invoice.total.toFixed(2)}`)
        )
      ),
      // Notes
      invoice.notes
        ? createElement(
            View,
            { style: styles.notes },
            createElement(Text, { style: styles.notesTitle }, 'Notes'),
            createElement(Text, { style: styles.notesText }, invoice.notes)
          )
        : null,
      // Footer
      createElement(
        Text,
        { style: styles.footer },
        `${company.name} | ${company.email} | Invoice ${invoice.invoiceNumber}`
      )
    )
  );
}

export async function generateInvoicePDF(invoice: Invoice, company: Company): Promise<Buffer> {
  const doc = createElement(InvoiceDocument, { invoice, company });
  const buffer = await renderToBuffer(doc);
  return Buffer.from(buffer);
}
