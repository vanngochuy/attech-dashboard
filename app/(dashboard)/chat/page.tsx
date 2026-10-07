'use client';

import { useChat } from 'ai/react';
import { Bot, Send, User, FileText, Loader2 } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { DocumentPreviewModal } from '@/components/document-preview-modal';

export default function ChatPage() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/chat',
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const [previewFileId, setPreviewFileId] = useState<string | null>(null);

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex flex-col h-full relative">
      {/* Header */}
      <header className="h-16 flex items-center px-6 border-b border-slate-800/50 bg-slate-900/40 backdrop-blur-md z-10">
        <div>
          <h1 className="text-xl font-semibold text-white">Trợ lý Tri thức RAG</h1>
          <p className="text-xs text-slate-400">Hỏi đáp dựa trên hệ thống tài liệu nội bộ</p>
        </div>
      </header>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 no-scrollbar relative z-0">
        <div className="max-w-4xl mx-auto space-y-6">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[50vh] text-center opacity-70">
              <div className="w-16 h-16 bg-indigo-500/20 rounded-2xl flex items-center justify-center mb-6 border border-indigo-500/30">
                <Bot className="w-8 h-8 text-indigo-400" />
              </div>
              <h2 className="text-2xl font-semibold text-white mb-2">Xin chào!</h2>
              <p className="text-slate-400 max-w-md">
                Tôi là trợ lý AI. Bạn có thể hỏi tôi bất kỳ thông tin nào về quy trình, 
                quy định hoặc tài liệu chuyên môn của tổ chức.
              </p>
            </div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={`flex gap-4 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center flex-shrink-0 mt-1">
                    <Bot size={16} className="text-indigo-400" />
                  </div>
                )}
                
                <div className={`max-w-[85%] rounded-2xl p-4 sm:p-5 shadow-sm backdrop-blur-sm ${
                  m.role === 'user' 
                    ? 'bg-indigo-600 text-white rounded-tr-sm' 
                    : 'bg-slate-800/60 border border-slate-700/50 text-slate-200 rounded-tl-sm'
                }`}>
                  <div className="prose prose-invert prose-sm max-w-none leading-relaxed">
                    {/* Basic text rendering. Note: in a real app, use react-markdown */}
                    {m.content.split('\n').map((line, i) => (
                      <p key={i} className="mb-2 last:mb-0">{line}</p>
                    ))}
                  </div>
                  
                  {/* Mock Citation (in real implementation, extract from tool_calls or metadata) */}
                  {m.role === 'assistant' && (
                    <div className="mt-4 pt-3 border-t border-slate-700/50 flex flex-wrap gap-2">
                      <span className="text-xs text-slate-400 flex items-center mr-2">Nguồn:</span>
                      {/* Fake citation button for UI. Wait, we should extract if it comes from API */}
                      <button 
                        onClick={() => setPreviewFileId('MOCK_DRIVE_ID')}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-700/50 hover:bg-indigo-500/20 text-indigo-300 border border-slate-600/50 hover:border-indigo-500/30 transition-colors text-xs font-medium cursor-pointer"
                      >
                        <FileText size={12} />
                        Quy-trinh-PCCC.pdf
                      </button>
                    </div>
                  )}
                </div>

                {m.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0 mt-1">
                    <User size={16} className="text-slate-300" />
                  </div>
                )}
              </div>
            ))
          )}
          {isLoading && (
            <div className="flex gap-4 justify-start">
              <div className="w-8 h-8 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center flex-shrink-0 mt-1">
                <Bot size={16} className="text-indigo-400" />
              </div>
              <div className="bg-slate-800/60 border border-slate-700/50 text-slate-200 rounded-2xl rounded-tl-sm p-5 flex items-center gap-3">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                <span className="text-sm text-slate-400">Đang tìm kiếm thông tin...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="p-4 sm:p-6 bg-slate-900/60 backdrop-blur-xl border-t border-slate-800/50 relative z-10">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto relative flex items-center">
          <input
            className="w-full bg-slate-800/50 border border-slate-700/80 rounded-full pl-6 pr-14 py-4 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-transparent transition-all shadow-inner"
            value={input}
            onChange={handleInputChange}
            placeholder="Hỏi về quy trình an toàn, tài liệu kỹ thuật..."
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="absolute right-2 w-10 h-10 rounded-full bg-indigo-600 hover:bg-indigo-500 flex items-center justify-center text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
          >
            <Send size={18} className="ml-1" />
          </button>
        </form>
        <p className="text-center text-[10px] text-slate-500 mt-3">
          AI có thể mắc lỗi. Vui lòng kiểm tra lại thông tin quan trọng từ tài liệu gốc.
        </p>
      </div>
      
      {/* Document Preview Modal */}
      {previewFileId && (
        <DocumentPreviewModal 
          fileId={previewFileId} 
          onClose={() => setPreviewFileId(null)} 
        />
      )}
    </div>
  );
}
