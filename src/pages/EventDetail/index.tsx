import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Users,
  Sparkles,
  CheckCircle2,
  Plus,
  Minus,
  ShieldAlert,
  Ticket
} from 'lucide-react';
import { getStoredEvents, saveStoredEvents } from '../../utils/storage';
import { EventItem, TicketTier, PurchasedTicket } from '../../types';
import { CheckoutModal } from '../../components/checkout/CheckoutModal';
import { getEvent as getEventFromApi, isApiEventId } from '../../services/eventsApi';

interface EventDetailPageProps {
  onShowToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const EventDetailPage: React.FC<EventDetailPageProps> = ({ onShowToast }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Đọc danh sách sự kiện với tồn kho mới nhất
  const localEvent = useMemo(() => getStoredEvents().find((item) => item.id === id), [id]);
  const [event, setEvent] = useState<EventItem | undefined>(localEvent);
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  // State chọn hạng vé và số lượng
  const [selectedTierId, setSelectedTierId] = useState<string>(() => {
    return event?.tiers?.[0]?.id || '';
  });
  const [quantity, setQuantity] = useState<number>(1);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    setEvent(localEvent);
    setSelectedTierId(localEvent?.tiers?.[0]?.id || '');
    setQuantity(1);
    setApiError(null);
    setIsLoading(true);
    if (!id || !isApiEventId(id)) {
      setIsLoading(false);
      return () => { cancelled = true; };
    }
    getEventFromApi(id)
      .then((remoteEvent) => {
        if (cancelled) return;
        setEvent(remoteEvent);
        setSelectedTierId(remoteEvent.tiers?.[0]?.id || '');
        const localEvents = getStoredEvents();
        saveStoredEvents([remoteEvent, ...localEvents.filter((item) => item.id !== remoteEvent.id)]);
      })
      .catch((error: unknown) => {
        if (!cancelled) setApiError(error instanceof Error ? error.message : 'Could not load event details from the API.');
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [id, localEvent]);

  if (!event) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-4 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-neon-pink/20 border border-neon-pink/40 flex items-center justify-center text-neon-pink">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-white">Không tìm thấy sự kiện</h2>
        <p className="text-xs sm:text-sm text-slate-300 max-w-md">
          Sự kiện với mã định danh "{id}" không tồn tại hoặc đã bị gỡ bỏ khỏi hệ thống.
        </p>
        <Link
          to="/events"
          className="px-6 py-2.5 rounded-xl bg-solana-purple text-white font-semibold text-xs hover:bg-purple-600 transition-colors inline-flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Quay lại Danh Sách Sự Kiện</span>
        </Link>
      </div>
    );
  }

  const selectedTier: TicketTier = event.tiers?.find((t) => t.id === selectedTierId) || event.tiers?.[0] || {
    id: 'default',
    name: 'Standard Ticket',
    priceSol: event.minPriceSol,
    description: 'Vé tiêu chuẩn',
    perks: ['Vé NFT kỷ niệm trên Solana'],
    totalQuantity: 1000,
    remainingQuantity: 500,
  };

  const isSoldOut = selectedTier.remainingQuantity <= 0;
  const totalPriceSol = parseFloat((selectedTier.priceSol * quantity).toFixed(4));

  const handleIncrease = () => {
    if (quantity < selectedTier.remainingQuantity) {
      setQuantity((prev) => prev + 1);
    } else {
      onShowToast('error', `Số lượng vé còn lại của hạng này chỉ còn ${selectedTier.remainingQuantity} vé.`);
    }
  };

  const handleDecrease = () => {
    if (quantity > 1) {
      setQuantity((prev) => prev - 1);
    }
  };

  const handleTierSelect = (tierId: string) => {
    setSelectedTierId(tierId);
    setQuantity(1); // Reset số lượng về 1 khi đổi hạng vé
  };

  const handleOpenCheckout = () => {
    if (isSoldOut) {
      onShowToast('error', 'Hạng vé này đã hết. Vui lòng chọn hạng vé khác.');
      return;
    }
    if (quantity > selectedTier.remainingQuantity) {
      onShowToast('error', `Vượt quá số lượng vé còn lại (${selectedTier.remainingQuantity} vé).`);
      return;
    }
    setIsCheckoutOpen(true);
  };

  const handleCheckoutSuccess = (tickets: PurchasedTicket[]) => {
    onShowToast('success', `Chúc mừng! Bạn đã mua thành công ${tickets.length} vé cho ${event.title}!`);
    navigate('/my-tickets');
  };

  return (
    <div className="min-h-screen py-8 sm:py-12 relative z-10 cyber-grid-bg">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 animate-fadeIn">
        {isLoading && <div role="status" className="rounded-xl border border-solana-cyan/30 bg-solana-cyan/10 px-4 py-3 text-xs text-solana-cyan">Đang tải chi tiết từ Events API…</div>}
        {apiError && <div role="status" className="rounded-xl border border-solana-purple/30 bg-solana-purple/10 px-4 py-3 text-xs text-slate-200">Không tải được chi tiết từ Events API; đang dùng bản sự kiện đã lưu trên thiết bị.</div>}
        {/* Nút quay lại */}
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-solana-cyan transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Quay lại</span>
        </button>

        {/* Banner lớn & Tiêu đề */}
        <div className="rounded-3xl bg-[#120B30] border border-solana-purple/30 overflow-hidden shadow-2xl">
          <div className="relative h-64 sm:h-96">
            <img
              src={event.bannerImage}
              alt={event.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#120B30] via-[#120B30]/50 to-transparent" />
            <div className="absolute bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-6 space-y-2 min-w-0">
              <span className="inline-block px-3 py-1 rounded-full bg-black/70 border border-solana-green/40 text-solana-green text-xs font-bold shrink-0">
                {event.category}
              </span>
              <h1 className="text-2xl sm:text-4xl font-extrabold text-white break-words line-clamp-2 sm:line-clamp-none">
                {event.title}
              </h1>
              <p className="text-xs sm:text-sm text-slate-200 line-clamp-2 max-w-2xl break-words">
                {event.subtitle}
              </p>
            </div>
          </div>

          <div className="p-5 sm:p-8 space-y-8 min-w-0">
            {/* 3 Khối thông tin thời gian, địa điểm, BTC */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 p-4 rounded-2xl bg-[#1A1040]/80 border border-white/10 min-w-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2.5 rounded-xl bg-solana-purple/20 text-solana-purple shrink-0">
                  <Calendar className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] text-slate-400">Thời gian</div>
                  <div className="text-xs sm:text-sm font-bold text-white truncate block">{event.date}</div>
                  <div className="text-[11px] text-slate-300 truncate block">{event.time}</div>
                </div>
              </div>

              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2.5 rounded-xl bg-neon-pink/20 text-neon-pink shrink-0">
                  <MapPin className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] text-slate-400">Địa điểm</div>
                  <div className="text-xs sm:text-sm font-bold text-white truncate block">{event.venue}</div>
                  <div className="text-[11px] text-slate-300 truncate block">{event.city}</div>
                </div>
              </div>

              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2.5 rounded-xl bg-solana-green/20 text-solana-green shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] text-slate-400">Ban tổ chức</div>
                  <div className="text-xs sm:text-sm font-bold text-white truncate block">{event.organizer.name}</div>
                  <div className="text-[11px] text-solana-green truncate block">Đã xác minh Web3 ✓</div>
                </div>
              </div>
            </div>

            {/* Mô tả sự kiện */}
            <div className="space-y-3 min-w-0">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-solana-cyan shrink-0" />
                <span>Giới Thiệu Sự Kiện</span>
              </h3>
              <p className="text-slate-300 leading-relaxed text-xs sm:text-sm text-wrap-safe break-words">
                {event.description}
              </p>
            </div>

            {/* Line-up nghệ sĩ */}
            {event.lineup && event.lineup.length > 0 && (
              <div className="space-y-3 min-w-0">
                <h3 className="text-base sm:text-lg font-bold text-white">Nghệ Sĩ Biểu Diễn (Line-up)</h3>
                <div className="flex flex-wrap gap-2">
                  {event.lineup.map((artist, idx) => (
                    <span
                      key={idx}
                      className="px-3.5 py-1.5 rounded-xl bg-[#1C1242] border border-solana-purple/30 text-xs font-semibold text-slate-200"
                    >
                      🎵 {artist}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* KHU VỰC CHỌN VÉ VÀ SỐ LƯỢNG (TICKET SELECTOR) */}
            <div className="space-y-6 pt-6 border-t border-white/10">
              <div>
                <h3 className="text-xl sm:text-2xl font-extrabold text-white">
                  Chọn Hạng Vé <span className="text-gradient-solana">& Đặt Mua NFT</span>
                </h3>
                <p className="text-xs sm:text-sm text-slate-300 mt-1">
                  Chọn hạng vé mong muốn và điều chỉnh số lượng. Tổng tiền SOL sẽ được tính tự động.
                </p>
              </div>

              {/* Lưới các hạng vé */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {event.tiers?.map((tier) => {
                  const isSelected = selectedTierId === tier.id;
                  const tierSoldOut = tier.remainingQuantity <= 0;

                  return (
                    <div
                      key={tier.id}
                      onClick={() => !tierSoldOut && handleTierSelect(tier.id)}
                      className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between space-y-4 min-w-0 ${
                        tierSoldOut
                          ? 'bg-[#150D2E]/50 border-white/5 opacity-60 cursor-not-allowed'
                          : isSelected
                          ? 'bg-[#1C1145] border-solana-green shadow-xl shadow-solana-green/20 scale-[1.02]'
                          : 'bg-[#170E38] border-white/10 hover:border-solana-purple/50'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex justify-between items-start mb-2 gap-2 min-w-0">
                          <span className="text-sm font-bold text-white break-words min-w-0 flex-1">
                            {tier.name}
                          </span>
                          <span
                            className={`text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded shrink-0 ${
                              tierSoldOut
                                ? 'bg-red-950 text-red-400 border border-red-800'
                                : 'bg-solana-green/10 text-solana-green border border-solana-green/20'
                            }`}
                          >
                            {tierSoldOut ? 'HẾT VÉ' : `Còn ${tier.remainingQuantity} vé`}
                          </span>
                        </div>

                        <div className="text-2xl font-black text-solana-cyan mb-2 font-mono">
                          {tier.priceSol} SOL
                        </div>

                        <p className="text-xs text-slate-300 mb-3 break-words leading-relaxed">
                          {tier.description}
                        </p>

                        <ul className="space-y-1.5 text-xs text-slate-300 min-w-0">
                          {tier.perks.map((p, idx) => (
                            <li key={idx} className="flex items-start gap-1.5 min-w-0">
                              <CheckCircle2 className="w-3.5 h-3.5 text-solana-green shrink-0 mt-0.5" />
                              <span className="break-words min-w-0 flex-1">{p}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="pt-2 border-t border-white/5">
                        <span
                          className={`text-xs font-semibold block text-center py-1.5 rounded-lg ${
                            isSelected
                              ? 'bg-solana-green/20 text-solana-green'
                              : 'text-slate-400 group-hover:text-white'
                          }`}
                        >
                          {isSelected ? '✓ Đang Chọn' : 'Bấm Để Chọn Hạng Này'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bộ đếm số lượng & Bảng tính tiền trực tiếp */}
              <div className="p-5 sm:p-6 rounded-2xl bg-[#171038] border border-solana-purple/30 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl">
                <div className="space-y-1 text-center sm:text-left w-full sm:w-auto">
                  <span className="text-xs text-slate-400 block">Hạng vé đang chọn:</span>
                  <span className="text-base sm:text-lg font-bold text-white block">
                    {selectedTier.name} ({selectedTier.priceSol} SOL / vé)
                  </span>
                  <span className="text-xs text-solana-green block">
                    Tồn kho khả dụng: {selectedTier.remainingQuantity} vé
                  </span>
                </div>

                {/* Counter + / - */}
                <div className="flex items-center gap-4">
                  <span className="text-xs font-semibold text-slate-300">Số lượng:</span>
                  <div className="flex items-center gap-2 bg-[#0B0620] p-1 rounded-xl border border-white/10">
                    <button
                      onClick={handleDecrease}
                      disabled={quantity <= 1 || isSoldOut}
                      aria-label="Giảm số lượng vé"
                      className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-10 text-center font-mono font-bold text-base text-white">
                      {quantity}
                    </span>
                    <button
                      onClick={handleIncrease}
                      disabled={quantity >= selectedTier.remainingQuantity || isSoldOut}
                      aria-label="Tăng số lượng vé"
                      className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Tổng tiền & Nút Mua */}
                <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
                  <div className="text-center sm:text-right">
                    <span className="text-xs text-slate-400 block">Tổng tiền tạm tính:</span>
                    <span className="text-2xl font-black text-solana-green font-mono">
                      {totalPriceSol} SOL
                    </span>
                  </div>

                  <button
                    onClick={handleOpenCheckout}
                    disabled={isSoldOut}
                    className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-gradient-to-r from-solana-purple via-neon-pink to-solana-cyan text-white font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-xl shadow-purple-950/60 hover:shadow-solana-purple/50 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                  >
                    <Ticket className="w-5 h-5" />
                    <span>{isSoldOut ? 'HẾT VÉ' : `Tiến Hành Đặt ${quantity} Vé`}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Thanh toán Checkout */}
        <CheckoutModal
          isOpen={isCheckoutOpen}
          onClose={() => setIsCheckoutOpen(false)}
          event={event}
          tier={selectedTier}
          quantity={quantity}
          onSuccess={handleCheckoutSuccess}
          onError={(msg) => onShowToast('error', msg)}
        />
      </div>
    </div>
  );
};
