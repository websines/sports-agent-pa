'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Plus, Trash2, Calendar, Building2 } from 'lucide-react';
import { useCreateInvoice, useUpdateInvoice, useCompanies } from '@/lib/query/hooks';
import { useUIStore } from '@/lib/stores';
import { clsx } from 'clsx';
import type { Invoice, InvoiceItem } from '@/lib/db/schema';

interface InvoiceFormProps {
  invoice?: Invoice | null;
  onClose: () => void;
}

export function InvoiceForm({ invoice, onClose }: InvoiceFormProps) {
  const { data: companies } = useCompanies();
  const createInvoice = useCreateInvoice();
  const updateInvoice = useUpdateInvoice();
  const { addNotification } = useUIStore();

  const [formData, setFormData] = useState({
    companyId: invoice?.companyId || '',
    clientName: invoice?.clientName || '',
    clientEmail: invoice?.clientEmail || '',
    clientAddress: invoice?.clientAddress || '',
    clientVatNumber: invoice?.clientVatNumber || '',
    description: invoice?.description || '',
    notes: invoice?.notes || '',
    scheduledDate: invoice?.scheduledDate
      ? new Date(invoice.scheduledDate).toISOString().split('T')[0]
      : '',
  });

  const [items, setItems] = useState<InvoiceItem[]>(
    invoice?.items || [{ description: '', quantity: 1, unitPrice: 0, total: 0 }]
  );

  const [sendOption, setSendOption] = useState<'now' | 'schedule'>('now');

  // Auto-select first company
  useEffect(() => {
    if (companies && companies.length > 0 && !formData.companyId) {
      setFormData((prev) => ({ ...prev, companyId: companies[0].id }));
    }
  }, [companies, formData.companyId]);

  const selectedCompany = companies?.find((c) => c.id === formData.companyId);
  const currency = selectedCompany?.currency || 'USD';
  const currencySymbol = currency === 'EUR' ? '€' : '$';

  const updateItem = (index: number, field: keyof InvoiceItem, value: string | number) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      // Recalculate total
      updated[index].total = updated[index].quantity * updated[index].unitPrice;
      return updated;
    });
  };

  const addItem = () => {
    setItems((prev) => [...prev, { description: '', quantity: 1, unitPrice: 0, total: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const total = subtotal; // Add tax calculation if needed

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.companyId) {
      addNotification('error', 'Please select a company');
      return;
    }

    const data = {
      ...formData,
      items,
      subtotal,
      total,
      currency,
      status: sendOption === 'schedule' && formData.scheduledDate ? 'scheduled' : 'draft',
      scheduledDate: sendOption === 'schedule' ? formData.scheduledDate : null,
    };

    try {
      if (invoice) {
        await updateInvoice.mutateAsync({ id: invoice.id, ...data });
        addNotification('success', 'Invoice updated');
      } else {
        await createInvoice.mutateAsync(data);
        addNotification('success', 'Invoice created');
      }
      onClose();
    } catch {
      addNotification('error', 'Failed to save invoice');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-void/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="absolute inset-x-0 bottom-0 top-12 bg-carbon rounded-t-3xl border-t border-slate/30 overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate/30">
          <h2 className="text-lg font-display font-bold text-white">
            {invoice ? 'Edit Invoice' : 'New Invoice'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-silver hover:text-white hover:bg-slate/30 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form - scrollable content */}
        <form id="invoice-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-6">
            {/* Company Selection */}
            <div>
              <label className="input-label">From Company</label>
              <div className="grid grid-cols-2 gap-3">
                {companies?.map((company) => (
                  <button
                    key={company.id}
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, companyId: company.id }))}
                    className={clsx(
                      'p-4 rounded-xl border text-left transition-all',
                      formData.companyId === company.id
                        ? 'border-accent bg-accent/10'
                        : 'border-slate/30 bg-graphite hover:border-slate'
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Building2 className="w-4 h-4 text-silver" />
                      <span className="text-xs text-silver">{company.region}</span>
                    </div>
                    <p className="font-medium text-white text-sm truncate">{company.name}</p>
                    <p className="text-xs text-silver">{company.currency}</p>
                  </button>
                ))}
                {(!companies || companies.length === 0) && (
                  <p className="col-span-2 text-silver text-sm">
                    No companies configured. Add them in Settings.
                  </p>
                )}
              </div>
            </div>

            {/* Client Details */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-silver">Client Details</h3>

              <div>
                <label className="input-label">Client Name</label>
                <input
                  type="text"
                  value={formData.clientName}
                  onChange={(e) => setFormData((prev) => ({ ...prev, clientName: e.target.value }))}
                  className="input"
                  placeholder="Acme Corp"
                  required
                />
              </div>

              <div>
                <label className="input-label">Client Email</label>
                <input
                  type="email"
                  value={formData.clientEmail}
                  onChange={(e) => setFormData((prev) => ({ ...prev, clientEmail: e.target.value }))}
                  className="input"
                  placeholder="billing@acme.com"
                  required
                />
              </div>

              <div>
                <label className="input-label">Client Address</label>
                <textarea
                  value={formData.clientAddress}
                  onChange={(e) => setFormData((prev) => ({ ...prev, clientAddress: e.target.value }))}
                  className="input resize-none"
                  rows={2}
                  placeholder="123 Main St, City, Country"
                  required
                />
              </div>

              <div>
                <label className="input-label">VAT Number (optional)</label>
                <input
                  type="text"
                  value={formData.clientVatNumber}
                  onChange={(e) => setFormData((prev) => ({ ...prev, clientVatNumber: e.target.value }))}
                  className="input"
                  placeholder="EU123456789"
                />
              </div>
            </div>

            {/* Invoice Items */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-silver">Items</h3>
                <button type="button" onClick={addItem} className="btn-ghost text-xs">
                  <Plus className="w-3 h-3" />
                  Add Item
                </button>
              </div>

              {items.map((item, index) => (
                <div key={index} className="p-4 bg-graphite rounded-xl space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => updateItem(index, 'description', e.target.value)}
                      className="input flex-1"
                      placeholder="Description"
                      required
                    />
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="p-2 text-error hover:bg-error/10 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-silver">Qty</label>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 0)}
                        className="input mt-1"
                        min="1"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs text-silver">Price</label>
                      <input
                        type="number"
                        value={item.unitPrice}
                        onChange={(e) => updateItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                        className="input mt-1"
                        min="0"
                        step="0.01"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs text-silver">Total</label>
                      <div className="input mt-1 bg-slate/30 text-silver">
                        {currencySymbol}{item.total.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Description */}
            <div>
              <label className="input-label">Invoice Description</label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                className="input"
                placeholder="Player transfer commission - John Doe"
                required
              />
            </div>

            {/* Notes */}
            <div>
              <label className="input-label">Notes (optional)</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                className="input resize-none"
                rows={2}
                placeholder="Payment terms, bank details, etc."
              />
            </div>

            {/* Send Options */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-silver">When to send?</h3>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSendOption('now')}
                  className={clsx(
                    'p-4 rounded-xl border text-left transition-all',
                    sendOption === 'now'
                      ? 'border-accent bg-accent/10'
                      : 'border-slate/30 bg-graphite hover:border-slate'
                  )}
                >
                  <p className="font-medium text-white text-sm">Save as Draft</p>
                  <p className="text-xs text-silver">Send manually later</p>
                </button>
                <button
                  type="button"
                  onClick={() => setSendOption('schedule')}
                  className={clsx(
                    'p-4 rounded-xl border text-left transition-all',
                    sendOption === 'schedule'
                      ? 'border-accent bg-accent/10'
                      : 'border-slate/30 bg-graphite hover:border-slate'
                  )}
                >
                  <Calendar className="w-4 h-4 text-accent mb-1" />
                  <p className="font-medium text-white text-sm">Schedule</p>
                  <p className="text-xs text-silver">Auto-send on date</p>
                </button>
              </div>

              {sendOption === 'schedule' && (
                <div>
                  <label className="input-label">Send Date</label>
                  <input
                    type="date"
                    value={formData.scheduledDate}
                    onChange={(e) => setFormData((prev) => ({ ...prev, scheduledDate: e.target.value }))}
                    className="input"
                    required={sendOption === 'schedule'}
                  />
                </div>
              )}
            </div>
        </form>

        {/* Footer - always visible */}
        <div className="shrink-0 p-5 bg-carbon border-t border-slate/30 safe-bottom">
          <div className="flex items-center justify-between mb-4">
            <span className="text-silver">Total</span>
            <span className="text-2xl font-display font-bold text-white">
              {currencySymbol}{total.toLocaleString()}
            </span>
          </div>
          <button
            type="submit"
            form="invoice-form"
            disabled={createInvoice.isPending || updateInvoice.isPending}
            className="btn-primary w-full"
          >
            {(createInvoice.isPending || updateInvoice.isPending) && (
              <div className="spinner border-white/30 border-t-white" />
            )}
            {invoice ? 'Update Invoice' : 'Create Invoice'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
