'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Plus, Trash2 } from 'lucide-react';
import { useCreateAthlete } from '@/lib/query/hooks';
import { useUIStore } from '@/lib/stores';

interface AthleteFormProps {
  onClose: () => void;
}

const positions = ['Setter', 'Outside Hitter', 'Opposite', 'Middle Blocker', 'Libero'];

export function AthleteForm({ onClose }: AthleteFormProps) {
  const createAthlete = useCreateAthlete();
  const { addNotification } = useUIStore();

  const [formData, setFormData] = useState({
    name: '',
    position: 'Outside Hitter',
    height: '',
    nationality: '',
    birthYear: '',
    notes: '',
    profileUrl: '',
    statsUrl: '',
    featured: false,
  });

  const [highlightUrls, setHighlightUrls] = useState<string[]>(['']);

  const addHighlightUrl = () => {
    setHighlightUrls((prev) => [...prev, '']);
  };

  const updateHighlightUrl = (index: number, value: string) => {
    setHighlightUrls((prev) => {
      const updated = [...prev];
      updated[index] = value;
      return updated;
    });
  };

  const removeHighlightUrl = (index: number) => {
    if (highlightUrls.length > 1) {
      setHighlightUrls((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await createAthlete.mutateAsync({
        ...formData,
        birthYear: formData.birthYear ? parseInt(formData.birthYear) : undefined,
        highlightUrls: highlightUrls.filter((url) => url.trim()),
      });
      addNotification('success', 'Athlete added');
      onClose();
    } catch {
      addNotification('error', 'Failed to add athlete');
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
          <h2 className="text-lg font-display font-bold text-white">Add Athlete</h2>
          <button
            onClick={onClose}
            className="p-2 text-silver hover:text-white hover:bg-slate/30 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-5 space-y-4">
            <div>
              <label className="input-label">Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                className="input"
                placeholder="Cameron Keen"
                required
              />
            </div>

            <div>
              <label className="input-label">Position *</label>
              <select
                value={formData.position}
                onChange={(e) => setFormData((prev) => ({ ...prev, position: e.target.value }))}
                className="select"
                required
              >
                {positions.map((pos) => (
                  <option key={pos} value={pos}>
                    {pos}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="input-label">Height</label>
                <input
                  type="text"
                  value={formData.height}
                  onChange={(e) => setFormData((prev) => ({ ...prev, height: e.target.value }))}
                  className="input"
                  placeholder="185cm"
                />
              </div>
              <div>
                <label className="input-label">Birth Year</label>
                <input
                  type="number"
                  value={formData.birthYear}
                  onChange={(e) => setFormData((prev) => ({ ...prev, birthYear: e.target.value }))}
                  className="input"
                  placeholder="1997"
                  min="1970"
                  max="2010"
                />
              </div>
            </div>

            <div>
              <label className="input-label">Nationality *</label>
              <input
                type="text"
                value={formData.nationality}
                onChange={(e) => setFormData((prev) => ({ ...prev, nationality: e.target.value }))}
                className="input"
                placeholder="Hungary"
                required
              />
            </div>

            <div>
              <label className="input-label">Profile URL (Volleybox)</label>
              <input
                type="url"
                value={formData.profileUrl}
                onChange={(e) => setFormData((prev) => ({ ...prev, profileUrl: e.target.value }))}
                className="input"
                placeholder="https://volleybox.net/..."
              />
            </div>

            <div>
              <label className="input-label">Stats/Video URL (Google Drive)</label>
              <input
                type="url"
                value={formData.statsUrl}
                onChange={(e) => setFormData((prev) => ({ ...prev, statsUrl: e.target.value }))}
                className="input"
                placeholder="https://drive.google.com/..."
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="input-label mb-0">Highlight URLs</label>
                <button type="button" onClick={addHighlightUrl} className="btn-ghost text-xs">
                  <Plus className="w-3 h-3" />
                  Add
                </button>
              </div>
              <div className="space-y-2">
                {highlightUrls.map((url, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="url"
                      value={url}
                      onChange={(e) => updateHighlightUrl(index, e.target.value)}
                      className="input flex-1"
                      placeholder="https://youtu.be/..."
                    />
                    {highlightUrls.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeHighlightUrl(index)}
                        className="p-2 text-error hover:bg-error/10 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="input-label">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                className="input resize-none"
                rows={2}
                placeholder="Left-handed, speaks Japanese..."
              />
            </div>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.featured}
                onChange={(e) => setFormData((prev) => ({ ...prev, featured: e.target.checked }))}
                className="checkbox"
              />
              <span className="text-sm text-white">Featured athlete (priority)</span>
            </label>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 p-5 bg-carbon border-t border-slate/30 safe-bottom">
            <button
              type="submit"
              disabled={createAthlete.isPending}
              className="btn-primary w-full"
            >
              {createAthlete.isPending && (
                <div className="spinner border-white/30 border-t-white" />
              )}
              Add Athlete
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
