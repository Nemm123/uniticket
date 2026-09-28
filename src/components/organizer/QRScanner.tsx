import React, { useEffect, useRef, useState } from 'react';
import QrScanner from 'qr-scanner';
// Html5Qrcode fallback reference: optimized with native BarcodeDetector and QrScanner engine
import { Camera, XCircle, SwitchCamera, Loader2, AlertCircle, CameraOff, Lock, RefreshCw, ShieldAlert } from 'lucide-react';

interface QRScannerProps {
  onScanSuccess: (decodedText: string) => void;
  isEnabled: boolean;
  onClose: () => void;
  facingMode?: 'environment' | 'user';
  onToggleCamera?: () => void;
  onError?: (error: string) => void;
}

export const QRScanner: React.FC<QRScannerProps> = ({
  onScanSuccess,
  isEnabled,
  onClose,
  facingMode = 'environment',
  onToggleCamera,
  onError,
}) => {
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
  const activeFacingModeRef = useRef(facingMode);

  const onScan = (result: string) => {
    onScanSuccess(result);
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
      // Duy trì luồng stream đang hoạt động tốt nếu không đổi facingMode
      const isLive = Boolean(
        streamRef.current &&
        streamRef.current.active &&
        streamRef.current.getVideoTracks().some((t) => t.readyState === 'live')
      );
      if (isLive && activeFacingModeRef.current === facingMode) {
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

      // Cấu hình media constraints an toàn trên mobile
      const constraints = {
        video: {
          facingMode: facingMode === 'environment' ? 'environment' : 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };

      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (idealErr) {
        console.warn('[QRScanner] Thử fallback constraints tuần tự:', idealErr);
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: facingMode } },
            audio: false
          });
        } catch (idealErr2) {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: facingMode === 'environment' ? 'environment' : 'user' },
              audio: false
            });
          } catch (softErr) {
            try {
              // Bước 1: Thử exact
              stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: { exact: 'environment' } }
              });
            } catch (step1Err) {
              try {
                // Bước 2: Thử soft
                stream = await navigator.mediaDevices.getUserMedia({
                  video: { facingMode: 'environment' }
                });
              } catch (step2Err) {
                // Bước 3: Mở bất kỳ camera nào khả dụng
                stream = await navigator.mediaDevices.getUserMedia({ video: true });
              }
            }
          }
        }
      }

      if (!stream) {
        throw new Error('Không nhận được luồng MediaStream từ thiết bị.');
      }

      streamRef.current = stream;
      activeFacingModeRef.current = facingMode;
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
        onError?.(deniedMsg);
      } else if (
        errName === 'NotFoundError' ||
        errName === 'DevicesNotFoundError' ||
        /not found|no device|devicesnotfound/i.test(errMsg)
      ) {
        const notFoundMsg = 'Không tìm thấy thiết bị Camera trên thiết bị này.';
        setCameraError(notFoundMsg);
        onError?.(notFoundMsg);
      } else {
        const otherMsg = err?.message || 'Không thể truy cập camera. Vui lòng kiểm tra lại thiết bị.';
        setCameraError(otherMsg);
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
  }, [isEnabled, facingMode, retryCount, onScanSuccess, onError]);

  if (!isEnabled) return null;

  return (
    <div className="relative w-full max-w-md mx-auto bg-black/70 border border-solana-purple/30 rounded-xl overflow-hidden shadow-2xl">
      <div className="flex justify-between items-center p-3 border-b border-white/10 bg-[#120B30]">
        <div className="flex items-center gap-2">
          <Camera className="w-4 h-4 text-solana-cyan" />
          <span className="text-sm font-semibold text-white">Scanner</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-solana-cyan/30 bg-solana-cyan/10 px-2.5 py-0.5 text-[11px] font-semibold text-solana-cyan">
            {facingMode === 'environment' ? 'Camera Sau' : 'Camera Trước'}
            {hasPermissionGranted && <span className="inline-block w-1.5 h-1.5 rounded-full bg-solana-green animate-pulse" title="Đã cấp quyền" />}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {onToggleCamera && (
            <button
              type="button"
              onClick={onToggleCamera}
              disabled={isStarting}
              title={`Chuyển sang ${facingMode === 'environment' ? 'Camera Trước' : 'Camera Sau'}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-solana-cyan/40 bg-solana-cyan/15 hover:bg-solana-cyan/25 px-2.5 py-1 text-xs font-bold text-solana-cyan transition-all active:scale-95 disabled:opacity-50"
            >
              <SwitchCamera className={`w-3.5 h-3.5 ${isStarting ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Đổi camera 🔄</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            title="Tắt camera"
            className="text-slate-400 hover:text-white transition-colors"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="relative min-h-[280px] bg-black flex items-center justify-center">
        {/* Nút nổi tròn ở góc trên bên phải khung quét để đổi camera tức thì trên mobile */}
        {onToggleCamera && (
          <button
            type="button"
            onClick={onToggleCamera}
            disabled={isStarting}
            title={`Chuyển sang ${facingMode === 'environment' ? 'Camera Trước' : 'Camera Sau'}`}
            className="absolute top-3 right-3 z-20 flex items-center gap-1.5 rounded-full bg-black/70 hover:bg-black/90 border border-solana-cyan/50 text-solana-cyan px-3 py-1.5 text-xs font-bold backdrop-blur-md transition-all active:scale-90 shadow-xl disabled:opacity-50"
          >
            <SwitchCamera className={`w-4 h-4 ${isStarting ? 'animate-spin' : ''}`} />
            <span>{facingMode === 'environment' ? 'Camera Sau 🔄' : 'Camera Trước 🔄'}</span>
          </button>
        )}

        {/* Thẻ video hiển thị stream chuẩn di động */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full max-h-[360px] object-cover rounded-b-xl ${
            permissionDenied || cameraError ? 'hidden' : 'block'
          }`}
        />

        {/* Khung ngắm quét mã QR Cyberpunk */}
        {!permissionDenied && !cameraError && !isStarting && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="relative w-56 h-56 border-2 border-solana-cyan/60 rounded-2xl shadow-[0_0_20px_rgba(0,255,163,0.3)] flex items-center justify-center">
              <div className="absolute top-0 left-0 w-5 h-5 border-t-4 border-l-4 border-solana-green rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-5 h-5 border-t-4 border-r-4 border-solana-green rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-5 h-5 border-b-4 border-l-4 border-solana-green rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-5 h-5 border-b-4 border-r-4 border-solana-green rounded-br-lg" />
              <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-solana-cyan to-transparent animate-pulse" />
            </div>
          </div>
        )}

        {isStarting && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/80 gap-2 text-solana-cyan">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="text-xs font-semibold">Đang kích hoạt {facingMode === 'environment' ? 'Camera Sau' : 'Camera Trước'}...</p>
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
