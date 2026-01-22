'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Trash2 } from 'lucide-react';
import { useCreateCompany, useUpdateCompany, useCompanies } from '@/lib/query/hooks';
import { useUIStore } from '@/lib/stores';
import { clsx } from 'clsx';

interface CompanyFormProps {
  companyId?: string | null;
  onClose: () => void;
}

export function CompanyForm({ companyId, onClose }: CompanyFormProps) {
  const { data: companies } = useCompanies();
  const createCompany = useCreateCompany();
  const updateCompany = useUpdateCompany();
  const { addNotification } = useUIStore();

  const existingCompany = companies?.find((c) => c.id === companyId);

  const [formData, setFormData] = useState({
    name: '',
    address: '',
    city: '',
    country: '',
    postalCode: '',
    vatNumber: '',
    email: '',
    phone: '',
    region: 'US' as 'US' | 'EU',
    currency: 'USD',
  });

  useEffect(() => {
    if (existingCompany) {
      setFormData({
        name: existingCompany.name,
        address: existingCompany.address,
        city: existingCompany.city,
        country: existingCompany.country,
        postalCode: existingCompany.postalCode || '',
        vatNumber: existingCompany.vatNumber || '',
        email: existingCompany.email,
        phone: existingCompany.phone || '',
        region: existingCompany.region as 'US' | 'EU',
        currency: existingCompany.currency,
      });
    }
  }, [existingCompany]);

  const handleRegionChange = (region: 'US' | 'EU') => {
    setFormData((prev) => ({
      ...prev,
      region,
      currency: region === 'US' ? 'USD' : 'EUR',
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (companyId && existingCompany) {
        await updateCompany.mutateAsync({ id: companyId, ...formData });
        addNotification('success', 'Company updated');
      } else {
        await createCompany.mutateAsync(formData);
        addNotification('success', 'Company added');
      }
      onClose();
    } catch {
      addNotification('error', 'Failed to save company');
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
        className="fixed inset-x-0 bottom-0 top-12 bg-carbon rounded-t-3xl border-t border-slate/30 grid grid-rows-[auto_1fr_auto]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate/30">
          <h2 className="text-lg font-display font-bold text-white">
            {companyId ? 'Edit Company' : 'Add Company'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-silver hover:text-white hover:bg-slate/30 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form - scrollable content */}
        <form id="company-form" onSubmit={handleSubmit} className="overflow-y-auto p-5 space-y-4">
            {/* Region Selection */}
            <div>
              <label className="input-label">Region</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleRegionChange('US')}
                  className={clsx(
                    'p-4 rounded-xl border text-left transition-all',
                    formData.region === 'US'
                      ? 'border-accent bg-accent/10'
                      : 'border-slate/30 bg-graphite hover:border-slate'
                  )}
                >
                  <p className="font-medium text-white">United States</p>
                  <p className="text-xs text-silver">USD currency</p>
                </button>
                <button
                  type="button"
                  onClick={() => handleRegionChange('EU')}
                  className={clsx(
                    'p-4 rounded-xl border text-left transition-all',
                    formData.region === 'EU'
                      ? 'border-accent bg-accent/10'
                      : 'border-slate/30 bg-graphite hover:border-slate'
                  )}
                >
                  <p className="font-medium text-white">Europe</p>
                  <p className="text-xs text-silver">EUR currency</p>
                </button>
              </div>
            </div>

            <div>
              <label className="input-label">Company Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                className="input"
                placeholder="Apex 8 Sports LLC"
                required
              />
            </div>

            <div>
              <label className="input-label">Street Address *</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
                className="input"
                placeholder="123 Main Street, Suite 100"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="input-label">City *</label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData((prev) => ({ ...prev, city: e.target.value }))}
                  className="input"
                  placeholder="New York"
                  required
                />
              </div>
              <div>
                <label className="input-label">Postal Code</label>
                <input
                  type="text"
                  value={formData.postalCode}
                  onChange={(e) => setFormData((prev) => ({ ...prev, postalCode: e.target.value }))}
                  className="input"
                  placeholder="10001"
                />
              </div>
            </div>

            <div>
              <label className="input-label">Country *</label>
              <input
                type="text"
                value={formData.country}
                onChange={(e) => setFormData((prev) => ({ ...prev, country: e.target.value }))}
                className="input"
                placeholder="United States"
                required
              />
            </div>

            {formData.region === 'EU' && (
              <div>
                <label className="input-label">VAT Number</label>
                <input
                  type="text"
                  value={formData.vatNumber}
                  onChange={(e) => setFormData((prev) => ({ ...prev, vatNumber: e.target.value }))}
                  className="input"
                  placeholder="EU123456789"
                />
              </div>
            )}

            <div>
              <label className="input-label">Email *</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                className="input"
                placeholder="billing@company.com"
                required
              />
            </div>

          <div>
            <label className="input-label">Phone</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
              className="input"
              placeholder="+1 (555) 123-4567"
            />
          </div>
        </form>

        {/* Footer - always visible */}
        <div className="p-5 bg-carbon border-t border-slate/30 safe-bottom">
          <button
            type="submit"
            form="company-form"
            disabled={createCompany.isPending || updateCompany.isPending}
            className="btn-primary w-full"
          >
            {(createCompany.isPending || updateCompany.isPending) && (
              <div className="spinner border-white/30 border-t-white" />
            )}
            {companyId ? 'Update Company' : 'Add Company'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
