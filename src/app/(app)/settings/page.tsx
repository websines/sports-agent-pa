'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Building2,
  Link2,
  Bell,
  Plus,
  Trash2,
  CheckCircle,
  ExternalLink,
  MessageCircle,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { CompanyForm } from '@/components/settings/CompanyForm';
import { useCompanies, useUpdateCompany } from '@/lib/query/hooks';
import { useSettingsStore, useUIStore } from '@/lib/stores';
import { clsx } from 'clsx';

export default function SettingsPage() {
  const { data: companies, isLoading } = useCompanies();
  const { googleConnected, telegramConnected, notificationEmail, setNotificationEmail } =
    useSettingsStore();
  const { addNotification } = useUIStore();

  const [showCompanyForm, setShowCompanyForm] = useState(false);
  const [editingCompany, setEditingCompany] = useState<string | null>(null);
  const [emailInput, setEmailInput] = useState(notificationEmail);

  useEffect(() => {
    setEmailInput(notificationEmail);
  }, [notificationEmail]);

  const handleConnectGoogle = async () => {
    // Redirect to Google OAuth
    window.location.href = '/api/auth/google';
  };

  const handleConnectTelegram = () => {
    // Open Telegram bot link
    const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'SportsAgentPABot';
    window.open(`https://t.me/${botUsername}`, '_blank');
    addNotification('info', 'Start a chat with the bot, then send /start');
  };

  const handleSaveEmail = () => {
    setNotificationEmail(emailInput);
    addNotification('success', 'Notification email saved');
  };

  return (
    <>
      <PageHeader title="Settings" subtitle="Configure your account" />

      <div className="space-y-6">
        {/* Companies Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-display font-semibold text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-accent" />
              Companies
            </h2>
            <button onClick={() => setShowCompanyForm(true)} className="btn-secondary text-sm">
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="spinner" />
            </div>
          ) : companies && companies.length > 0 ? (
            <div className="space-y-3">
              {companies.map((company) => (
                <motion.div
                  key={company.id}
                  layout
                  className="card-hover cursor-pointer"
                  onClick={() => setEditingCompany(company.id)}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="badge-accent">{company.region}</span>
                        <span className="text-xs text-silver font-mono">{company.currency}</span>
                      </div>
                      <h3 className="font-medium text-white">{company.name}</h3>
                      <p className="text-sm text-silver">{company.address}</p>
                      <p className="text-sm text-silver">
                        {company.city}, {company.country}
                      </p>
                      {company.vatNumber && (
                        <p className="text-xs text-silver mt-1">VAT: {company.vatNumber}</p>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="card text-center py-8">
              <Building2 className="w-10 h-10 text-silver mx-auto mb-3" />
              <p className="text-silver mb-4">No companies configured</p>
              <button onClick={() => setShowCompanyForm(true)} className="btn-primary text-sm">
                <Plus className="w-4 h-4" />
                Add Your First Company
              </button>
            </div>
          )}
        </section>

        {/* Connections Section */}
        <section>
          <h2 className="text-lg font-display font-semibold text-white flex items-center gap-2 mb-4">
            <Link2 className="w-5 h-5 text-accent" />
            Connections
          </h2>

          <div className="space-y-3">
            {/* Google Drive */}
            <div className="card flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={clsx(
                    'w-10 h-10 rounded-xl flex items-center justify-center',
                    googleConnected ? 'bg-success/10' : 'bg-slate/30'
                  )}
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5">
                    <path
                      fill={googleConnected ? '#22c55e' : '#71717a'}
                      d="M12.545 10.239v3.821h5.445c-.712 2.315-2.647 3.972-5.445 3.972a6.033 6.033 0 1 1 0-12.064c1.498 0 2.866.549 3.921 1.453l2.814-2.814A9.969 9.969 0 0 0 12.545 2C7.021 2 2.543 6.477 2.543 12s4.478 10 10.002 10c8.396 0 10.249-7.85 9.426-11.748l-9.426-.013z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-white">Google Drive</p>
                  <p className="text-xs text-silver">
                    {googleConnected ? 'Connected' : 'For receipt storage'}
                  </p>
                </div>
              </div>

              {googleConnected ? (
                <div className="flex items-center gap-2 text-success">
                  <CheckCircle className="w-5 h-5" />
                  <span className="text-sm">Connected</span>
                </div>
              ) : (
                <button onClick={handleConnectGoogle} className="btn-secondary text-sm">
                  Connect
                </button>
              )}
            </div>

            {/* Telegram */}
            <div className="card flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={clsx(
                    'w-10 h-10 rounded-xl flex items-center justify-center',
                    telegramConnected ? 'bg-success/10' : 'bg-slate/30'
                  )}
                >
                  <MessageCircle
                    className={clsx('w-5 h-5', telegramConnected ? 'text-success' : 'text-silver')}
                  />
                </div>
                <div>
                  <p className="font-medium text-white">Telegram Bot</p>
                  <p className="text-xs text-silver">
                    {telegramConnected ? 'Connected' : 'For notifications & quick actions'}
                  </p>
                </div>
              </div>

              {telegramConnected ? (
                <div className="flex items-center gap-2 text-success">
                  <CheckCircle className="w-5 h-5" />
                  <span className="text-sm">Connected</span>
                </div>
              ) : (
                <button onClick={handleConnectTelegram} className="btn-secondary text-sm">
                  <ExternalLink className="w-4 h-4" />
                  Connect
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Notifications Section */}
        <section>
          <h2 className="text-lg font-display font-semibold text-white flex items-center gap-2 mb-4">
            <Bell className="w-5 h-5 text-accent" />
            Notifications
          </h2>

          <div className="card space-y-4">
            <div>
              <label className="input-label">Notification Email</label>
              <p className="text-xs text-silver mb-2">
                Get notified when invoices are sent, receipts processed, etc.
              </p>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="input flex-1"
                  placeholder="you@example.com"
                />
                <button
                  onClick={handleSaveEmail}
                  disabled={emailInput === notificationEmail}
                  className="btn-primary"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Version */}
        <p className="text-center text-xs text-silver py-4">
          Sports Agent PA v1.0.0 · Built with Next.js
        </p>
      </div>

      {/* Company Form Modal */}
      {(showCompanyForm || editingCompany) && (
        <CompanyForm
          companyId={editingCompany}
          onClose={() => {
            setShowCompanyForm(false);
            setEditingCompany(null);
          }}
        />
      )}
    </>
  );
}
