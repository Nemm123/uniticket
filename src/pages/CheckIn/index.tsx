import React, { useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, Keyboard, Loader2, RefreshCw, ScanLine, ShieldAlert, Ticket, XCircle } from 'lucide-react';
import QrScanner from 'qr-scanner';
import { CheckInResult, PurchasedTicket, UserRole } from '../../types';
import { checkInTicketApi, listTicketsApi, verifyTicketApi } from '../../services/ticketsApi';
import { useTranslation } from '../../i18n';

interface CheckInPageProps {
  currentRole: UserRole | null;
  organizerAddress: string | null;
  onShowToast: (type: 'success' | 'error' | 'info', message: string) => void;
  onTicketsChanged: () => void;
}

type TicketFilter = 'all' | 'checked-in' | 'unused';
const ticketIsCheckedIn = (ticket: PurchasedTicket) => ticket.isCheckedIn || ticket.status === 'checked_in' || ticket.status === 'CHECKED_IN';

export const CheckInPage: React.FC<CheckInPageProps> = ({ currentRole, organizerAddress, onShowToast, onTicketsChanged }) => {
  const { t, formatDate } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const processingRef = useRef(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualPayload, setManualPayload] = useState('');
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [tickets, setTickets] = useState<PurchasedTicket[]>([]);
  const [filter, setFilter] = useState<TicketFilter>('all');
  const [search, setSearch] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshTickets = async () => {
    setIsRefreshing(true);
    try {
      const remoteTickets = await listTicketsApi();
      setTickets(remoteTickets);
      return;
    } catch (err) {
      console.warn('[UniTicket CheckIn] Could not fetch remote tickets:', err);
    } finally {
      setIsRefreshing(false);
    }
    setTickets([]);
  };

  useEffect(() => {
    void refreshTickets();
  }, []);

  const validateInput = async (input: string) => {
    if (processingRef.current || currentRole !== 'organizer') return;
    processingRef.current = true;
    setIsValidating(true);
    setCameraEnabled(false);
    scannerRef.current?.stop();

    try {
      const backendValidation = await verifyTicketApi(input);

      if (backendValidation.status !== 'error') {
        setResult(backendValidation);
        onShowToast(
          backendValidation.status === 'valid' ? 'info' : backendValidation.status === 'used' ? 'info' : 'error',
          backendValidation.message
        );
      } else {
        setResult(backendValidation);
        onShowToast('error', backendValidation.message);
        return;
      }
    } finally {
      setIsValidating(false);
      processingRef.current = false;
    }
  };

  useEffect(() => {
    if (!cameraEnabled || !videoRef.current) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera không được hỗ trợ trên trình duyệt này. Vui lòng dán mã QR hoặc mã vé bên dưới.');
      setCameraEnabled(false);
      return;
    }
    const scanner = new QrScanner(videoRef.current, (scanResult) => void validateInput(scanResult.data), {
      preferredCamera: 'environment', maxScansPerSecond: 5, highlightScanRegion: true, highlightCodeOutline: true,
    });
    scannerRef.current = scanner;
    setCameraError(null);
    void scanner.start().catch(() => {
      setCameraError('Quyền truy cập camera bị từ chối hoặc camera đang bận. Vui lòng dán mã QR bên dưới.');
      setCameraEnabled(false);
    });
    return () => { void scanner.destroy(); scannerRef.current = null; };
  }, [cameraEnabled]);

  const confirmCheckIn = async () => {
    if (!result?.ticket || currentRole !== 'organizer') {
      onShowToast('error', 'Chỉ vai trò Ban Tổ Chức mới có thể xác nhận check-in.');
      return;
    }
    setIsConfirming(true);
    try {
      const code = result.ticket.ticketCode || result.ticket.id;
      const backendConfirmation = await checkInTicketApi(code);

      if (backendConfirmation.status !== 'error') {
        setResult(backendConfirmation);
        await refreshTickets();
        onTicketsChanged();
        onShowToast(backendConfirmation.status === 'valid' ? 'success' : 'error', backendConfirmation.message);
      } else {
        setResult(backendConfirmation);
        onShowToast('error', backendConfirmation.message);
        return;
      }
    } finally {
      setIsConfirming(false);
    }
  };

  if (currentRole !== 'organizer') {
    return (
      <div className="min-h-screen py-10 cyber-grid-bg">
        <div className="mx-auto max-w-xl rounded-2xl border border-neon-pink/40 bg-[#120B30] p-8 text-center shadow-2xl">
          <ShieldAlert className="mx-auto h-10 w-10 text-neon-pink" />
          <h1 className="mt-3 text-2xl font-extrabold text-white">{t('accessDenied.title')}</h1>
          <p className="mt-2 text-sm text-slate-300">{t('accessDenied.subtitle')}</p>
        </div>
      </div>
    );
  }

  const query = search.trim().toLowerCase();
  const visibleTickets = tickets.filter((ticket) => {
    const matchesFilter = filter === 'all' || (filter === 'checked-in' ? ticketIsCheckedIn(ticket) : !ticketIsCheckedIn(ticket));
    return matchesFilter && (!query || ticket.ticketCode.toLowerCase().includes(query) || ticket.id.toLowerCase().includes(query) || ticket.customerName.toLowerCase().includes(query));
  });

  const resultStyle = result?.status === 'valid'
    ? 'border-solana-green/50 bg-solana-green/10 text-solana-green'
    : result?.status === 'used'
      ? 'border-yellow-400/50 bg-yellow-400/10 text-yellow-100'
      : result?.status === 'error'
        ? 'border-purple-500/50 bg-purple-950/30 text-purple-200'
        : 'border-neon-pink/50 bg-neon-pink/10 text-neon-pink';

  return (
    <div className="min-h-screen py-8 sm:py-12 cyber-grid-bg text-left">
      <div className="mx-auto max-w-5xl space-y-6 px-4 sm:px-6 lg:px-8 animate-fadeIn">
        <header className="border-b border-white/10 pb-6">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-solana-cyan/30 bg-solana-cyan/10 px-3 py-1 text-xs font-semibold text-solana-cyan">
            <ScanLine className="h-4 w-4" />
            {t('checkIn.consoleBadge')}
          </div>
          <h1 className="text-2xl font-extrabold text-white sm:text-4xl">
            {t('checkIn.title')} <span className="text-gradient-solana">{t('checkIn.titleGradient')}</span>
          </h1>
          <p className="mt-2 text-xs leading-relaxed text-slate-300 sm:text-sm">
            {t('checkIn.subtitle')}
          </p>
          <p className="mt-3 text-xs text-solana-cyan">
            Organizer: {organizerAddress ? `${organizerAddress.slice(0, 4)}...${organizerAddress.slice(-4)}` : 'Staff Gate Operator'}
          </p>
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-2xl border border-solana-purple/30 bg-[#120B30] p-4 shadow-2xl sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Camera className="h-5 w-5 text-solana-cyan" />
                <h2 className="font-bold text-white">{t('checkIn.cameraTitle')}</h2>
              </div>
              {cameraEnabled && (
                <button
                  type="button"
                  onClick={() => setCameraEnabled(false)}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-white/10 px-3 text-xs text-slate-300 hover:bg-white/5"
                >
                  <XCircle className="h-4 w-4" />
                  {t('checkIn.cameraStop')}
                </button>
              )}
            </div>

            <div className="relative aspect-video overflow-hidden rounded-xl border border-white/10 bg-black/50">
              <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
              {!cameraEnabled && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center">
                  <ScanLine className="h-10 w-10 text-solana-purple" />
                  <p className="text-xs text-slate-400">{t('checkIn.cameraHint')}</p>
                  <button
                    type="button"
                    onClick={() => { setResult(null); setCameraEnabled(true); }}
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-solana-purple to-neon-pink px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-purple-950/50 active:scale-95"
                  >
                    <Camera className="h-4 w-4" />
                    {t('checkIn.cameraStart')}
                  </button>
                </div>
              )}
            </div>

            {cameraError && (
              <p className="mt-3 rounded-xl border border-yellow-400/30 bg-yellow-950/30 p-3 text-xs text-yellow-100">
                {cameraError}
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-solana-purple/30 bg-[#120B30] p-4 shadow-2xl sm:p-6">
            <div className="mb-4 flex items-center gap-2">
              <Keyboard className="h-5 w-5 text-solana-cyan" />
              <h2 className="font-bold text-white">{t('checkIn.manualTitle')}</h2>
            </div>
            <form onSubmit={(event) => { event.preventDefault(); void validateInput(manualPayload); }} className="space-y-3">
              <label htmlFor="qr-payload" className="block text-xs font-semibold text-slate-200">
                {t('checkIn.manualLabel')}
              </label>
              <textarea
                id="qr-payload"
                value={manualPayload}
                onChange={(event) => setManualPayload(event.target.value)}
                placeholder={t('checkIn.manualPlaceholder')}
                rows={5}
                className="w-full rounded-xl border border-white/15 bg-black/40 px-3.5 py-3 text-sm text-white outline-none focus:border-solana-purple"
              />
              <button
                type="submit"
                disabled={!manualPayload.trim() || isValidating}
                className="w-full min-h-11 rounded-xl bg-gradient-to-r from-solana-purple to-neon-pink px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isValidating ? (
                  <span className="inline-flex items-center gap-2 justify-center">
                    <Loader2 className="w-4 h-4 animate-spin" /> {t('checkIn.validating')}
                  </span>
                ) : (
                  t('checkIn.validateBtn')
                )}
              </button>
            </form>
          </section>
        </div>

        {result && (
          <section className={`rounded-2xl border p-5 ${resultStyle}`} role="status">
            <div className="flex items-start gap-3">
              {result.status === 'valid' ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-solana-green" />
              ) : (
                <ShieldAlert className="h-5 w-5 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-bold">{result.message}</p>
                {result.ticket && (
                  <div className="mt-4 grid grid-cols-1 gap-2 text-xs text-slate-100 sm:grid-cols-2">
                    <p>Sự kiện: <strong>{result.ticket.eventTitle}</strong></p>
                    <p>Hạng vé: <strong>{result.ticket.tierName}</strong></p>
                    <p>Ghế: {result.ticket.seat}</p>
                    <p className="font-mono">Mã vé: <strong className="text-white">{result.ticket.ticketCode}</strong></p>
                    <p>Người mua: {result.ticket.customerName}</p>
                    <p>Trạng thái: <strong>{ticketIsCheckedIn(result.ticket) ? t('common.checkedIn').toUpperCase() : t('common.valid').toUpperCase()}</strong></p>
                    <p>Thời điểm mua: {formatDate(result.ticket.purchasedAt)}</p>
                    {result.ticket.checkInTime && (
                      <p className="text-solana-green">Check-in: {formatDate(result.ticket.checkInTime)}</p>
                    )}
                    {result.ticket.checkedInBy && (
                      <p className="truncate">Soát vé bởi: {result.ticket.checkedInBy}</p>
                    )}
                  </div>
                )}
                {result.status === 'valid' && (
                  <button
                    type="button"
                    onClick={() => void confirmCheckIn()}
                    disabled={isConfirming}
                    className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-gradient-to-r from-solana-green to-solana-cyan px-5 py-2.5 text-sm font-bold text-[#070412] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {isConfirming ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" /> {t('checkIn.confirming')}
                      </span>
                    ) : (
                      t('checkIn.confirmCheckIn')
                    )}
                  </button>
                )}
              </div>
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-white/10 bg-[#120B30] p-4 shadow-xl sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-bold text-white">{t('checkIn.historyTitle')}</h2>
            <button
              type="button"
              onClick={() => void refreshTickets()}
              disabled={isRefreshing}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 px-3 text-xs text-slate-300 hover:bg-white/5"
            >
              {isRefreshing ? (
                <Loader2 className="h-4 w-4 animate-spin text-solana-cyan" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span>{t('checkIn.refreshBtn')}</span>
            </button>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('checkIn.searchPlaceholder')}
              className="min-h-11 flex-1 rounded-xl border border-white/15 bg-black/30 px-3 text-sm text-white outline-none focus:border-solana-purple"
            />
            <div className="flex gap-2">
              {(['all', 'checked-in', 'unused'] as TicketFilter[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setFilter(item)}
                  className={`min-h-11 rounded-xl px-3 text-xs font-semibold ${
                    filter === item ? 'bg-solana-purple text-white' : 'border border-white/10 text-slate-300'
                  }`}
                >
                  {item === 'all'
                    ? t('checkIn.filterAll')
                    : item === 'checked-in'
                      ? t('checkIn.filterCheckedIn')
                      : t('checkIn.filterUnused')}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {visibleTickets.map((ticket) => (
              <div
                key={ticket.id}
                className="flex flex-col gap-1 rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-slate-300 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-mono text-white font-semibold">{ticket.ticketCode}</p>
                  <p className="truncate">{ticket.customerName} · {ticket.eventTitle} ({ticket.tierName})</p>
                </div>
                <div className="text-left sm:text-right">
                  <p className={ticketIsCheckedIn(ticket) ? 'text-solana-green font-bold' : 'text-yellow-200 font-medium'}>
                    {ticketIsCheckedIn(ticket) ? `✓ ${t('common.checkedIn').toUpperCase()}` : `○ ${t('checkIn.filterUnused').toUpperCase()}`}
                  </p>
                  {ticket.checkInTime && (
                    <p className="text-[11px] text-slate-400">{formatDate(ticket.checkInTime)}</p>
                  )}
                  {ticket.checkedInBy && (
                    <p className="max-w-40 truncate text-[11px] text-slate-500">Bởi: {ticket.checkedInBy}</p>
                  )}
                </div>
              </div>
            ))}
            {visibleTickets.length === 0 && (
              <p className="py-4 text-center text-xs text-slate-400">{t('checkIn.noTickets')}</p>
            )}
          </div>
        </section>

        <p className="flex items-start gap-2 rounded-xl border border-solana-green/20 bg-solana-green/5 p-4 text-xs leading-relaxed text-slate-300">
          <Ticket className="mt-0.5 h-4 w-4 shrink-0 text-solana-green" />
          Hệ thống đồng bộ dữ liệu vé qua PostgreSQL trên Neon. Xác thực đa thiết bị theo thời gian thực và tự động khóa chống check-in trùng lặp.
        </p>
      </div>
    </div>
  );
};
