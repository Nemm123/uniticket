import React, { useEffect, useRef, useState } from 'react';
import QrScanner from 'qr-scanner';
// Html5Qrcode fallback reference: optimized with native BarcodeDetector and QrScanner engine
import { Camera, XCircle, Loader2, AlertCircle, CameraOff, Lock, RefreshCw, ShieldAlert } from 'lucide-react';

interface QRScannerProps {
  onScanSuccess: (decodedText: string) => void;
  isEnabled: boolean;
  onClose: () => void;
  facingMode?: string;
  onToggleCamera?: () => void;
  onError?: (error: string) => void;
}

const QRScannerComponent: React.FC<QRScannerProps> = ({
  onScanSuccess,
  isEnabled,
  onClose,
  onError,
}) => {
  const onScanSuccessRef = useRef(onScanSuccess);
  onScanSuccessRef.current = onScanSuccess;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<any>(null);
  const isOpeningCameraRef = useRef(false);
  const [isStarting, setIsStarting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [hasPermissionGranted, setHasPermissionGranted] = useState(false);
  const hasPermissionGrantedRef = useRef(false);

  const isScanLockedRef = useRef(false);
  const [isScanLocked, setIsScanLocked] = useState(false);
  const onScan = (result: string) => {
    if (isScanLockedRef.current) return;
    isScanLockedRef.current = true;
    setIsScanLocked(true);
    onScanSuccess(result);
    onScanSuccessRef.current?.(result);
    setTimeout(() => {
      isScanLockedRef.current = false;
      setIsScanLocked(false);
    }, 2500);
  };

  const stopExistingTracks = () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => {
          track.enabled = false;
          track.stop();
        });
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current && videoRef.current.srcObject instanceof MediaStream) {
        videoRef.current.srcObject.getTracks().forEach((track) => {
          track.enabled = false;
          track.stop();
        });
        videoRef.current.srcObject = null;
      }
      const videoEl = document.querySelector('#qr-reader video') as HTMLVideoElement | null;
      if (videoEl && videoEl.srcObject instanceof MediaStream) {
        videoEl.srcObject.getTracks().forEach((track) => {
          track.enabled = false;
          track.stop();
        });
        videoEl.srcObject = null;
      }
    } catch {}
  };

  const startScanner = async () => {
    if (isOpeningCameraRef.current) return;
    isOpeningCameraRef.current = true;
    setIsStarting(true);
    setCameraError(null);
    setPermissionDenied(false);

    try {
      // Duy trì luồng stream đang hoạt động tốt
      const isLive = Boolean(
        streamRef.current &&
        streamRef.current.active &&
        streamRef.current.getVideoTracks().some((t) => t.readyState === 'live')
      );
      if (isLive) {
        if (videoRef.current && videoRef.current.srcObject !== streamRef.current) {
          videoRef.current.srcObject = streamRef.current;
          videoRef.current.setAttribute('playsinline', 'true');
          videoRef.current.muted = true;
          await videoRef.current.play().catch((e) => console.error('Video play error:', e));
        }
        return;
      }

      // 1. Trước khi mở stream mới, dừng triệt để toàn bộ track camera đang chạy ngầm:
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => {
          track.enabled = false;
          track.stop();
        });
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
      stopExistingTracks();

      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        throw new Error('Trình duyệt không hỗ trợ MediaDevices API.');
      }

      // Cố định cấu hình camera duy nhất (ưu tiên camera sau của thiết bị để quét mã):
      const constraints = {
        video: { facingMode: 'environment' },
        audio: false
      };

      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (idealErr) {
        console.warn('[QRScanner] Camera sau không khả dụng, thử fallback tuần tự:', idealErr);
        try {
          // Bước 1: Thử exact
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { exact: 'environment' } },
            audio: false
          });
        } catch (step1Err) {
          try {
            // Bước 2: Thử soft
            stream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: 'environment' },
              audio: false
            });
          } catch (step2Err) {
            // Bước 3: Nếu thiết bị không có camera sau, tự động fallback an toàn về { video: true }
            stream = await navigator.mediaDevices.getUserMedia({ video: true });
          }
        }
      }

      if (!stream) {
        throw new Error('Không nhận được luồng MediaStream từ thiết bị.');
      }

      streamRef.current = stream;
      hasPermissionGrantedRef.current = true;
      setHasPermissionGranted(true);

      // 2. GẮN STREAM VÀO THẺ VIDEO CHUẨN DI ĐỘNG:
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.muted = true;
        await videoRef.current.play().catch((e) => console.error('Video play error:', e));
      }

      // Khởi chạy vòng lặp phát hiện mã QR
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
      }

      scanIntervalRef.current = setInterval(async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) return;

        // Ưu tiên native BarcodeDetector của trình duyệt
        if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
          try {
            const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
            const barcodes = await detector.detect(videoRef.current);
            if (barcodes.length > 0 && barcodes[0]?.rawValue) {
              onScan(barcodes[0].rawValue);
              return;
            }
          } catch {}
        }

        // Fallback sang QrScanner engine
        try {
          const res = await QrScanner.scanImage(videoRef.current, { returnDetailedScanResult: true });
          if (res && res.data) {
            onScan(res.data);
            return;
          }
        } catch {}
      }, 200);

    } catch (err: any) {
      console.error('[QRScanner] Lỗi mở camera:', err);
      const errName = err?.name || '';
      const errMsg = String(err?.message || err || '');

      if (
        errName === 'NotAllowedError' ||
        errName === 'PermissionDeniedError' ||
        /not allowed|permission denied|denied/i.test(errMsg)
      ) {
        setPermissionDenied(true);
        const deniedMsg =
          "Trình duyệt đang chặn quyền Camera. Vui lòng bấm vào icon Ổ khóa (hoặc Cài đặt trang web) trên thanh địa chỉ > Chọn 'Quyền' > Đổi Camera sang 'Cho phép' > Nhấn nút 'Thử lại' bên dưới.";
        // Trình duyệt chưa được cấp quyền truy cập Camera. Vui lòng bấm vào icon Ổ Khóa trên thanh địa chỉ để cấp quyền.
        setCameraError(deniedMsg);
        onErrorRef.current?.(deniedMsg);
        onError?.(deniedMsg);
      } else if (
        errName === 'NotFoundError' ||
        errName === 'DevicesNotFoundError' ||
        /not found|no device|devicesnotfound/i.test(errMsg)
      ) {
        const notFoundMsg = 'Không tìm thấy thiết bị Camera trên thiết bị này.';
        setCameraError(notFoundMsg);
        onErrorRef.current?.(notFoundMsg);
        onError?.(notFoundMsg);
      } else {
        const otherMsg = err?.message || 'Không thể truy cập camera. Vui lòng kiểm tra lại thiết bị.';
        setCameraError(otherMsg);
        onErrorRef.current?.(otherMsg);
        onError?.(otherMsg);
      }
    } finally {
      isOpeningCameraRef.current = false;
      setIsStarting(false);
    }
  };

  const handleRetryPermission = async () => {
    setPermissionDenied(false);
    setCameraError(null);
    setIsStarting(true);
    setRetryCount((prev) => prev + 1);
    await startScanner();
  };

  // Chỉ dọn dẹp track khi component thực sự unmount hoàn toàn
  useEffect(() => {
    return () => {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => {
          track.enabled = false;
          track.stop();
        });
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      stopExistingTracks();
    };
  }, []);

  useEffect(() => {
    if (!isEnabled) {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
      stopExistingTracks();
      return;
    }

    void startScanner();
  }, [isEnabled, retryCount]);

  if (!isEnabled) return null;

  return (
    <div className="relative w-full bg-black/70 border border-solana-purple/30 rounded-xl overflow-hidden shadow-2xl">
      <div className="flex justify-between items-center p-3 border-b border-white/10 bg-[#120B30]">
        <div className="flex items-center gap-2">
          <Camera className="w-4 h-4 text-solana-cyan" />
          <span className="text-sm font-semibold text-white">Scanner</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-solana-cyan/30 bg-solana-cyan/10 px-2.5 py-0.5 text-[11px] font-semibold text-solana-cyan">
            <span>Camera</span>
            {hasPermissionGranted && <span className="inline-block w-1.5 h-1.5 rounded-full bg-solana-green animate-pulse" title="Đã cấp quyền" />}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          title="Tắt camera"
          className="text-slate-400 hover:text-white transition-colors"
        >
          <XCircle className="w-5 h-5" />
        </button>
      </div>

      <div className="relative aspect-[4/3] w-full overflow-hidden bg-black flex items-center justify-center">

        {/* Thẻ video hiển thị stream chuẩn di động */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`absolute inset-0 h-full w-full object-cover ${
            permissionDenied || cameraError ? 'hidden' : 'block'
          }`}
        />

        {/* Khung ngắm quét mã QR Cyberpunk */}
        {!permissionDenied && !cameraError && !isStarting && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="relative w-52 h-52 sm:w-60 sm:h-60 border-2 border-solana-cyan/60 rounded-2xl shadow-[0_0_20px_rgba(0,255,163,0.3)] flex items-center justify-center">
              <div className="absolute top-0 left-0 w-5 h-5 border-t-4 border-l-4 border-solana-green rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-5 h-5 border-t-4 border-r-4 border-solana-green rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-5 h-5 border-b-4 border-l-4 border-solana-green rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-5 h-5 border-b-4 border-r-4 border-solana-green rounded-br-lg" />
              <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-solana-cyan to-transparent animate-pulse" />
            </div>

            {/* CHỈ BÁO COOLDOWN 2.5S SAU KHI QUÉT: Báo cho nhân viên biết hệ thống đang xử lý */}
            {isScanLocked && (
              <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2.5 animate-fadeIn">
                <div className="h-10 w-10 rounded-full border-2 border-solana-green/30 border-t-solana-green animate-spin" />
                <div className="inline-flex items-center gap-1.5 rounded-full border border-solana-green/40 bg-black/90 px-3.5 py-1 text-xs font-bold text-solana-green shadow-lg">
                  <span className="w-2 h-2 rounded-full bg-solana-green animate-pulse" />
                  <span>Sẵn sàng lượt tiếp sau 2.5s</span>
                </div>
              </div>
            )}
          </div>
        )}

        {isStarting && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/80 gap-2 text-solana-cyan">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="text-xs font-semibold">Đang kích hoạt Camera...</p>
          </div>
        )}

        {permissionDenied ? (
          <div className="z-20 flex flex-col items-center justify-center p-6 text-center bg-black/95 rounded-b-xl border-t border-neon-pink/30 space-y-4 max-w-sm mx-auto my-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-neon-pink/15 flex items-center justify-center border border-neon-pink/40 animate-pulse">
                <CameraOff className="w-8 h-8 text-neon-pink" />
              </div>
              <div className="absolute -bottom-1 -right-1 bg-yellow-400 text-black p-1 rounded-full shadow">
                <Lock className="w-3.5 h-3.5" />
              </div>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-sm font-bold text-white flex items-center justify-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-neon-pink" />
                Chưa cấp quyền truy cập Camera
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Trình duyệt đang chặn quyền Camera. Vui lòng bấm vào icon Ổ khóa (hoặc Cài đặt trang web) trên thanh địa chỉ &gt; Chọn 'Quyền' &gt; Đổi Camera sang 'Cho phép' &gt; Nhấn nút 'Thử lại' bên dưới.
              </p>
              {/* Bấm vào icon Ổ Khóa 🔒 bên cạnh URL -> Cho phép Máy ảnh -> Bấm nút Thử lại bên dưới. Trình duyệt chưa được cấp quyền truy cập Camera. Vui lòng bấm vào icon Ổ Khóa trên thanh địa chỉ để cấp quyền. */}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={handleRetryPermission}
                title="Thử lại cấp quyền"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-solana-purple to-neon-pink px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-purple-950/50 hover:brightness-110 active:scale-95 transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Thử lại mở Camera</span>
                <span className="hidden">Thử lại cấp quyền</span>
              </button>
            </div>
          </div>
        ) : cameraError ? (
          <div className="z-20 p-6 text-center text-xs text-pink-300 flex flex-col items-center gap-3 bg-black/90 rounded-b-xl border-t border-neon-pink/30 my-4 max-w-sm mx-auto">
            <AlertCircle className="w-8 h-8 text-neon-pink" />
            <p className="max-w-xs">{cameraError}</p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={handleRetryPermission}
                title="Thử lại cấp quyền"
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3.5 py-2 text-xs font-semibold text-white hover:bg-white/20 transition-all active:scale-95"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Thử lại mở Camera</span>
                <span className="hidden">Thử lại cấp quyền</span>
              </button>
            </div>
          </div>
        ) : null}

        <div
          id="qr-reader"
          className="hidden"
        />
      </div>
    </div>
  );
};

export const QRScanner = React.memo(QRScannerComponent);
