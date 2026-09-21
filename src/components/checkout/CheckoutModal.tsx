import React, { useEffect, useState } from 'react';
import { X, Ticket, Sparkles, ShieldCheck, User, Mail, Minus, Plus } from 'lucide-react';
import { EventItem, TicketTier, PurchasedTicket } from '../../types';
import { getStoredPurchasedTickets, savePurchaseAtomically } from '../../utils/storage';
import { createTicketsApi } from '../../services/ticketsApi';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: EventItem;
  tier: TicketTier;
  quantity: number;
  walletAddress?: string;
  onSuccess: (ticketsCreated: PurchasedTicket[]) => void;
  onError: (msg: string) => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  event,
  tier,
  quantity,
  walletAddress,
  onSuccess,
  onError,
}) => {
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [selectedQuantity, setSelectedQuantity] = useState(quantity);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setSelectedQuantity(Math.max(1, Math.min(quantity, tier.remainingQuantity)));
  }, [quantity, tier.id, tier.remainingQuantity]);

  if (!isOpen) return null;

  const totalTicketPriceSol = parseFloat((tier.priceSol * selectedQuantity).toFixed(4));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = customerName.trim();
    const trimmedEmail = customerEmail.trim();

    if (!Number.isInteger(selectedQuantity) || selectedQuantity <= 0) {
      onError('Số lượng vé phải lớn hơn 0.');
      return;
    }
    if (!walletAddress) {
      onError('Vui lòng kết nối Phantom trước khi mua vé.');
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
      // Tạo mã đơn hàng chung và mã riêng cho từng vé.
      const orderId = `ORD-${createUniqueValue('order')}`;
      const existingTickets = getStoredPurchasedTickets();
      const usedTicketIds = new Set(existingTickets.map((ticket) => ticket.id));
      const usedTicketCodes = new Set(existingTickets.map((ticket) => ticket.ticketCode));
      const newTickets: PurchasedTicket[] = [];
      for (let i = 0; i < selectedQuantity; i++) {
        const ticketId = createUniqueValue('tkt', usedTicketIds);
        const ticketCode = createUniqueValue('UT-SOL', usedTicketCodes);
        const timestamp = Date.now();
        const seatPrefix = tier.name.toLowerCase().includes('vip') ? 'VIP-ROW' : 'GA-ZONE';
        const seat = `${seatPrefix}-${Math.floor(1 + Math.random() * 20)}-${String(i + 1).padStart(2, '0')}`;

        // Cấu trúc dữ liệu JSON mã hóa trong QR
        const qrPayload = JSON.stringify({
          ticketId,
          orderId,
          eventId: event.id,
          tierId: tier.id,
          ticketCode,
          customerName: trimmedName,
          customerWallet: walletAddress,
          seat,
          timestamp,
          signatureVersion: 'mock-v1',
        });

        newTickets.push({
          id: ticketId,
          orderId,
          eventId: event.id,
          eventTitle: event.title,
          eventBanner: event.bannerImage,
          venue: event.venue,
          city: event.city,
          date: event.date,
          time: event.time,
          tierId: tier.id,
          tierName: tier.name,
          seat,
          priceSol: tier.priceSol,
          ticketCode,
          customerName: trimmedName,
          customerEmail: trimmedEmail,
          customerWallet: walletAddress,
          purchasedAt: new Date().toISOString(),
          purchaseDate: new Date().toISOString(),
          status: 'valid',
          isCheckedIn: false,
          timestamp,
          signatureVersion: 'mock-v1',
          checkInStatus: 'unused',
          qrPayload,
        });
      }

      let finalTickets = newTickets;
      try {
        const backendTickets = await createTicketsApi(newTickets);
        if (backendTickets && backendTickets.length > 0) {
          finalTickets = backendTickets;
        }
      } catch (apiErr) {
        console.warn('[UniTicket Checkout] Backend sync issue, falling back to local snapshot:', apiErr);
      }

      const isPurchaseSaved = savePurchaseAtomically(event.id, tier.id, selectedQuantity, finalTickets);
      if (!isPurchaseSaved) {
        setIsSubmitting(false);
        onError('Không thể lưu đơn hàng. Tồn kho và các vé đã mua trước đó được giữ nguyên.');
        return;
      }

      setIsSubmitting(false);
      onClose();
      onSuccess(finalTickets);
    } catch {
      setIsSubmitting(false);
      onError('Đã xảy ra sự cố khi hoàn tất mua vé.');
    }
  };

  function createUniqueValue(prefix: string, usedValues?: Set<string>): string {
    let value = '';
    do {
      const uniquePart = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
      value = `${prefix}-${uniquePart}`;
    } while (usedValues?.has(value));
    usedValues?.add(value);
    return value;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md transition-all">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative w-full max-w-lg rounded-2xl bg-[#0F0A28] border border-solana-purple/40 p-5 sm:p-7 shadow-2xl shadow-purple-950/80 z-10 overflow-hidden animate-scaleUp text-left max-h-[90vh] overflow-y-auto">
        {/* Glow decoration */}
        <div className="absolute -top-24 -right-24 w-52 h-52 bg-solana-purple/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-52 h-52 bg-solana-green/20 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-solana-purple to-neon-pink text-white shadow-lg">
              <Ticket className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                Xác Nhận Đặt Vé NFT
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-solana-purple/30 border border-solana-purple/50 text-purple-200">
                  Mô Phỏng
                </span>
              </h3>
              <p className="text-xs text-slate-300">Tạo vé NFT độc bản vào ví cá nhân</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-300 hover:text-white hover:bg-white/10 active:scale-95 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notice Banner */}
        <div className="my-4 p-3 rounded-xl bg-purple-950/50 border border-solana-purple/40 text-xs text-purple-200 flex items-start gap-2.5">
          <Sparkles className="w-4 h-4 text-solana-green shrink-0 mt-0.5 animate-pulse" />
          <div className="space-y-0.5">
            <p className="font-semibold text-white">Thanh Toán & Phát Hành Mô Phỏng</p>
            <p className="text-slate-300 leading-relaxed text-[11px]">
              Đây là quy trình mô phỏng. Hệ thống tạo {selectedQuantity} vé và lưu trên thiết bị của bạn; không trừ SOL thật và chưa mint NFT.
            </p>
          </div>
        </div>

        {/* Order Summary */}
        <div className="p-4 rounded-xl bg-[#170E38] border border-white/10 space-y-3 mb-5">
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
              <span className="text-slate-400 block text-[11px]">Số lượng:</span>
              <strong className="text-white block mt-0.5">{selectedQuantity} vé</strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Đơn giá:</span>
              <span className="text-slate-200 block mt-0.5 font-mono">{tier.priceSol} SOL / vé</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Tạm tính:</span>
              <span className="text-white block mt-0.5 font-mono font-bold">{totalTicketPriceSol} SOL</span>
            </div>
          </div>

          <div className="pt-2 border-t border-white/10 flex items-center justify-between">
            <span className="text-xs font-bold text-white">Tổng cộng thanh toán:</span>
            <span className="text-lg font-black text-solana-green font-mono">
              {totalTicketPriceSol} SOL
            </span>
          </div>
        </div>

        <div className="mb-5 flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-4 py-3">
          <div>
            <span className="block text-xs font-semibold text-white">Số lượng vé</span>
            <span className="text-[11px] text-slate-400">Còn lại: {tier.remainingQuantity}</span>
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

        {/* Form nhập thông tin khách hàng */}
        <form onSubmit={handleSubmit} className="space-y-4">
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
              disabled={isSubmitting}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-solana-purple via-neon-pink to-solana-cyan text-white font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-xl shadow-purple-950/60 hover:shadow-solana-purple/50 active:scale-95 transition-all disabled:opacity-50"
            >
              <ShieldCheck className="w-5 h-5" />
              <span>
                {isSubmitting ? 'Đang Tạo Vé Mô Phỏng...' : `Xác Nhận Mua ${selectedQuantity} Vé`}
              </span>
            </button>
            <p className="text-center text-[11px] text-slate-400 mt-2">
              Bằng cách nhấn xác nhận, bạn đồng ý với điều khoản mô phỏng của cuộc thi UniHackFest.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};
