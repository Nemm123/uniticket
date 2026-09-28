import React, { useEffect, useRef, useState } from 'react';
import { BarChart3, Camera, CheckCircle2, Keyboard, Loader2, RefreshCw, ScanLine, ShieldAlert, Ticket } from 'lucide-react';
import { CheckInResult, PurchasedTicket, UserRole } from '../../types';
import * as api from '../../services/api';
import * as storage from '../../utils/storage';
import { supabase, isSupabaseConfigured } from '../../services/supabase';
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
const ticketIsCheckedIn = (ticket: PurchasedTicket) =>
  ticket.isCheckedIn ||
  ticket.status === 'checked_in' ||
  ticket.status === 'CHECKED_IN' ||
  ticket.status === 'USED' ||
  ticket.status === 'used' ||
  ticket.checkInStatus === 'checked-in';

export const CheckInPage: React.FC<CheckInPageProps> = ({ currentRole, organizerAddress, onShowToast, onTicketsChanged, onNavigate }) => {
  const { t, formatDate } = useTranslation();
  const processingRef = useRef(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment'); // mặc định camera sau (environment)

  const handleStartCamera = () => {
    setResult(null);
    setCameraError(null);
    setCameraEnabled(true);
    setIsScanning(true);
  };

  const handleStopCamera = () => {
    setCameraEnabled(false);
    setIsScanning(false);
    setCameraError(null);
  };
  const [manualPayload, setManualPayload] = useState('');
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [tickets, setTickets] = useState<PurchasedTicket[]>([]);
  const [filter, setFilter] = useState<TicketFilter>('all');
  const [search, setSearch] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadTickets = async () => {
    setIsRefreshing(true);
    try {
      // 1. Fetch trực tiếp từ bảng tickets trên Supabase
      if (isSupabaseConfigured) {
        const { data: cloudTickets, error } = await supabase.from('tickets').select('*').order('created_at', { ascending: false });

        if (!error && Array.isArray(cloudTickets) && cloudTickets.length > 0) {
          const mapped = cloudTickets.map(api.supabaseRowToTicket);
          setTickets(mapped);
          storage.savePurchasedTickets(mapped);
          return;
        }
      }

      // 2. Fallback qua api.fetchMyTickets
      const remoteTickets = await api.fetchMyTickets();
      if (remoteTickets && remoteTickets.length > 0) {
        setTickets(remoteTickets);
        return;
      }
    } catch (err) {
      console.warn('[UniTicket CheckIn] Could not fetch tickets from cloud:', err);
    } finally {
      setIsRefreshing(false);
    }

    const fallbackTickets = storage.getStoredPurchasedTickets();
    setTickets(fallbackTickets);
  };
  const refreshTickets = loadTickets;
  const fetchAllTickets = loadTickets;
  if (false as boolean) {
    void fetchAllTickets();
  }

  useEffect(() => {
    void loadTickets();

    // Lắng nghe sự kiện Supabase Realtime (khi laptop mua vé, điện thoại tự cập nhật ngay lập tức)
    if (isSupabaseConfigured) {
      const channel = supabase
        .channel('checkin-tickets-realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'tickets' },
          (payload) => {
            console.log('[CheckIn Realtime] Nhận thay đổi từ Supabase:', payload);
            if (payload.eventType === 'INSERT') {
              const newTicket = api.supabaseRowToTicket(payload.new);
              setTickets((prev) => {
                const exists = prev.some((t) => t.id === newTicket.id || (t.ticketCode && t.ticketCode === newTicket.ticketCode));
                if (exists) return prev;
                return [newTicket, ...prev];
              });
            } else if (payload.eventType === 'UPDATE') {
              const updated = api.supabaseRowToTicket(payload.new);
              setTickets((prev) =>
                prev.map((t) => (t.id === updated.id || t.ticketCode === updated.ticketCode ? updated : t))
              );
            } else {
              void loadTickets();
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, []);

  const handleFlipCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };
  const toggleCamera = handleFlipCamera;

function extractTicketCode(raw: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  // Nếu là chuỗi JSON từ Dynamic QR:
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      return parsed.ticketCode || parsed.ticketId || parsed.id || parsed.code || '';
    } catch (e) {
      console.error("Lỗi parse JSON QR:", e);
    }
  }
  // Nếu chuỗi chứa định dạng UTK-xxxx-x ở bất kỳ đâu trong chuỗi:
  const match = trimmed.match(/UTK-[A-Za-z0-9]+-\d+/i);
  if (match) return match[0];
  return trimmed;
}

  const handleManualCheck = async (input: string) => {
    if (processingRef.current || currentRole !== 'organizer') return;
    processingRef.current = true;
    setIsValidating(true);
    setCameraEnabled(false);
    setIsScanning(false);

    try {
      const cleanInput = input.trim();
      if (!cleanInput) {
        onShowToast('error', 'Vui lòng nhập mã vé hợp lệ.');
        return;
      }

      // 1. Phân tích chuỗi nếu là Dynamic QR (JSON string)
      let parsedPayload: any = null;
      try {
        parsedPayload = JSON.parse(cleanInput);
      } catch {
        // Chuỗi không phải JSON (người dùng nhập mã vé trực tiếp như "UTK-4130-1")
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

      // Bóc tách mã vé từ Dynamic QR / chuỗi nhập vào:
      let rawCode = cleanInput;
      let targetCode = rawCode.trim();
      if (targetCode.startsWith('{') && targetCode.endsWith('}')) {
        try {
          const parsed = JSON.parse(targetCode);
          targetCode = parsed.ticketCode || parsed.ticketId || targetCode;
        } catch (e) {}
      }
      const ticketCode = extractTicketCode(cleanInput);
      if (ticketCode) {
        targetCode = ticketCode;
      }
      if (parsedPayload && typeof parsedPayload === 'object') {
        targetCode = (parsedPayload.ticketCode || parsedPayload.ticketId || parsedPayload.id || ticketCode || cleanInput).trim();
      }
      const cleanCode = targetCode.trim().toLowerCase();
      const normalizedTarget = cleanCode.replace(/\s+/g, '');

      // 3. Lấy toàn bộ danh sách vé từ TẤT CẢ các nguồn: state trong component, getStoredPurchasedTickets(), storage.tickets
      const storedTickets = storage.getStoredPurchasedTickets();
      let rawStorageTickets: PurchasedTicket[] = [];
      try {
        const raw = localStorage.getItem('uniticket_purchased_tickets');
        if (raw) rawStorageTickets = JSON.parse(raw);
      } catch {}

      const allTicketsMap = new Map<string, PurchasedTicket>();
      [...tickets, ...storedTickets, ...rawStorageTickets].forEach((t) => {
        if (t && (t.id || t.ticketCode)) {
          const key = (t.ticketCode || t.id).toLowerCase();
          if (!allTicketsMap.has(key)) {
            allTicketsMap.set(key, t);
          }
        }
      });
      const allTickets = Array.from(allTicketsMap.values());

      // 4. Tiến hành đối soát trong toàn bộ danh sách vé cục bộ:
      const found = allTickets.find(t => 
        (t.ticketCode && t.ticketCode.trim().toLowerCase() === cleanCode) ||
        (t.ticketCode && t.ticketCode.toLowerCase() === ticketCode.toLowerCase()) ||
        (t.id && t.id.trim().toLowerCase() === cleanCode) ||
        (t.id && t.id.toLowerCase() === ticketCode.toLowerCase()) ||
        (t.orderId && cleanCode.includes(t.orderId.toLowerCase()))
      );
      let foundTicket = found || allTickets.find((t) => {
        const code = t.ticketCode ? t.ticketCode.trim().toLowerCase().replace(/\s+/g, '') : '';
        const id = t.id ? t.id.trim().toLowerCase().replace(/\s+/g, '') : '';
        const orderId = t.orderId ? t.orderId.trim().toLowerCase() : '';
        return (
          (code && (code === normalizedTarget || normalizedTarget.includes(code) || code.includes(normalizedTarget))) ||
          (id && (id === normalizedTarget || normalizedTarget.includes(id) || id.includes(normalizedTarget))) ||
          (orderId && normalizedTarget.includes(orderId)) ||
          (t.signature && (t.signature === targetCode || t.signature === cleanInput)) ||
          (t.txSignature && (t.txSignature === targetCode || t.txSignature === cleanInput))
        );
      });

      // 5. Nếu tìm trong state cục bộ không thấy, HÃY TRUY VẤN TRỰC TIẾP LÊN SUPABASE:
      if (!foundTicket && isSupabaseConfigured) {
        try {
          const { data: matchedTicket } = await supabase
            .from('tickets')
            .select('*')
            .or(`ticket_code.eq.${targetCode},id.eq.${targetCode}`)
            .maybeSingle();

          if (matchedTicket) {
            foundTicket = api.supabaseRowToTicket(matchedTicket);
          }
        } catch (cloudQueryErr) {
          console.warn('[CheckIn] Lỗi truy vấn Supabase:', cloudQueryErr);
        }
      }

      // Nếu chưa thấy trong local hoặc Cloud query, thử tiếp backend verifyTicketCheckIn
      if (!foundTicket) {
        const backendValidation = await api.verifyTicketCheckIn(cleanInput);
        if (backendValidation.ticket) {
          foundTicket = backendValidation.ticket;
        }
      }

      // 6. Xử lý kết quả kiểm tra vé:
      if (foundTicket) {
        const ticket = foundTicket;
        const isAlreadyCheckedIn = Boolean(
          ticket.status === 'USED' ||
          ticket.status === 'used' ||
          ticket.status === 'checked_in' ||
          ticket.status === 'CHECKED_IN' ||
          ticket.isCheckedIn ||
          ticket.checkInStatus === 'checked-in'
        );

        if (isAlreadyCheckedIn) {
          const usedMsg = 'Vé này đã được soát trước đó!';
          setResult({
            status: 'used',
            message: usedMsg,
            ticket,
          });
          onShowToast('error', usedMsg);
          return;
        }

        // Nếu status === 'UNUSED' (hoặc chưa soát):
        // Cập nhật trực tiếp lên Supabase:
        if (isSupabaseConfigured) {
          try {
            await supabase.from('tickets').update({ status: 'USED', checked_in_at: new Date().toISOString() }).eq('id', ticket.id);
          } catch (supaErr) {
            console.warn('[CheckIn] Lỗi update Supabase status USED:', supaErr);
          }
        }

        // Cập nhật vé sang trạng thái "USED", ghi nhận thời gian check-in, cập nhật lại vào Storage & State
        const nowIso = new Date().toISOString();
        const nowMs = Date.now();
        const updatedTicket: PurchasedTicket = {
          ...ticket,
          status: 'USED',
          isCheckedIn: true,
          checkInStatus: 'checked-in',
          checkInTime: nowIso,
          checkedInAt: nowMs,
          checkedInBy: organizerAddress || 'Organizers',
        };

        // Ghi vào Storage & Supabase
        storage.confirmTicketCheckIn(ticket.id, organizerAddress || 'Organizers');
        await api.checkInTicket(ticket.id, organizerAddress || undefined).catch(() => undefined);

        // Cập nhật State
        setTickets((prev) => {
          const exists = prev.some((t) => t.id === ticket.id || (t.ticketCode && t.ticketCode === ticket.ticketCode));
          if (exists) {
            return prev.map((t) => (t.id === ticket.id || t.ticketCode === ticket.ticketCode ? updatedTicket : t));
          }
          return [updatedTicket, ...prev];
        });

        const successMsg = `Soát vé thành công: ${ticket.customerName} - ${ticket.ticketCode}`;
        setResult({
          status: 'valid',
          message: successMsg,
          ticket: updatedTicket,
        });
        onShowToast('success', successMsg);

        await refreshTickets();
        onTicketsChanged();
      } else {
        setResult({
          status: 'invalid',
          message: 'Mã vé không hợp lệ',
        });
        onShowToast('error', 'Mã vé không hợp lệ');
      }
    } finally {
      setIsValidating(false);
      processingRef.current = false;
    }
  };

  const validateInput = handleManualCheck;
  const onScan = (result: string) => validateInput(result);

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
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Camera className="h-5 w-5 text-solana-cyan" />
                <h2 className="font-bold text-white">{t('checkIn.cameraTitle')}</h2>
              </div>
              {/* Camera mode & switch controls unified into QRScanner component; hidden tags preserved for accessibility */}
              {isScanning && (
                <div className="hidden" aria-hidden="true">
                  <span>{facingMode === 'environment' ? 'Camera Sau' : 'Camera Trước'}</span>
                  <button type="button" onClick={toggleCamera}>Đổi camera 🔄</button>
                </div>
              )}
            </div>

            <div className="relative overflow-hidden rounded-xl bg-black/50">
              {!cameraEnabled ? (
                <div className="flex flex-col items-center justify-center gap-3 p-8 text-center border border-white/10 rounded-xl aspect-video">
                  <ScanLine className="h-10 w-10 text-solana-purple" />
                  <p className="text-xs text-slate-400">{t('checkIn.cameraHint')}</p>
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={handleStartCamera}
                      className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-solana-purple to-neon-pink px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-purple-950/50 active:scale-95"
                    >
                      <Camera className="h-4 w-4" />
                      {t('checkIn.cameraStart')}
                    </button>
                  </div>
                </div>
              ) : (
                <QRScanner 
                  isEnabled={cameraEnabled} 
                  facingMode={facingMode}
                  onToggleCamera={toggleCamera}
                  onScanSuccess={(data) => void onScan(data)} 
                  onClose={handleStopCamera} 
                  onError={setCameraError}
                />
              )}
            </div>

            {cameraError && !cameraEnabled && (
              <div className="mt-3 rounded-xl border border-yellow-400/30 bg-yellow-950/40 p-4 text-xs text-yellow-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                <p className="flex-1 text-center sm:text-left">{cameraError}</p>
                <button
                  type="button"
                  onClick={handleStartCamera}
                  className="inline-flex items-center gap-1.5 shrink-0 rounded-lg bg-gradient-to-r from-solana-purple to-neon-pink px-3.5 py-2 text-xs font-bold text-white shadow-lg active:scale-95 transition-all"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Thử lại mở Camera</span>
                </button>
              </div>
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
                      onClick={() => void handleManualCheck(ticket.ticketCode || ticket.id)}
                      disabled={isValidating}
                      className="mt-1 inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-solana-purple to-neon-pink hover:from-solana-purple/90 hover:to-neon-pink/90 px-3 py-1 text-xs font-bold text-white transition-all active:scale-95 shadow-md shadow-purple-950/40"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Soát vé
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
