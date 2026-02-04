'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { X, Upload, FileText, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { useQueryClient } from '@tanstack/react-query';
import { useUIStore } from '@/lib/stores';

interface AthleteImportModalProps {
  onClose: () => void;
}

interface ImportResult {
  imported: number;
  athletes: Array<{ name: string; position: string; nationality: string }>;
}

export function AthleteImportModal({ onClose }: AthleteImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { addNotification } = useUIStore();
  const queryClient = useQueryClient();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const selected = acceptedFiles[0];
    if (selected) {
      setFile(selected);
      setError(null);
      setResult(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
    },
    maxFiles: 1,
  });

  const handleImport = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/athletes/import', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Import failed');
      }

      setResult(data);
      queryClient.invalidateQueries({ queryKey: ['athletes'] });
      addNotification('success', `Imported ${data.imported} athletes`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Import failed';
      setError(message);
      addNotification('error', message);
    } finally {
      setLoading(false);
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
        className="fixed inset-x-0 bottom-20 top-12 bg-carbon rounded-3xl border border-slate/30 grid grid-rows-[auto_1fr_auto] mx-2"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate/30">
          <h2 className="text-lg font-display font-bold text-white">Import Athletes</h2>
          <button
            onClick={onClose}
            className="p-2 text-silver hover:text-white hover:bg-slate/30 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-5 space-y-4">
          {!result ? (
            <>
              {/* Info */}
              <div className="bg-graphite rounded-xl p-4 text-sm text-silver">
                <p className="font-medium text-white mb-2">Supported formats:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Word Document (.docx)</li>
                  <li>Text File (.txt)</li>
                </ul>
                <p className="mt-3">
                  The file should contain player information including name, position, nationality.
                  Height and birth year are optional.
                </p>
              </div>

              {/* Dropzone */}
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
                  isDragActive
                    ? 'border-accent bg-accent/10'
                    : file
                    ? 'border-success bg-success/10'
                    : 'border-slate/50 hover:border-accent/50'
                }`}
              >
                <input {...getInputProps()} />
                {file ? (
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="w-12 h-12 text-success" />
                    <p className="text-white font-medium">{file.name}</p>
                    <p className="text-sm text-silver">Click or drag to change file</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="w-12 h-12 text-silver" />
                    <p className="text-white font-medium">
                      {isDragActive ? 'Drop file here' : 'Drop a file or click to browse'}
                    </p>
                    <p className="text-sm text-silver">.docx or .txt files</p>
                  </div>
                )}
              </div>

              {/* Error */}
              {error && (
                <div className="bg-error/10 border border-error/30 rounded-xl p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-error flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-error">{error}</p>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Success */}
              <div className="bg-success/10 border border-success/30 rounded-xl p-4 text-center">
                <CheckCircle className="w-12 h-12 text-success mx-auto mb-3" />
                <p className="text-lg font-medium text-white">
                  Imported {result.imported} athletes!
                </p>
              </div>

              {/* Imported list */}
              <div className="bg-graphite rounded-xl p-4">
                <p className="text-sm text-silver mb-3">Imported players:</p>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {result.athletes.map((athlete, i) => (
                    <div key={i} className="text-sm">
                      <span className="text-white">{athlete.name}</span>
                      <span className="text-silver">
                        {' '}
                        - {athlete.position}, {athlete.nationality}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 bg-carbon border-t border-slate/30 rounded-b-3xl">
          {!result ? (
            <button
              onClick={handleImport}
              disabled={!file || loading}
              className="btn-primary w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Import Athletes
                </>
              )}
            </button>
          ) : (
            <button onClick={onClose} className="btn-primary w-full">
              Done
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
