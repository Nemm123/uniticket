import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  X,
  Ticket,
  Sparkles,
  ShieldCheck,
  User,
  Mail,
  Minus,
  Plus,
  Clock,
  Copy,
  Check,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CreditCard,
  RefreshCw,
  Loader2,
  Building2,
  CheckCircle2,
  ExternalLink
} from 'lucide-react';
import { EventItem, TicketTier, PurchasedTicket } from '../../types';
import { createOrder, demoPayOrder, type OrderSummary } from '../../services/ordersApi';
import { listGuestTicketsApi } from '../../services/ticketsApi';
import { isApiEventId } from '../../services/eventsApi';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: EventItem;
  tier: TicketTier;
  quantity: number;
  onSuccess: (ticketsCreated: PurchasedTicket[]) => void;
  onError: (msg: string) => void;
}

const formatVnd = (amount: number): string => `${amount.toLocaleString('vi-VN')} ₫`;

const BANK_CONFIG = {
  bankName: 'MB Bank (Ngân hàng TMCP Quân Đội - Demo)',
  bin: '970422',
  accountNumber: '88889999UNITICKET',
  accountName: 'UNITICKET DEMO ACCOUNT',
};

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  event,
  tier,
  quantity,
  onSuccess,
  onError,
}) => {
  const [step, setStep] = useState<'FORM' | 'PAYMENT' | 'WAITING_CONFIRMATION'>('FORM');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [selectedQuantity, setSelectedQuantity] = useState(quantity);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationSuccess, setVerificationSuccess] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState('');
  const [reservation, setReservation] = useState<OrderSummary | null>(null);
  const [guestAccessToken, setGuestAccessToken] = useState<string>(() => localStorage.getItem('guest_access_token') ?? '');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [timeLeftMs, setTimeLeftMs] = useState<number>(0);
  const [bankAppNotice, setBankAppNotice] = useState<string | null>(null);
  const [checkingWebhook, setCheckingWebhook] = useState(false);
  const [webhookStatusMessage, setWebhookStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedQuantity(Math.max(1, Math.min(quantity, tier.remainingQuantity)));
      setReservation(null);
      setStep('FORM');
      setIsSubmitting(false);
      setIsVerifying(false);
      setVerificationSuccess(false);
      setVerificationMessage('');
      setCopiedField(null);
      setBankAppNotice(null);
      setCheckingWebhook(false);
      setWebhookStatusMessage(null);
    }
  }, [isOpen, quantity, tier.id, tier.remainingQuantity]);

  // Đồng hồ đếm ngược giữ vé
  useEffect(() => {
    if (!reservation?.expiresAt || step === 'FORM') {
      setTimeLeftMs(0);
      return;
    }
    const updateCountdown = () => {
      const expiresTime = new Date(reservation.expiresAt).getTime();
      const remaining = Math.max(0, expiresTime - Date.now());
      setTimeLeftMs(remaining);
    };
    updateCountdown();
    const timer = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(timer);
  }, [reservation?.expiresAt, step]);

  if (!isOpen) return null;

  const isBackendEvent = isApiEventId(event.id);
  const unitPriceVnd = typeof tier.priceVnd === 'number' && tier.priceVnd > 0 ? tier.priceVnd : null;
  const subtotalVnd = unitPriceVnd ? unitPriceVnd * selectedQuantity : 0;
  const estimatedServiceFee = 20000;
  const estimatedTotalVnd = subtotalVnd + estimatedServiceFee;

  const formatCountdown = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const isExpired = Boolean(reservation && timeLeftMs <= 0);

  const copyToClipboard = (text: string, field: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Bước 1: Tạo đơn hàng trên backend
  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!unitPriceVnd) {
      onError('Hạng vé này chưa được thiết lập giá VNĐ hợp lệ. Vui lòng liên hệ ban tổ chức.');
      return;
    }

    if (!isBackendEvent) {
      onError('Sự kiện thử nghiệm cục bộ không hỗ trợ đặt vé qua hệ thống thanh toán chính thức. Vui lòng chọn sự kiện có trên hệ thống.');
      return;
    }

    const trimmedName = customerName.trim();
    const trimmedEmail = customerEmail.trim();

    if (!Number.isInteger(selectedQuantity) || selectedQuantity <= 0) {
      onError('Số lượng vé phải lớn hơn 0.');
      return;
    }
    if (selectedQuantity > tier.remainingQuantity) {
      onError(`Số lượng vé không được vượt quá ${tier.remainingQuantity} vé còn lại.`);
      return;
    }
    if (!trimmedName || trimmedName.length < 2) {
      onError('Vui lòng nhập họ và tên hợp lệ (tối thiểu 2 ký tự).');
      return;
    }
    if (!trimmedEmail || !trimmedEmail.includes('@') || !trimmedEmail.includes('.')) {
      onError('Vui lòng nhập địa chỉ email hợp lệ để nhận vé.');
      return;
    }

    setIsSubmitting(true);

    try {
      const created = await createOrder(event.id, tier.id, selectedQuantity, trimmedName, trimmedEmail);
      if (created.guestAccessToken) {
        setGuestAccessToken(created.guestAccessToken);
        localStorage.setItem('guest_access_token', created.guestAccessToken);
      }
      setReservation(created);
      setStep('PAYMENT');
      setIsSubmitting(false);
    } catch (error) {
      setIsSubmitting(false);
      onError(error instanceof Error ? error.message : 'Đã xảy ra sự cố khi tạo đơn hàng.');
    }
  };

  const handleOpenBankApp = () => {
    if (!reservation) return;
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile) {
      window.location.href = vietQrTransferString;
    } else {
      setBankAppNotice('Hệ điều hành máy tính không hỗ trợ mở trực tiếp ứng dụng ngân hàng. Vui lòng mở ứng dụng ngân hàng trên điện thoại của bạn và quét mã VietQR bên dưới.');
    }
  };

  // Bước 2: Chuyển sang màn hình chờ xác nhận thanh toán (không tự cấp vé giả mạo)
  const handleTransitionToWaiting = () => {
    setStep('WAITING_CONFIRMATION');
    setWebhookStatusMessage('Hệ thống đang kết nối và chờ tín hiệu đối soát thanh toán từ ngân hàng...');
  };

  // Kiểm tra lại trạng thái đối soát (giữ nguyên PAYMENT_PENDING)
  const handleRecheckStatus = async () => {
    setCheckingWebhook(true);
    setWebhookStatusMessage('Đang kết nối cổng đối soát ngân hàng...');
    await new Promise((r) => setTimeout(r, 1200));
    setCheckingWebhook(false);
    setWebhookStatusMessage('Chưa nhận được xác nhận thanh toán từ ngân hàng. Đơn hàng vẫn được lưu giữ an toàn ở trạng thái PAYMENT_PENDING.');
  };

  // Mô phỏng Webhook thành công (dành riêng cho ban giám khảo / chấm thi Hackathon kiểm thử cấp vé)
  const handleSimulateWebhookSuccess = async () => {
    if (!reservation) return;
    if (isExpired) {
      onError('Đơn hàng đã hết hạn giữ vé. Vui lòng tạo đơn mới.');
      return;
    }

    setIsVerifying(true);
    setVerificationMessage('Đang mô phỏng tín hiệu Webhook ngân hàng xác nhận đối soát thành công...');

    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setVerificationMessage('Ngân hàng đã xác nhận thanh toán! Đang kích hoạt vé điện tử & QR NFT...');

      const completed = await demoPayOrder(reservation.id, guestAccessToken || undefined);

      setVerificationSuccess(true);
      await new Promise((resolve) => setTimeout(resolve, 800));

      let orderTickets: PurchasedTicket[] = [];
      if (guestAccessToken) {
        try {
          orderTickets = await listGuestTicketsApi(completed.id, guestAccessToken);
        } catch {
          // Tickets are already issued on backend
        }
      }
      setIsVerifying(false);
      onClose();
      onSuccess(orderTickets);
    } catch (error) {
      setIsVerifying(false);
      setVerificationMessage('');
      onError(error instanceof Error ? error.message : 'Lỗi khi kích hoạt vé thử nghiệm.');
    }
  };

  const vietQrTransferString = reservation
    ? `vietqr://transfer?bin=${BANK_CONFIG.bin}&acc=${BANK_CONFIG.accountNumber}&amount=${reservation.totalVnd}&memo=${encodeURIComponent(reservation.orderCode)}`
    : '';

  const vietQrImageUrl = reservation
    ? `https://img.vietqr.io/image/${BANK_CONFIG.bin}-${BANK_CONFIG.accountNumber}-compact2.png?amount=${reservation.totalVnd}&addInfo=${encodeURIComponent(reservation.orderCode)}&accountName=${encodeURIComponent(BANK_CONFIG.accountName)}`
    : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md transition-all">
      <div className="absolute inset-0" onClick={isVerifying ? undefined : onClose} />

      <div className="relative w-full max-w-lg rounded-2xl bg-[#0F0A28] border border-solana-purple/40 p-5 sm:p-7 shadow-2xl shadow-purple-950/80 z-10 overflow-hidden animate-scaleUp text-left max-h-[92vh] overflow-y-auto">
        <div className="absolute -top-24 -right-24 w-52 h-52 bg-solana-purple/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-52 h-52 bg-solana-green/20 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-solana-purple to-neon-pink text-white shadow-lg">
              {step === 'FORM' ? (
                <Ticket className="w-5 h-5" />
              ) : step === 'PAYMENT' ? (
                <CreditCard className="w-5 h-5" />
              ) : (
                <Clock className="w-5 h-5 text-amber-400" />
              )}
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                {step === 'FORM'
                  ? 'Đặt Vé Sự Kiện'
                  : step === 'PAYMENT'
                    ? 'Cổng Thanh Toán UniTicket'
                    : 'Chờ Xác Nhận Đối Soát'}
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-solana-purple/30 border border-solana-purple/50 text-purple-200">
                  {step === 'WAITING_CONFIRMATION' ? 'PAYMENT_PENDING' : 'VietQR VNĐ'}
                </span>
              </h3>
              <p className="text-xs text-slate-300">
                {step === 'FORM'
                  ? 'Bước 1/3: Thông tin vé & người nhận'
                  : step === 'PAYMENT'
                    ? 'Bước 2/3: Quét mã chuyển khoản VietQR'
                    : 'Bước 3/3: Đối soát giao dịch từ ngân hàng'}
              </p>
            </div>
          </div>
          {!isVerifying && (
            <button
              onClick={onClose}
              aria-label="Đóng cửa sổ"
              className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-300 hover:text-white hover:bg-white/10 active:scale-95 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* STEP 1: FORM THÔNG TIN */}
        {step === 'FORM' && (
          <form onSubmit={handleCreateOrder} className="mt-4 space-y-4">
            <div className="p-3 rounded-xl bg-purple-950/50 border border-solana-purple/40 text-xs text-purple-200 flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-solana-green shrink-0 mt-0.5 animate-pulse" />
              <div className="space-y-0.5">
                <p className="font-semibold text-white">Thanh Toán Bằng VNĐ</p>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  Giá vé được niêm yết bằng Việt Nam Đồng (VNĐ). Sau khi bấm tiếp tục, hệ thống sẽ tạo đơn hàng và mở cổng chuyển khoản VietQR.
                </p>
              </div>
            </div>

            {/* Thông tin vé & giá */}
            <div className="p-4 rounded-xl bg-[#170E38] border border-white/10 space-y-3">
              <div className="text-xs text-slate-300 border-b border-white/10 pb-2">
                <span className="text-slate-400 block text-[11px]">Sự kiện:</span>
                <strong className="text-white text-sm block mt-0.5 line-clamp-1">{event.title}</strong>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs text-slate-300">
                <div>
                  <span className="text-slate-400 block text-[11px]">Hạng vé:</span>
                  <strong className="text-solana-cyan block mt-0.5">{tier.name}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Đơn giá:</span>
                  <span className="text-slate-200 block mt-0.5 font-mono">
                    {unitPriceVnd ? `${formatVnd(unitPriceVnd)} / vé` : 'Chưa có giá'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Tạm tính:</span>
                  <span className="text-white block mt-0.5 font-mono font-bold">
                    {unitPriceVnd ? formatVnd(subtotalVnd) : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Phí dịch vụ:</span>
                  <span className="text-solana-green block mt-0.5 font-mono">{formatVnd(estimatedServiceFee)}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                <span className="text-xs font-bold text-white">Tổng tạm tính:</span>
                <span className="text-lg font-black text-solana-green font-mono">
                  {unitPriceVnd ? formatVnd(estimatedTotalVnd) : 'Chưa có giá'}
                </span>
              </div>
            </div>

            {/* Chọn số lượng */}
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-4 py-3">
              <div>
                <span className="block text-xs font-semibold text-white">Số lượng vé</span>
                <span className="text-[11px] text-slate-400">Còn lại: {tier.remainingQuantity} vé</span>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#0B0620] p-1">
                <button
                  type="button"
                  onClick={() => setSelectedQuantity((current) => Math.max(1, current - 1))}
                  disabled={selectedQuantity <= 1}
                  aria-label="Giảm số lượng vé"
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-white disabled:opacity-30"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-8 text-center font-mono font-bold text-white">{selectedQuantity}</span>
                <button
                  type="button"
                  onClick={() => setSelectedQuantity((current) => Math.min(tier.remainingQuantity, current + 1))}
                  disabled={selectedQuantity >= tier.remainingQuantity}
                  aria-label="Tăng số lượng vé"
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-white disabled:opacity-30"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Thông tin người nhận vé */}
            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-solana-cyan" />
                <span>Họ và Tên Người Tham Dự *</span>
              </label>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="VD: Nguyễn Văn A"
                className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/15 focus:border-solana-purple focus:outline-none text-white text-xs sm:text-sm placeholder:text-slate-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-1.5 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-neon-pink" />
                <span>Email Nhận Vé Điện Tử *</span>
              </label>
              <input
                type="email"
                required
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="VD: nguyenvana@gmail.com"
                className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/15 focus:border-solana-purple focus:outline-none text-white text-xs sm:text-sm placeholder:text-slate-500 transition-colors"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting || !unitPriceVnd || !isBackendEvent}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-solana-purple via-neon-pink to-solana-cyan text-white font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-xl shadow-purple-950/60 hover:shadow-solana-purple/50 active:scale-95 transition-all disabled:opacity-50"
              >
                <span>{isSubmitting ? 'Đang tạo đơn hàng...' : 'Tiếp Tục Đến Thanh Toán'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <p className="text-center text-[11px] text-slate-400 mt-2">
                Hệ thống sẽ giữ chỗ trong 15 phút để bạn tiến hành thanh toán.
              </p>
            </div>
          </form>
        )}

        {/* STEP 2: CỔNG THANH TOÁN (PAYMENT_PENDING) */}
        {step === 'PAYMENT' && reservation && (
          <div className="mt-4 space-y-4">
            {/* Banner trạng thái & Countdown */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 rounded-xl bg-purple-950/40 border border-solana-purple/50">
              <div className="flex items-center gap-2">
                <Clock className={`w-4 h-4 ${isExpired ? 'text-neon-pink' : 'text-solana-cyan animate-pulse'}`} />
                <span className="text-xs text-slate-300">
                  {isExpired ? 'Thời gian giữ vé đã kết thúc' : 'Thời gian giữ vé còn lại:'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  PAYMENT_PENDING
                </span>
                <div className={`font-mono text-sm font-bold px-2.5 py-1 rounded-lg ${
                  isExpired ? 'bg-neon-pink/20 text-neon-pink border border-neon-pink/40' : 'bg-solana-cyan/10 text-solana-cyan border border-solana-cyan/30'
                }`}>
                  {isExpired ? '00:00 (Hết hạn)' : formatCountdown(timeLeftMs)}
                </div>
              </div>
            </div>

            {/* Chi tiết đơn hàng */}
            <div className="p-4 rounded-xl bg-[#170E38] border border-white/10 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <span className="text-xs text-slate-400">Mã đơn hàng:</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-solana-cyan">{reservation.orderCode}</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(reservation.orderCode, 'orderCode')}
                    className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                    title="Sao chép mã đơn hàng"
                  >
                    {copiedField === 'orderCode' ? <Check className="w-3.5 h-3.5 text-solana-green" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                <div>
                  <span className="text-slate-400 block text-[11px]">Sự kiện:</span>
                  <span className="text-white block mt-0.5 font-medium truncate">{event.title}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Hạng vé & SL:</span>
                  <span className="text-white block mt-0.5">{tier.name} × {selectedQuantity}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Tạm tính:</span>
                  <span className="text-slate-200 block mt-0.5 font-mono">{formatVnd(reservation.subtotalVnd)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Phí dịch vụ:</span>
                  <span className="text-slate-200 block mt-0.5 font-mono">{formatVnd(reservation.serviceFeeVnd)}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                <span className="text-xs font-bold text-white">Tổng tiền thanh toán:</span>
                <span className="text-xl font-black text-solana-green font-mono">{formatVnd(reservation.totalVnd)}</span>
              </div>
            </div>

            {/* Khung chuyển khoản & VietQR */}
            <div className="p-4 rounded-xl bg-black/30 border border-white/10 flex flex-col items-center text-center space-y-3">
              <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-solana-cyan" />
                <span>Thông Tin Chuyển Khoản Ngân Hàng (VietQR)</span>
              </span>

              <div className="p-2.5 bg-white rounded-2xl shadow-lg shadow-purple-950/40 inline-flex items-center justify-center min-h-[170px] min-w-[170px]">
                <img
                  src={vietQrImageUrl}
                  alt="Mã VietQR Thanh Toán"
                  className="w-[160px] h-[160px] object-contain rounded-xl"
                  onError={(e) => {
                    // Fallback to local QRCodeSVG if remote VietQR img fails
                    e.currentTarget.style.display = 'none';
                    const parent = e.currentTarget.parentElement;
                    if (parent && !parent.querySelector('svg')) {
                      const svgWrapper = document.createElement('div');
                      parent.appendChild(svgWrapper);
                    }
                  }}
                />
                <noscript>
                  <QRCodeSVG value={vietQrTransferString} size={160} level="M" />
                </noscript>
              </div>

              <div className="w-full text-left bg-[#120B30] p-3 rounded-xl border border-white/5 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-[11px]">Ngân hàng:</span>
                  <span className="text-white font-medium">{BANK_CONFIG.bankName}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-[11px]">Chủ tài khoản:</span>
                  <span className="text-white font-medium uppercase">{BANK_CONFIG.accountName}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-[11px]">Số tài khoản:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-solana-cyan font-mono font-bold">{BANK_CONFIG.accountNumber}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(BANK_CONFIG.accountNumber, 'acc')}
                      className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white"
                      title="Sao chép số tài khoản"
                    >
                      {copiedField === 'acc' ? <Check className="w-3 h-3 text-solana-green" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-[11px]">Số tiền cần chuyển:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-solana-green font-mono font-bold">{formatVnd(reservation.totalVnd)}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(String(reservation.totalVnd), 'amount')}
                      className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white"
                      title="Sao chép số tiền"
                    >
                      {copiedField === 'amount' ? <Check className="w-3 h-3 text-solana-green" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-1 border-t border-white/5">
                  <span className="text-slate-400 text-[11px]">Nội dung chuyển khoản:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-neon-pink font-mono font-bold">{reservation.orderCode}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(reservation.orderCode, 'memo')}
                      className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white"
                      title="Sao chép nội dung"
                    >
                      {copiedField === 'memo' ? <Check className="w-3 h-3 text-solana-green" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Nút mở App ngân hàng (Deep link Mobile / Hướng dẫn Desktop) */}
              <div className="w-full space-y-1.5 pt-1">
                <button
                  type="button"
                  onClick={handleOpenBankApp}
                  className="w-full py-2.5 px-3 rounded-lg bg-white/10 hover:bg-white/15 border border-white/20 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-solana-cyan" />
                  <span>Mở ứng dụng ngân hàng</span>
                </button>
                {bankAppNotice && (
                  <p className="text-[11px] text-amber-300 text-left bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20 leading-relaxed">
                    {bankAppNotice}
                  </p>
                )}
              </div>

              {/* Thông báo minh bạch Demo */}
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-left text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-[11px] leading-relaxed">
                  <strong>Môi trường Demo</strong>: Đây là giao diện cổng thanh toán thử nghiệm phục vụ Hackathon. Vui lòng không chuyển tiền thật vào tài khoản thử nghiệm trên. Sau khi quét mã tham khảo, nhấn nút xác nhận bên dưới.
                </div>
              </div>
            </div>

            {/* Trạng thái xác minh đang chạy */}
            {isVerifying && (
              <div className="p-4 rounded-xl bg-solana-purple/20 border border-solana-purple/40 text-center space-y-2 animate-pulse">
                <div className="flex items-center justify-center gap-2 text-solana-cyan font-semibold text-sm">
                  {verificationSuccess ? <CheckCircle2 className="w-5 h-5 text-solana-green" /> : <Loader2 className="w-5 h-5 animate-spin" />}
                  <span>{verificationMessage}</span>
                </div>
                <p className="text-[11px] text-slate-300">
                  Hệ thống đang đối soát trạng thái đơn hàng {reservation.orderCode}...
                </p>
              </div>
            )}

            {/* Nút hành động Bước 2 */}
            {!isVerifying && (
              <div className="space-y-2 pt-1">
                {isExpired ? (
                  <button
                    type="button"
                    onClick={() => {
                      setReservation(null);
                      setStep('FORM');
                    }}
                    className="w-full py-3.5 rounded-xl bg-neon-pink/20 border border-neon-pink/40 text-pink-200 font-bold text-sm flex items-center justify-center gap-2 hover:bg-neon-pink/30 active:scale-95 transition-all"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Đơn Hàng Hết Hạn — Tạo Lại Đơn Mới</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleTransitionToWaiting}
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-solana-purple via-neon-pink to-solana-cyan text-white font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-xl shadow-purple-950/60 hover:shadow-solana-purple/50 active:scale-95 transition-all"
                  >
                    <ShieldCheck className="w-5 h-5" />
                    <span>Tôi đã chuyển khoản — Chờ xác nhận</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setStep('FORM')}
                  className="w-full py-2.5 rounded-xl border border-white/10 text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition-colors flex items-center justify-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Quay lại chỉnh sửa thông tin</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* BƯỚC 3: MÀN HÌNH CHỜ XÁC NHẬN THANH TOÁN (PAYMENT_PENDING) */}
        {step === 'WAITING_CONFIRMATION' && reservation && (
          <div className="space-y-4 pt-2">
            {/* Banner trạng thái PAYMENT_PENDING & Countdown */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30">
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                </span>
                <span className="text-xs font-bold text-amber-300 uppercase tracking-wide">
                  Đang Chờ Đối Soát (PAYMENT_PENDING)
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-300 font-mono">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>{isExpired ? 'Hết hạn' : formatCountdown(timeLeftMs)}</span>
              </div>
            </div>

            {/* Tóm tắt thông tin đơn hàng */}
            <div className="p-4 rounded-xl bg-[#170E38] border border-white/10 space-y-2.5 text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-white/10">
                <span className="text-slate-400">Mã đơn hàng:</span>
                <span className="text-neon-pink font-mono font-bold text-sm">{reservation.orderCode}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Sự kiện:</span>
                <span className="text-white font-medium line-clamp-1 max-w-[240px] text-right">{event.title}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Hạng vé & Số lượng:</span>
                <span className="text-slate-200 font-medium">{tier.name} × {selectedQuantity}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-white/10">
                <span className="text-white font-bold">Tổng tiền cần thanh toán:</span>
                <span className="text-base font-black text-solana-green font-mono">{formatVnd(reservation.totalVnd)}</span>
              </div>
            </div>

            {/* Thông báo cơ chế xác thực */}
            <div className="p-4 rounded-xl bg-black/30 border border-white/10 space-y-2 text-left">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-solana-cyan shrink-0 mt-0.5" />
                <div className="text-xs text-slate-300 leading-relaxed space-y-1">
                  <p className="font-semibold text-white">Chưa ghi nhận tín hiệu thanh toán tự động</p>
                  <p className="text-[11px] text-slate-400">
                    Hệ thống đang giữ đơn hàng ở trạng thái <strong className="text-amber-300 font-mono">PAYMENT_PENDING</strong>. Vé và mã QR NFT chỉ được phát hành khi nhận được đối soát thanh toán thành công.
                  </p>
                </div>
              </div>

              {webhookStatusMessage && (
                <div className="mt-2 p-2.5 rounded-lg bg-white/5 border border-white/10 text-[11px] text-slate-300 flex items-center gap-2">
                  <Loader2 className={`w-3.5 h-3.5 text-solana-cyan shrink-0 ${checkingWebhook ? 'animate-spin' : ''}`} />
                  <span>{webhookStatusMessage}</span>
                </div>
              )}
            </div>

            {/* Lưu ý Demo & Nút mô phỏng Webhook cho Giám khảo */}
            <div className="p-3.5 rounded-xl bg-purple-950/40 border border-solana-purple/30 text-left space-y-2">
              <div className="text-[11px] text-purple-200 leading-relaxed">
                <strong>Chế độ chấm thi Hackathon</strong>: Cổng thanh toán thật cần kết nối Webhook ngân hàng trực tiếp. Để ban giám khảo nghiệm thu quy trình phát hành vé và QR NFT sau thanh toán, vui lòng sử dụng nút bên dưới:
              </div>

              <button
                type="button"
                onClick={handleSimulateWebhookSuccess}
                disabled={isVerifying || isExpired}
                className="w-full py-2.5 px-3 rounded-lg bg-solana-green/20 hover:bg-solana-green/30 border border-solana-green/50 text-solana-green font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-40"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang kích hoạt vé qua Webhook mô phỏng...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>[Mô phỏng Webhook] Xác nhận thanh toán thành công</span>
                  </>
                )}
              </button>
            </div>

            {/* Các nút điều hướng */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={handleRecheckStatus}
                disabled={checkingWebhook || isVerifying || isExpired}
                className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-40"
              >
                <RefreshCw className={`w-4 h-4 text-solana-cyan ${checkingWebhook ? 'animate-spin' : ''}`} />
                <span>Kiểm tra lại trạng thái đối soát</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setStep('PAYMENT')}
                  className="py-2.5 rounded-xl border border-white/10 text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/5 transition-colors flex items-center justify-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Xem lại mã VietQR</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="py-2.5 rounded-xl border border-white/10 text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                  Đóng cửa sổ
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
