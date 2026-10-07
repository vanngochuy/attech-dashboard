'use client';

import { X, ExternalLink } from 'lucide-react';
import { useEffect, useState } from 'react';

interface DocumentPreviewModalProps {
  fileId: string;
  onClose: () => void;
}

export function DocumentPreviewModal({ fileId, onClose }: DocumentPreviewModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Prevent scrolling when modal is open
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  if (!mounted) return null;

  const viewUrl = `https://drive.google.com/file/d/${fileId}/preview`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/50 rounded-2xl w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl overflow-hidden shadow-indigo-500/10">
        <div className="h-14 flex items-center justify-between px-6 border-b border-slate-800/50 bg-slate-900/80">
          <div className="flex items-center gap-2">
            <h3 className="text-white font-medium">Trích xuất tài liệu</h3>
            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-xs border border-slate-700">Preview</span>
          </div>
          <div className="flex items-center gap-3">
            <a 
              href={viewUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors flex items-center gap-2"
              title="Mở tab mới"
            >
              <ExternalLink size={18} />
              <span className="text-sm font-medium hidden sm:inline-block">Mở trong Drive</span>
            </a>
            <div className="w-px h-6 bg-slate-700/50"></div>
            <button 
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-rose-500/20 hover:border-rose-500/30 rounded-lg transition-colors border border-transparent"
              title="Đóng"
            >
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="flex-1 bg-slate-950 relative overflow-hidden">
          {/* Skeleton or loading indicator could go here */}
          <iframe 
            src={viewUrl} 
            className="w-full h-full border-none absolute inset-0 z-10 bg-white"
            allow="autoplay"
            title="Google Drive Document Preview"
          ></iframe>
        </div>
      </div>
    </div>
  );
}
