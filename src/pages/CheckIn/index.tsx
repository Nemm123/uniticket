import React, { useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, Keyboard, RefreshCw, ScanLine, ShieldAlert, Ticket, XCircle } from 'lucide-react';
import QrScanner from 'qr-scanner';
import { CheckInResult, PurchasedTicket, UserRole } from '../../types';
import { confirmTicketCheckIn, getStoredPurchasedTickets, validateTicketForCheckIn } from '../../utils/storage';

interface CheckInPageProps {
  currentRole: UserRole | null;
  organizerAddress: string | null;
  onShowToast: (type: 'success' | 'error' | 'info', message: string) => void;
  onTicketsChanged: () => void;
}

type TicketFilter = 'all' | 'checked-in' | 'unused';
const ticketIsCheckedIn = (ticket: PurchasedTicket) => ticket.isCheckedIn || ticket.status === 'checked_in' || ticket.status === 'CHECKED_IN';

export const CheckInPage: React.FC<CheckInPageProps> = ({ currentRole, organizerAddress, onShowToast, onTicketsChanged }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const processingRef = useRef(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualPayload, setManualPayload] = useState('');
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [tickets, setTickets] = useState<PurchasedTicket[]>(() => getStoredPurchasedTickets());
  const [filter, setFilter] = useState<TicketFilter>('all');
  const [search, setSearch] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);

  const refreshTickets = () => setTickets(getStoredPurchasedTickets());

  const validateInput = (input: string) => {
    if (processingRef.current || currentRole !== 'organizer') return;
    processingRef.current = true;
    const validation = validateTicketForCheckIn(input);
    setResult(validation);
    setCameraEnabled(false);
    scannerRef.current?.stop();
    processingRef.current = false;
    onShowToast(validation.status === 'valid' ? 'info' : 'error', validation.message);
  };

  useEffect(() => {
    if (!cameraEnabled || !videoRef.current) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera is not supported in this browser. Paste the QR payload below instead.');
      setCameraEnabled(false);
      return;
    }
    const scanner = new QrScanner(videoRef.current, (scanResult) => validateInput(scanResult.data), {
      preferredCamera: 'environment', maxScansPerSecond: 5, highlightScanRegion: true, highlightCodeOutline: true,
    });
    scannerRef.current = scanner;
    setCameraError(null);
    void scanner.start().catch(() => {
      setCameraError('Camera permission was denied or the camera is unavailable. Paste the QR payload below instead.');
      setCameraEnabled(false);
    });
    return () => { void scanner.destroy(); scannerRef.current = null; };
  }, [cameraEnabled]);

  const confirmCheckIn = () => {
    if (!result?.ticket || !organizerAddress || currentRole !== 'organizer') {
      onShowToast('error', 'Connect an organizer wallet before confirming check-in.');
      return;
    }
    setIsConfirming(true);
    const confirmation = confirmTicketCheckIn(result.ticket.id, organizerAddress);
    setResult(confirmation);
    setIsConfirming(false);
    refreshTickets();
    onTicketsChanged();
    onShowToast(confirmation.status === 'valid' ? 'success' : 'error', confirmation.message);
  };

  if (currentRole !== 'organizer') {
    return <div className="min-h-screen py-10 cyber-grid-bg"><div className="mx-auto max-w-xl rounded-2xl border border-neon-pink/40 bg-[#120B30] p-8 text-center shadow-2xl"><ShieldAlert className="mx-auto h-10 w-10 text-neon-pink" /><h1 className="mt-3 text-2xl font-extrabold text-white">Access Denied</h1><p className="mt-2 text-sm text-slate-300">Only the Organizer role can validate and confirm demo ticket check-in.</p></div></div>;
  }

  const query = search.trim().toLowerCase();
  const visibleTickets = tickets.filter((ticket) => {
    const matchesFilter = filter === 'all' || (filter === 'checked-in' ? ticketIsCheckedIn(ticket) : !ticketIsCheckedIn(ticket));
    return matchesFilter && (!query || ticket.ticketCode.toLowerCase().includes(query) || ticket.id.toLowerCase().includes(query));
  });
  const resultStyle = result?.status === 'valid' ? 'border-solana-green/50 bg-solana-green/10 text-solana-green' : result?.status === 'used' ? 'border-yellow-400/50 bg-yellow-400/10 text-yellow-100' : 'border-neon-pink/50 bg-neon-pink/10 text-neon-pink';

  return <div className="min-h-screen py-8 sm:py-12 cyber-grid-bg"><div className="mx-auto max-w-5xl space-y-6 px-4 sm:px-6 lg:px-8 animate-fadeIn">
    <header className="border-b border-white/10 pb-6"><div className="mb-3 inline-flex items-center gap-2 rounded-full border border-solana-cyan/30 bg-solana-cyan/10 px-3 py-1 text-xs font-semibold text-solana-cyan"><ScanLine className="h-4 w-4" />Organizer Console</div><h1 className="text-2xl font-extrabold text-white sm:text-4xl">Event <span className="text-gradient-solana">Check-in</span></h1><p className="mt-2 text-xs leading-relaxed text-slate-300 sm:text-sm">Validate a demo QR ticket first, then actively confirm check-in. No blockchain transaction is created.</p><p className="mt-3 text-xs text-solana-cyan">Organizer: {organizerAddress ? `${organizerAddress.slice(0, 4)}...${organizerAddress.slice(-4)}` : 'Wallet not connected'}</p></header>
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.15fr_0.85fr]">
      <section className="rounded-2xl border border-solana-purple/30 bg-[#120B30] p-4 shadow-2xl sm:p-6"><div className="mb-4 flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Camera className="h-5 w-5 text-solana-cyan" /><h2 className="font-bold text-white">Camera scanner</h2></div>{cameraEnabled && <button type="button" onClick={() => setCameraEnabled(false)} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-white/10 px-3 text-xs text-slate-300 hover:bg-white/5"><XCircle className="h-4 w-4" />Stop scanner</button>}</div><div className="relative aspect-video overflow-hidden rounded-xl border border-white/10 bg-black/50"><video ref={videoRef} className="h-full w-full object-cover" muted playsInline />{!cameraEnabled && <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center"><ScanLine className="h-10 w-10 text-solana-purple" /><p className="text-xs text-slate-400">Start the camera only when ready to scan.</p><button type="button" onClick={() => { setResult(null); setCameraEnabled(true); }} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-solana-purple to-neon-pink px-4 py-2.5 text-xs font-bold text-white"><Camera className="h-4 w-4" />Start Camera Scanner</button></div>}</div>{cameraError && <p className="mt-3 rounded-xl border border-yellow-400/30 bg-yellow-950/30 p-3 text-xs text-yellow-100">{cameraError}</p>}</section>
      <section className="rounded-2xl border border-solana-purple/30 bg-[#120B30] p-4 shadow-2xl sm:p-6"><div className="mb-4 flex items-center gap-2"><Keyboard className="h-5 w-5 text-solana-cyan" /><h2 className="font-bold text-white">Manual validation</h2></div><form onSubmit={(event) => { event.preventDefault(); validateInput(manualPayload); }} className="space-y-3"><label htmlFor="qr-payload" className="block text-xs font-semibold text-slate-200">QR payload JSON</label><textarea id="qr-payload" value={manualPayload} onChange={(event) => setManualPayload(event.target.value)} placeholder="Paste the QR payload" rows={5} className="w-full rounded-xl border border-white/15 bg-black/40 px-3.5 py-3 text-sm text-white outline-none focus:border-solana-purple" /><button type="submit" disabled={!manualPayload.trim()} className="w-full min-h-11 rounded-xl bg-gradient-to-r from-solana-purple to-neon-pink px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">Validate QR</button></form></section>
    </div>
    {result && <section className={`rounded-2xl border p-5 ${resultStyle}`} role="status"><div className="flex items-start gap-3">{result.status === 'valid' ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <ShieldAlert className="h-5 w-5 shrink-0" />}<div className="min-w-0 flex-1"><p className="font-bold">{result.message}</p>{result.ticket && <div className="mt-4 grid grid-cols-1 gap-2 text-xs text-slate-100 sm:grid-cols-2"><p>Event: {result.ticket.eventTitle}</p><p>Tier: {result.ticket.tierName}</p><p className="break-all">Ticket ID: {result.ticket.id}</p><p>Ticket code: {result.ticket.ticketCode}</p><p>Customer: {result.ticket.customerName}</p><p>Status: {ticketIsCheckedIn(result.ticket) ? 'Checked-in' : 'Unused'}</p><p>Created: {new Date(result.ticket.purchasedAt).toLocaleString('vi-VN')}</p>{result.ticket.checkInTime && <p>Checked-in: {new Date(result.ticket.checkInTime).toLocaleString('vi-VN')}</p>}{result.ticket.checkedInBy && <p className="break-all">Checked-in by: {result.ticket.checkedInBy}</p>}</div>}{result.status === 'valid' && <button type="button" onClick={confirmCheckIn} disabled={isConfirming || !organizerAddress} className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-gradient-to-r from-solana-green to-solana-cyan px-4 py-2.5 text-sm font-bold text-[#070412] disabled:cursor-not-allowed disabled:opacity-40">{isConfirming ? 'Confirming...' : 'Confirm Check-in'}</button>}</div></div></section>}
    <section className="rounded-2xl border border-white/10 bg-[#120B30] p-4 shadow-xl sm:p-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><h2 className="font-bold text-white">Demo ticket history</h2><button type="button" onClick={refreshTickets} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 px-3 text-xs text-slate-300 hover:bg-white/5"><RefreshCw className="h-4 w-4" />Refresh</button></div><div className="mt-4 flex flex-col gap-3 sm:flex-row"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search ticket code or ID" className="min-h-11 flex-1 rounded-xl border border-white/15 bg-black/30 px-3 text-sm text-white outline-none focus:border-solana-purple" /><div className="flex gap-2">{(['all', 'checked-in', 'unused'] as TicketFilter[]).map((item) => <button key={item} type="button" onClick={() => setFilter(item)} className={`min-h-11 rounded-xl px-3 text-xs font-semibold ${filter === item ? 'bg-solana-purple text-white' : 'border border-white/10 text-slate-300'}`}>{item}</button>)}</div></div><div className="mt-4 space-y-2">{visibleTickets.map((ticket) => <div key={ticket.id} className="flex flex-col gap-1 rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-slate-300 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="font-mono text-white">{ticket.ticketCode}</p><p className="truncate">{ticket.customerName} · {ticket.eventTitle}</p></div><div className="text-left sm:text-right"><p className={ticketIsCheckedIn(ticket) ? 'text-solana-green' : 'text-yellow-200'}>{ticketIsCheckedIn(ticket) ? 'Checked-in' : 'Unused'}</p>{ticket.checkInTime && <p>{new Date(ticket.checkInTime).toLocaleString('vi-VN')}</p>}{ticket.checkedInBy && <p className="max-w-40 truncate">By: {ticket.checkedInBy}</p>}</div></div>)}{visibleTickets.length === 0 && <p className="py-4 text-center text-xs text-slate-400">No matching demo tickets.</p>}</div></section>
    <p className="flex items-start gap-2 rounded-xl border border-solana-green/20 bg-solana-green/5 p-4 text-xs leading-relaxed text-slate-300"><Ticket className="mt-0.5 h-4 w-4 shrink-0 text-solana-green" />This is a localStorage demo only. It is not a blockchain signature, fraud-prevention system, or multi-device check-in backend.</p>
  </div></div>;
};
