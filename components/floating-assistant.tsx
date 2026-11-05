'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import {
  Bot,
  X,
  Send,
  Loader2,
  FileText,
  Sparkles,
  Trash2,
  User,
  Maximize2,
  Minimize2,
  CheckSquare,
  Square,
  Eye,
  Upload,
  CheckCircle2,
  AlertTriangle,
  BookOpen,
} from 'lucide-react';
import { useAssistant, AssistantDoc } from '@/components/assistant-context';
import { DocumentPreviewModal } from '@/components/document-preview-modal';
import { useAuth } from '@/components/auth-context';

function renderInline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={i} className="font-semibold text-slate-900">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    )
  );
}

export function AnimatedChatbotIcon({ className = 'w-14 h-14' }: { className?: string }) {
  return (
    <div className={`relative select-none ${className}`}>
      <style>{`
        @keyframes botEyeMoveAndBlink {
          0%, 14% { transform: translate(0px, 0px) scaleY(1); }
          16% { transform: translate(0px, 0px) scaleY(0.08); }
          18%, 34% { transform: translate(-6px, -1px) scaleY(1); }
          38%, 54% { transform: translate(6px, -1px) scaleY(1); }
          56% { transform: translate(6px, 0px) scaleY(0.08); }
          58%, 74% { transform: translate(0px, 2px) scaleY(1); }
          76% { transform: translate(0px, 0px) scaleY(0.08); }
          78% { transform: translate(0px, 0px) scaleY(1); }
          80% { transform: translate(0px, 0px) scaleY(0.08); }
          82%, 100% { transform: translate(0px, 0px) scaleY(1); }
        }
        @keyframes botSpeechDotBounce {
          0%, 60%, 100% { transform: translateY(0px) scale(1); opacity: 0.85; }
          30% { transform: translateY(-9px) scale(1.14); opacity: 1; }
        }
        .bot-eye-anim {
          transform-box: fill-box;
          transform-origin: center center;
          animation: botEyeMoveAndBlink 5.2s ease-in-out infinite;
        }
        .bot-dot-1 {
          transform-box: fill-box;
          transform-origin: center center;
          animation: botSpeechDotBounce 1.35s ease-in-out infinite;
          animation-delay: 0s;
        }
        .bot-dot-2 {
          transform-box: fill-box;
          transform-origin: center center;
          animation: botSpeechDotBounce 1.35s ease-in-out infinite;
          animation-delay: 0.22s;
        }
        .bot-dot-3 {
          transform-box: fill-box;
          transform-origin: center center;
          animation: botSpeechDotBounce 1.35s ease-in-out infinite;
          animation-delay: 0.44s;
        }
      `}</style>
      <svg
        viewBox="30 60 390 340"
        className="w-full h-full overflow-visible drop-shadow-[0_6px_14px_rgba(2,132,199,0.35)]"
      >
        <defs>
          <radialGradient id="botDot3D" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="65%" stopColor="#e2e8f0" />
            <stop offset="100%" stopColor="#cbd5e1" />
          </radialGradient>
          <filter id="cyanEyeGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Lớp nền Robot 3D đã xử lý sạch vùng mắt & dấu ... */}
        <image href="/chatbot-base.png" x="0" y="0" width="450" height="450" />

        {/* Hai mắt Cyan phát sáng có cử động liếc & chớp mắt */}
        <g filter="url(#cyanEyeGlow)">
          <rect
            className="bot-eye-anim"
            x="142"
            y="238"
            width="43"
            height="45"
            rx="16"
            fill="#2be4ff"
          />
          <rect
            className="bot-eye-anim"
            x="222"
            y="238"
            width="41"
            height="45"
            rx="16"
            fill="#2be4ff"
          />
        </g>

        {/* Ba dấu chấm (...) 3D nhảy sóng trong bong bóng thoại */}
        <g style={{ filter: 'drop-shadow(0px 3px 3px rgba(2, 70, 130, 0.35))' }}>
          <circle className="bot-dot-1" cx="280.5" cy="139" r="14" fill="url(#botDot3D)" />
          <circle className="bot-dot-2" cx="321.5" cy="139" r="14" fill="url(#botDot3D)" />
          <circle className="bot-dot-3" cx="361.5" cy="139" r="14" fill="url(#botDot3D)" />
        </g>
      </svg>
    </div>
  );
}

export default function FloatingAssistant() {
  const {
    docs,
    scopeLabel,
    selectedDocIds,
    toggleSelectDoc,
    clearSelectedDocs,
    markDocHasOcr,
    isOpen,
    setIsOpen,
    isExpanded,
    setIsExpanded,
    previewFileId,
    setPreviewFileId,
  } = useAssistant();
  const { isAdmin } = useAuth();

  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [ocrLoadingDocId, setOcrLoadingDocId] = useState<string | null>(null);
  const [ocrTargetDocId, setOcrTargetDocId] = useState<string | null>(null);
  const ocrFileInputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const chatWindowRef = useRef<HTMLDivElement>(null);
  const launcherBtnRef = useRef<HTMLButtonElement>(null);

  // Vị trí có thể kéo thả tự do của nút Chatbot Robot
  const [botPos, setBotPos] = useState<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ startX: number; startY: number; initX: number; initY: number }>({
    startX: 0,
    startY: 0,
    initX: 0,
    initY: 0,
  });
  const hasMovedRef = useRef(false);

  // Kéo thả Chatbot (Pointer Events hỗ trợ cả chuột & màn hình cảm ứng)
  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    isDraggingRef.current = true;
    hasMovedRef.current = false;
    const currentX = botPos ? botPos.x : window.innerWidth - 74 - 20;
    const currentY = botPos ? botPos.y : window.innerHeight - 74 - 20;
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initX: currentX,
      initY: currentY,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - dragStartRef.current.startX;
    const dy = e.clientY - dragStartRef.current.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      hasMovedRef.current = true;
    }
    const newX = Math.max(10, Math.min(window.innerWidth - 84, dragStartRef.current.initX + dx));
    const newY = Math.max(10, Math.min(window.innerHeight - 84, dragStartRef.current.initY + dy));
    setBotPos({ x: newX, y: newY });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    isDraggingRef.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }
  };

  const handleBotClick = () => {
    // Chỉ mở/đóng nếu người dùng nhấn vào nút, không kích hoạt khi đang kéo di chuyển
    if (!hasMovedRef.current) {
      setIsOpen(!isOpen);
    }
  };

  // Tự động thu nhỏ chatbot khi nhấn ra ngoài khu vực hỏi đáp
  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // Không đóng nếu nhấn bên trong cửa sổ chat hoặc nút mở chatbot
      if (chatWindowRef.current?.contains(target)) return;
      if (launcherBtnRef.current?.contains(target)) return;
      if (ocrFileInputRef.current?.contains(target)) return;

      // Không đóng nếu đang nhấn nút "Hỏi AI" trên dòng văn bản hoặc đang mở cửa sổ xem trước PDF
      if (target.closest('[data-assistant-trigger="true"]')) return;
      if (previewFileId) return;

      setIsOpen(false);
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [isOpen, previewFileId, setIsOpen]);

  const docList = docs || [];
  const selectedDocs: AssistantDoc[] = selectedDocIds
    .map((id) => docList.find((d) => d.id === id))
    .filter((d): d is AssistantDoc => !!d);

  const { messages, input, handleInputChange, handleSubmit, isLoading, setMessages, error } = useChat({
    api: '/api/chat',
    body: {
      documents: docList,
      scopeLabel,
      selectedDocIds,
    },
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen, isExpanded]);

  // Trích xuất mã DOC-XXXXXX từ câu trả lời của AI để hiển thị nút bấm mở xem trước PDF
  const extractSources = (content: string) => {
    const codes = Array.from(new Set(content.match(/DOC-[0-9A-F]{6}/gi) || [])).map((c) => c.toUpperCase());
    return codes
      .map((code) => docList.find((d) => `DOC-${d.id.slice(0, 6).toUpperCase()}` === code))
      .filter((d): d is AssistantDoc => !!d);
  };

  // Gợi ý câu hỏi thông minh tùy theo số lượng văn bản đang chọn
  const suggestions =
    selectedDocs.length >= 2
      ? [
        'So sánh điểm giống và khác nhau giữa các văn bản đã chọn',
        'Tóm tắt nội dung chính của từng văn bản',
        'Đối tượng áp dụng và trách nhiệm thực hiện của các văn bản khác nhau thế nào?',
      ]
      : selectedDocs.length === 1
        ? [
          'Tóm tắt nội dung cốt lõi của văn bản này',
          'Các quy định, nhiệm vụ hoặc điều khoản chính là gì?',
          'Đơn vị, cá nhân nào chịu trách nhiệm thi hành?',
        ]
        : [
          'Liệt kê các văn bản đang hiển thị',
          'Văn bản nào được ban hành mới nhất?',
          'Những văn bản nào đang còn hiệu lực?',
        ];

  const sendSuggestion = (text: string) => {
    handleInputChange({ target: { value: text } } as React.ChangeEvent<HTMLInputElement>);
    setTimeout(() => {
      (document.getElementById('assistant-form') as HTMLFormElement | null)?.requestSubmit();
    }, 0);
  };

  // Xử lý đọc OCR 1 lần cho văn bản cũ chưa có ocr_content
  const handleTriggerOcrUpload = (docId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOcrTargetDocId(docId);
    ocrFileInputRef.current?.click();
  };

  const handleOcrFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const targetId = ocrTargetDocId;
    e.target.value = '';
    if (!file || !targetId) return;

    setOcrLoadingDocId(targetId);
    try {
      const fd = new FormData();
      fd.append('doc_id', targetId);
      fd.append('file', file);

      const res = await fetch('/api/documents/ocr', {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Không thể trích xuất OCR cho văn bản này.');
      } else {
        markDocHasOcr(targetId);
      }
    } catch (err: any) {
      alert('Lỗi kết nối khi trích xuất OCR: ' + (err.message || ''));
    } finally {
      setOcrLoadingDocId(null);
      setOcrTargetDocId(null);
    }
  };

  // Khối danh sách nguồn tài liệu (dùng cho cột trái chế độ NotebookLM hoặc ngăn chọn nhanh)
  const renderSourceList = () => (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
        <div>
          <div className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
            <span>Nguồn tài liệu ({selectedDocIds.length})</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Tích chọn văn bản để AI đọc toàn văn
          </p>
        </div>
        {selectedDocIds.length > 0 && (
          <button
            onClick={clearSelectedDocs}
            className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium underline"
          >
            Bỏ chọn
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 space-y-1">
        {docList.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400">
            Chưa có văn bản nào trong bộ lọc hiện tại.
          </div>
        ) : (
          docList.map((d) => {
            const isSelected = selectedDocIds.includes(d.id);
            const isSuperseded = d.status === 'SUPERSEDED';
            const isOcrRunning = ocrLoadingDocId === d.id;

            return (
              <div
                key={d.id}
                onClick={() => toggleSelectDoc(d.id)}
                className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-start gap-2.5 ${isSelected
                  ? 'bg-indigo-50/80 border-indigo-300 shadow-xs'
                  : 'bg-white hover:bg-slate-50 border-slate-200/80'
                  }`}
              >
                <div className="mt-0.5 text-indigo-600 shrink-0">
                  {isSelected ? (
                    <CheckSquare className="w-4 h-4 fill-indigo-600 text-white" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-slate-800 line-clamp-2 leading-snug">
                    {d.file_name}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    {d.document_code && (
                      <span className="font-mono text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                        {d.document_code}
                      </span>
                    )}
                    {isSuperseded && (
                      <span className="text-[10px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                        Hết hiệu lực
                      </span>
                    )}
                    {d.has_ocr ? (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                        <CheckCircle2 className="w-2.5 h-2.5" /> Đã có OCR
                      </span>
                    ) : isAdmin ? (
                      <button
                        type="button"
                        onClick={(e) => handleTriggerOcrUpload(d.id, e)}
                        disabled={isOcrRunning}
                        className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-800 bg-amber-100 hover:bg-amber-200 px-1.5 py-0.5 rounded border border-amber-300 transition-colors"
                        title="Admin: Văn bản cũ chưa có chữ OCR. Bấm để chọn file PDF đọc OCR 1 lần lưu vào Supabase."
                      >
                        {isOcrRunning ? (
                          <>
                            <Loader2 className="w-2.5 h-2.5 animate-spin" /> Đang đọc OCR...
                          </>
                        ) : (
                          <>
                            <Upload className="w-2.5 h-2.5" /> Đọc OCR 1 lần
                          </>
                        )}
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                        Chưa có OCR
                      </span>
                    )}
                  </div>
                </div>

                {d.drive_file_id && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreviewFileId(d.drive_file_id!);
                    }}
                    className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-indigo-600 shrink-0"
                    title="Xem bản gốc PDF"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Input ẩn phục vụ đọc OCR 1 lần cho văn bản cũ */}
      <input
        ref={ocrFileInputRef}
        type="file"
        accept=".pdf,image/*"
        className="hidden"
        onChange={handleOcrFileChange}
      />

      {isOpen && (
        <div
          ref={chatWindowRef}
          className={
            isExpanded
              ? 'fixed inset-4 sm:inset-8 z-40 bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200'
              : 'fixed bottom-24 right-6 z-40 w-[430px] max-w-[calc(100vw-2rem)] h-[600px] max-h-[calc(100vh-8rem)] bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200'
          }
        >
          {/* Thanh tiêu đề */}
          <div className="flex items-center justify-between px-4 py-3 bg-indigo-600 text-white shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center shrink-0 p-0.5">
                <AnimatedChatbotIcon className="w-8 h-8" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold leading-tight flex items-center gap-2">
                  <span>Trợ lý ATTECH Notebook</span>
                  {selectedDocs.length > 0 && (
                    <span className="text-[10px] font-mono bg-emerald-400 text-slate-950 font-bold px-2 py-0.5 rounded-full">
                      Đọc sâu {selectedDocs.length} file
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-indigo-100 truncate">
                  {docs ? `${scopeLabel} · ${docList.length} văn bản trong bộ lọc` : 'Hỏi đáp tài liệu nội bộ'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {!isExpanded && docs && (
                <button
                  onClick={() => setShowSourcePicker((v) => !v)}
                  className={`px-2 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1 transition-colors ${showSourcePicker ? 'bg-white text-indigo-700' : 'bg-white/15 hover:bg-white/25 text-white'
                    }`}
                  title="Chọn văn bản nguồn để đọc sâu"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Nguồn ({selectedDocs.length})</span>
                </button>
              )}
              {messages.length > 0 && (
                <button
                  onClick={() => setMessages([])}
                  className="p-1.5 rounded-md hover:bg-white/20 transition-colors"
                  title="Làm mới cuộc trò chuyện"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => {
                  setIsExpanded(!isExpanded);
                  setShowSourcePicker(false);
                }}
                className="p-1.5 rounded-md hover:bg-white/20 transition-colors"
                title={isExpanded ? 'Thu gọn về góc phải' : 'Mở rộng chế độ NotebookLM'}
              >
                {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-md hover:bg-white/20 transition-colors"
                title="Đóng"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Thân cửa sổ: Nếu mở rộng thì chia 2 cột (Cột trái: Nguồn tài liệu | Cột phải: Chat) */}
          <div className="flex-1 flex min-h-0 overflow-hidden">
            {isExpanded && (
              <div className="w-80 border-r border-slate-200 bg-white shrink-0 hidden md:flex flex-col">
                {renderSourceList()}
              </div>
            )}

            {/* Cột phải: Khu vực Chat */}
            <div className="flex-1 flex flex-col min-w-0 bg-slate-50">
              {/* Nếu đang ở chế độ thu gọn và bật ngăn chọn nguồn */}
              {!isExpanded && showSourcePicker ? (
                <div className="flex-1 overflow-hidden bg-white">{renderSourceList()}</div>
              ) : (
                <>
                  {/* Thanh hiển thị 1-2 văn bản đang được ghim đọc sâu */}
                  {selectedDocs.length > 0 && (
                    <div className="px-3.5 py-2 bg-indigo-50/90 border-b border-indigo-200/80 flex flex-wrap items-center gap-1.5 shrink-0">
                      <span className="text-[11px] font-semibold text-indigo-800 mr-1">
                        Đang ghim đọc toàn văn:
                      </span>
                      {selectedDocs.map((sd) => (
                        <div
                          key={sd.id}
                          className="inline-flex items-center gap-1.5 bg-white border border-indigo-200 rounded-lg px-2 py-1 text-[11px] text-slate-800 shadow-2xs max-w-[240px]"
                        >
                          <FileText className="w-3 h-3 text-indigo-600 shrink-0" />
                          <span className="font-semibold text-indigo-700 shrink-0">
                            {sd.document_code || `DOC-${sd.id.slice(0, 6).toUpperCase()}`}
                          </span>
                          <span className="truncate text-slate-600">{sd.file_name}</span>
                          {!sd.has_ocr && (
                            <button
                              type="button"
                              onClick={(e) => handleTriggerOcrUpload(sd.id, e)}
                              className="text-[10px] font-semibold text-amber-800 bg-amber-100 hover:bg-amber-200 px-1.5 py-0.5 rounded border border-amber-300 shrink-0"
                              title="Bổ sung OCR 1 lần cho văn bản cũ"
                            >
                              {ocrLoadingDocId === sd.id ? '...' : '+OCR'}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => toggleSelectDoc(sd.id)}
                            className="text-slate-400 hover:text-rose-600 ml-0.5 shrink-0"
                            title="Bỏ ghim văn bản này"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Cảnh báo nếu có văn bản ghim chưa có OCR */}
                  {selectedDocs.some((d) => !d.has_ocr) && (
                    <div className="px-3.5 py-2 bg-amber-50 border-b border-amber-200 flex items-center justify-between gap-2 text-[11px] text-amber-900 shrink-0">
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>
                          Văn bản cũ chưa có lớp chữ OCR. Bấm <strong>&ldquo;Đọc OCR 1 lần&rdquo;</strong> để AI đọc toàn văn.
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Danh sách tin nhắn */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.length === 0 ? (
                      <div className="flex flex-col items-center text-center pt-4">
                        <div className="mb-2">
                          <AnimatedChatbotIcon className="w-16 h-16" />
                        </div>
                        <h4 className="text-sm font-bold text-slate-900">
                          {selectedDocs.length > 0
                            ? `Sẵn sàng phân tích ${selectedDocs.length} văn bản đã chọn`
                            : 'Trợ lý Tài liệu ATTECH'}
                        </h4>
                        {selectedDocs.length > 0 && (
                          <p className="text-xs text-slate-600 mt-1 max-w-md leading-relaxed">
                            AI sẽ đọc trực tiếp toàn bộ nội dung chữ (OCR) đã lưu trên Supabase của văn bản được chọn và trích dẫn chính xác từng trang.
                          </p>
                        )}

                        <div className="mt-4 flex flex-col gap-2 w-full max-w-md">
                          {suggestions.map((s) => (
                            <button
                              key={s}
                              onClick={() => sendSuggestion(s)}
                              className="text-xs text-left px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 hover:border-indigo-400 hover:text-indigo-700 text-slate-700 transition-colors shadow-xs"
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      messages.map((m) => {
                        const sources = m.role === 'assistant' ? extractSources(m.content) : [];
                        return (
                          <div
                            key={m.id}
                            className={`flex gap-2.5 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                          >
                            {m.role === 'assistant' && (
                              <div className="w-7 h-7 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center shrink-0 mt-0.5">
                                <Bot className="w-4 h-4 text-indigo-600" />
                              </div>
                            )}
                            <div
                              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed shadow-xs ${m.role === 'user'
                                ? 'bg-indigo-600 text-white rounded-tr-sm'
                                : 'bg-white border border-slate-200 text-slate-800 rounded-tl-sm'
                                }`}
                            >
                              {m.content.split('\n').map((line, i) => (
                                <p key={i} className="mb-1.5 last:mb-0 break-words">
                                  {m.role === 'assistant' ? renderInline(line) : line}
                                </p>
                              ))}
                              {sources.length > 0 && (
                                <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap items-center gap-1.5">
                                  <span className="text-[10px] font-semibold text-slate-400 uppercase mr-1">
                                    Nguồn trích dẫn:
                                  </span>
                                  {sources.map((d) =>
                                    d.drive_file_id ? (
                                      <button
                                        key={d.id}
                                        onClick={() => setPreviewFileId(d.drive_file_id!)}
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[11px] font-medium transition-colors max-w-full"
                                        title={`Mở xem trước: ${d.file_name}`}
                                      >
                                        <FileText className="w-3 h-3 shrink-0" />
                                        <span className="truncate">
                                          {d.document_code || `DOC-${d.id.slice(0, 6).toUpperCase()}`}
                                        </span>
                                      </button>
                                    ) : null
                                  )}
                                </div>
                              )}
                            </div>
                            {m.role === 'user' && (
                              <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                                <User className="w-4 h-4 text-slate-600" />
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}

                    {isLoading && messages[messages.length - 1]?.role === 'user' && (
                      <div className="flex gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center shrink-0">
                          <Bot className="w-4 h-4 text-indigo-600" />
                        </div>
                        <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-3.5 py-2.5 flex items-center gap-2 text-xs text-slate-500 shadow-xs">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" /> Đang đối chiếu nguồn tài liệu...
                        </div>
                      </div>
                    )}

                    {error && (
                      <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2.5">
                        Không thể kết nối trợ lý AI. Vui lòng kiểm tra GEMINI_API_KEY và thử lại.
                      </div>
                    )}
                    <div ref={endRef} />
                  </div>

                  {/* Ô nhập câu hỏi */}
                  <form
                    id="assistant-form"
                    onSubmit={handleSubmit}
                    className="p-3 border-t border-slate-200 bg-white flex items-center gap-2 shrink-0"
                  >
                    <input
                      value={input}
                      onChange={handleInputChange}
                      disabled={isLoading}
                      placeholder={
                        selectedDocs.length > 0
                          ? `Hỏi chi tiết về ${selectedDocs.length} văn bản đang chọn...`
                          : 'Nhập câu hỏi ...'
                      }
                      className="flex-1 bg-slate-100 border border-slate-200 focus:bg-white focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 rounded-full px-4 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none transition-all"
                    />
                    <button
                      type="submit"
                      disabled={isLoading || !(input ?? '').trim()}
                      className="w-9 h-9 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shrink-0"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Nút Robot 3D nổi có thể kéo thả di chuyển tự do trên màn hình */}
      <button
        ref={launcherBtnRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onClick={handleBotClick}
        style={
          botPos
            ? { left: `${botPos.x}px`, top: `${botPos.y}px`, bottom: 'auto', right: 'auto' }
            : undefined
        }
        className={`fixed z-40 w-[74px] h-[74px] rounded-full flex items-center justify-center transition-transform duration-150 hover:scale-105 active:scale-95 focus:outline-none group touch-none cursor-grab active:cursor-grabbing ${
          botPos ? '' : 'bottom-5 right-5'
        }`}
        title="Kéo thả để di chuyển vị trí, bấm để mở trợ lý AI"
        aria-label="Trợ lý AI"
      >
        <AnimatedChatbotIcon className="w-[74px] h-[74px] pointer-events-none" />
        {selectedDocIds.length > 0 && (
          <span className="absolute top-0 right-0 min-w-5 h-5 px-1.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white shadow-sm pointer-events-none">
            {selectedDocIds.length}
          </span>
        )}
      </button>

      {previewFileId && <DocumentPreviewModal fileId={previewFileId} onClose={() => setPreviewFileId(null)} />}
    </>
  );
}
