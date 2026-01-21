'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { useUIStore } from '@/lib/stores';
import { clsx } from 'clsx';

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
};

const colors = {
  success: 'bg-success/10 border-success/30 text-success',
  error: 'bg-error/10 border-error/30 text-error',
  info: 'bg-cyan/10 border-cyan/30 text-cyan',
};

export function Toasts() {
  const { notifications, removeNotification } = useUIStore();

  return (
    <div className="fixed top-4 right-4 left-4 z-[100] flex flex-col gap-2 pointer-events-none md:left-auto md:w-96">
      <AnimatePresence mode="popLayout">
        {notifications.map((notification) => {
          const Icon = icons[notification.type];

          return (
            <motion.div
              key={notification.id}
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className={clsx(
                'flex items-start gap-3 p-4 rounded-xl border backdrop-blur-lg pointer-events-auto',
                colors[notification.type]
              )}
            >
              <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p className="flex-1 text-sm text-white">{notification.message}</p>
              <button
                onClick={() => removeNotification(notification.id)}
                className="text-silver hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
