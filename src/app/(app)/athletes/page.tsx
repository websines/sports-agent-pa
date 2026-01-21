'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Send,
  Users,
  Filter,
  CheckSquare,
  Square,
  Star,
  ExternalLink,
  Upload,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { AthleteForm } from '@/components/athletes/AthleteForm';
import { BlastForm } from '@/components/athletes/BlastForm';
import { ContactsModal } from '@/components/athletes/ContactsModal';
import { useAthletes, useContacts } from '@/lib/query/hooks';
import { useAthleteStore, useContactStore, useUIStore } from '@/lib/stores';
import { clsx } from 'clsx';

const positions = ['Setter', 'Outside Hitter', 'Opposite', 'Middle Blocker', 'Libero'];

export default function AthletesPage() {
  const [showAthleteForm, setShowAthleteForm] = useState(false);
  const [showBlastForm, setShowBlastForm] = useState(false);
  const [showContacts, setShowContacts] = useState(false);
  const [activeTab, setActiveTab] = useState<'roster' | 'contacts'>('roster');

  const { data: athletes, isLoading: athletesLoading } = useAthletes();
  const { data: contacts, isLoading: contactsLoading } = useContacts();

  const {
    selectedIds: selectedAthleteIds,
    filterPosition,
    setFilterPosition,
    toggleSelected: toggleAthlete,
    selectAll: selectAllAthletes,
    clearSelection: clearAthleteSelection,
  } = useAthleteStore();

  const {
    selectedIds: selectedContactIds,
    toggleSelected: toggleContact,
    selectAll: selectAllContacts,
    clearSelection: clearContactSelection,
  } = useContactStore();

  const { addNotification } = useUIStore();

  // Sync athletes to store
  useMemo(() => {
    if (athletes) {
      useAthleteStore.getState().setAthletes(athletes);
    }
  }, [athletes]);

  // Sync contacts to store
  useMemo(() => {
    if (contacts) {
      useContactStore.getState().setContacts(contacts);
    }
  }, [contacts]);

  const filteredAthletes = useMemo(() => {
    if (!athletes) return [];
    if (!filterPosition) return athletes;
    return athletes.filter((a) => a.position === filterPosition);
  }, [athletes, filterPosition]);

  const groupedAthletes = useMemo(() => {
    const groups: Record<string, typeof filteredAthletes> = {};
    filteredAthletes.forEach((athlete) => {
      if (!groups[athlete.position]) {
        groups[athlete.position] = [];
      }
      groups[athlete.position].push(athlete);
    });
    return groups;
  }, [filteredAthletes]);

  const canBlast = selectedAthleteIds.length > 0 && selectedContactIds.length > 0;

  return (
    <>
      <PageHeader
        title="Athletes"
        subtitle={athletes ? `${athletes.length} players` : 'Loading...'}
        action={
          <div className="flex gap-2">
            <button
              onClick={() => setShowContacts(true)}
              className="btn-secondary"
            >
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Contacts</span>
            </button>
            <button onClick={() => setShowAthleteForm(true)} className="btn-primary">
              <Plus className="w-4 h-4" />
            </button>
          </div>
        }
      />

      {/* Tabs */}
      <div className="tabs mb-4">
        <button
          onClick={() => setActiveTab('roster')}
          className={activeTab === 'roster' ? 'tab-active' : 'tab'}
        >
          Roster ({athletes?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('contacts')}
          className={activeTab === 'contacts' ? 'tab-active' : 'tab'}
        >
          Contacts ({contacts?.length || 0})
        </button>
      </div>

      {activeTab === 'roster' && (
        <>
          {/* Position Filter */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-4 px-4">
            <button
              onClick={() => setFilterPosition(null)}
              className={clsx(
                'flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                !filterPosition
                  ? 'bg-accent text-white'
                  : 'bg-slate/30 text-silver hover:text-white'
              )}
            >
              All
            </button>
            {positions.map((pos) => (
              <button
                key={pos}
                onClick={() => setFilterPosition(pos)}
                className={clsx(
                  'flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap',
                  filterPosition === pos
                    ? 'bg-accent text-white'
                    : 'bg-slate/30 text-silver hover:text-white'
                )}
              >
                {pos}
              </button>
            ))}
          </div>

          {/* Selection Bar */}
          {(selectedAthleteIds.length > 0 || selectedContactIds.length > 0) && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="card mb-4 flex items-center justify-between"
            >
              <div className="text-sm">
                <span className="text-accent font-medium">{selectedAthleteIds.length}</span>
                <span className="text-silver"> athletes, </span>
                <span className="text-cyan font-medium">{selectedContactIds.length}</span>
                <span className="text-silver"> contacts</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    clearAthleteSelection();
                    clearContactSelection();
                  }}
                  className="btn-ghost text-xs"
                >
                  Clear
                </button>
                <button
                  onClick={() => setShowBlastForm(true)}
                  disabled={!canBlast}
                  className="btn-primary text-xs"
                >
                  <Send className="w-3 h-3" />
                  Blast
                </button>
              </div>
            </motion.div>
          )}

          {/* Athlete List */}
          {athletesLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="spinner" />
            </div>
          ) : filteredAthletes.length > 0 ? (
            <div className="space-y-6">
              {Object.entries(groupedAthletes).map(([position, athletes]) => (
                <div key={position}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-silver uppercase tracking-wider">
                      {position}
                    </h3>
                    <button
                      onClick={() => {
                        const posAthletes = athletes.map((a) => a.id);
                        const allSelected = posAthletes.every((id) =>
                          selectedAthleteIds.includes(id)
                        );
                        if (allSelected) {
                          posAthletes.forEach((id) => {
                            if (selectedAthleteIds.includes(id)) toggleAthlete(id);
                          });
                        } else {
                          posAthletes.forEach((id) => {
                            if (!selectedAthleteIds.includes(id)) toggleAthlete(id);
                          });
                        }
                      }}
                      className="text-xs text-silver hover:text-accent transition-colors"
                    >
                      Select all
                    </button>
                  </div>

                  <div className="space-y-2">
                    {athletes.map((athlete) => {
                      const isSelected = selectedAthleteIds.includes(athlete.id);

                      return (
                        <motion.div
                          key={athlete.id}
                          layout
                          className={clsx(
                            'card-hover cursor-pointer',
                            isSelected && 'border-accent/50 bg-accent/5'
                          )}
                          onClick={() => toggleAthlete(athlete.id)}
                        >
                          <div className="flex items-start gap-3">
                            <div className="pt-1">
                              {isSelected ? (
                                <CheckSquare className="w-5 h-5 text-accent" />
                              ) : (
                                <Square className="w-5 h-5 text-slate" />
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium text-white">{athlete.name}</h4>
                                {athlete.featured && (
                                  <Star className="w-4 h-4 text-warning fill-warning" />
                                )}
                              </div>
                              <p className="text-sm text-silver">
                                {athlete.height && `${athlete.height} · `}
                                {athlete.nationality}
                                {athlete.birthYear && ` · ${athlete.birthYear}`}
                              </p>

                              {/* Links */}
                              <div className="flex gap-3 mt-2">
                                {athlete.profileUrl && (
                                  <a
                                    href={athlete.profileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-xs text-cyan hover:text-cyan-light flex items-center gap-1"
                                  >
                                    Profile <ExternalLink className="w-3 h-3" />
                                  </a>
                                )}
                                {athlete.highlightUrls && athlete.highlightUrls.length > 0 && (
                                  <a
                                    href={athlete.highlightUrls[0]}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-xs text-accent hover:text-accent-light flex items-center gap-1"
                                  >
                                    Highlights <ExternalLink className="w-3 h-3" />
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate/30 flex items-center justify-center">
                <Users className="w-8 h-8 text-silver" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">No athletes yet</h3>
              <p className="text-silver text-sm mb-6">Add your first athlete to get started</p>
              <button onClick={() => setShowAthleteForm(true)} className="btn-primary">
                <Plus className="w-4 h-4" />
                Add Athlete
              </button>
            </div>
          )}
        </>
      )}

      {activeTab === 'contacts' && (
        <>
          {/* Selection controls */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={selectAllContacts}
              className="btn-ghost text-sm"
            >
              <CheckSquare className="w-4 h-4" />
              Select All
            </button>
            <button
              onClick={() => setShowContacts(true)}
              className="btn-secondary text-sm"
            >
              <Upload className="w-4 h-4" />
              Import CSV
            </button>
          </div>

          {contactsLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="spinner" />
            </div>
          ) : contacts && contacts.length > 0 ? (
            <div className="space-y-2">
              {contacts.map((contact) => {
                const isSelected = selectedContactIds.includes(contact.id);

                return (
                  <motion.div
                    key={contact.id}
                    layout
                    className={clsx(
                      'card-hover cursor-pointer',
                      isSelected && 'border-cyan/50 bg-cyan/5'
                    )}
                    onClick={() => toggleContact(contact.id)}
                  >
                    <div className="flex items-center gap-3">
                      {isSelected ? (
                        <CheckSquare className="w-5 h-5 text-cyan" />
                      ) : (
                        <Square className="w-5 h-5 text-slate" />
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-white">{contact.name}</h4>
                        <p className="text-sm text-silver truncate">
                          {contact.club && `${contact.club} · `}
                          {contact.country}
                          {contact.league && ` · ${contact.league}`}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-20">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate/30 flex items-center justify-center">
                <Users className="w-8 h-8 text-silver" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">No contacts yet</h3>
              <p className="text-silver text-sm mb-6">Import contacts via CSV to get started</p>
              <button onClick={() => setShowContacts(true)} className="btn-primary">
                <Upload className="w-4 h-4" />
                Import Contacts
              </button>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      <AnimatePresence>
        {showAthleteForm && <AthleteForm onClose={() => setShowAthleteForm(false)} />}
        {showBlastForm && <BlastForm onClose={() => setShowBlastForm(false)} />}
        {showContacts && <ContactsModal onClose={() => setShowContacts(false)} />}
      </AnimatePresence>
    </>
  );
}
