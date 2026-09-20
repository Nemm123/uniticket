import React from 'react';
import { ShieldCheck, Zap, Repeat, Award, Sparkles } from 'lucide-react';

export const NFTBenefits: React.FC = () => {
  const benefits = [
    {
      icon: ShieldCheck,
      title: 'Chống Vé Giả 100%',
      desc: 'Mỗi vé là một token NFT độc nhất được ghi nhận minh bạch trên sổ cái Solana. Không thể sao chép, làm giả hay chụp màn hình bán nhiều lần.',
      color: 'from-solana-purple to-purple-600',
      badge: 'Solana Mint',
    },
    {
      icon: Zap,
      title: 'Check-in Tức Thì',
      desc: 'Mã QR động xác thực ví chỉ trong 400ms tại cổng soát vé, giúp giải tỏa ùn tắc hàng ngàn khán giả tại sân vận động.',
      color: 'from-solana-green to-emerald-600',
      badge: '< 400ms',
    },
    {
      icon: Repeat,
      title: 'Bảo Vệ Giá & Chống Phe Vé',
      desc: 'Quy định trần giá bán lại và tự động chia sẻ tiền bản quyền (Royalty Fee) về cho ban tổ chức cùng nghệ sĩ khi vé sang tay.',
      color: 'from-neon-pink to-rose-600',
      badge: 'Smart Contract',
    },
    {
      icon: Award,
      title: 'Kỷ Niệm Số Độc Bản',
      desc: 'Sau concert, vé NFT biến thành kỷ niệm chương số có thể airdrop quà tặng, merchandise độc quyền và ưu tiên mua vé show tiếp theo.',
      color: 'from-solana-cyan to-blue-600',
      badge: 'Fan Rewards',
    },
  ];

  return (
    <section className="py-14 sm:py-20 relative z-10 border-t border-white/10 bg-[#0A051C]/70">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-solana-purple/20 border border-solana-purple/40 text-[11px] sm:text-xs font-semibold text-solana-cyan mb-3">
            <Sparkles className="w-3.5 h-3.5 text-solana-green" />
            <span>TẠI SAO CHỌN VÉ NFT SOLANA?</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
            Giải Quyết Nỗi Lo <span className="text-gradient-solana">Của Bán Vé Truyền Thống</span>
          </h2>
          <p className="text-xs sm:text-base text-slate-300 mt-2 max-w-2xl mx-auto leading-relaxed">
            Công nghệ Web3 mang lại sự minh bạch, công bằng và trải nghiệm đẳng cấp cho cả khán giả lẫn nhà tổ chức sự kiện.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
          {benefits.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="rounded-2xl bg-[#120B30]/90 border border-white/10 hover:border-solana-purple/50 p-5 sm:p-6 transition-all duration-300 hover:-translate-y-1 shadow-lg relative group overflow-hidden hover:shadow-purple-950/40"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-tr ${item.color} flex items-center justify-center text-white shadow-md`}>
                    <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-300 shrink-0">
                    {item.badge}
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-white mb-2 group-hover:text-solana-cyan transition-colors break-words">
                  {item.title}
                </h3>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed break-words">
                  {item.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
