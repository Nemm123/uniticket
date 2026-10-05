import React from 'react';
import { ArrowUpRight, Zap } from 'lucide-react';

interface LiveActivityBannerProps {
  onNavigateMarketplace?: () => void;
}

const ACTIVITIES = [
  {
    id: 'act-1',
    wallet: '0x7a...4b',
    action: 'vừa mua vé',
    event: 'Neon Horizon 2026',
    price: '0.05 SOL',
    detail: '10% Royalty (0.005 SOL) đã chuyển tức thì đến ví Ban tổ chức',
    badge: 'Giới hạn: 1/2',
    badgeColor: 'text-yellow-300 border-yellow-500/40 bg-yellow-950/40',
  },
  {
    id: 'act-2',
    wallet: '0x9c...3e',
    action: 'vừa chấp nhận Escrow P2P',
    event: 'Tech Fest 2026',
    price: '0.08 SOL',
    detail: 'Chuyển nhượng an toàn 2 bước thành công qua Smart Contract',
    badge: '2/2 Locked',
    badgeColor: 'text-red-300 border-red-500/40 bg-red-950/40',
  },
  {
    id: 'act-3',
    wallet: '0x3f...8a',
    action: 'vừa niêm yết vé',
    event: 'Solana Vietnam Tour',
    price: '0.12 SOL',
    detail: 'Phân bổ 85% Người bán • 10% Royalty BTC • 5% UniTicket',
    badge: 'Chợ Vé Thứ Cấp',
    badgeColor: 'text-solana-cyan border-solana-cyan/40 bg-solana-cyan/10',
  },
  {
    id: 'act-4',
    wallet: '0x1e...9d',
    action: 'vừa check-in vé Dynamic QR',
    event: 'Devnet Summit',
    price: '0.00 SOL',
    detail: 'Xác thực Ed25519 On-chain tự làm mới 20s chống chụp màn hình',
    badge: 'Check-In OK',
    badgeColor: 'text-solana-green border-solana-green/40 bg-solana-green/10',
  },
];

export const LiveActivityBanner: React.FC<LiveActivityBannerProps> = ({ onNavigateMarketplace }) => {
  return (
    <div
      role="region"
      aria-label="Web3 Live Activity Ticker"
      className="relative z-20 w-full bg-[#09041a]/95 backdrop-blur-md border-b border-purple-500/20 text-xs shadow-sm overflow-hidden"
    >
      <div className="max-w-7xl mx-auto flex items-center h-9 px-3 sm:px-6">
        {/* Fixed LIVE ACTIVITY Badge */}
        <div className="flex items-center gap-2 shrink-0 pr-3 sm:pr-4 border-r border-white/10 z-10 bg-[#09041a]/95">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-solana-green opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-solana-green" />
          </span>
          <span className="text-[10px] font-black tracking-wider text-solana-green uppercase flex items-center gap-1 font-mono">
            <Zap className="w-3 h-3 text-solana-green inline" />
            <span>LIVE ACTIVITY</span>
          </span>
        </div>

        {/* Marquee Ticker Track */}
        <div className="flex-1 overflow-hidden relative h-full flex items-center">
          <div className="animate-marquee flex items-center gap-8 pl-4 select-none">
            {/* Sequence 1 */}
            {ACTIVITIES.map((act) => (
              <div key={act.id} className="flex items-center gap-2 text-slate-300 text-[11px] sm:text-xs shrink-0">
                <span className="font-mono font-bold text-white bg-white/5 px-1.5 py-0.5 rounded border border-white/10">
                  {act.wallet}
                </span>
                <span className="text-slate-400">{act.action}</span>
                <span className="font-semibold text-white">{act.event}</span>
                <span className="font-mono font-extrabold text-solana-green">({act.price})</span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-300 hidden md:inline">{act.detail}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${act.badgeColor}`}>
                  {act.badge}
                </span>
                <span className="text-purple-500/50 text-xs font-bold pl-2">✦</span>
              </div>
            ))}

            {/* Sequence 2 for continuous loop */}
            {ACTIVITIES.map((act) => (
              <div key={`loop-${act.id}`} className="flex items-center gap-2 text-slate-300 text-[11px] sm:text-xs shrink-0">
                <span className="font-mono font-bold text-white bg-white/5 px-1.5 py-0.5 rounded border border-white/10">
                  {act.wallet}
                </span>
                <span className="text-slate-400">{act.action}</span>
                <span className="font-semibold text-white">{act.event}</span>
                <span className="font-mono font-extrabold text-solana-green">({act.price})</span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-300 hidden md:inline">{act.detail}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${act.badgeColor}`}>
                  {act.badge}
                </span>
                <span className="text-purple-500/50 text-xs font-bold pl-2">✦</span>
              </div>
            ))}
          </div>

          {/* Fade gradients at edges */}
          <div className="pointer-events-none absolute left-0 inset-y-0 w-6 bg-gradient-to-r from-[#09041a] to-transparent" />
          <div className="pointer-events-none absolute right-0 inset-y-0 w-8 bg-gradient-to-l from-[#09041a] to-transparent" />
        </div>

        {/* Quick CTA to secondary market */}
        {onNavigateMarketplace && (
          <button
            type="button"
            onClick={onNavigateMarketplace}
            className="hidden sm:inline-flex items-center gap-1 pl-3 border-l border-white/10 text-[11px] font-bold text-neon-pink hover:text-pink-300 transition-colors shrink-0 z-10 bg-[#09041a]/95 group"
          >
            <span>Săn vé Chợ</span>
            <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </button>
        )}
      </div>
    </div>
  );
};
