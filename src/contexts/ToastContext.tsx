import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

type ToastTone = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastContextType {
  toast: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<ToastItem[]>([]);

  const toast = useCallback((message: string, tone: ToastTone = 'success') => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { id, tone, message }]);
    setTimeout(() => {
      setItems((prev) => prev.filter((item) => item.id !== id));
    }, 4200);
  }, []);

  const dismiss = (id: number) => setItems((prev) => prev.filter((item) => item.id !== id));

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none no-print">
        {items.map((item) => {
          const Icon = item.tone === 'success' ? CheckCircle2 : item.tone === 'error' ? AlertCircle : Info;
          const color =
            item.tone === 'success'
              ? 'text-[#059669]'
              : item.tone === 'error'
              ? 'text-[#DC2626]'
              : 'text-[#0D9488]';
          return (
            <div
              key={item.id}
              className="pointer-events-auto flex items-start gap-3 bg-white border border-[#DCE4EF] rounded-xl px-4 py-3 shadow-lg text-sm text-[#0F172A]"
            >
              <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${color}`} />
              <p className="flex-1 leading-snug">{item.message}</p>
              <button
                onClick={() => dismiss(item.id)}
                className="text-[#64748B] hover:text-[#0F172A] transition-colors"
                aria-label="Dismiss notification"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
