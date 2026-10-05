import React, { useState, useEffect, useCallback } from 'react';
import { X, Award, CheckCircle2, Sparkles, Zap, Shield, Gift, Flame } from 'lucide-react';
import confetti from 'canvas-confetti';

interface FanQuestModalProps {
  isOpen: boolean;
  onClose: () => void;
  walletAddress?: string | null;
  onPointsUpdated?: (newPoints: number) => void;
}

export const getFanPoints = (wallet?: string | null): number => {
  if (typeof window === 'undefined') return 0;
  const key = `uniticket_fan_points_${(wallet || 'guest').toLowerCase()}`;
  const val = localStorage.getItem(key);
  return val ? Number(val) || 0 : 0;
};

export const addFanPoints = (amount: number, wallet?: string | null): number => {
  if (typeof window === 'undefined') return amount;
  const key = `uniticket_fan_points_${(wallet || 'guest').toLowerCase()}`;
  const current = getFanPoints(wallet);
  const updated = current + amount;
  localStorage.setItem(key, String(updated));
  window.dispatchEvent(new CustomEvent('uniticket-fan-points-updated', { detail: { points: updated } }));
  return updated;
};

export const FanQuestModal: React.FC<FanQuestModalProps> = ({
  isOpen,
  onClose,
  walletAddress,
  onPointsUpdated,
}) => {
  const walletKey = (walletAddress || 'guest').toLowerCase();
  const [points, setPoints] = useState<number>(() => getFanPoints(walletAddress));
  const [completedQuests, setCompletedQuests] = useState<string[]>([]);
  const [redeemedPerks, setRedeemedPerks] = useState<string[]>([]);

  // State answers for Quest 1
  const [q1Answers, setQ1Answers] = useState<{ [qIndex: number]: number }>({});
  const [q1Error, setQ1Error] = useState<string | null>(null);

  // State answers for Quest 2
  const [q2Answers, setQ2Answers] = useState<{ [qIndex: number]: number }>({});
  const [q2Error, setQ2Error] = useState<string | null>(null);

  // State notification
  const [rewardCelebration, setRewardCelebration] = useState<string | null>(null);

  // Load completed quests and points from localStorage
  const loadState = useCallback(() => {
    const currentPts = getFanPoints(walletAddress);
    setPoints(currentPts);

    try {
      const savedQuests = localStorage.getItem(`uniticket_completed_quests_${walletKey}`);
      if (savedQuests) {
        setCompletedQuests(JSON.parse(savedQuests));
      } else {
        setCompletedQuests([]);
      }

      const savedPerks = localStorage.getItem(`uniticket_redeemed_perks_${walletKey}`);
      if (savedPerks) {
        setRedeemedPerks(JSON.parse(savedPerks));
      } else {
        setRedeemedPerks([]);
      }
    } catch {
      // safe fallback
    }
  }, [walletAddress, walletKey]);

  useEffect(() => {
    if (isOpen) {
      loadState();
      setQ1Error(null);
      setQ2Error(null);
      setRewardCelebration(null);
    }
  }, [isOpen, loadState]);

  // Listen for global point update events
  useEffect(() => {
    const handleUpdate = () => {
      setPoints(getFanPoints(walletAddress));
    };
    window.addEventListener('uniticket-fan-points-updated', handleUpdate);
    return () => window.removeEventListener('uniticket-fan-points-updated', handleUpdate);
  }, [walletAddress]);

  if (!isOpen) return null;

  const triggerConfetti = () => {
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#9945FF', '#14F195', '#00F5FF', '#FF007A', '#FFD700'],
      });
    } catch {
      // safe fallback
    }
  };

  // Submit Quest 1
  const handleSubmitQuest1 = () => {
    if (completedQuests.includes('quest-1')) return;

    if (q1Answers[0] === undefined || q1Answers[1] === undefined) {
      setQ1Error('Vui lòng chọn đáp án cho cả 2 câu hỏi trước khi nhận thưởng.');
      return;
    }

    // Correct: Q1 -> index 1 (30 Anh Trai), Q2 -> index 1 (Tự động làm mới chu kỳ 20s...)
    if (q1Answers[0] !== 1 || q1Answers[1] !== 1) {
      setQ1Error('Có câu trả lời chưa chính xác. Bạn hãy thử lại để nhận 50 UniPoint nhé!');
      return;
    }

    setQ1Error(null);
    const newPts = addFanPoints(50, walletAddress);
    setPoints(newPts);
    onPointsUpdated?.(newPts);

    const nextCompleted = [...completedQuests, 'quest-1'];
    setCompletedQuests(nextCompleted);
    localStorage.setItem(`uniticket_completed_quests_${walletKey}`, JSON.stringify(nextCompleted));

    triggerConfetti();
    setRewardCelebration('🎉 Chúc mừng! Bạn nhận được +50 UniPoint từ Quest "Hiểu Nghệ Sĩ Trong 60s"!');
  };

  // Submit Quest 2
  const handleSubmitQuest2 = () => {
    if (completedQuests.includes('quest-2')) return;

    if (q2Answers[0] === undefined) {
      setQ2Error('Vui lòng chọn đáp án trước khi nhận thưởng.');
      return;
    }

    // Correct: Q1 -> index 0 (Phí giao dịch siêu rẻ (<0.001$) và thời gian xác thực chỉ 400ms)
    if (q2Answers[0] !== 0) {
      setQ2Error('Đáp án chưa chính xác. Hãy chọn lại ưu thế của Solana để nhận 100 UniPoint!');
      return;
    }

    setQ2Error(null);
    const newPts = addFanPoints(100, walletAddress);
    setPoints(newPts);
    onPointsUpdated?.(newPts);

    const nextCompleted = [...completedQuests, 'quest-2'];
    setCompletedQuests(nextCompleted);
    localStorage.setItem(`uniticket_completed_quests_${walletKey}`, JSON.stringify(nextCompleted));

    triggerConfetti();
    setRewardCelebration('🎉 Chúc mừng! Bạn nhận được +100 UniPoint từ Quest "Khám Phá Solana Devnet"!');
  };

  // Redeem Perk
  const handleRedeemPerk = (perkId: string, requiredPoints: number) => {
    if (redeemedPerks.includes(perkId)) return;
    if (points < requiredPoints) return;

    const nextPerks = [...redeemedPerks, perkId];
    setRedeemedPerks(nextPerks);
    localStorage.setItem(`uniticket_redeemed_perks_${walletKey}`, JSON.stringify(nextPerks));
    triggerConfetti();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="fan-quest-title"
      className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl rounded-3xl border border-purple-500/40 bg-gradient-to-b from-[#160B3A] via-[#0E0728] to-[#0A051C] p-5 sm:p-7 shadow-2xl text-left shadow-purple-950/80 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow ambient background */}
        <div className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-solana-purple/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-solana-green/15 blur-3xl" />

        {/* Header modal */}
        <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-solana-purple/20 border border-solana-purple/40 text-[11px] font-bold text-solana-cyan mb-1.5">
              <Sparkles className="w-3.5 h-3.5 text-solana-green animate-pulse" />
              <span>Engage-to-Earn Hub</span>
            </div>
            <h2 id="fan-quest-title" className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <span>🎯 Fan Quest Hub</span>
            </h2>
            <p className="text-xs text-slate-300 mt-1">
              Hoàn thành các nhiệm vụ ngắn để nhận <span className="text-yellow-300 font-bold">UniPoint</span> và mở khóa đặc quyền VIP!
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all shrink-0 active:scale-95"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* UniPoint Balance Card */}
        <div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-purple-950/50 via-[#180E3D] to-indigo-950/50 border border-purple-500/30 shadow-lg flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-yellow-500 via-amber-400 to-yellow-200 p-0.5 shadow-md flex items-center justify-center shrink-0">
              <div className="w-full h-full bg-[#120B30] rounded-[14px] flex items-center justify-center">
                <Award className="w-6 h-6 text-yellow-300" />
              </div>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 font-medium block">Số dư UniPoint của ví</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-black text-yellow-300 font-mono tracking-tight">
                  {points}
                </span>
                <span className="text-xs font-bold text-yellow-400/80 font-mono">pts</span>
              </div>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-300 block">
              {walletAddress ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}` : 'Ví Guest'}
            </span>
            <span className="text-[10px] text-solana-green font-semibold mt-1 inline-flex items-center gap-1">
              <Zap className="w-3 h-3" />
              <span>Sẵn sàng đổi quà</span>
            </span>
          </div>
        </div>

        {/* Celebration Banner */}
        {rewardCelebration && (
          <div className="mt-3.5 p-3 rounded-xl bg-solana-green/15 border border-solana-green/40 text-solana-green text-xs font-semibold flex items-center gap-2 animate-bounce">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-solana-green" />
            <span>{rewardCelebration}</span>
          </div>
        )}

        {/* Danh sách Nhiệm Vụ (Quests) */}
        <div className="mt-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-solana-cyan flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-neon-pink" />
              <span>Nhiệm vụ nhận thưởng (Quests)</span>
            </h3>
            <span className="text-[11px] text-slate-400 font-mono">
              Hoàn thành: {completedQuests.length}/2
            </span>
          </div>

          {/* QUEST 1: Hiểu Nghệ Sĩ Trong 60s */}
          <div className={`p-4 sm:p-5 rounded-2xl border transition-all ${
            completedQuests.includes('quest-1')
              ? 'bg-solana-green/5 border-solana-green/30'
              : 'bg-white/5 border-purple-500/25 hover:border-purple-500/50'
          }`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Âm nhạc & Thần tượng
                </span>
                <h4 className="text-sm font-bold text-white mt-1">
                  1. Hiểu Nghệ Sĩ Trong 60s
                </h4>
                <p className="text-xs text-slate-300 mt-0.5">
                  Trả lời 2 câu trắc nghiệm nhanh về sự kiện để nhận thưởng UniPoint.
                </p>
              </div>

              {completedQuests.includes('quest-1') ? (
                <span className="px-2.5 py-1 rounded-full bg-solana-green/20 border border-solana-green/40 text-[11px] font-bold text-solana-green flex items-center gap-1 shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Đã hoàn thành ✅</span>
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-full bg-yellow-500/20 border border-yellow-500/40 text-[11px] font-extrabold text-yellow-300 font-mono shrink-0">
                  +50 pts
                </span>
              )}
            </div>

            {!completedQuests.includes('quest-1') && (
              <div className="mt-3.5 space-y-3 pt-3 border-t border-white/10 text-xs">
                {/* Câu 1 */}
                <div>
                  <p className="font-semibold text-slate-200">
                    Câu 1: Sự kiện "Anh Trai Say Hi 2026" quy tụ bao nhiêu nghệ sĩ tài năng tham gia?
                  </p>
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {['10 Anh Trai', '30 Anh Trai', '50 Anh Trai'].map((opt, idx) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setQ1Answers((prev) => ({ ...prev, 0: idx }))}
                        className={`px-3 py-2 rounded-xl border text-left font-medium transition-all ${
                          q1Answers[0] === idx
                            ? 'bg-solana-purple/30 border-solana-cyan text-white shadow-md'
                            : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Câu 2 */}
                <div>
                  <p className="font-semibold text-slate-200">
                    Câu 2: Mã vé check-in Dynamic QR trên UniTicket có đặc tính công nghệ chống vé giả nào?
                  </p>
                  <div className="mt-2 grid grid-cols-1 gap-2">
                    {[
                      'Mã QR tĩnh gửi dạng ảnh qua tin nhắn Zalo / Email',
                      'Tự động làm mới chu kỳ 20s và ký xác thực Ed25519 chống chụp màn hình',
                      'In mã vạch đen trắng truyền thống trên giấy nhiệt',
                    ].map((opt, idx) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setQ1Answers((prev) => ({ ...prev, 1: idx }))}
                        className={`px-3 py-2 rounded-xl border text-left font-medium transition-all ${
                          q1Answers[1] === idx
                            ? 'bg-solana-purple/30 border-solana-cyan text-white shadow-md'
                            : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                {q1Error && (
                  <p className="text-red-400 text-xs font-semibold">{q1Error}</p>
                )}

                <button
                  type="button"
                  onClick={handleSubmitQuest1}
                  className="w-full mt-2 py-2.5 rounded-xl bg-gradient-to-r from-solana-purple to-neon-pink text-white font-bold text-xs shadow-md shadow-purple-950/60 hover:opacity-95 active:scale-[0.99] transition-all flex items-center justify-center gap-1.5"
                >
                  <Gift className="w-3.5 h-3.5" />
                  <span>Xác nhận & Nhận Thưởng (+50 UniPoint)</span>
                </button>
              </div>
            )}
          </div>

          {/* QUEST 2: Khám Phá Solana Devnet */}
          <div className={`p-4 sm:p-5 rounded-2xl border transition-all ${
            completedQuests.includes('quest-2')
              ? 'bg-solana-green/5 border-solana-green/30'
              : 'bg-white/5 border-purple-500/25 hover:border-purple-500/50'
          }`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-solana-cyan/20 text-solana-cyan border border-solana-cyan/30">
                  Web3 & Solana Tech
                </span>
                <h4 className="text-sm font-bold text-white mt-1">
                  2. Khám Phá Solana Devnet
                </h4>
                <p className="text-xs text-slate-300 mt-0.5">
                  Tìm hiểu vì sao công nghệ Blockchain Solana là giải pháp hoàn hảo cho vé minh bạch.
                </p>
              </div>

              {completedQuests.includes('quest-2') ? (
                <span className="px-2.5 py-1 rounded-full bg-solana-green/20 border border-solana-green/40 text-[11px] font-bold text-solana-green flex items-center gap-1 shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Đã hoàn thành ✅</span>
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-full bg-yellow-500/20 border border-yellow-500/40 text-[11px] font-extrabold text-yellow-300 font-mono shrink-0">
                  +100 pts
                </span>
              )}
            </div>

            {!completedQuests.includes('quest-2') && (
              <div className="mt-3.5 space-y-3 pt-3 border-t border-white/10 text-xs">
                <div>
                  <p className="font-semibold text-slate-200">
                    Câu hỏi: Ưu thế vượt trội của mạng Solana trong việc phân phối và chống vé chợ đen là gì?
                  </p>
                  <div className="mt-2 grid grid-cols-1 gap-2">
                    {[
                      'Phí giao dịch siêu rẻ (<0.001$) và thời gian xác thực chỉ 400ms',
                      'Phí giao dịch đắt đỏ 50$ mỗi lần thanh toán',
                      'Mất 15 đến 30 phút mới hoàn tất một giao dịch chuyển vé',
                    ].map((opt, idx) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setQ2Answers((prev) => ({ ...prev, 0: idx }))}
                        className={`px-3 py-2 rounded-xl border text-left font-medium transition-all ${
                          q2Answers[0] === idx
                            ? 'bg-solana-purple/30 border-solana-cyan text-white shadow-md'
                            : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                {q2Error && (
                  <p className="text-red-400 text-xs font-semibold">{q2Error}</p>
                )}

                <button
                  type="button"
                  onClick={handleSubmitQuest2}
                  className="w-full mt-2 py-2.5 rounded-xl bg-gradient-to-r from-[#9945FF] to-[#14F195] text-white font-bold text-xs shadow-md shadow-purple-950/60 hover:opacity-95 active:scale-[0.99] transition-all flex items-center justify-center gap-1.5"
                >
                  <Gift className="w-3.5 h-3.5" />
                  <span>Xác nhận & Nhận Thưởng (+100 UniPoint)</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* KHU VỰC ĐẶC QUYỀN UNIPOINT */}
        <div className="mt-6 pt-5 border-t border-white/10 space-y-3">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-yellow-300 flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-yellow-400" />
            <span>Đặc quyền đổi thưởng UniPoint</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Đặc quyền 1: Giảm 50% phí sàn */}
            <div className="p-3.5 rounded-2xl border border-white/10 bg-white/5 flex flex-col justify-between space-y-2.5">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-solana-cyan bg-solana-cyan/15 px-2 py-0.5 rounded border border-solana-cyan/30">
                    Phí sàn 5% → 2.5%
                  </span>
                  <span className="text-xs font-mono font-bold text-yellow-300">150 pts</span>
                </div>
                <h4 className="text-xs font-bold text-white mt-1.5">Giảm 50% phí sàn Marketplace</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Áp dụng giảm trừ tự động cho giao dịch bán vé thứ cấp tiếp theo.
                </p>
              </div>

              {redeemedPerks.includes('perk-fee') ? (
                <div className="w-full py-1.5 rounded-xl bg-solana-green/20 text-solana-green text-[11px] font-bold text-center border border-solana-green/40">
                  Đã kích hoạt ✨
                </div>
              ) : (
                <button
                  type="button"
                  disabled={points < 150}
                  onClick={() => handleRedeemPerk('perk-fee', 150)}
                  className="w-full py-1.5 rounded-xl bg-solana-purple/20 hover:bg-solana-purple/40 border border-solana-purple/40 text-solana-cyan text-[11px] font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {points >= 150 ? 'Kích hoạt ưu đãi' : `Cần thêm ${150 - points} pts`}
                </button>
              )}
            </div>

            {/* Đặc quyền 2: Đổi vé Fast-lane Check-in */}
            <div className="p-3.5 rounded-2xl border border-white/10 bg-white/5 flex flex-col justify-between space-y-2.5">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-neon-pink bg-neon-pink/15 px-2 py-0.5 rounded border border-neon-pink/30">
                    Lối đi VIP riêng
                  </span>
                  <span className="text-xs font-mono font-bold text-yellow-300">300 pts</span>
                </div>
                <h4 className="text-xs font-bold text-white mt-1.5">Đổi vé Fast-lane Check-in</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Đặc quyền vào cửa nhanh tại cổng soát vé không cần xếp hàng chờ.
                </p>
              </div>

              {redeemedPerks.includes('perk-fastlane') ? (
                <div className="w-full py-1.5 rounded-xl bg-solana-green/20 text-solana-green text-[11px] font-bold text-center border border-solana-green/40">
                  Đã nhận thẻ 🎟️
                </div>
              ) : (
                <button
                  type="button"
                  disabled={points < 300}
                  onClick={() => handleRedeemPerk('perk-fastlane', 300)}
                  className="w-full py-1.5 rounded-xl bg-solana-purple/20 hover:bg-solana-purple/40 border border-solana-purple/40 text-solana-cyan text-[11px] font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {points >= 300 ? 'Nhận thẻ Fast-lane' : `Cần thêm ${300 - points} pts`}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
