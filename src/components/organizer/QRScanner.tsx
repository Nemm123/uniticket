import React, { useEffect, useRef } from 'react';
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode';
import { Camera, XCircle } from 'lucide-react';

interface QRScannerProps {
  onScanSuccess: (decodedText: string) => void;
  isEnabled: boolean;
  onClose: () => void;
}

export const QRScanner: React.FC<QRScannerProps> = ({ onScanSuccess, isEnabled, onClose }) => {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    if (!isEnabled) {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
        scannerRef.current = null;
      }
      return;
    }

    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      { 
        fps: 10, 
        qrbox: { width: 250, height: 250 },
        supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
        rememberLastUsedCamera: true,
      },
      false
    );

    scannerRef.current = scanner;

    scanner.render(
      (decodedText) => {
        // Debounce or stop to prevent multiple scans
        if (scannerRef.current) {
          scannerRef.current.pause(true);
        }
        onScanSuccess(decodedText);
      },
      () => {
        // silence error
      }
    );

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
        scannerRef.current = null;
      }
    };
  }, [isEnabled, onScanSuccess]);

  if (!isEnabled) return null;

  return (
    <div className="relative w-full max-w-md mx-auto bg-black/50 border border-white/10 rounded-xl overflow-hidden shadow-2xl">
      <div className="flex justify-between items-center p-3 border-b border-white/10 bg-[#120B30]">
        <div className="flex items-center gap-2">
          <Camera className="w-4 h-4 text-solana-cyan" />
          <span className="text-sm font-semibold text-white">Scanner</span>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
          <XCircle className="w-5 h-5" />
        </button>
      </div>
      <div id="qr-reader" className="w-full text-slate-200 [&_button]:bg-solana-purple [&_button]:text-white [&_button]:px-4 [&_button]:py-2 [&_button]:rounded-xl [&_button]:font-semibold [&_select]:bg-black [&_select]:text-white [&_select]:p-2 [&_select]:rounded-lg [&_select]:border [&_select]:border-white/20 [&_video]:w-full [&_video]:rounded-b-xl" />

    </div>
  );
};
