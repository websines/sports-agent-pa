'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, Send, Loader2, FileText, Receipt, Users, Mail } from 'lucide-react';
import { useUIStore } from '@/lib/stores';

interface CommandResult {
  type: 'success' | 'error' | 'info';
  title: string;
  message: string;
  action?: {
    label: string;
    href: string;
  };
}

export function CommandBar() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CommandResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { addNotification } = useUIStore();

  // Keyboard shortcut to open (Cmd/Ctrl + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
        setResult(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch('/api/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input }),
      });

      const data = await res.json();

      if (res.ok) {
        setResult({
          type: 'success',
          title: data.title || 'Done',
          message: data.message,
          action: data.action,
        });
        addNotification('success', data.message);
      } else {
        setResult({
          type: 'error',
          title: 'Error',
          message: data.error || 'Something went wrong',
        });
      }
    } catch (error) {
      setResult({
        type: 'error',
        title: 'Error',
        message: 'Failed to process command',
      });
    } finally {
      setLoading(false);
      setInput('');
    }
  };

  const suggestions = [
    { icon: FileText, text: 'Create invoice for [client] $[amount]', example: 'Create invoice for ABC Corp $5000 consulting' },
    { icon: Receipt, text: 'Add expense $[amount] [description]', example: 'Add expense $45 lunch meeting' },
    { icon: Users, text: 'Show athletes / Show invoices', example: 'Show all setters' },
    { icon: Mail, text: 'Send blast to [country/league]', example: 'Send blast to German clubs' },
  ];

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-4 z-40 w-14 h-14 bg-gradient-to-br from-primary-500 to-accent rounded-full shadow-lg flex items-center justify-center text-white hover:scale-105 transition-transform"
      >
        <Sparkles className="w-6 h-6" />
      </button>

      {/* Command Modal */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsOpen(false);
                setResult(null);
              }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-x-4 top-20 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-lg z-50"
            >
              <div className="bg-[#111] border border-[#333] rounded-2xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#333]">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary-500" />
                    <span className="font-medium text-white">AI Assistant</span>
                  </div>
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      setResult(null);
                    }}
                    className="p-1 hover:bg-[#222] rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-[#888]" />
                  </button>
                </div>

                {/* Input */}
                <form onSubmit={handleSubmit} className="p-4">
                  <div className="flex items-center gap-3 bg-[#1a1a1a] border border-[#333] rounded-xl px-4 py-3">
                    <input
                      ref={inputRef}
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Type a command or ask anything..."
                      className="flex-1 bg-transparent text-white placeholder-[#666] outline-none"
                      disabled={loading}
                    />
                    <button
                      type="submit"
                      disabled={loading || !input.trim()}
                      className="p-2 bg-primary-500 hover:bg-primary-600 disabled:bg-[#333] disabled:text-[#666] rounded-lg transition-colors"
                    >
                      {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </form>

                {/* Result */}
                {result && (
                  <div className={`mx-4 mb-4 p-4 rounded-xl ${
                    result.type === 'success' ? 'bg-green-500/10 border border-green-500/20' :
                    result.type === 'error' ? 'bg-red-500/10 border border-red-500/20' :
                    'bg-blue-500/10 border border-blue-500/20'
                  }`}>
                    <h4 className={`font-medium mb-1 ${
                      result.type === 'success' ? 'text-green-400' :
                      result.type === 'error' ? 'text-red-400' :
                      'text-blue-400'
                    }`}>
                      {result.title}
                    </h4>
                    <p className="text-sm text-[#ccc]">{result.message}</p>
                    {result.action && (
                      <a
                        href={result.action.href}
                        className="inline-block mt-2 text-sm text-primary-500 hover:underline"
                        onClick={() => setIsOpen(false)}
                      >
                        {result.action.label} →
                      </a>
                    )}
                  </div>
                )}

                {/* Suggestions */}
                {!result && (
                  <div className="px-4 pb-4">
                    <p className="text-xs text-[#666] mb-3">Try saying:</p>
                    <div className="space-y-2">
                      {suggestions.map((suggestion, i) => (
                        <button
                          key={i}
                          onClick={() => setInput(suggestion.example)}
                          className="w-full flex items-center gap-3 p-3 bg-[#1a1a1a] hover:bg-[#222] rounded-xl text-left transition-colors group"
                        >
                          <suggestion.icon className="w-4 h-4 text-[#666] group-hover:text-primary-500" />
                          <span className="text-sm text-[#888] group-hover:text-white">
                            {suggestion.text}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Footer */}
                <div className="px-4 py-3 border-t border-[#333] bg-[#0a0a0a]">
                  <p className="text-xs text-[#666] text-center">
                    Press <kbd className="px-1.5 py-0.5 bg-[#222] rounded text-[#888]">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 bg-[#222] rounded text-[#888]">K</kbd> to open
                  </p>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
