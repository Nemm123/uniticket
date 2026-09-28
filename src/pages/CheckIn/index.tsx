import React, { useEffect, useRef, useState } from 'react';
import { BarChart3, Camera, CheckCircle2, Keyboard, Loader2, RefreshCw, ScanLine, ShieldAlert, SwitchCamera, Ticket } from 'lucide-react';
import { CheckInResult, PurchasedTicket, UserRole } from '../../types';
import * as api from '../../services/api';
import { useTranslation } from '../../i18n';
import { QRScanner } from '../../components/organizer/QRScanner';

interface CheckInPageProps {
  currentRole: UserRole | null;
  organizerAddress: string | null;
  onShowToast: (type: 'success' | 'error' | 'info', message: string) => void;
  onTicketsChanged: () => void;
  onNavigate?: (page: string) => void;
}

type TicketFilter = 'all' | 'checked-in' | 'unused';
const ticketIsCheckedIn = (ticket: PurchasedTicket) => ticket.isCheckedIn || ticket.status === 'checked_in' || ticket.status === 'CHECKED_IN';

export const CheckInPage: React.FC<CheckInPageProps> = ({ currentRole, organizerAddress, onShowToast, onTicketsChanged, onNavigate }) => {
  const { t, formatDate } = useTranslation();
  const processingRef = useRef(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment'); // mặc định camera sau (environment)

  const toggleCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  const handleStartCamera = () => {
    setResult(null);
    setCameraEnabled(true);
    setIsScanning(true);
  };

  const handleStopCamera = () => {
    setCameraEnabled(false);
    setIsScanning(false);
  };
  const [manualPayload, setManualPayload] = useState('');
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [tickets, setTickets] = useState<PurchasedTicket[]>([]);
  const [filter, setFilter] = useState<TicketFilter>('all');
  const [search, setSearch] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshTickets = async () => {
    setIsRefreshing(true);
    try {
      const remoteTickets = await api.fetchMyTickets();
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
    setIsScanning(false);

    try {
      const rawInput = input.trim();
      if (!rawInput) {
        onShowToast('error', 'Vui lòng nhập mã vé hợp lệ.');
        return;
      }

      // 1. Giải mã chuỗi JSON lấy ticketId, ticketCode, signature và timestamp (Dynamic QR)
      let parsedPayload: any = null;
      try {
        parsedPayload = JSON.parse(rawInput);
      } catch {
        // Chuỗi không phải JSON (có thể là ticketCode như UTK-5495-1 hoặc ticketId/UUID nhập tay)
      }

      // 2. Chống chụp màn hình gian lận: Kiểm tra thời hạn 60s cho Dynamic QR
      if (parsedPayload && typeof parsedPayload === 'object' && typeof parsedPayload.timestamp === 'number') {
        const ageMs = Date.now() - parsedPayload.timestamp;
        if (ageMs > 60000) {
          const expiredMsg = 'Mã QR đã hết hạn! Vui lòng mở ứng dụng UniTicket trực tiếp';
          setResult({
            status: 'error',
            message: expiredMsg,
          });
          onShowToast('error', expiredMsg);
          return;
        }
      }

      // Lấy định danh tốt nhất để tra cứu
      const searchTarget = (parsedPayload && typeof parsedPayload === 'object')
        ? (parsedPayload.ticketCode || parsedPayload.ticketId || parsedPayload.id || parsedPayload.signature || rawInput)
        : rawInput;

      // 3. Tra cứu vé trong hệ thống qua API / storage
      const backendValidation = await api.verifyTicketCheckIn(rawInput);

      if (backendValidation.status === 'valid') {
        // Tự động check-in
        const ticketId = backendValidation.ticket?.id || backendValidation.ticket?.ticketCode || searchTarget;
        const confirmResult = await api.checkInTicket(ticketId, organizerAddress || undefined);
        
        if (confirmResult.status !== 'error') {
          setResult({
            ...confirmResult,
            message: 'Hợp lệ - Cho phép qua cổng',
            ticket: confirmResult.ticket || backendValidation.ticket,
          });
          await refreshTickets();
          onTicketsChanged();
          onShowToast('success', 'Hợp lệ - Cho phép qua cổng');
        } else {
          setResult(confirmResult);
          onShowToast('error', confirmResult.message);
        }
      } else if (backendValidation.status === 'used') {
        setResult({ ...backendValidation, message: 'Vé đã được sử dụng! (Cảnh báo vé giả/quét trùng)' });
        onShowToast('error', 'Vé đã được sử dụng! (Cảnh báo vé giả/quét trùng)');
      } else if (backendValidation.status === 'error' && backendValidation.message.includes('hết hạn')) {
        setResult({ ...backendValidation, message: 'Mã QR đã hết hạn! Vui lòng mở ứng dụng UniTicket trực tiếp' });
        onShowToast('error', 'Mã QR đã hết hạn! Vui lòng mở ứng dụng UniTicket trực tiếp');
      } else {
        // Fallback tra cứu trong danh sách vé hiện tại (theo ticketCode, id, signature)
        const cleanTarget = searchTarget.toLowerCase();
        const matched = tickets.find(
          (t) =>
            t.ticketCode?.toLowerCase() === cleanTarget ||
            t.id?.toLowerCase() === cleanTarget ||
            t.signature === searchTarget ||
            t.txSignature === searchTarget
        );

        if (matched) {
          if (ticketIsCheckedIn(matched)) {
            setResult({
              status: 'used',
              message: 'Vé đã được sử dụng! (Cảnh báo vé giả/quét trùng)',
              ticket: matched,
            });
            onShowToast('error', 'Vé đã được sử dụng! (Cảnh báo vé giả/quét trùng)');
          } else {
            const confirmResult = await api.checkInTicket(matched.id, organizerAddress || undefined);
            setResult({
              ...confirmResult,
              message: 'Hợp lệ - Cho phép qua cổng',
              ticket: confirmResult.ticket || matched,
            });
            await refreshTickets();
            onTicketsChanged();
            onShowToast('success', 'Hợp lệ - Cho phép qua cổng');
          }
        } else {
          setResult({ ...backendValidation, message: 'Mã vé không hợp lệ' });
          onShowToast('error', 'Mã vé không hợp lệ');
        }
      }
    } finally {
      setIsValidating(false);
      processingRef.current = false;
    }
  };

  // camera logic handled by QRScanner component



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
        <header className="flex flex-col gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
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
          </div>
          {onNavigate && (
            <div>
              <button
                type="button"
                onClick={() => onNavigate('organizer')}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-semibold text-slate-200 hover:bg-white/10 hover:text-white transition-colors"
              >
                <BarChart3 className="h-4 w-4 text-solana-green" /> Bảng Quản Trị BTC
              </button>
            </div>
          )}
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-2xl border border-solana-purple/30 bg-[#120B30] p-4 shadow-2xl sm:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Camera className="h-5 w-5 text-solana-cyan" />
                <h2 className="font-bold text-white">{t('checkIn.cameraTitle')}</h2>
              </div>
              {isScanning && (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center rounded-full border border-solana-cyan/30 bg-solana-cyan/10 px-2.5 py-0.5 text-xs font-semibold text-solana-cyan">
                    {facingMode === 'environment' ? 'Camera Sau' : 'Camera Trước'}
                  </span>
                  <button
                    type="button"
                    onClick={toggleCamera}
                    title={`Đổi sang ${facingMode === 'environment' ? 'Camera Trước' : 'Camera Sau'}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-solana-cyan/30 bg-solana-cyan/15 hover:bg-solana-cyan/25 px-3 py-1 text-xs font-bold text-solana-cyan transition-all active:scale-95 shadow-sm"
                  >
                    <SwitchCamera className="w-3.5 h-3.5" />
                    <span>Đổi camera 🔄</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleStopCamera}
                    className="rounded-lg border border-white/10 bg-black/40 hover:bg-black/60 px-2.5 py-1 text-xs text-slate-300 transition-colors"
                  >
                    Tắt camera
                  </button>
                </div>
              )}
            </div>

            <div className="relative overflow-hidden rounded-xl bg-black/50">
              {!cameraEnabled ? (
                <div className="flex flex-col items-center justify-center gap-3 p-8 text-center border border-white/10 rounded-xl aspect-video">
                  <ScanLine className="h-10 w-10 text-solana-purple" />
                  <p className="text-xs text-slate-400">{t('checkIn.cameraHint')}</p>
                  <button
                    type="button"
                    onClick={handleStartCamera}
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-solana-purple to-neon-pink px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-purple-950/50 active:scale-95"
                  >
                    <Camera className="h-4 w-4" />
                    {t('checkIn.cameraStart')}
                  </button>
                </div>
              ) : (
                <QRScanner 
                  isEnabled={cameraEnabled} 
                  facingMode={facingMode}
                  onToggleCamera={toggleCamera}
                  onScanSuccess={(data) => void validateInput(data)} 
                  onClose={handleStopCamera} 
                />
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
            {search.trim() && (
              <button
                type="button"
                onClick={() => void validateInput(search.trim())}
                disabled={isValidating}
                className="min-h-11 rounded-xl bg-gradient-to-r from-solana-purple to-neon-pink px-4 text-xs font-bold text-white shadow-lg active:scale-95 whitespace-nowrap inline-flex items-center justify-center gap-1.5"
              >
                {isValidating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ScanLine className="w-3.5 h-3.5" />}
                {t('checkIn.validateBtn')}
              </button>
            )}
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
                  {!ticketIsCheckedIn(ticket) && (
                    <button
                      type="button"
                      onClick={() => void validateInput(ticket.ticketCode)}
                      disabled={isValidating}
                      className="mt-1 inline-flex items-center gap-1 rounded-lg bg-solana-purple/80 hover:bg-solana-purple px-2 py-0.5 text-[11px] font-semibold text-white transition-colors"
                    >
                      <CheckCircle2 className="w-3 h-3" /> Soát vé
                    </button>
                  )}
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
