'use client';

import { X, ExternalLink, ShieldCheck } from 'lucide-react';
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
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  if (!mounted) return null;

  const viewUrl = `https://drive.google.com/file/d/${fileId}/preview`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 sm:p-6 animate-in fade-in duration-150">
      <div className="bg-[#121316] border border-white/[0.08] rounded-xl w-full max-w-5xl h-[88vh] flex flex-col shadow-2xl overflow-hidden font-sans">
        {/* Linear Header */}
        <div className="h-12 flex items-center justify-between px-5 border-b border-white/[0.06] bg-[#14151a]">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-semibold text-zinc-200">
              Xem Trước Văn Bản (Google Drive Preview)
            </span>
            <span className="font-mono text-[11px] text-zinc-400 bg-white/[0.04] px-2 py-0.5 rounded border border-white/[0.06]">
              {fileId}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={viewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors"
              title="Mở Google Drive"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Drive tab mới</span>
            </a>

            <div className="w-px h-4 bg-white/[0.08] mx-1" />

            <span className="text-[11px] font-mono text-zinc-500 bg-white/[0.03] px-1.5 py-0.5 rounded border border-white/[0.05]">
              ESC
            </span>

            <button
              onClick={onClose}
              className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors"
              title="Đóng (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Iframe View */}
        <div className="flex-1 bg-[#0a0b0d] relative overflow-hidden">
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
