'use client';

import { X, ExternalLink, ShieldCheck, Share2 } from 'lucide-react';
import { useEffect, useState } from 'react';

interface DocumentPreviewModalProps {
  fileId: string;
  onClose: () => void;
}

export function DocumentPreviewModal({ fileId, onClose }: DocumentPreviewModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = 'auto';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  if (!mounted) return null;

  const viewUrl = `https://drive.google.com/file/d/${fileId}/preview`;
  const nativeUrl = `https://drive.google.com/file/d/${fileId}/view`;

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Văn bản ATTECH',
          text: 'Chia sẻ văn bản PDF từ hệ thống ATTECH Docs',
          url: nativeUrl,
        });
      } else {
        await navigator.clipboard.writeText(nativeUrl);
        alert('Đã sao chép đường dẫn file PDF để gửi qua Zalo/Mail!');
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
              Xem Văn Bản PDF
            </span>
            <span className="hidden md:inline font-mono text-[11px] text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
              {fileId}
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Nút Chia sẻ nhanh qua Zalo / Mail trên iPhone */}
            <button
              type="button"
              onClick={handleShare}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold text-sky-700 hover:bg-sky-50 border border-sky-200 bg-white transition-colors shadow-2xs"
              title="Chia sẻ file qua Zalo / Mail"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Chia sẻ</span>
            </button>

            <a
              href={nativeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:text-indigo-600 hover:bg-slate-200/70 border border-slate-200 bg-white transition-colors shadow-2xs"
              title="Mở bằng trình đọc PDF gốc để phóng to 2 ngón tay"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Drive tab mới</span>
              <span className="sm:hidden">Mở gốc</span>
            </a>

            <div className="hidden sm:block w-px h-4 bg-slate-200 mx-0.5" />

            <span className="hidden sm:inline text-[11px] font-mono text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
              ESC
            </span>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition-colors"
              title="Đóng (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Iframe View */}
        <div className="flex-1 bg-slate-100 relative overflow-hidden pb-safe">
          <iframe
            src={viewUrl}
            className="w-full h-full border-none absolute inset-0 z-10 bg-white"
            allow="autoplay"
            title="Google Drive Document Preview"
          />
        </div>
      </div>
    </div>
  );
}
