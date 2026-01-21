'use client';

import { ReactNode } from 'react';
import { BottomNav } from './BottomNav';
import { Toasts } from '@/components/ui/Toast';

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-void">
      {/* Background gradient */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-radial from-accent/5 via-transparent to-transparent opacity-50" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-gradient-radial from-cyan/5 via-transparent to-transparent opacity-30" />
      </div>

      {/* Main content */}
      <main className="relative z-10 px-4 pt-6 pb-24 max-w-2xl mx-auto">
        {children}
      </main>

      {/* Navigation */}
      <BottomNav />

      {/* Notifications */}
      <Toasts />
    </div>
  );
}
