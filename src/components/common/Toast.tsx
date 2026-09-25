import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X, ExternalLink } from 'lucide-react';
import { ToastMessage } from '../../types';

interface ToastProps {
  toasts: ToastMessage[];
  onClose: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onClose }) => {
  // Lọc bỏ triệt để các thông báo liên quan đến máy chủ xác thực trong dApp Web3
  const filteredToasts = toasts.filter(
    (t) =>
      !t.message.includes('máy chủ xác thực') &&
      !t.message.includes('Không thể kết nối máy chủ xác thực') &&
      !t.message.includes('Backend offline')
  );

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2.5 max-w-sm w-full px-4 pointer-events-none">
      {filteredToasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={onClose} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ toast: ToastMessage; onClose: (id: string) => void }> = ({
  toast,
  onClose,
}) => {
  useEffect(() => {
    // Cho phép hiển thị lâu hơn một chút nếu có action link
    const duration = toast.actionUrl ? 8000 : 4500;
    const timer = setTimeout(() => {
      onClose(toast.id);
    }, duration);
    return () => clearTimeout(timer);
  }, [toast.id, toast.actionUrl, onClose]);

  const config = {
    success: {
      icon: CheckCircle2,
      border: 'border-solana-green/40',
      bg: 'bg-[#0E1A1A]/95',
      iconColor: 'text-solana-green',
      glow: 'shadow-neon-green/20',
    },
    error: {
      icon: AlertCircle,
      border: 'border-neon-pink/40',
      bg: 'bg-[#1A0C16]/95',
      iconColor: 'text-neon-pink',
      glow: 'shadow-neon-pink/20',
    },
    info: {
      icon: Info,
      border: 'border-solana-purple/40',
      bg: 'bg-[#140C2E]/95',
      iconColor: 'text-solana-cyan',
      glow: 'shadow-neon-purple/20',
    },
  }[toast.type];

  const Icon = config.icon;

  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border ${config.border} ${config.bg} backdrop-blur-xl shadow-xl ${config.glow} animate-fadeIn transition-all`}
    >
      <Icon className={`w-5 h-5 ${config.iconColor} shrink-0 mt-0.5`} />
      <div className="flex-1 min-w-0">
        <p className="text-xs sm:text-sm text-slate-100 font-medium break-words leading-relaxed">
          {toast.message}
        </p>
        {toast.actionUrl && (
          <a
            href={toast.actionUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-solana-cyan/15 hover:bg-solana-cyan/25 border border-solana-cyan/40 px-2.5 py-1 text-xs font-bold text-solana-cyan transition-colors"
          >
            <span>{toast.actionLabel || 'Xem trên Solana Explorer'}</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
      <button
        onClick={() => onClose(toast.id)}
        className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
