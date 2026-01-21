'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Send, Clock, CheckCircle, FileText, MoreVertical, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { PageHeader } from '@/components/layout/PageHeader';
import { InvoiceForm } from '@/components/invoices/InvoiceForm';
import { useInvoices, useDeleteInvoice, useSendInvoice } from '@/lib/query/hooks';
import { useUIStore } from '@/lib/stores';
import { clsx } from 'clsx';
import type { Invoice } from '@/lib/db/schema';

const statusConfig = {
  draft: { label: 'Draft', color: 'badge-neutral', icon: FileText },
  scheduled: { label: 'Scheduled', color: 'badge-warning', icon: Clock },
  sent: { label: 'Sent', color: 'badge-accent', icon: Send },
  paid: { label: 'Paid', color: 'badge-success', icon: CheckCircle },
};

export default function InvoicesPage() {
  const [showForm, setShowForm] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  const { data: invoices, isLoading } = useInvoices();
  const deleteInvoice = useDeleteInvoice();
  const sendInvoice = useSendInvoice();
  const { addNotification } = useUIStore();

  const handleEdit = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    setShowForm(true);
    setActiveMenu(null);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteInvoice.mutateAsync(id);
      addNotification('success', 'Invoice deleted');
    } catch {
      addNotification('error', 'Failed to delete invoice');
    }
    setActiveMenu(null);
  };

  const handleSend = async (id: string) => {
    try {
      await sendInvoice.mutateAsync(id);
      addNotification('success', 'Invoice sent successfully');
    } catch {
      addNotification('error', 'Failed to send invoice');
    }
    setActiveMenu(null);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingInvoice(null);
  };

  return (
    <>
      <PageHeader
        title="Invoices"
        subtitle={invoices ? `${invoices.length} total` : 'Loading...'}
        action={
          <button onClick={() => setShowForm(true)} className="btn-primary">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Invoice</span>
          </button>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="spinner" />
        </div>
      ) : invoices && invoices.length > 0 ? (
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
          }}
          className="space-y-3"
        >
          {invoices.map((invoice) => {
            const status = statusConfig[invoice.status as keyof typeof statusConfig];
            const StatusIcon = status.icon;

            return (
              <motion.div
                key={invoice.id}
                variants={{
                  hidden: { opacity: 0, y: 10 },
                  visible: { opacity: 1, y: 0 },
                }}
                className="card-hover"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs text-silver">
                        {invoice.invoiceNumber}
                      </span>
                      <span className={status.color}>
                        <StatusIcon className="w-3 h-3 mr-1 inline" />
                        {status.label}
                      </span>
                    </div>
                    <h3 className="font-medium text-white truncate">{invoice.clientName}</h3>
                    <p className="text-sm text-silver truncate">{invoice.description}</p>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <p className="font-display font-bold text-lg text-white">
                      {invoice.currency === 'EUR' ? '€' : '$'}
                      {invoice.total.toLocaleString()}
                    </p>
                    <p className="text-xs text-silver">
                      {invoice.createdAt
                        ? format(new Date(invoice.createdAt), 'MMM d, yyyy')
                        : ''}
                    </p>
                  </div>

                  <div className="relative">
                    <button
                      onClick={() => setActiveMenu(activeMenu === invoice.id ? null : invoice.id)}
                      className="p-2 text-silver hover:text-white hover:bg-slate/30 rounded-lg transition-colors"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    <AnimatePresence>
                      {activeMenu === invoice.id && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="absolute right-0 top-full mt-1 w-40 bg-graphite border border-slate rounded-xl shadow-xl z-20 overflow-hidden"
                        >
                          {invoice.status === 'draft' && (
                            <button
                              onClick={() => handleSend(invoice.id)}
                              className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-slate/50 flex items-center gap-2"
                            >
                              <Send className="w-4 h-4" />
                              Send Now
                            </button>
                          )}
                          <button
                            onClick={() => handleEdit(invoice)}
                            className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-slate/50 flex items-center gap-2"
                          >
                            <FileText className="w-4 h-4" />
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(invoice.id)}
                            className="w-full px-4 py-2.5 text-left text-sm text-error hover:bg-error/10 flex items-center gap-2"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {invoice.scheduledDate && invoice.status === 'scheduled' && (
                  <div className="mt-3 pt-3 border-t border-slate/30">
                    <p className="text-xs text-silver flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Scheduled for {format(new Date(invoice.scheduledDate), 'MMM d, yyyy')}
                    </p>
                  </div>
                )}
              </motion.div>
            );
          })}
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-20"
        >
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate/30 flex items-center justify-center">
            <FileText className="w-8 h-8 text-silver" />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">No invoices yet</h3>
          <p className="text-silver text-sm mb-6">Create your first invoice to get started</p>
          <button onClick={() => setShowForm(true)} className="btn-primary">
            <Plus className="w-4 h-4" />
            Create Invoice
          </button>
        </motion.div>
      )}

      {/* Invoice Form Modal */}
      <AnimatePresence>
        {showForm && (
          <InvoiceForm
            invoice={editingInvoice}
            onClose={handleCloseForm}
          />
        )}
      </AnimatePresence>

      {/* Click outside to close menu */}
      {activeMenu && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setActiveMenu(null)}
        />
      )}
    </>
  );
}
