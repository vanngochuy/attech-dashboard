'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Camera,
  Trash2,
  CheckCircle2,
  PlaneLanding,
  Upload,
  ShieldAlert,
  X,
  RefreshCw,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from './auth-context';
import { useTheme } from './theme-context';

interface AuditLogItem {
  id: string;
  timestamp: string;
  username: string;
  role: 'admin' | 'user' | 'anonymous';
  department?: string;
  action: string;
  targetId?: string;
  targetTitle?: string;
  ip: string;
  userAgent: string;
  deviceLabel: string;
  details?: string;
}

export default function UserAvatarMenu() {
  const { isAdmin, username, departmentScope, logout } = useAuth();
  const { isDeepAero } = useTheme();

  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ top: number; right: number }>({ top: 60, right: 24 });

  // Trạng thái Nhật ký Kiểm toán (Audit Log Modal cho Admin)
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem('attech_user_avatar');
      if (saved) setAvatarUrl(saved);
    } catch {
      // Ignore
    }
  }, []);

  const fetchAuditLogs = async () => {
    setIsLoadingAudit(true);
    try {
      const res = await fetch('/api/audit/logs', {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.logs)) {
          setAuditLogs(data.logs);
        }
      }
    } catch {
      // Ignore
    } finally {
      setIsLoadingAudit(false);
    }
  };

  const updateCoords = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + 8,
        right: Math.max(16, window.innerWidth - rect.right),
      });
    }
  };

  const handleToggle = () => {
    updateCoords();
    setIsOpen((prev) => !prev);
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    const handleScrollOrResize = () => {
      updateCoords();
    };

    document.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [isOpen]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Vui lòng chọn file hình ảnh (JPG, PNG, WebP).');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert('Kích thước ảnh tối đa 2MB để đảm bảo hiệu năng tải trang.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setAvatarUrl(result);
      try {
        localStorage.setItem('attech_user_avatar', result);
      } catch (err) {
        console.warn('Không thể lưu avatar vào localStorage:', err);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleRemoveAvatar = () => {
    setAvatarUrl(null);
    try {
      localStorage.removeItem('attech_user_avatar');
    } catch {
      // Ignore
    }
  };

  const renderActionBadge = (action: string) => {
    switch (action) {
      case 'LOGIN_SUCCESS':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Đăng nhập
          </span>
        );
      case 'LOGIN_FAILED':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            Sai mật khẩu
          </span>
        );
      case 'VIEW_PDF':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
            Xem / Tải PDF
          </span>
        );
      case 'UPDATE_DOC':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
            Sửa văn bản
          </span>
        );
      case 'DELETE_DOC':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
            Xóa văn bản
          </span>
        );
      case 'LOGOUT':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
            Đăng xuất
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
            {action}
          </span>
        );
    }
  };

  const displayName = username || (isAdmin ? 'huyvn' : 'Nhân viên tra cứu');
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        className="relative flex items-center justify-center w-9 h-9 rounded-full cursor-pointer focus:outline-none transition-all active:scale-95 group shrink-0"
        title={`Tài khoản: ${displayName} (${isAdmin ? 'admin' : 'user'})`}
        aria-expanded={isOpen}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={displayName}
            className="w-9 h-9 rounded-full object-cover border-2 border-white/80 shadow-xs group-hover:ring-2 group-hover:ring-sky-400 transition-all"
          />
        ) : (
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shadow-xs border-2 border-white/80 group-hover:ring-2 group-hover:ring-sky-400 transition-all ${
              isDeepAero
                ? 'bg-gradient-to-tr from-sky-700 to-indigo-600 text-white'
                : 'bg-gradient-to-tr from-sky-600 to-indigo-500 text-white'
            }`}
          >
            {initial}
          </div>
        )}

        <span
          className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white"
          title="Đang hoạt động"
        />
      </button>

      {mounted &&
        isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: 'fixed',
              top: `${coords.top}px`,
              right: `${coords.right}px`,
              zIndex: 99999,
            }}
            className={`w-72 rounded-2xl p-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150 border ${
              isDeepAero
                ? 'bg-[#0b1b32]/95 backdrop-blur-xl border-sky-400/20 text-slate-100 shadow-sky-950/80'
                : 'bg-white/95 backdrop-blur-xl border-slate-200 text-slate-800 shadow-2xl'
            }`}
          >
            <div className="flex items-center gap-3 pb-3 border-b border-slate-200/40">
              <div className="relative group/avatar shrink-0">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={displayName}
                    className="w-14 h-14 rounded-full object-cover border-2 border-sky-400 shadow-sm"
                  />
                ) : (
                  <div
                    className={`w-14 h-14 rounded-full flex items-center justify-center font-extrabold text-xl shadow-sm border-2 border-sky-400 ${
                      isDeepAero
                        ? 'bg-gradient-to-tr from-sky-700 to-indigo-600 text-white'
                        : 'bg-gradient-to-tr from-sky-600 to-indigo-500 text-white'
                    }`}
                  >
                    {initial}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-sky-600 hover:bg-sky-500 text-white flex items-center justify-center shadow-xs cursor-pointer border-2 border-white transition-all"
                  title="Thay đổi ảnh đại diện"
                >
                  <Camera className="w-3 h-3" />
                </button>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-bold truncate">{displayName}</p>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-400 border border-sky-400/30">
                    {isAdmin ? 'admin' : 'user'}
                  </span>
                </div>
                <p
                  className={`text-xs truncate mt-0.5 ${
                    isDeepAero ? 'text-sky-200/70' : 'text-slate-500'
                  }`}
                >
                  Phạm vi: {departmentScope === 'ALL' ? 'Toàn công ty' : departmentScope}
                </p>
                <div className="flex items-center gap-1 text-[11px] text-emerald-500 mt-1 font-medium">
                  <CheckCircle2 className="w-3 h-3 shrink-0" />
                  <span>Phiên bảo mật HttpOnly</span>
                </div>
              </div>
            </div>

            <div className="py-2.5 border-b border-slate-200/40 space-y-1">
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    setIsAuditOpen(true);
                    fetchAuditLogs();
                  }}
                  className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    isDeepAero
                      ? 'bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-400/30'
                      : 'bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200'
                  }`}
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                  <span>Nhật ký Kiểm toán (Audit Log)</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  isDeepAero
                    ? 'hover:bg-white/10 text-slate-200'
                    : 'hover:bg-slate-100 text-slate-700'
                }`}
              >
                <Upload className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                <span>{avatarUrl ? 'Thay đổi hình ảnh tài khoản' : 'Thêm hình ảnh vào tài khoản'}</span>
              </button>

              {avatarUrl && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    isDeepAero
                      ? 'hover:bg-rose-500/20 text-rose-300'
                      : 'hover:bg-rose-50 text-rose-600'
                  }`}
                >
                  <Trash2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Xóa ảnh đại diện</span>
                </button>
              )}
            </div>

            <div className="pt-2.5">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  logout();
                }}
                className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs border ${
                  isDeepAero
                    ? 'bg-rose-950/50 hover:bg-rose-900/70 border-rose-500/40 text-rose-200'
                    : 'bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-700'
                }`}
              >
                <PlaneLanding className="w-3.5 h-3.5 shrink-0" />
                <span>Đăng xuất</span>
              </button>
            </div>
          </div>,
          document.body
        )}

      {/* Modal Nhật ký Kiểm toán Bảo mật (Audit Log) dành cho Admin */}
      {mounted &&
        isAuditOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[100000] bg-slate-900/65 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-6 animate-in fade-in duration-150"
            onClick={() => setIsAuditOpen(false)}
          >
            <div
              className="bg-white border border-slate-200 rounded-t-3xl sm:rounded-2xl w-full max-w-4xl h-[88dvh] sm:h-[82vh] flex flex-col shadow-2xl overflow-hidden text-slate-800 font-sans"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-xs">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Nhật ký Kiểm toán Bảo mật (Security Audit Log)
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Theo dõi lịch sử đăng nhập, thiết bị/IP, xem văn bản PDF, chỉnh sửa và xóa tài liệu
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={fetchAuditLogs}
                    disabled={isLoadingAudit}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-700 cursor-pointer"
                  >
                    {isLoadingAudit ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-600" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5 text-sky-600" />
                    )}
                    <span>Làm mới</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAuditOpen(false)}
                    className="p-1.5 rounded-lg bg-slate-200/70 hover:bg-slate-300 text-slate-600 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-4 space-y-2">
                {isLoadingAudit ? (
                  <div className="py-16 flex flex-col items-center justify-center text-slate-500 text-xs gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-sky-600" />
                    <span>Đang tải nhật ký kiểm toán bảo mật...</span>
                  </div>
                ) : auditLogs.length === 0 ? (
                  <div className="py-16 text-center text-slate-400 text-xs">
                    Chưa có bản ghi kiểm toán nào.
                  </div>
                ) : (
                  auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3 rounded-xl border border-slate-200/80 bg-white hover:bg-slate-50/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {renderActionBadge(log.action)}
                          <span className="font-bold text-slate-900">{log.username}</span>
                          <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                            {log.role === 'admin' ? 'Admin' : `Phòng: ${log.department || 'ALL'}`}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            • {new Date(log.timestamp).toLocaleString('vi-VN')}
                          </span>
                        </div>
                        {(log.targetTitle || log.details) && (
                          <div className="text-slate-600 text-[11px] break-words">
                            {log.targetTitle && (
                              <strong className="text-slate-800 mr-1.5">[{log.targetTitle}]</strong>
                            )}
                            <span>{log.details}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0 text-[11px] font-mono text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200/70">
                        <span>{log.deviceLabel}</span>
                        <span>•</span>
                        <span>IP: {log.ip}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
