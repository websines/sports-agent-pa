'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Send, Calendar, Users, Clock } from 'lucide-react';
import { useCreateBlast, useSendBlast } from '@/lib/query/hooks';
import { useAthleteStore, useContactStore, useUIStore } from '@/lib/stores';
import { clsx } from 'clsx';

interface BlastFormProps {
  onClose: () => void;
}

export function BlastForm({ onClose }: BlastFormProps) {
  const { athletes, selectedIds: selectedAthleteIds } = useAthleteStore();
  const { contacts, selectedIds: selectedContactIds } = useContactStore();
  const { addNotification } = useUIStore();

  const createBlast = useCreateBlast();
  const sendBlast = useSendBlast();

  const [formData, setFormData] = useState({
    subject: 'Athletes Available - Apex 8 Sports',
    message: '',
    scheduledDate: '',
  });

  const [sendOption, setSendOption] = useState<'now' | 'schedule'>('now');

  const selectedAthletes = athletes.filter((a) => selectedAthleteIds.includes(a.id));
  const selectedContacts = contacts.filter((c) => selectedContactIds.includes(c.id));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const blast = await createBlast.mutateAsync({
        subject: formData.subject,
        message: formData.message || undefined,
        athleteIds: selectedAthleteIds,
        contactIds: selectedContactIds,
        scheduledDate: sendOption === 'schedule' ? formData.scheduledDate : undefined,
      });

      if (sendOption === 'now') {
        await sendBlast.mutateAsync(blast.id);
        addNotification('success', `Blast sent to ${selectedContacts.length} contacts`);
      } else {
        addNotification('success', 'Blast scheduled');
      }

      onClose();
    } catch {
      addNotification('error', 'Failed to send blast');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] bg-void/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="absolute inset-x-0 bottom-0 top-12 bg-carbon rounded-t-3xl border-t border-slate/30 flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate/30">
          <h2 className="text-lg font-display font-bold text-white">Send Blast</h2>
          <button
            onClick={onClose}
            className="p-2 text-silver hover:text-white hover:bg-slate/30 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form - scrollable content */}
        <form id="blast-form" onSubmit={handleSubmit} className="flex-1 min-h-0 overflow-y-auto p-5 space-y-6">
            {/* Summary */}
            <div className="grid grid-cols-2 gap-4">
              <div className="card">
                <div className="flex items-center gap-2 text-accent mb-2">
                  <Users className="w-4 h-4" />
                  <span className="text-sm font-medium">Athletes</span>
                </div>
                <p className="text-2xl font-display font-bold text-white">
                  {selectedAthletes.length}
                </p>
                <p className="text-xs text-silver mt-1 truncate">
                  {selectedAthletes
                    .slice(0, 3)
                    .map((a) => a.name.split(' ')[0])
                    .join(', ')}
                  {selectedAthletes.length > 3 && '...'}
                </p>
              </div>

              <div className="card">
                <div className="flex items-center gap-2 text-cyan mb-2">
                  <Send className="w-4 h-4" />
                  <span className="text-sm font-medium">Recipients</span>
                </div>
                <p className="text-2xl font-display font-bold text-white">
                  {selectedContacts.length}
                </p>
                <p className="text-xs text-silver mt-1 truncate">
                  {selectedContacts
                    .slice(0, 3)
                    .map((c) => c.club || c.name.split(' ')[0])
                    .join(', ')}
                  {selectedContacts.length > 3 && '...'}
                </p>
              </div>
            </div>

            {/* Email Details */}
            <div>
              <label className="input-label">Subject</label>
              <input
                type="text"
                value={formData.subject}
                onChange={(e) => setFormData((prev) => ({ ...prev, subject: e.target.value }))}
                className="input"
                required
              />
            </div>

            <div>
              <label className="input-label">Custom Message (optional)</label>
              <textarea
                value={formData.message}
                onChange={(e) => setFormData((prev) => ({ ...prev, message: e.target.value }))}
                className="input resize-none"
                rows={3}
                placeholder="Hi, here are some athletes that might interest you..."
              />
            </div>

            {/* Preview */}
            <div>
              <label className="input-label">Athletes in Email</label>
              <div className="bg-graphite rounded-xl p-4 max-h-48 overflow-y-auto">
                {Object.entries(
                  selectedAthletes.reduce((acc, a) => {
                    if (!acc[a.position]) acc[a.position] = [];
                    acc[a.position].push(a);
                    return acc;
                  }, {} as Record<string, typeof selectedAthletes>)
                ).map(([position, athletes]) => (
                  <div key={position} className="mb-3 last:mb-0">
                    <p className="text-xs font-medium text-silver uppercase mb-1">{position}</p>
                    {athletes.map((a) => (
                      <p key={a.id} className="text-sm text-white">
                        {a.name}
                        <span className="text-silver">
                          {a.height && ` · ${a.height}`}
                          {` · ${a.nationality}`}
                        </span>
                      </p>
                    ))}
                  </div>
                ))}
              </div>
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
                  <Send className="w-4 h-4 text-accent mb-1" />
                  <p className="font-medium text-white text-sm">Send Now</p>
                  <p className="text-xs text-silver">Deliver immediately</p>
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
                  <p className="text-xs text-silver">Pick a date</p>
                </button>
              </div>

              {sendOption === 'schedule' && (
                <div>
                  <label className="input-label">Send Date</label>
                  <input
                    type="date"
                    value={formData.scheduledDate}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, scheduledDate: e.target.value }))
                    }
                    className="input"
                    required={sendOption === 'schedule'}
                  />
                </div>
              )}
            </div>
        </form>

        {/* Footer - always visible */}
        <div className="shrink-0 p-5 bg-carbon border-t border-slate/30 safe-bottom">
          <button
            type="submit"
            form="blast-form"
            disabled={createBlast.isPending || sendBlast.isPending}
            className="btn-primary w-full"
          >
            {(createBlast.isPending || sendBlast.isPending) && (
              <div className="spinner border-white/30 border-t-white" />
            )}
            {sendOption === 'now' ? (
              <>
                <Send className="w-4 h-4" />
                Send to {selectedContacts.length} Contacts
              </>
            ) : (
              <>
                <Clock className="w-4 h-4" />
                Schedule Blast
              </>
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
