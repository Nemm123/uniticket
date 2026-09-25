import React from 'react';
import { ShieldCheck, Zap, Repeat, Award, Sparkles } from 'lucide-react';
import { useTranslation } from '../../i18n';

export const NFTBenefits: React.FC = () => {
  const { t } = useTranslation();

  const benefits = [
    {
      icon: ShieldCheck,
      title: t('nftBenefits.antiScalpingTitle'),
      desc: t('nftBenefits.antiScalpingDesc'),
      color: 'from-solana-purple to-purple-600',
      badge: 'Solana Mint',
    },
    {
      icon: Zap,
      title: t('nftBenefits.checkInTitle'),
      desc: t('nftBenefits.checkInDesc'),
      color: 'from-solana-green to-emerald-600',
      badge: '< 400ms',
    },
    {
      icon: Repeat,
      title: t('nftBenefits.priceProtectionTitle'),
      desc: t('nftBenefits.priceProtectionDesc'),
      color: 'from-neon-pink to-rose-600',
      badge: 'Smart Contract',
    },
    {
      icon: Award,
      title: t('nftBenefits.digitalSouvenirTitle'),
      desc: t('nftBenefits.digitalSouvenirDesc'),
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
            <span>{t('nftBenefits.badge')}</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
            {t('nftBenefits.title')} <span className="text-gradient-solana">{t('nftBenefits.titleGradient')}</span>
          </h2>
          <p className="text-xs sm:text-base text-slate-300 mt-2 max-w-2xl mx-auto leading-relaxed">
            {t('nftBenefits.subtitle')}
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
