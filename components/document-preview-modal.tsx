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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 sm:p-6 animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-5xl h-[88vh] flex flex-col shadow-2xl overflow-hidden font-sans">
        {/* Header */}
        <div className="h-14 flex items-center justify-between px-6 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-bold text-slate-900">
              Xem Trước Văn Bản (Google Drive Preview)
            </span>
            <span className="font-mono text-[11px] text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
              {fileId}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={viewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:text-indigo-600 hover:bg-slate-200/70 border border-slate-200 bg-white transition-colors shadow-xs"
              title="Mở Google Drive"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Drive tab mới</span>
            </a>

            <div className="w-px h-4 bg-slate-200 mx-1" />

            <span className="text-[11px] font-mono text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
              ESC
            </span>

            <button
              onClick={onClose}
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
              title="Đóng (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Iframe View */}
        <div className="flex-1 bg-slate-100 relative overflow-hidden">
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
