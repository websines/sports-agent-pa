'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { X, Upload, FileSpreadsheet, Plus, Trash2 } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import Papa from 'papaparse';
import { useCreateContact, useImportContacts, useDeleteContact } from '@/lib/query/hooks';
import { useContactStore, useUIStore } from '@/lib/stores';

interface ContactsModalProps {
  onClose: () => void;
}

export function ContactsModal({ onClose }: ContactsModalProps) {
  const { contacts } = useContactStore();
  const { addNotification } = useUIStore();

  const createContact = useCreateContact();
  const importContacts = useImportContacts();
  const deleteContact = useDeleteContact();

  const [activeTab, setActiveTab] = useState<'import' | 'add'>('import');
  const [parsedContacts, setParsedContacts] = useState<
    Array<{
      name: string;
      email: string;
      club?: string;
      country?: string;
      league?: string;
    }>
  >([]);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    club: '',
    country: '',
    league: '',
    role: '',
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data as Record<string, string>[];
        const contacts = data
          .map((row) => ({
            name: row.name || row.Name || '',
            email: row.email || row.Email || '',
            club: row.club || row.Club || '',
            country: row.country || row.Country || '',
            league: row.league || row.League || '',
          }))
          .filter((c) => c.name && c.email);

        setParsedContacts(contacts);
        if (contacts.length === 0) {
          addNotification('error', 'No valid contacts found in CSV');
        }
      },
      error: () => {
        addNotification('error', 'Failed to parse CSV');
      },
    });
  }, [addNotification]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.csv'],
    },
    maxFiles: 1,
  });

  const handleImport = async () => {
    try {
      const result = await importContacts.mutateAsync(parsedContacts);
      addNotification('success', `Imported ${result.imported} contacts`);
      setParsedContacts([]);
      onClose();
    } catch {
      addNotification('error', 'Failed to import contacts');
    }
  };

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createContact.mutateAsync(formData);
      addNotification('success', 'Contact added');
      setFormData({ name: '', email: '', club: '', country: '', league: '', role: '' });
    } catch {
      addNotification('error', 'Failed to add contact');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteContact.mutateAsync(id);
      addNotification('success', 'Contact deleted');
    } catch {
      addNotification('error', 'Failed to delete contact');
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
          <h2 className="text-lg font-display font-bold text-white">Contacts</h2>
          <button
            onClick={onClose}
            className="p-2 text-silver hover:text-white hover:bg-slate/30 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="tabs mx-5 mt-4">
          <button
            onClick={() => setActiveTab('import')}
            className={activeTab === 'import' ? 'tab-active' : 'tab'}
          >
            <Upload className="w-4 h-4 mr-1" />
            Import CSV
          </button>
          <button
            onClick={() => setActiveTab('add')}
            className={activeTab === 'add' ? 'tab-active' : 'tab'}
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Manually
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === 'import' && (
            <div className="space-y-4">
              {/* Dropzone */}
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  isDragActive
                    ? 'border-accent bg-accent/10'
                    : 'border-slate/50 hover:border-slate'
                }`}
              >
                <input {...getInputProps()} />
                <FileSpreadsheet className="w-12 h-12 text-silver mx-auto mb-4" />
                <p className="text-white font-medium mb-1">
                  {isDragActive ? 'Drop the file here' : 'Drop a CSV file here'}
                </p>
                <p className="text-silver text-sm">or click to browse</p>
                <p className="text-xs text-silver mt-4">
                  Expected columns: name, email, club, country, league
                </p>
              </div>

              {/* Parsed Preview */}
              {parsedContacts.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-silver">
                      Preview ({parsedContacts.length} contacts)
                    </h3>
                    <button
                      onClick={handleImport}
                      disabled={importContacts.isPending}
                      className="btn-primary text-sm"
                    >
                      {importContacts.isPending && (
                        <div className="spinner border-white/30 border-t-white" />
                      )}
                      Import All
                    </button>
                  </div>

                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {parsedContacts.slice(0, 10).map((contact, i) => (
                      <div key={i} className="bg-graphite rounded-lg p-3">
                        <p className="text-white text-sm font-medium">{contact.name}</p>
                        <p className="text-silver text-xs">{contact.email}</p>
                        <p className="text-silver text-xs">
                          {contact.club && `${contact.club} · `}
                          {contact.country}
                          {contact.league && ` · ${contact.league}`}
                        </p>
                      </div>
                    ))}
                    {parsedContacts.length > 10 && (
                      <p className="text-silver text-xs text-center py-2">
                        +{parsedContacts.length - 10} more contacts
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Existing Contacts */}
              {contacts.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-silver mb-3">
                    Existing Contacts ({contacts.length})
                  </h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {contacts.map((contact) => (
                      <div
                        key={contact.id}
                        className="bg-graphite rounded-lg p-3 flex items-center justify-between"
                      >
                        <div>
                          <p className="text-white text-sm font-medium">{contact.name}</p>
                          <p className="text-silver text-xs">{contact.email}</p>
                        </div>
                        <button
                          onClick={() => handleDelete(contact.id)}
                          className="p-2 text-error hover:bg-error/10 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'add' && (
            <form onSubmit={handleAddContact} className="space-y-4">
              <div>
                <label className="input-label">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  className="input"
                  placeholder="John Smith"
                  required
                />
              </div>

              <div>
                <label className="input-label">Email *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                  className="input"
                  placeholder="john@club.com"
                  required
                />
              </div>

              <div>
                <label className="input-label">Club</label>
                <input
                  type="text"
                  value={formData.club}
                  onChange={(e) => setFormData((prev) => ({ ...prev, club: e.target.value }))}
                  className="input"
                  placeholder="AC Milan"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Country</label>
                  <input
                    type="text"
                    value={formData.country}
                    onChange={(e) => setFormData((prev) => ({ ...prev, country: e.target.value }))}
                    className="input"
                    placeholder="Italy"
                  />
                </div>
                <div>
                  <label className="input-label">League</label>
                  <input
                    type="text"
                    value={formData.league}
                    onChange={(e) => setFormData((prev) => ({ ...prev, league: e.target.value }))}
                    className="input"
                    placeholder="Serie A"
                  />
                </div>
              </div>

              <div>
                <label className="input-label">Role</label>
                <input
                  type="text"
                  value={formData.role}
                  onChange={(e) => setFormData((prev) => ({ ...prev, role: e.target.value }))}
                  className="input"
                  placeholder="Sporting Director"
                />
              </div>

              <button
                type="submit"
                disabled={createContact.isPending}
                className="btn-primary w-full mt-6"
              >
                {createContact.isPending && (
                  <div className="spinner border-white/30 border-t-white" />
                )}
                Add Contact
              </button>
            </form>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
