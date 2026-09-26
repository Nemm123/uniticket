import React, { useState } from 'react';
import { PublicKey } from '@solana/web3.js';
import {
  X,
  Send,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  MapPin,
  Ticket,
  Loader2,
  ArrowRight
} from 'lucide-react';
import { PurchasedTicket } from '../../types';
import { transferTicket } from '../../services/api';
import { useTranslation } from '../../i18n';

interface TransferTicketModalProps {
  isOpen: boolean;
  ticket: PurchasedTicket | null;
  currentWallet?: string | null;
  onClose: () => void;
  onSuccess: (transferredTicket: PurchasedTicket) => void;
}

export function isValidSolanaAddress(address: string): boolean {
  if (!address || typeof address !== 'string') return false;
  const trimmed = address.trim();
  if (trimmed.length < 32 || trimmed.length > 44) return false;
  try {
    const pubkey = new PublicKey(trimmed);
    return PublicKey.isOnCurve(pubkey.toBuffer());
  } catch {
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmed);
  }
}

export const TransferTicketModal: React.FC<TransferTicketModalProps> = ({
  isOpen,
  ticket,
  currentWallet,
  onClose,
  onSuccess,
}) => {
  const { t, formatDate } = useTranslation();
  const [receiverAddress, setReceiverAddress] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen || !ticket) return null;

  const trimmedAddress = receiverAddress.trim();
  const isSelfTransfer = Boolean(
    currentWallet &&
    trimmedAddress &&
    trimmedAddress.toLowerCase() === currentWallet.trim().toLowerCase()
  );
  const isValidAddress = isValidSolanaAddress(trimmedAddress);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!trimmedAddress) {
      setErrorMessage(t('transferModal.invalidAddress'));
      return;
    }

    if (isSelfTransfer) {
      setErrorMessage(t('transferModal.cannotTransferToSelf'));
      return;
    }

    if (!isValidAddress) {
      setErrorMessage(t('transferModal.invalidAddress'));
      return;
    }

    try {
      setIsSubmitting(true);
      const result = await transferTicket(ticket.id, trimmedAddress);
      if (result.ok && result.ticket) {
        onSuccess(result.ticket);
        onClose();
      } else {
        setErrorMessage(result.message || 'Chuyển nhượng vé thất bại.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Đã xảy ra lỗi trong quá trình chuyển nhượng.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl border border-solana-purple/50 bg-[#120B30] p-6 sm:p-7 shadow-2xl shadow-purple-950/60 overflow-hidden text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow ambient decoration */}
        <div className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full bg-solana-purple/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-solana-cyan/15 blur-3xl" />

        {/* Modal Header */}
        <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-solana-purple/25 border border-solana-purple/40 text-solana-cyan shadow-md">
              <Send className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                <span>{t('transferModal.title')}</span>
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                {t('transferModal.subtitle')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg p-1 text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Ticket Summary Card */}
        <div className="my-5 rounded-xl border border-white/10 bg-[#180E3D]/80 p-4 space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-solana-cyan">
                <Ticket className="w-3.5 h-3.5" />
                <span>{ticket.tierName}</span>
              </div>
              <h3 className="font-bold text-white text-sm sm:text-base truncate mt-0.5">
                {ticket.eventTitle}
              </h3>
            </div>
            <span className="shrink-0 rounded-lg bg-black/60 border border-white/15 px-2.5 py-1 font-mono text-[11px] text-solana-green">
              {ticket.ticketCode}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-white/10 text-xs text-slate-300">
            <div className="flex items-center gap-1.5 truncate">
              <Calendar className="w-3.5 h-3.5 text-solana-purple shrink-0" />
              <span>{formatDate(ticket.date)} {ticket.time ? `• ${ticket.time}` : ''}</span>
            </div>
            <div className="flex items-center gap-1.5 truncate">
              <MapPin className="w-3.5 h-3.5 text-neon-pink shrink-0" />
              <span>{ticket.venue}</span>
            </div>
          </div>
        </div>

        {/* Transfer Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-200 mb-1.5 flex items-center justify-between">
              <span>{t('transferModal.receiverWalletLabel')}</span>
              {trimmedAddress && (
                isValidAddress && !isSelfTransfer ? (
                  <span className="inline-flex items-center gap-1 text-[11px] text-solana-green font-normal">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Hợp lệ</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] text-neon-pink font-normal">
                    <AlertTriangle className="w-3 h-3" />
                    <span>{isSelfTransfer ? 'Trùng ví hiện tại' : 'Chưa đúng định dạng'}</span>
                  </span>
                )
              )}
            </label>

            <div className="relative">
              <input
                type="text"
                value={receiverAddress}
                onChange={(e) => {
                  setReceiverAddress(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                disabled={isSubmitting}
                placeholder={t('transferModal.receiverWalletPlaceholder')}
                className={`w-full rounded-xl bg-[#0B0620] border px-4 py-3 text-xs sm:text-sm font-mono text-white placeholder:text-slate-500 focus:outline-none transition-colors ${
                  trimmedAddress
                    ? isValidAddress && !isSelfTransfer
                      ? 'border-solana-green/60 focus:border-solana-green'
                      : 'border-neon-pink/60 focus:border-neon-pink'
                    : 'border-white/15 focus:border-solana-purple'
                }`}
                autoFocus
              />
            </div>
          </div>

          {/* Warning Banner */}
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 flex items-start gap-3 text-xs">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-bold text-amber-200">{t('transferModal.warningTitle')}</p>
              <p className="text-amber-300/90 leading-relaxed">
                {t('transferModal.warningNotice')}
              </p>
            </div>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
            >
              {t('transferModal.cancel')}
            </button>

            <button
              type="submit"
              disabled={isSubmitting || !trimmedAddress || !isValidAddress || isSelfTransfer}
              className="rounded-xl bg-gradient-to-r from-solana-purple to-neon-pink px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-purple-900/50 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t('transferModal.transferring')}</span>
                </>
              ) : (
                <>
                  <span>{t('transferModal.confirmTransfer')}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
