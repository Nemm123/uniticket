import React, { useState, useEffect, useCallback } from 'react';
import { testSupabaseConnection } from '../../services/supabase';
import { RefreshCw } from 'lucide-react';

interface DatabaseStatusBadgeProps {
  className?: string;
  onStatusChange?: (isOnline: boolean) => void;
}

export const DatabaseStatusBadge: React.FC<DatabaseStatusBadgeProps> = ({
  className = '',
  onStatusChange,
}) => {
  const [isOnline, setIsOnline] = useState<boolean>(false);
  const [latencyMs, setLatencyMs] = useState<number | undefined>(undefined);
  const [statusMessage, setStatusMessage] = useState<string>('Đang kiểm tra kết nối...');
  const [isPinging, setIsPinging] = useState<boolean>(false);

  const checkConnection = useCallback(async () => {
    setIsPinging(true);
    try {
      const result = await testSupabaseConnection();
      setIsOnline(result.success);
      setLatencyMs(result.latencyMs);
      setStatusMessage(result.message);
      if (onStatusChange) {
        onStatusChange(result.success);
      }
    } catch {
      setIsOnline(false);
      setStatusMessage('Không thể kết nối đến Cloud Database');
      if (onStatusChange) {
        onStatusChange(false);
      }
    } finally {
      setIsPinging(false);
    }
  }, [onStatusChange]);

  useEffect(() => {
    void checkConnection();
  }, [checkConnection]);

  const tooltipText = isOnline
    ? `Supabase Connected${latencyMs ? ` · ${latencyMs}ms ping` : ''} (Click để kiểm tra lại)`
    : `${statusMessage} (Click để kiểm tra lại)`;

  return (
    <button
      type="button"
      onClick={() => void checkConnection()}
      disabled={isPinging}
      title={tooltipText}
      aria-label={tooltipText}
      className={`group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium transition-all active:scale-95 cursor-pointer select-none shadow-sm ${
        isOnline
          ? 'border-solana-green/40 bg-solana-green/10 text-solana-green hover:bg-solana-green/20'
          : 'border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
      } ${className}`}
    >
      {/* Indicator Dot hoặc Spinner */}
      {isPinging ? (
        <RefreshCw className="w-2.5 h-2.5 animate-spin text-solana-cyan" />
      ) : isOnline ? (
        <span className="w-2 h-2 rounded-full bg-solana-green animate-pulse shrink-0" />
      ) : (
        <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
      )}

      {/* Label Text */}
      <span className="font-semibold tracking-tight whitespace-nowrap">
        {isPinging
          ? 'Pinging...'
          : isOnline
            ? 'Cloud Database: Online'
            : 'Local Mode: Fallback'}
      </span>

      {/* Latency badge nếu online */}
      {isOnline && latencyMs !== undefined && !isPinging && (
        <span className="hidden lg:inline text-[9px] font-mono text-solana-cyan/80 bg-black/30 px-1 py-0.2 rounded border border-solana-cyan/20">
          {latencyMs}ms
        </span>
      )}
    </button>
  );
};
