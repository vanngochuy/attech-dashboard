'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  User,
  Camera,
  Trash2,
  CheckCircle2,
  PlaneLanding,
  Upload,
} from 'lucide-react';
import { useAuth } from './auth-context';
import { useTheme } from './theme-context';

export default function UserAvatarMenu() {
  const { isAdmin, username, logout } = useAuth();
  const { isDeepAero } = useTheme();

  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ top: number; right: number }>({ top: 60, right: 24 });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Đảm bảo an toàn SSR
  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem('attech_user_avatar');
      if (saved) setAvatarUrl(saved);
    } catch {
      // Ignore
    }
  }, []);

  // Tính toán vị trí của popover ngay sát dưới nút Avatar
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

  // Tự động đóng menu khi bấm ra ngoài hoặc khi resize/scroll
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

  // Xử lý upload ảnh đại diện mới
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

  const displayName = username || (isAdmin ? 'huyvn' : 'Nhân viên tra cứu');
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <>
      {/* Input upload file ảnh ẩn */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Nút Avatar hình tròn đơn giản */}
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        className="relative flex items-center justify-center w-9 h-9 rounded-full cursor-pointer focus:outline-none transition-all active:scale-95 group shrink-0"
        title={`Tài khoản: ${displayName} (admin)`}
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

        {/* Chấm tròn trạng thái hoạt động */}
        <span
          className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white"
          title="Đang hoạt động"
        />
      </button>

      {/* Popover hiển thị thông tin tài khoản qua Portal để không bao giờ bị overflow-hidden cắt mất */}
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
            {/* Thông tin User & Avatar lớn kèm nút đổi ảnh */}
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

                {/* Nút camera nhỏ trên avatar để đổi ảnh nhanh */}
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
                  {/* Thay "Toàn quyền quản trị" thành "admin" */}
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-400 border border-sky-400/30">
                    admin
                  </span>
                </div>
                <p
                  className={`text-xs truncate mt-0.5 ${
                    isDeepAero ? 'text-sky-200/70' : 'text-slate-500'
                  }`}
                >
                  {isAdmin ? 'tuh@attech.com.vn' : 'user@attech.com.vn'}
                </p>
                <div className="flex items-center gap-1 text-[11px] text-emerald-500 mt-1 font-medium">
                  <CheckCircle2 className="w-3 h-3 shrink-0" />
                  <span>Hệ thống ATTECH sẵn sàng</span>
                </div>
              </div>
            </div>

            {/* Các nút thao tác ảnh đại diện */}
            <div className="py-2.5 border-b border-slate-200/40 space-y-1">
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

            {/* Nút Đăng xuất */}
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
    </>
  );
}
