'use client';

import { X, ExternalLink, ShieldCheck, Share2, Lock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from './auth-context';

interface DocumentPreviewModalProps {
  fileId: string;
  onClose: () => void;
}

export function DocumentPreviewModal({ fileId, onClose }: DocumentPreviewModalProps) {
  const { isAdmin } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [useProxyStream, setUseProxyStream] = useState(false);

  useEffect(() => {
    setMounted(true);
    document.body.style.overflow = 'hidden';

    // Ghi Nhật ký kiểm toán (Audit Log) mỗi khi có người mở xem file PDF
    fetch('/api/audit/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        action: 'VIEW_PDF',
        targetId: fileId,
        targetTitle: `PDF ID: ${fileId.slice(0, 12)}...`,
        details: 'Mở khung xem trước văn bản PDF trên ứng dụng',
      }),
    }).catch(() => {});

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = 'auto';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [fileId, onClose]);

  if (!mounted) return null;

  // Đường dẫn Proxy bảo mật qua Server (không lộ link Google Drive ra ngoài)
  const proxyStreamUrl = `/api/documents/stream/${encodeURIComponent(fileId)}`;
  const embedPreviewUrl = useProxyStream
    ? proxyStreamUrl
    : `https://drive.google.com/file/d/${fileId}/preview`;

  const handleShare = async () => {
    const shareLink = `${window.location.origin}${proxyStreamUrl}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Văn bản nội bộ ATTECH',
          text: 'Liên kết văn bản bảo mật ATTECH (Yêu cầu đăng nhập để mở):',
          url: shareLink,
        });
      } else {
        await navigator.clipboard.writeText(shareLink);
        alert('Đã sao chép đường dẫn bảo mật nội bộ ATTECH (yêu cầu đăng nhập khi mở)!');
      }
    } catch {
      // Người dùng hủy hộp thoại chia sẻ iOS
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/65 backdrop-blur-sm p-0 sm:p-6 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-t-3xl sm:rounded-2xl w-full max-w-5xl h-[92dvh] sm:h-[88vh] flex flex-col shadow-2xl overflow-hidden font-sans animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Thanh kéo trên iPhone (Bottom Sheet Handle) */}
        <div className="pt-2 pb-0.5 bg-slate-50 sm:hidden flex justify-center">
          <div className="w-10 h-1 rounded-full bg-slate-300" />
        </div>

        {/* Header */}
        <div className="h-12 sm:h-14 flex items-center justify-between px-4 sm:px-6 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="text-xs font-bold text-slate-900 truncate">
              Xem Văn Bản PDF Bảo Mật
            </span>
            <span className="hidden md:inline-flex items-center gap-1 font-mono text-[11px] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <Lock className="w-3 h-3 text-emerald-600" />
              <span>{isAdmin ? `Protected · ${fileId.slice(0, 10)}...` : 'ATTECH Secure Stream'}</span>
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Chuyển đổi luồng đọc Proxy Server vs Embed */}
            <button
              type="button"
              onClick={() => setUseProxyStream((v) => !v)}
              className={`hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer ${
                useProxyStream
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
              title="Đọc trực tiếp qua luồng Proxy bảo mật của Server ATTECH (/api/documents/stream)"
            >
              <Lock className="w-3 h-3" />
              <span>{useProxyStream ? 'Đang bật Proxy Stream' : 'Chế độ Proxy Stream'}</span>
            </button>

            {/* Nút Chia sẻ đường dẫn nội bộ bảo mật (Không lộ link Google Drive) */}
            <button
              type="button"
              onClick={handleShare}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold text-sky-700 hover:bg-sky-50 border border-sky-200 bg-white transition-colors shadow-2xs cursor-pointer"
              title="Chia sẻ đường dẫn bảo mật nội bộ (Người nhận phải đăng nhập ATTECH mới xem được)"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Chia sẻ</span>
            </button>

            {/* Mở PDF qua luồng Proxy bảo mật của Server (Ẩn hoàn toàn URL Google Drive) */}
            <a
              href={proxyStreamUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:text-indigo-600 hover:bg-slate-200/70 border border-slate-200 bg-white transition-colors shadow-2xs"
              title="Mở PDF bằng trình đọc gốc qua luồng bảo mật ATTECH (/api/documents/stream)"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Mở PDF Bảo mật</span>
              <span className="sm:hidden">Mở gốc</span>
            </a>

            <div className="hidden sm:block w-px h-4 bg-slate-200 mx-0.5" />

            <span className="hidden sm:inline text-[11px] font-mono text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
              ESC
            </span>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition-colors cursor-pointer"
              title="Đóng (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Iframe View */}
        <div className="flex-1 bg-slate-100 relative overflow-hidden pb-safe">
          <iframe
            src={embedPreviewUrl}
            className="w-full h-full border-none absolute inset-0 z-10 bg-white"
            allow="autoplay"
            title="ATTECH Secure Document Preview"
          />
        </div>
      </div>
    </div>
  );
}
