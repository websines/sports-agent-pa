'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  Receipt,
  Camera,
  CheckCircle,
  Clock,
  AlertCircle,
  ExternalLink,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { format } from 'date-fns';
import { PageHeader } from '@/components/layout/PageHeader';
import { useReceipts, useUploadReceipt, useDeleteReceipt } from '@/lib/query/hooks';
import { useUIStore, useSettingsStore } from '@/lib/stores';
import { clsx } from 'clsx';

const statusConfig = {
  queued: { label: 'Queued', color: 'badge-warning', icon: Clock },
  processing: { label: 'Processing', color: 'badge-accent', icon: RefreshCw },
  done: { label: 'Done', color: 'badge-success', icon: CheckCircle },
  failed: { label: 'Failed', color: 'badge-error', icon: AlertCircle },
};

export default function ReceiptsPage() {
  const { data: receipts, isLoading, refetch } = useReceipts();
  const uploadReceipt = useUploadReceipt();
  const deleteReceipt = useDeleteReceipt();
  const { addNotification } = useUIStore();
  const { googleConnected } = useSettingsStore();

  const [uploading, setUploading] = useState(false);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (!googleConnected) {
        addNotification('error', 'Connect Google Drive in Settings first');
        return;
      }

      setUploading(true);
      let successCount = 0;

      for (const file of acceptedFiles) {
        try {
          await uploadReceipt.mutateAsync(file);
          successCount++;
        } catch (error) {
          console.error('Upload failed:', error);
        }
      }

      setUploading(false);

      if (successCount > 0) {
        addNotification(
          'success',
          `${successCount} receipt${successCount > 1 ? 's' : ''} uploaded - processing...`
        );
      }
      if (successCount < acceptedFiles.length) {
        addNotification('error', `${acceptedFiles.length - successCount} upload(s) failed`);
      }
    },
    [uploadReceipt, addNotification, googleConnected]
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.heic'],
      'application/pdf': ['.pdf'],
    },
    noClick: true,
  });

  const handleDelete = async (id: string) => {
    try {
      await deleteReceipt.mutateAsync(id);
      addNotification('success', 'Receipt deleted');
    } catch {
      addNotification('error', 'Failed to delete receipt');
    }
  };

  const getCurrencySymbol = (currency: string) => {
    switch (currency) {
      case 'EUR':
        return '€';
      case 'GBP':
        return '£';
      default:
        return '$';
    }
  };

  return (
    <div {...getRootProps()} className="min-h-[calc(100vh-150px)]">
      <input {...getInputProps()} />

      <PageHeader
        title="Receipts"
        subtitle={receipts ? `${receipts.length} total` : 'Loading...'}
        action={
          <button onClick={open} disabled={uploading} className="btn-primary">
            {uploading ? (
              <div className="spinner border-white/30 border-t-white" />
            ) : (
              <Camera className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">Upload</span>
          </button>
        }
      />

      {/* Connection Warning */}
      {!googleConnected && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-4 bg-warning/10 border border-warning/30 rounded-xl"
        >
          <p className="text-warning text-sm">
            Connect Google Drive in Settings to enable receipt uploads
          </p>
        </motion.div>
      )}

      {/* Drop Zone Overlay */}
      <AnimatePresence>
        {isDragActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-void/90 flex items-center justify-center"
          >
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-accent/20 flex items-center justify-center">
                <Upload className="w-10 h-10 text-accent" />
              </div>
              <p className="text-xl font-display font-bold text-white">Drop receipts here</p>
              <p className="text-silver mt-1">Images or PDFs</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upload Area */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={open}
        className="mb-6 p-6 border-2 border-dashed border-slate/50 rounded-2xl cursor-pointer hover:border-accent/50 transition-colors text-center"
      >
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-accent/10 flex items-center justify-center">
          <Camera className="w-6 h-6 text-accent" />
        </div>
        <p className="text-white font-medium mb-1">Tap to upload receipt</p>
        <p className="text-silver text-sm">or drag and drop images here</p>
      </motion.div>

      {/* Receipt List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="spinner" />
        </div>
      ) : receipts && receipts.length > 0 ? (
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
          }}
          className="space-y-3"
        >
          {receipts.map((receipt) => {
            const status = statusConfig[receipt.status as keyof typeof statusConfig];
            const StatusIcon = status.icon;

            return (
              <motion.div
                key={receipt.id}
                variants={{
                  hidden: { opacity: 0, y: 10 },
                  visible: { opacity: 1, y: 0 },
                }}
                className="card-hover"
              >
                <div className="flex items-start gap-4">
                  {/* Amount */}
                  <div className="flex-shrink-0 w-20 text-center">
                    <p className="text-2xl font-display font-bold text-white">
                      {getCurrencySymbol(receipt.currency)}
                      {receipt.amount}
                    </p>
                    <p className="text-xs text-silver font-mono">{receipt.date}</p>
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={status.color}>
                        <StatusIcon
                          className={clsx(
                            'w-3 h-3 mr-1 inline',
                            receipt.status === 'processing' && 'animate-spin'
                          )}
                        />
                        {status.label}
                      </span>
                      {receipt.category && (
                        <span className="badge-neutral">{receipt.category}</span>
                      )}
                    </div>

                    <p className="text-white font-medium truncate">{receipt.description}</p>

                    <p className="text-xs text-silver mt-1 truncate font-mono">
                      {receipt.generatedFilename}
                    </p>

                    {receipt.error && (
                      <p className="text-xs text-error mt-1">{receipt.error}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex-shrink-0 flex items-center gap-1">
                    {receipt.driveUrl && (
                      <a
                        href={receipt.driveUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-silver hover:text-cyan hover:bg-cyan/10 rounded-lg transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                    <button
                      onClick={() => handleDelete(receipt.id)}
                      className="p-2 text-silver hover:text-error hover:bg-error/10 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {receipt.createdAt && (
                  <p className="text-xs text-silver mt-3 pt-3 border-t border-slate/20">
                    Uploaded {format(new Date(receipt.createdAt), 'MMM d, yyyy · h:mm a')}
                  </p>
                )}
              </motion.div>
            );
          })}
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-16"
        >
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate/30 flex items-center justify-center">
            <Receipt className="w-8 h-8 text-silver" />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">No receipts yet</h3>
          <p className="text-silver text-sm">
            Take a photo of a receipt to automatically extract and organize it
          </p>
        </motion.div>
      )}
    </div>
  );
}
