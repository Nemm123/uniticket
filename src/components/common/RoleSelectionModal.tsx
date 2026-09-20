import React, { useEffect, useState } from 'react';
import { Building2, CheckCircle2, UserRound, X } from 'lucide-react';
import { UserRole } from '../../types';

interface RoleSelectionModalProps {
  isOpen: boolean;
  currentRole: UserRole | null;
  onClose: () => void;
  onContinue: (role: UserRole) => void;
}

const roleOptions: Array<{
  role: UserRole;
  title: string;
  description: string;
  icon: typeof UserRound;
  features: string[];
}> = [
  {
    role: 'attendee',
    title: 'Attendee',
    description: 'Discover events, purchase tickets and access your digital tickets.',
    icon: UserRound,
    features: ['Browse events', 'Purchase tickets', 'View My Tickets', 'Display QR code', 'View ticket status'],
  },
  {
    role: 'organizer',
    title: 'Organizer',
    description: 'Create and manage events, tickets and event check-in.',
    icon: Building2,
    features: ['Create events', 'Manage ticket inventory', 'View event information', 'Access check-in tools', 'View mock sales statistics'],
  },
];

export const RoleSelectionModal: React.FC<RoleSelectionModalProps> = ({
  isOpen,
  currentRole,
  onClose,
  onContinue,
}) => {
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(currentRole);

  useEffect(() => {
    if (isOpen) setSelectedRole(currentRole);
  }, [isOpen, currentRole]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-md">
      <div className="relative my-4 w-full max-w-3xl rounded-2xl border border-solana-purple/40 bg-[#0F0A28] p-5 shadow-2xl shadow-purple-950/70 sm:p-7">
        <div className="absolute -right-20 -top-20 h-44 w-44 rounded-full bg-solana-purple/20 blur-3xl" />
        <div className="relative flex items-start justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-solana-cyan">UniTicket access</p>
            <h2 className="text-xl font-extrabold text-white sm:text-2xl">How do you want to use UniTicket?</h2>
            <p className="mt-1 text-xs text-slate-300">You can switch roles later. This demo role is stored locally on this device.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close role selection"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-300 hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          {roleOptions.map((option) => {
            const Icon = option.icon;
            const isSelected = selectedRole === option.role;
            return (
              <button
                type="button"
                key={option.role}
                onClick={() => setSelectedRole(option.role)}
                className={`rounded-2xl border p-4 text-left transition-all sm:p-5 ${
                  isSelected
                    ? 'border-solana-cyan bg-solana-purple/20 shadow-lg shadow-solana-purple/20'
                    : 'border-white/10 bg-[#171038]/80 hover:border-solana-purple/60 hover:bg-[#21164A]'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${isSelected ? 'bg-solana-cyan/20 text-solana-cyan' : 'bg-white/10 text-slate-300'}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  {isSelected && <CheckCircle2 className="h-5 w-5 text-solana-green" />}
                </div>
                <h3 className="mt-4 text-lg font-bold text-white">{option.title}</h3>
                <p className="mt-1 min-h-10 text-xs leading-relaxed text-slate-300">{option.description}</p>
                <ul className="mt-4 space-y-2 text-xs text-slate-300">
                  {option.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-solana-green" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>

        <div className="relative mt-6 flex flex-col-reverse gap-3 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 px-5 py-3 text-sm font-semibold text-slate-300 hover:bg-white/5 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!selectedRole}
            onClick={() => selectedRole && onContinue(selectedRole)}
            className="rounded-xl bg-gradient-to-r from-solana-purple via-neon-pink to-solana-cyan px-5 py-3 text-sm font-bold text-white shadow-lg shadow-purple-950/50 transition-all hover:shadow-solana-purple/50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
};
