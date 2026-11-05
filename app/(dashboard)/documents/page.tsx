'use client';

import { Suspense, useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Search,
  Plus,
  Eye,
  SlidersHorizontal,
  ExternalLink,
  Layers,
  Wrench,
  ShieldCheck,
  Flame,
  Waves,
  HardHat,
  Building2,
  List,
  LayoutGrid,
  CheckCircle2,
  FileText,
  FileCode,
  FileSpreadsheet,
  Clock,
  Cloud,
  Database,
  ChevronRight,
  Filter,
  AlertTriangle,
  RefreshCw,
  ShieldAlert,
  Loader2,
  Scale,
  Building,
  Hash,
  Calendar,
  History,
  Ban,
  Bot,
  X
} from 'lucide-react';
import UploadDocumentModal from '@/components/upload-document-modal';
import EditDocumentModal from '@/components/edit-document-modal';
import { DocumentPreviewModal } from '@/components/document-preview-modal';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { abbreviateIssuer } from '@/lib/issuer';
import { useAssistant } from '@/components/assistant-context';
import { useAuth } from '@/components/auth-context';

// Danh mục Chuyên môn
const DEPARTMENTS = [
  { id: 'ALL', label: 'Tất cả chuyên môn', dot: 'bg-slate-400', icon: Layers },
  { id: 'VB_PHAP_LUAT', label: 'Văn bản Pháp luật & Quy chế', dot: 'bg-blue-500', icon: Scale },
  { id: 'QL_KY_THUAT', label: 'Quản lý Kỹ thuật (CNS, Selex)', dot: 'bg-indigo-500', icon: Wrench },
  { id: 'SMS', label: 'An toàn (SMS)', dot: 'bg-emerald-500', icon: ShieldCheck },
  { id: 'PCCC_CHCN', label: 'PCCC & CHCN', dot: 'bg-rose-500', icon: Flame },
  { id: 'PCTT_TKCN', label: 'PCTT & TKCN', dot: 'bg-cyan-500', icon: Waves },
  { id: 'ATVSLD', label: 'An toàn VSLĐ', dot: 'bg-amber-500', icon: HardHat },
  { id: 'CONG_TRINH_HK', label: 'Công trình Hàng không', dot: 'bg-purple-500', icon: Building2 },
];

// Hàm bỏ dấu tiếng Việt & ký tự đặc biệt để hỗ trợ tìm kiếm từ khóa thông minh (không cần gõ đúng nguyên văn)
function normalizeSearchText(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[-_./,()[\]{}:;+]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export default function DocumentsPage() {
  return (
    <Suspense fallback={null}>
      <DocumentsContent />
    </Suspense>
  );
}

function DocumentsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setDocsContext, selectedDocIds, selectAndAskDoc } = useAssistant();
  const { isAdmin } = useAuth();
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<any | null>(null);
  const [previewDoc, setPreviewDoc] = useState<string | null>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Bộ lọc chuyên môn đồng bộ với URL (?dept=...) để sidebar và trang luôn khớp nhau
  const deptParam = searchParams.get('dept');
  const activeFilter = deptParam && DEPARTMENTS.some((d) => d.id === deptParam) ? deptParam : 'ALL';
  const setActiveFilter = useCallback(
    (id: string) => router.replace(id === 'ALL' ? '/documents' : `/documents?dept=${id}`),
    [router]
  );
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'SUPERSEDED'>('ALL');
  const [issuerFilter, setIssuerFilter] = useState<string>('ALL');
  const [yearFilter, setYearFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [filterMissingOnly, setFilterMissingOnly] = useState(false);
  const [isDbConfigured, setIsDbConfigured] = useState(true);

  // Trạng thái Quét trực tiếp Google Drive cho Admin
  const [isScanningDrive, setIsScanningDrive] = useState(false);
  const [scanNotification, setScanNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Lấy dữ liệu Supabase (ưu tiên client, tự động fallback qua Server API /api/documents/list trên Vercel)
  const fetchDocuments = async () => {
    setIsLoading(true);
    try {
      if (isSupabaseConfigured()) {
        const { data, error } = await supabase
          .from('document_files')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data) {
          setDocuments(data);
          setIsDbConfigured(true);
          setIsLoading(false);
          return;
        }
      }

      // Fallback qua Server API (đọc được biến môi trường runtime trên Vercel ngay cả khi không rebuild)
      const res = await fetch('/api/documents/list', { cache: 'no-store' });
      const payload = await res.json();
      if (payload.configured) {
        setDocuments(payload.documents || []);
        setIsDbConfigured(true);
      } else {
        setIsDbConfigured(false);
      }
    } catch (err) {
      console.error('Lỗi nạp dữ liệu từ Supabase:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  // Đếm số lượng tài liệu theo từng chuyên mục
  const departmentCounts = useMemo(() => {
    const map: Record<string, number> = {};
    DEPARTMENTS.forEach((d) => { map[d.id] = 0; });
    documents.forEach((doc) => {
      const dept = doc.department_access?.[0];
      if (dept && map[dept] !== undefined) map[dept]++;
      map['ALL'] = (map['ALL'] || 0) + 1;
    });
    return map;
  }, [documents]);

  // Danh sách Đơn vị ban hành (đã chuẩn hóa tên viết tắt) kèm số lượng văn bản
  const issuerOptions = useMemo(() => {
    const counts: Record<string, number> = {};
    documents.forEach((doc) => {
      const raw = (doc.issuing_authority || '').trim();
      if (!raw) return;
      const shortName = abbreviateIssuer(raw);
      counts[shortName] = (counts[shortName] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([label, count]) => ({ label, count }));
  }, [documents]);

  // Danh sách Năm ban hành kèm số lượng văn bản
  const yearOptions = useMemo(() => {
    const counts: Record<string, number> = {};
    documents.forEach((doc) => {
      if (!doc.issue_date) return;
      const y = new Date(doc.issue_date).getFullYear();
      if (!isNaN(y) && y > 1970 && y < 2100) {
        const yStr = String(y);
        counts[yStr] = (counts[yStr] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .sort((a, b) => Number(b[0]) - Number(a[0]))
      .map(([year, count]) => ({ year, count }));
  }, [documents]);

  // Bộ lọc tìm kiếm đa trường & đa từ khóa thông minh:
  // Không cần gõ khớp nguyên chuỗi, chỉ cần gõ vài từ khóa rời rạc (VD: "mối nguy 2025", "alos attech 2026", "pccc vatm")
  const filteredDocuments = useMemo(() => {
    const queryTokens = normalizeSearchText(searchQuery)
      .split(' ')
      .filter((t) => t.length > 0);

    return documents.filter((doc) => {
      // 1. Lọc theo Chuyên môn
      const matchesDept = activeFilter === 'ALL' || doc.department_access?.includes(activeFilter);
      if (!matchesDept) return false;

      // 2. Lọc theo Đơn vị ban hành
      if (issuerFilter !== 'ALL') {
        const docIssuerShort = abbreviateIssuer(doc.issuing_authority);
        if (docIssuerShort !== issuerFilter) return false;
      }

      // 3. Lọc theo Năm ban hành
      const docYear = doc.issue_date ? String(new Date(doc.issue_date).getFullYear()) : '';
      if (yearFilter !== 'ALL' && docYear !== yearFilter) return false;

      // 4. Lọc theo Trạng thái mất file & Hiệu lực
      const matchesMissing = filterMissingOnly ? doc.sync_status === 'missing_on_drive' : true;
      if (!matchesMissing) return false;

      const matchesStatus =
        statusFilter === 'ALL'
          ? true
          : statusFilter === 'ACTIVE'
            ? doc.status !== 'SUPERSEDED'
            : doc.status === 'SUPERSEDED';
      if (!matchesStatus) return false;

      // 5. Tìm kiếm đa từ khóa (Multi-keyword) trên các trường định danh văn bản:
      // Tên văn bản + Số/Ký hiệu + Đơn vị ban hành (đầy đủ & viết tắt) + Ngày/Năm ban hành + Tên chuyên môn
      if (queryTokens.length > 0) {
        const deptCode = doc.department_access?.[0] || '';
        const deptLabel = DEPARTMENTS.find((d) => d.id === deptCode)?.label || '';
        const vnDate = doc.issue_date
          ? new Date(doc.issue_date).toLocaleDateString('vi-VN')
          : '';
        const issuerShort = abbreviateIssuer(doc.issuing_authority);

        const searchableComposite = normalizeSearchText(
          `${doc.file_name || ''} ${doc.document_code || ''} ${doc.issuing_authority || ''} ${issuerShort} ${doc.issue_date || ''} ${vnDate} ${docYear} ${deptLabel}`
        );

        // Mọi từ khóa người dùng gõ vào đều phải xuất hiện trong thông tin văn bản
        const allTokensMatched = queryTokens.every((token) =>
          searchableComposite.includes(token)
        );
        if (!allTokensMatched) return false;
      }

      return true;
    });
  }, [documents, searchQuery, filterMissingOnly, statusFilter, activeFilter, issuerFilter, yearFilter]);

  // Chia sẻ danh sách đang lọc cho Trợ lý AI nổi
  useEffect(() => {
    const label = DEPARTMENTS.find((d) => d.id === activeFilter)?.label || 'Tất cả chuyên môn';
    setDocsContext(
      filteredDocuments.map((d) => ({
        id: d.id,
        file_name: d.file_name,
        document_code: d.document_code,
        issuing_authority: d.issuing_authority,
        issue_date: d.issue_date,
        status: d.status,
        department_access: d.department_access,
        drive_file_id: d.drive_file_id,
        has_ocr: !!d.ocr_content,
      })),
      label
    );
  }, [filteredDocuments, activeFilter, setDocsContext]);

  // Trợ lý không còn dữ liệu danh sách khi rời trang Tài liệu
  useEffect(() => () => setDocsContext(null, 'Toàn bộ hệ thống'), [setDocsContext]);

  // Đếm số lượng file bị mất trên Google Drive
  const missingDriveCount = useMemo(() => {
    return documents.filter((doc) => doc.sync_status === 'missing_on_drive').length;
  }, [documents]);

  const activeDept = DEPARTMENTS.find((d) => d.id === activeFilter) || DEPARTMENTS[0];

  const getDeptConfig = (code: string) => {
    const found = DEPARTMENTS.find((d) => d.id === code);
    return found || { id: code, label: code || 'Chung', dot: 'bg-slate-400', icon: FileText };
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName?.split('.').pop()?.toLowerCase();
    if (ext === 'xlsx' || ext === 'xls') return <FileSpreadsheet className="w-4 h-4 text-emerald-600" />;
    if (ext === 'doc' || ext === 'docx') return <FileCode className="w-4 h-4 text-blue-600" />;
    return <FileText className="w-4 h-4 text-indigo-600" />;
  };

  // Hàm Admin bấm quét Google Drive trực tiếp
  const handleScanDrive = async () => {
    setIsScanningDrive(true);
    setScanNotification(null);

    try {
      const res = await fetch('/api/documents/sync', {
        method: 'POST',
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Quét thất bại');
      }

      setScanNotification({
        type: 'success',
        text: 'Đã hoàn tất quét Google Drive! Danh sách đã được làm mới.'
      });

      await fetchDocuments();
    } catch (err: any) {
      console.error('Lỗi quét Drive:', err);
      setScanNotification({
        type: 'error',
        text: err.message || 'Không thể kích hoạt n8n quét Google Drive.'
      });
    } finally {
      setIsScanningDrive(false);
      setTimeout(() => {
        setScanNotification(null);
      }, 5000);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 text-slate-800 font-sans selection:bg-sky-500/20">
      <style>{`
        @keyframes driftCloudHeader1 {
          0%, 100% { transform: translateX(0px); }
          50% { transform: translateX(35px); }
        }
        @keyframes driftCloudHeader2 {
          0%, 100% { transform: translateX(0px); }
          50% { transform: translateX(-30px); }
        }
      `}</style>

      {/* Khối Tiêu đề & Thanh Chuyên môn: Nền Xanh Bầu Trời & Mây Trắng */}
      <div className="relative bg-gradient-to-r from-[#0284c7] via-[#0ea5e9] to-[#38bdf8] border-b border-sky-300 shadow-sm shrink-0 overflow-hidden z-20">
        {/* Các đám mây trắng bồng bềnh trang trí trên nền bầu trời */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden select-none">
          <svg
            viewBox="0 0 220 80"
            className="absolute -top-3 left-16 w-48 text-white/25 fill-current"
            style={{ animation: 'driftCloudHeader1 14s ease-in-out infinite' }}
          >
            <path d="M40 65 H180 A18 18 0 0 0 180 30 A24 24 0 0 0 135 14 A30 30 0 0 0 75 20 A22 22 0 0 0 40 65 Z" />
          </svg>
          <svg
            viewBox="0 0 240 80"
            className="absolute top-2 left-[38%] w-56 text-white/30 fill-current"
            style={{ animation: 'driftCloudHeader2 18s ease-in-out infinite' }}
          >
            <path d="M35 65 H195 A20 20 0 0 0 195 28 A26 26 0 0 0 148 12 A32 32 0 0 0 82 18 A24 24 0 0 0 35 65 Z" />
          </svg>
          <svg
            viewBox="0 0 200 80"
            className="absolute -bottom-4 right-24 w-52 text-white/25 fill-current"
            style={{ animation: 'driftCloudHeader1 16s ease-in-out infinite' }}
          >
            <path d="M45 65 H165 A20 20 0 0 0 165 25 A22 22 0 0 0 125 12 A30 30 0 0 0 68 20 A24 24 0 0 0 45 65 Z" />
          </svg>
        </div>

        {/* Top Bar Header */}
        <header className="h-14 border-b border-white/20 flex items-center justify-between px-6 relative z-10">
          <div className="hidden sm:flex items-center gap-2 text-white font-bold text-sm drop-shadow-2xs">
            <Cloud className="w-4 h-4 text-white fill-white/80" />
            <span>Kho Văn bản &amp; Tài liệu Nghiệp vụ</span>
          </div>

          {/* Right Action Tools */}
          <div className="flex items-center gap-2.5 ml-auto">
            {/* Trạng thái Google Drive & Supabase */}
            <div className="hidden lg:flex items-center gap-2 mr-1">
              <div className="flex items-center gap-1.5 bg-white/95 px-2.5 py-1.5 rounded-lg border border-white text-xs shadow-xs">
                <Cloud className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                <span className="text-slate-600 font-medium">Drive:</span>
                <span className="text-emerald-600 font-bold font-mono">Synced</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/95 px-2.5 py-1.5 rounded-lg border border-white text-xs shadow-xs">
                <Database className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="text-slate-600 font-medium">Supabase:</span>
                <span className="text-emerald-600 font-bold font-mono">Ready</span>
              </div>
            </div>

            {/* Admin Quét Drive Nhanh (Chỉ hiển thị cho Admin) */}
            {isAdmin && (
              <button
                onClick={handleScanDrive}
                disabled={isScanningDrive}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/95 hover:bg-white border border-white text-slate-800 hover:text-sky-900 rounded-lg text-xs font-semibold transition-all shadow-sm disabled:opacity-50 cursor-pointer"
                title="Admin: Kích hoạt n8n quét và kiểm tra sự tồn tại của toàn bộ file trên Google Drive"
              >
                {isScanningDrive ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
                ) : (
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                )}
                <span className="hidden sm:inline">{isScanningDrive ? 'Đang quét...' : 'Quét Drive'}</span>
              </button>
            )}

            {/* Refresh button */}
            <button
              onClick={fetchDocuments}
              disabled={isLoading}
              className="p-2 bg-white/95 hover:bg-white border border-white text-slate-700 hover:text-sky-700 rounded-lg transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
              title="Làm mới danh sách"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>

            {/* View toggle */}
            <div className="flex items-center p-0.5 bg-sky-900/20 backdrop-blur-xs border border-white/30 rounded-lg">
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded transition-colors ${viewMode === 'list' ? 'bg-white text-sky-700 shadow-xs font-semibold' : 'text-white/85 hover:text-white'
                  }`}
                title="Chế độ Danh sách (List)"
              >
                <List className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded transition-colors ${viewMode === 'grid' ? 'bg-white text-sky-700 shadow-xs font-semibold' : 'text-white/85 hover:text-white'
                  }`}
                title="Chế độ Thẻ (Grid)"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* New Document Button (Chỉ hiển thị cho Admin) */}
            {isAdmin && (
              <button
                onClick={() => setIsUploadModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#1b3252] hover:bg-slate-900 active:scale-95 text-white border border-white/25 rounded-lg text-xs font-semibold transition-all shadow-md cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm tài liệu</span>
                <span className="text-[10px] text-sky-200 font-mono ml-0.5">C</span>
              </button>
            )}
          </div>
        </header>

        {/* Sub-header / Filter Pills Bar (Trên nền bầu trời mây trắng) */}
        <div className="px-6 py-2.5 flex items-center justify-between overflow-x-auto no-scrollbar relative z-10 bg-white/15 backdrop-blur-xs">
          {/* Department Pills */}
          <div className="flex items-center gap-2">
            <div className="text-white text-xs uppercase tracking-wider font-bold mr-1 flex items-center gap-1.5 shrink-0 drop-shadow-2xs">
              <Filter className="w-3.5 h-3.5 text-white" /> Chuyên môn:
            </div>
            {DEPARTMENTS.map((dept) => {
              const isActive = activeFilter === dept.id;
              const count = departmentCounts[dept.id] || 0;
              return (
                <button
                  key={dept.id}
                  onClick={() => {
                    setActiveFilter(dept.id);
                    setFilterMissingOnly(false);
                  }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer ${isActive
                      ? 'bg-[#1b3252] text-white shadow-md border border-white/40'
                      : 'bg-white/95 text-slate-800 hover:bg-white border border-white shadow-xs'
                    }`}
                >
                  <span className={`w-2 h-2 rounded-full ${dept.dot}`} />
                  <span>{dept.label}</span>
                  <span
                    className={`text-[11px] font-mono px-1.5 py-0.2 rounded-full ${isActive
                        ? 'bg-sky-500 text-white font-bold'
                        : 'bg-sky-50 text-sky-800 border border-sky-200'
                      }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Thông báo kết quả quét Drive (Toast Banner) */}
      {scanNotification && (
        <div
          className={`mx-6 mt-3 p-3 rounded-lg border text-xs flex items-center justify-between transition-all ${scanNotification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
        >
          <div className="flex items-center gap-2">
            {scanNotification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="font-medium">{scanNotification.text}</span>
          </div>
          <button
            onClick={() => setScanNotification(null)}
            className="text-[11px] opacity-70 hover:opacity-100 underline ml-2 font-medium"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Cảnh báo nếu phát hiện file bị mất trên Google Drive (Chỉ hiển thị cho Admin) */}
      {isAdmin && missingDriveCount > 0 && (
        <div className="mx-6 mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-between text-xs text-amber-800 shrink-0 shadow-xs">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Cảnh báo đồng bộ:</strong> Phát hiện{' '}
              <strong className="text-amber-900 underline">{missingDriveCount} tài liệu</strong> đã bị xóa hoặc chuyển vào thùng rác trên Google Drive.
            </span>
          </div>
          <button
            onClick={() => setFilterMissingOnly(!filterMissingOnly)}
            className="px-2.5 py-1 rounded text-[11px] font-medium bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 transition-colors"
          >
            {filterMissingOnly ? 'Hiện tất cả tài liệu' : 'Lọc tài liệu lỗi'}
          </button>
        </div>
      )}

      {/* Thanh Tìm kiếm & Lọc Đa Trường (Cố định phía trên danh sách) */}
      {!isLoading && isDbConfigured && (
        <div className="px-6 py-2.5 bg-white border-b border-slate-200 shadow-2xs shrink-0 z-20 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
          {/* Trái: Tiêu đề + Số lượng văn bản khớp */}
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-sky-600" />
              <span>Danh sách văn bản</span>
              <span className="text-xs font-mono font-bold text-sky-800 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200">
                {filteredDocuments.length}/{documents.length}
              </span>
            </h3>

            {(activeFilter !== 'ALL' ||
              issuerFilter !== 'ALL' ||
              yearFilter !== 'ALL' ||
              statusFilter !== 'ALL' ||
              searchQuery.trim() !== '' ||
              filterMissingOnly) && (
              <button
                type="button"
                onClick={() => {
                  setActiveFilter('ALL');
                  setIssuerFilter('ALL');
                  setYearFilter('ALL');
                  setStatusFilter('ALL');
                  setSearchQuery('');
                  setFilterMissingOnly(false);
                }}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer"
                title="Xóa toàn bộ điều kiện tìm kiếm và bộ lọc"
              >
                <X className="w-3 h-3" />
                <span>Xóa bộ lọc</span>
              </button>
            )}
          </div>

          {/* Phải: Các trường lọc nâng cao (Từ khóa + Chuyên môn + Đơn vị ban hành + Năm ban hành + Hiệu lực) */}
          <div className="flex flex-wrap items-center gap-2 flex-1 justify-end">
            {/* Ô tìm kiếm từ khóa trực tiếp (Hỗ trợ gõ tên + năm + đơn vị không cần đúng thứ tự) */}
            <div className="relative flex-1 min-w-[240px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-sky-600 w-3.5 h-3.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm từ khóa: tên văn bản + năm, số hiệu, đơn vị (VD: an toàn 2025)..."
                className="w-full bg-slate-50 focus:bg-white border border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/15 rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-600"
                  title="Xóa từ khóa"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Trường lọc: Chuyên môn */}
            <select
              value={activeFilter}
              onChange={(e) => {
                setActiveFilter(e.target.value);
                setFilterMissingOnly(false);
              }}
              aria-label="Lọc theo chuyên môn"
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium focus:outline-none focus:border-sky-500 transition-colors cursor-pointer ${
                activeFilter !== 'ALL'
                  ? 'bg-sky-50 border-sky-300 text-sky-900 font-semibold'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-white'
              }`}
            >
              {DEPARTMENTS.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.id === 'ALL'
                    ? `Chuyên môn: Tất cả (${departmentCounts['ALL'] || 0})`
                    : `${dept.label} (${departmentCounts[dept.id] || 0})`}
                </option>
              ))}
            </select>

            {/* Trường lọc: Đơn vị ban hành */}
            <select
              value={issuerFilter}
              onChange={(e) => setIssuerFilter(e.target.value)}
              aria-label="Lọc theo đơn vị ban hành"
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium focus:outline-none focus:border-sky-500 transition-colors cursor-pointer max-w-[190px] ${
                issuerFilter !== 'ALL'
                  ? 'bg-sky-50 border-sky-300 text-sky-900 font-semibold'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-white'
              }`}
            >
              <option value="ALL">Đơn vị ban hành: Tất cả</option>
              {issuerOptions.map((opt) => (
                <option key={opt.label} value={opt.label}>
                  {opt.label} ({opt.count})
                </option>
              ))}
            </select>

            {/* Trường lọc: Năm ban hành */}
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              aria-label="Lọc theo năm ban hành"
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium focus:outline-none focus:border-sky-500 transition-colors cursor-pointer ${
                yearFilter !== 'ALL'
                  ? 'bg-sky-50 border-sky-300 text-sky-900 font-semibold'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-white'
              }`}
            >
              <option value="ALL">Năm ban hành: Tất cả</option>
              {yearOptions.map((opt) => (
                <option key={opt.year} value={opt.year}>
                  Năm {opt.year} ({opt.count})
                </option>
              ))}
            </select>

            {/* Trường lọc: Hiệu lực */}
            <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setStatusFilter('ALL')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  statusFilter === 'ALL'
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tất cả
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('ACTIVE')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                  statusFilter === 'ACTIVE'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Còn hiệu lực
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('SUPERSEDED')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                  statusFilter === 'SUPERSEDED'
                    ? 'bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <History className="w-3 h-3 text-amber-600" /> Đã thay thế
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Document Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-16 flex flex-col items-center justify-center text-slate-500 text-xs gap-3">
            <div className="w-6 h-6 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" />
            <span>Đang đồng bộ dữ liệu từ Supabase...</span>
          </div>
        ) : !isDbConfigured ? (
          <div className="p-16 flex flex-col items-center justify-center text-center max-w-lg mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-600 mb-4 shadow-sm">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900 mb-2">Chưa cấu hình Supabase Database</h3>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Hệ thống cần kết nối với Supabase để lưu trữ và tải danh sách tài liệu. Hiện tại biến <code className="px-1.5 py-0.5 rounded bg-slate-200 text-amber-800 font-mono">NEXT_PUBLIC_SUPABASE_URL</code> trong file <code className="px-1.5 py-0.5 rounded bg-slate-200 text-amber-800 font-mono">.env.local</code> chưa được thiết lập URL chính xác.
            </p>
            <div className="w-full bg-white border border-slate-200 rounded-lg p-3.5 text-left font-mono text-[11px] text-slate-700 shadow-xs space-y-1.5">
              <div className="text-slate-400">// Mở file .env.local và cập nhật thông tin dự án của bạn:</div>
              <div><span className="text-indigo-600">NEXT_PUBLIC_SUPABASE_URL</span>=<span className="text-emerald-600">&quot;https://xxxx.supabase.co&quot;</span></div>
              <div><span className="text-indigo-600">NEXT_PUBLIC_SUPABASE_ANON_KEY</span>=<span className="text-emerald-600">&quot;eyJh...&quot;</span></div>
            </div>
          </div>
        ) : (
          <div className="pb-12">
            {/* DANH SÁCH HOẶC LƯỚI KHUNG TÀI LIỆU */}
            {filteredDocuments.length === 0 ? (
              <div className="p-16 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 mb-3 shadow-xs">
                  <FileText className="w-6 h-6 text-indigo-500" />
                </div>
                <h4 className="text-sm font-semibold text-slate-900 mb-1">Không tìm thấy tài liệu phù hợp</h4>
                <p className="text-slate-500 text-xs max-w-sm mb-4">
                  {filterMissingOnly
                    ? 'Không có tài liệu nào bị lỗi mất file Google Drive.'
                    : 'Không có văn bản nào khớp với từ khóa hoặc bộ lọc đã chọn. Hãy thử bớt từ khóa hoặc đặt lại bộ lọc.'}
                </p>
                <button
                  onClick={() => {
                    setActiveFilter('ALL');
                    setIssuerFilter('ALL');
                    setYearFilter('ALL');
                    setStatusFilter('ALL');
                    setSearchQuery('');
                    setFilterMissingOnly(false);
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium border border-slate-200 shadow-xs transition-colors"
                >
                  Đặt lại bộ lọc
                </button>
              </div>
            ) : viewMode === 'list' ? (
              /* TABLE VIEW (với phần Tiêu đề cột Freeze / Sticky khi cuộn xuống) */
              <div className="px-6 pt-3">
                <div className="border border-slate-200 rounded-xl bg-white shadow-xs">
                  {/* Table Header - FREEZE (Sticky top-0) khi kéo xuống */}
                  <div className="sticky top-0 z-20 h-11 px-4 flex items-center justify-between bg-slate-100/95 backdrop-blur-md text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200 rounded-t-xl shadow-2xs">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="flex-1">TÊN VĂN BẢN</span>
                    </div>
                    <div className="flex items-center gap-4 shrink-0 text-right">
                      <span className="w-28 text-left hidden sm:inline">SỐ / KÝ HIỆU</span>
                      <span className="w-28 text-left hidden md:inline">ĐƠN VỊ BAN HÀNH</span>
                      <span className="w-28 text-center">NGÀY BAN HÀNH</span>
                      <span className="w-32 text-center hidden lg:inline">CHUYÊN MÔN</span>
                      <span className="w-28 text-center">HIỆU LỰC</span>
                      <span className="w-24 text-right">THAO TÁC</span>
                    </div>
                  </div>

                  {/* Table Rows */}
                  <div className="divide-y divide-slate-100">
                    {filteredDocuments.map((doc) => {
                      const deptCode = doc.department_access?.[0] || '';
                      const dept = getDeptConfig(deptCode);
                      const docCode = `DOC-${doc.id.slice(0, 6).toUpperCase()}`;
                      const isMissingOnDrive = doc.sync_status === 'missing_on_drive';
                      const isSuperseded = doc.status === 'SUPERSEDED';

                      return (
                        <div
                          key={doc.id}
                          className={`h-14 px-4 flex items-center justify-between hover:bg-slate-50 transition-colors group cursor-pointer last:rounded-b-xl ${isMissingOnDrive
                              ? 'bg-rose-50/30'
                              : isSuperseded
                                ? 'bg-amber-50/20'
                                : 'bg-white'
                            }`}
                          onClick={() => {
                            if (!isMissingOnDrive) setPreviewDoc(doc.drive_file_id);
                            else if (isAdmin) setEditingDoc(doc);
                          }}
                        >
                          {/* Left: Icon + File Name */}
                          <div className="flex items-center gap-3 min-w-0 pr-4 flex-1">
                            <div className="shrink-0">{getFileIcon(doc.file_name)}</div>
                            <span
                              className={`text-xs font-semibold truncate ${isMissingOnDrive
                                  ? 'text-slate-400 line-through decoration-rose-500/50'
                                  : isSuperseded
                                    ? 'text-slate-600'
                                    : 'text-slate-900 group-hover:text-indigo-600'
                                }`}
                              title={doc.file_name}
                            >
                              {doc.file_name}
                            </span>
                          </div>

                          {/* Right Columns */}
                          <div className="flex items-center gap-4 shrink-0">
                            {/* Số hiệu */}
                            <span className="w-28 text-left font-mono text-xs text-indigo-700 font-semibold truncate hidden sm:inline">
                              {doc.document_code || '---'}
                            </span>

                            {/* Đơn vị */}
                            <span
                              className="w-28 text-left text-xs text-slate-700 font-medium truncate hidden md:inline"
                              title={doc.issuing_authority || undefined}
                            >
                              {abbreviateIssuer(doc.issuing_authority)}
                            </span>

                            {/* Ngày ban hành */}
                            <span className="w-28 text-center font-mono text-xs text-slate-600">
                              {doc.issue_date
                                ? new Date(doc.issue_date).toLocaleDateString('vi-VN')
                                : '---'}
                            </span>

                            {/* Chuyên môn */}
                            <span className="w-32 text-center hidden lg:inline">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                <span className={`w-1.5 h-1.5 rounded-full ${dept.dot}`} />
                                <span className="truncate max-w-[100px]">{dept.label}</span>
                              </span>
                            </span>

                            {/* Trạng thái hiệu lực */}
                            <span className="w-28 text-center">
                              {isSuperseded ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                                  <History className="w-3 h-3 text-amber-600" /> Đã thay thế
                                </span>
                              ) : isMissingOnDrive ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
                                  Mất file
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Còn hiệu lực
                                </span>
                              )}
                            </span>

                            {/* Thao tác */}
                            <div
                              className="w-24 text-right flex items-center justify-end gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                data-assistant-trigger="true"
                                onClick={() => selectAndAskDoc(doc.id)}
                                className={`p-1.5 rounded transition-colors ${
                                  selectedDocIds.includes(doc.id)
                                    ? 'bg-indigo-600 text-white shadow-2xs'
                                    : 'hover:bg-indigo-50 text-indigo-600 hover:text-indigo-700'
                                }`}
                                title="Ghim văn bản này vào Trợ lý AI để hỏi sâu nội dung"
                              >
                                <Bot className="w-3.5 h-3.5" />
                              </button>
                              {!isMissingOnDrive && (
                                <button
                                  onClick={() => setPreviewDoc(doc.drive_file_id)}
                                  className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-indigo-600 transition-colors"
                                  title="Xem trước"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {isAdmin && (
                                <button
                                  onClick={() => setEditingDoc(doc)}
                                  className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors"
                                  title="Sửa metadata (Admin)"
                                >
                                  <SlidersHorizontal className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {!isMissingOnDrive && doc.drive_view_url && (
                                <a
                                  href={doc.drive_view_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors"
                                  title="Mở Google Drive"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              /* GRID / CARD VIEW (Kiểu Thẻ Google Drive) */
              <div className="px-6 pt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredDocuments.map((doc) => {
                  const deptCode = doc.department_access?.[0] || '';
                  const dept = getDeptConfig(deptCode);
                  const docCode = `DOC-${doc.id.slice(0, 6).toUpperCase()}`;
                  const isMissingOnDrive = doc.sync_status === 'missing_on_drive';
                  const isSuperseded = doc.status === 'SUPERSEDED';

                  return (
                    <div
                      key={doc.id}
                      className={`bg-white border ${isMissingOnDrive
                          ? 'border-rose-300 hover:border-rose-400'
                          : isSuperseded
                            ? 'border-amber-300 hover:border-amber-400 opacity-95 hover:opacity-100'
                            : 'border-slate-200 hover:border-indigo-400 hover:shadow-md'
                        } rounded-xl overflow-hidden transition-all group cursor-pointer flex flex-col justify-between shadow-xs`}
                      onClick={() => {
                        if (!isMissingOnDrive) setPreviewDoc(doc.drive_file_id);
                        else if (isAdmin) setEditingDoc(doc);
                      }}
                    >
                      {/* 1. Header Khung: Icon + Tên tài liệu + Hiệu lực + Actions */}
                      <div className="p-3.5 pb-2.5 flex items-start justify-between gap-2 border-b border-slate-100 bg-slate-50/70">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="p-2 rounded-lg bg-white border border-slate-200 shadow-xs shrink-0">
                            {getFileIcon(doc.file_name)}
                          </div>
                          <div className="min-w-0">
                            <h4
                              className={`text-xs font-bold truncate ${isMissingOnDrive
                                  ? 'line-through text-slate-400'
                                  : isSuperseded
                                    ? 'text-slate-600'
                                    : 'text-slate-900 group-hover:text-indigo-600'
                                } transition-colors`}
                              title={doc.file_name}
                            >
                              {doc.file_name}
                            </h4>
                            <div className="flex items-center gap-2 mt-0.5">
                              {isSuperseded ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                  <History className="w-2.5 h-2.5 text-amber-600" /> Hết hiệu lực
                                </span>
                              ) : isMissingOnDrive ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                                  Mất file
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <span className="w-1 h-1 rounded-full bg-emerald-500" /> Hiệu lực
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Quick actions */}
                        <div
                          className="flex items-center gap-0.5 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            data-assistant-trigger="true"
                            onClick={() => selectAndAskDoc(doc.id)}
                            className={`p-1 rounded transition-colors ${
                              selectedDocIds.includes(doc.id)
                                ? 'bg-indigo-600 text-white shadow-2xs'
                                : 'hover:bg-indigo-50 text-indigo-600 hover:text-indigo-700'
                            }`}
                            title="Ghim văn bản này vào Trợ lý AI để hỏi sâu nội dung"
                          >
                            <Bot className="w-3.5 h-3.5" />
                          </button>
                          {!isMissingOnDrive && (
                            <button
                              onClick={() => setPreviewDoc(doc.drive_file_id)}
                              className="p-1 rounded hover:bg-slate-200 text-slate-500 hover:text-indigo-600 transition-colors"
                              title="Xem trước"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {isAdmin && (
                            <button
                              onClick={() => setEditingDoc(doc)}
                              className="p-1 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-900 transition-colors"
                              title="Chỉnh sửa metadata (Admin)"
                            >
                              <SlidersHorizontal className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {!isMissingOnDrive && doc.drive_view_url && (
                            <a
                              href={doc.drive_view_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-900 transition-colors"
                              title="Mở Google Drive"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </div>

                      {/* 2. Thân Khung: 4 trường thông tin chi tiết */}
                      <div className="p-3.5 space-y-2 bg-white flex-1">
                        {/* Số hiệu văn bản */}
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500 flex items-center gap-1.5 font-medium">
                            <Hash className="w-3 h-3 text-slate-400" /> Số hiệu:
                          </span>
                          <span className="font-mono font-semibold text-indigo-700 truncate max-w-[150px]">
                            {doc.document_code || '---'}
                          </span>
                        </div>

                        {/* Đơn vị ban hành */}
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500 flex items-center gap-1.5 font-medium">
                            <Building className="w-3 h-3 text-slate-400" /> Đơn vị:
                          </span>
                          <span
                            className="text-slate-800 font-medium truncate max-w-[150px]"
                            title={doc.issuing_authority || undefined}
                          >
                            {abbreviateIssuer(doc.issuing_authority)}
                          </span>
                        </div>

                        {/* Ngày ban hành */}
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500 flex items-center gap-1.5 font-medium">
                            <Calendar className="w-3 h-3 text-slate-400" /> Ban hành:
                          </span>
                          <span className="font-mono text-slate-700 font-medium">
                            {doc.issue_date
                              ? new Date(doc.issue_date).toLocaleDateString('vi-VN')
                              : '---'}
                          </span>
                        </div>

                        {/* Chuyên môn */}
                        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                          <span className="text-slate-500 font-medium">Chuyên môn:</span>
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                            <span className={`w-1.5 h-1.5 rounded-full ${dept.dot}`} />
                            <span className="truncate max-w-[120px]">{dept.label}</span>
                          </span>
                        </div>
                      </div>

                      {/* 3. Đáy khung: Ngày tải lên hệ thống */}
                      <div className="px-3.5 py-2 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-[11px] text-slate-500">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>Tải lên:</span>
                          <span className="font-mono text-slate-600">
                            {doc.created_at ? new Date(doc.created_at).toLocaleDateString('vi-VN') : '---'}
                          </span>
                        </div>
                        {doc.sync_status === 'synced' && (
                          <span className="text-emerald-700 flex items-center gap-1 text-[10px] font-medium">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Đã đồng bộ
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Thêm tài liệu mới (Chỉ dành cho Admin) */}
      {isAdmin && (
        <UploadDocumentModal
          isOpen={isUploadModalOpen}
          onClose={() => setIsUploadModalOpen(false)}
          onSuccess={fetchDocuments}
        />
      )}

      {/* Modal Chỉnh sửa metadata (Chỉ dành cho Admin) */}
      {isAdmin && editingDoc && (
        <EditDocumentModal
          isOpen={!!editingDoc}
          document={editingDoc}
          onClose={() => setEditingDoc(null)}
          onSuccess={() => {
            setEditingDoc(null);
            fetchDocuments();
          }}
        />
      )}

      {/* Modal Xem trước file từ Google Drive */}
      {previewDoc && (
        <DocumentPreviewModal
          fileId={previewDoc}
          onClose={() => setPreviewDoc(null)}
        />
      )}
    </div>
  );
}
