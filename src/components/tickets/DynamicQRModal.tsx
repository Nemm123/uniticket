import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, ShieldCheck, RefreshCw, Clock, Sparkles } from 'lucide-react';
import { PurchasedTicket } from '../../types';
import { useTranslation } from '../../i18n';

interface DynamicQRModalProps {
  ticket: PurchasedTicket | null;
  isOpen: boolean;
  onClose: () => void;
  onNavigateToVerify?: (ticketId: string) => void;
}

export const REFRESH_INTERVAL_SECONDS = 20;

/**
 * Sinh mã băm bảo mật động từ ticketId, owner và timestamp
 */
export function generateDynamicQRHash(ticketId: string, owner: string, timestamp: number): string {
  const seed = `${ticketId}|${owner}|${timestamp}|UNITICKET_SECURE_ANTI_FRAUD_SALT_2026`;
  let h1 = 0x811c9dc5;
  let h2 = 0x27d4eb2f;
  for (let i = 0; i < seed.length; i++) {
    const code = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 16777619);
    h2 = Math.imul(h2 ^ code, 2246822507);
  }
  const hex1 = ((h1 ^ (h1 >>> 16)) >>> 0).toString(16).padStart(8, '0');
  const hex2 = ((h2 ^ (h2 >>> 13)) >>> 0).toString(16).padStart(8, '0');
  return `0x${hex1}${hex2}`;
}

/**
 * Tạo payload JSON chuẩn cho mã QR động chống chụp màn hình gian lận
 */
export function generateDynamicQRPayload(ticket: PurchasedTicket, timestamp: number): string {
  const owner = ticket.customerWallet || 'attendee';
  const hash = generateDynamicQRHash(ticket.id, owner, timestamp);
  return JSON.stringify({
    ticketId: ticket.id,
    ticketCode: ticket.ticketCode || ticket.id,
    owner,
    timestamp,
    hash,
  });
}

export const DynamicQRModal: React.FC<DynamicQRModalProps> = ({
  ticket,
  isOpen,
  onClose,
  onNavigateToVerify,
}) => {
  const { t } = useTranslation();
  const [timestamp, setTimestamp] = useState<number>(() => Date.now());
  const [secondsLeft, setSecondsLeft] = useState<number>(REFRESH_INTERVAL_SECONDS);
  const [progressPercent, setProgressPercent] = useState<number>(100);
  const [isRotating, setIsRotating] = useState<boolean>(false);

  const refreshQRCode = useCallback(() => {
    const now = Date.now();
    setTimestamp(now);
    setSecondsLeft(REFRESH_INTERVAL_SECONDS);
    setProgressPercent(100);
    setIsRotating(true);
    setTimeout(() => setIsRotating(false), 500);
  }, []);

  useEffect(() => {
    if (!isOpen || !ticket) return;

    let cycleStart = Date.now();
    setTimestamp(cycleStart);
    setSecondsLeft(REFRESH_INTERVAL_SECONDS);
    setProgressPercent(100);

    const intervalId = setInterval(() => {
      const now = Date.now();
      const elapsedMs = now - cycleStart;
      const elapsedSec = elapsedMs / 1000;
      const remainingSec = Math.max(0, REFRESH_INTERVAL_SECONDS - elapsedSec);

      setSecondsLeft(Math.ceil(remainingSec));
      setProgressPercent(Math.max(0, (remainingSec / REFRESH_INTERVAL_SECONDS) * 100));

      if (elapsedSec >= REFRESH_INTERVAL_SECONDS) {
        cycleStart = Date.now();
        setTimestamp(cycleStart);
        setSecondsLeft(REFRESH_INTERVAL_SECONDS);
        setProgressPercent(100);
        setIsRotating(true);
        setTimeout(() => setIsRotating(false), 500);
      }
    }, 100);

    return () => clearInterval(intervalId);
  }, [isOpen, ticket]);

  const qrPayload = useMemo(() => {
    if (!ticket) return '';
    return generateDynamicQRPayload(ticket, timestamp);
  }, [ticket, timestamp]);

  if (!isOpen || !ticket) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-3 sm:p-4 backdrop-blur-md animate-fadeIn overflow-y-auto">
      {/* Backdrop click to close */}
      <button
        aria-label={t('common.close')}
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />

      <div className="relative w-full max-w-sm rounded-2xl border border-solana-purple/50 bg-[#0F0A28] p-4 sm:p-6 text-center shadow-2xl z-10 space-y-3.5 sm:space-y-4 max-h-[90vh] overflow-y-auto my-auto">
        {/* Nút đóng */}
        <button
          aria-label={t('common.close')}
          onClick={onClose}
          className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header thông tin vé */}
        <div className="text-left pr-8">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-solana-green/40 bg-solana-green/15 text-[11px] font-semibold text-solana-green mb-1.5">
            <Sparkles className="w-3 h-3" />
            <span>Mã QR Động Chống Vé Giả</span>
          </div>
          <h2 className="text-base sm:text-lg font-bold text-white truncate">{ticket.eventTitle}</h2>
          <p className="text-xs text-solana-cyan">
            {ticket.tierName} {ticket.seat ? `· ${ticket.seat}` : ''} · <span className="font-mono">{ticket.ticketCode}</span>
          </p>
        </div>

        {/* Khung hiển thị mã QR động */}
        <div className="relative mx-auto inline-flex max-w-full rounded-2xl bg-white p-3.5 shadow-2xl border-2 border-solana-purple/30 group">
          <QRCodeSVG value={qrPayload} size={230} level="M" />
        </div>

        {/* Thanh đếm ngược trực quan (Progress Bar) */}
        <div className="space-y-1.5 text-left">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-solana-cyan" />
              <span>{t('qrModal.refreshIn', { seconds: secondsLeft })}</span>
            </span>
            <button
              onClick={refreshQRCode}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-300 hover:text-white transition-colors"
              title="Làm mới mã QR ngay lập tức"
            >
              <RefreshCw className={`w-3 h-3 ${isRotating ? 'animate-spin' : ''}`} />
              <span>{t('qrModal.refreshNow')}</span>
            </button>
          </div>

          {/* Progress bar line */}
          <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full transition-all duration-100 ease-linear rounded-full ${
                secondsLeft <= 5
                  ? 'bg-gradient-to-r from-amber-500 to-rose-500'
                  : 'bg-gradient-to-r from-solana-green via-solana-cyan to-solana-purple'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Dòng chữ cảnh báo chống gian lận / chụp màn hình theo yêu cầu */}
        <div className="rounded-xl bg-solana-purple/15 border border-solana-purple/30 p-2.5 text-center">
          <p className="text-xs font-medium text-purple-200 leading-snug">
            {t('qrModal.dynamicNotice')}
          </p>
        </div>

        <p className="text-[11px] text-slate-400">
          {t('qrModal.showToStaff')}
        </p>

        {/* Link tra cứu công khai */}
        {onNavigateToVerify && (
          <div className="pt-2 border-t border-white/10 flex flex-col items-center">
            <button
              onClick={() => {
                const targetId = ticket.id;
                onClose();
                onNavigateToVerify(targetId);
              }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-solana-cyan hover:underline transition-colors"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-solana-green" />
              <span>{t('myTickets.viewPublicVerification')}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
