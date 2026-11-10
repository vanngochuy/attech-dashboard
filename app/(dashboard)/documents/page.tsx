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
  Sparkles,
  Scale,
  Building,
  Hash,
  Calendar,
  History,
  Ban,
  Bot,
  X,
  GitCompareArrows
} from 'lucide-react';
import UploadDocumentModal from '@/components/upload-document-modal';
import EditDocumentModal from '@/components/edit-document-modal';
import { DocumentPreviewModal } from '@/components/document-preview-modal';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { abbreviateIssuer } from '@/lib/issuer';
import { useAssistant } from '@/components/assistant-context';
import { useAuth } from '@/components/auth-context';
import { useTheme } from '@/components/theme-context';
import ThemeToggleButton from '@/components/theme-toggle-button';
import UserAvatarMenu from '@/components/user-avatar-menu';

// Danh mục Chuyên môn
const DEPARTMENTS = [
  { id: 'ALL', label: 'Tất cả', shortLabel: 'Tất cả', dot: 'bg-slate-400', icon: Layers },
  { id: 'VB_PHAP_LUAT', label: 'Văn bản Pháp luật & Quy chế', shortLabel: 'VB Pháp luật', dot: 'bg-blue-500', icon: Scale },
  { id: 'QL_KY_THUAT', label: 'Quản lý Kỹ thuật', shortLabel: 'QLKT', dot: 'bg-indigo-500', icon: Wrench },
  { id: 'SMS', label: 'An toàn (SMS)', shortLabel: 'SMS', dot: 'bg-emerald-500', icon: ShieldCheck },
  { id: 'PCCC_CHCN', label: 'PCCC & CHCN', shortLabel: 'PCCC & CHCN', dot: 'bg-rose-500', icon: Flame },
  { id: 'PCTT_TKCN', label: 'PCTT & TKCN', shortLabel: 'PCTT & TKCN', dot: 'bg-cyan-500', icon: Waves },
  { id: 'ATVSLD', label: 'An toàn VSLĐ', shortLabel: 'ATVSLĐ', dot: 'bg-amber-500', icon: HardHat },
  { id: 'CONG_TRINH_HK', label: 'Công trình Hàng không', shortLabel: 'CTHK', dot: 'bg-purple-500', icon: Building2 },
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

// Chuyển đổi định dạng ngày sang YYYY-MM-DD cho input[type="date"]
function toYMD(val?: string | null): string {
  if (!val) return '';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return '';
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  } catch {
    return '';
  }
}

type InlineField = 'document_code' | 'issuing_authority' | 'issue_date' | 'department_access';

function InlineEditable({
  docId,
  field,
  type = 'text',
  displayNode,
  currentValue,
  activeEdit,
  setActiveEdit,
  onSave,
  containerClassName = '',
  inputClassName = '',
  selectOptions,
}: {
  docId: string;
  field: InlineField;
  type?: 'text' | 'date' | 'select';
  displayNode: React.ReactNode;
  currentValue: string;
  activeEdit: { docId: string; field: InlineField; value: string } | null;
  setActiveEdit: (val: { docId: string; field: InlineField; value: string } | null) => void;
  onSave: (docId: string, field: InlineField, value: string) => void;
  containerClassName?: string;
  inputClassName?: string;
  selectOptions?: { id: string; label: string }[];
}) {
  const isEditing = activeEdit?.docId === docId && activeEdit?.field === field;

  if (isEditing && activeEdit) {
    return (
      <div className={containerClassName} onClick={(e) => e.stopPropagation()}>
        {type === 'select' ? (
          <select
            autoFocus
            value={activeEdit.value}
            onChange={(e) => {
              const val = e.target.value;
              setActiveEdit({ docId, field, value: val });
              onSave(docId, field, val);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setActiveEdit(null);
            }}
            onBlur={() => onSave(docId, field, activeEdit.value)}
            className={inputClassName}
          >
            {selectOptions?.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            type={type}
            autoFocus
            value={activeEdit.value}
            onChange={(e) => setActiveEdit({ docId, field, value: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSave(docId, field, activeEdit.value);
              if (e.key === 'Escape') setActiveEdit(null);
            }}
            onBlur={() => onSave(docId, field, activeEdit.value)}
            className={inputClassName}
          />
        )}
      </div>
    );
  }

  return <>{displayNode}</>;
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
  const { isDeepAero } = useTheme();
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<any | null>(null);
  const [previewDoc, setPreviewDoc] = useState<string | null>(null);
  const [mobileCompareDoc, setMobileCompareDoc] = useState<any | null>(null);
  const [isMobileDeptMenuOpen, setIsMobileDeptMenuOpen] = useState(false);
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
  const [filterIncompleteOnly, setFilterIncompleteOnly] = useState(false);
  const [isScanningAiDocId, setIsScanningAiDocId] = useState<string | null>(null);
  const [isBatchScanningAi, setIsBatchScanningAi] = useState(false);
  const [batchScanProgress, setBatchScanProgress] = useState<{ current: number; total: number } | null>(null);
  const [isDbConfigured, setIsDbConfigured] = useState(true);

  // Trạng thái Tìm kiếm ngữ nghĩa bằng AI (Tìm AI)
  const [isAiSearchMode, setIsAiSearchMode] = useState(false);
  const [isAiSearching, setIsAiSearching] = useState(false);
  const [aiSearchResults, setAiSearchResults] = useState<{ id: string; relevance: string; snippet: string }[] | null>(null);
  const [aiSearchSummary, setAiSearchSummary] = useState<string | null>(null);

  const handleTriggerAiSearch = async (overrideQuery?: string) => {
    const q = (overrideQuery ?? searchQuery).trim();
    if (!q) {
      setAiSearchResults(null);
      setAiSearchSummary(null);
      return;
    }

    setIsAiSearching(true);
    setAiSearchSummary(null);

    try {
      const res = await fetch('/api/documents/search-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, dept: activeFilter }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Lỗi khi tìm kiếm AI');
      }

      if (Array.isArray(data.results)) {
        setAiSearchResults(data.results);
        if (data.results.length === 0) {
          setAiSearchSummary(`AI đã quét toàn bộ văn bản nhưng không tìm thấy nội dung phù hợp với "${q}".`);
        } else {
          setAiSearchSummary(`AI tìm thấy ${data.results.length} tài liệu có nội dung phù hợp với "${q}".`);
        }
      }
    } catch (err: any) {
      console.error('[AI Search Error]:', err);
      alert(err.message || 'Lỗi tìm kiếm AI');
    } finally {
      setIsAiSearching(false);
    }
  };

  // Trạng thái Quét trực tiếp Google Drive cho Admin
  const [isScanningDrive, setIsScanningDrive] = useState(false);
  const [scanNotification, setScanNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Trạng thái Chỉnh sửa trực tiếp tại chỗ (Inline Edit) cho Admin
  const [inlineEdit, setInlineEdit] = useState<{ docId: string; field: InlineField; value: string } | null>(null);
  const [inlineSavingDocId, setInlineSavingDocId] = useState<string | null>(null);

  const handleSaveInline = async (docId: string, field: InlineField, newValue: string) => {
    const targetDoc = documents.find((d) => d.id === docId);
    if (!targetDoc) {
      setInlineEdit(null);
      return;
    }

    const trimmed = newValue.trim();
    const currentValue = field === 'department_access'
      ? (targetDoc.department_access?.[0] || 'QL_KY_THUAT')
      : (targetDoc[field] || '');

    // Nếu không thay đổi thì đóng chế độ sửa
    if (currentValue === trimmed) {
      setInlineEdit(null);
      return;
    }

    // 1. Cập nhật giao diện tức thì (Optimistic update)
    setDocuments((prev) =>
      prev.map((d) => {
        if (d.id !== docId) return d;
        if (field === 'department_access') {
          return { ...d, department_access: [trimmed] };
        }
        return { ...d, [field]: trimmed };
      })
    );

    setInlineEdit(null);
    setInlineSavingDocId(docId);

    // 2. Gửi API cập nhật cơ sở dữ liệu Supabase
    try {
      const payload: Record<string, any> = { id: docId };
      if (field === 'department_access') {
        payload.department_access = [trimmed];
      } else {
        payload[field] = trimmed;
      }

      const res = await fetch('/api/documents/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Cập nhật thất bại');
      }
    } catch (err: any) {
      console.error('Lỗi lưu inline:', err);
      // Rollback nếu có lỗi
      setDocuments((prev) =>
        prev.map((d) => (d.id === docId ? targetDoc : d))
      );
      alert('Không thể lưu thay đổi: ' + (err.message || 'Lỗi mạng'));
    } finally {
      setInlineSavingDocId(null);
    }
  };

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

  // Bộ lọc tìm kiếm đa trường & đa từ khóa thông minh HOẶC Tìm kiếm AI:
  // - Chế độ Tìm nhanh: Lọc tức thì (tên văn bản, số hiệu, đơn vị, năm)
  // - Chế độ Tìm AI: Lọc sâu vào nội dung toàn văn theo độ liên quan từ Gemini
  const filteredDocuments = useMemo(() => {
    // 1. Nếu đang ở chế độ Tìm AI và đã có kết quả từ AI
    if (isAiSearchMode && aiSearchResults !== null) {
      const idOrderMap = new Map(aiSearchResults.map((r, i) => [r.id, i]));
      const matchedDocs = documents.filter((doc) => idOrderMap.has(doc.id));

      const furtherFiltered = matchedDocs.filter((doc) => {
        const matchesDept = activeFilter === 'ALL' || doc.department_access?.includes(activeFilter);
        if (!matchesDept) return false;

        if (issuerFilter !== 'ALL') {
          const docIssuerShort = abbreviateIssuer(doc.issuing_authority);
          if (docIssuerShort !== issuerFilter) return false;
        }

        const docYear = doc.issue_date ? String(new Date(doc.issue_date).getFullYear()) : '';
        if (yearFilter !== 'ALL' && docYear !== yearFilter) return false;

        const matchesMissing = filterMissingOnly ? doc.sync_status === 'missing_on_drive' : true;
        if (!matchesMissing) return false;

        const matchesIncomplete = filterIncompleteOnly ? isDocMissingMeta(doc) : true;
        if (!matchesIncomplete) return false;

        const matchesStatus =
          statusFilter === 'ALL'
            ? true
            : statusFilter === 'ACTIVE'
              ? doc.status !== 'SUPERSEDED'
              : doc.status === 'SUPERSEDED';
        if (!matchesStatus) return false;

        return true;
      });

      // Sắp xếp thứ tự văn bản phù hợp nhất lên đầu
      return furtherFiltered.sort((a, b) => (idOrderMap.get(a.id) ?? 999) - (idOrderMap.get(b.id) ?? 999));
    }

    // 2. Chế độ Tìm nhanh mặc định:
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

      // 4. Lọc theo Trạng thái mất file & Hiệu lực & Chưa đủ metadata
      const matchesMissing = filterMissingOnly ? doc.sync_status === 'missing_on_drive' : true;
      if (!matchesMissing) return false;

      const matchesIncomplete = filterIncompleteOnly ? isDocMissingMeta(doc) : true;
      if (!matchesIncomplete) return false;

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
  }, [documents, searchQuery, isAiSearchMode, aiSearchResults, filterMissingOnly, statusFilter, activeFilter, issuerFilter, yearFilter]);

  // Chia sẻ danh sách đang lọc cho Trợ lý AI nổi
  useEffect(() => {
    const label = DEPARTMENTS.find((d) => d.id === activeFilter)?.label || 'Tất cả';
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

  // Kiểm tra tài liệu có bị thiếu metadata cốt lõi hay không (Số hiệu, Cơ quan ban hành, Ngày ban hành)
  const isDocMissingMeta = useCallback((doc: any) => {
    const code = (doc.document_code || '').trim();
    const issuer = (doc.issuing_authority || '').trim();
    const date = doc.issue_date;
    return !code || !issuer || !date;
  }, []);

  // Đếm số lượng file chưa hiển đủ metadata
  const incompleteMetaCount = useMemo(() => {
    return documents.filter(isDocMissingMeta).length;
  }, [documents, isDocMissingMeta]);

  // Hàm Quét AI 2 trang đầu cho 1 tài liệu đơn lẻ (Dành cho Admin)
  const handleScanSingleDocAi = async (doc: any) => {
    if (isScanningAiDocId || isBatchScanningAi) return;
    setIsScanningAiDocId(doc.id);
    setScanNotification(null);

    try {
      const res = await fetch('/api/documents/scan-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doc_id: doc.id }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Lỗi quét AI trích xuất metadata');
      }

      // Cập nhật state documents tức thì
      if (data.metadata) {
        setDocuments((prev) =>
          prev.map((d) => (d.id === doc.id ? { ...d, ...data.metadata } : d))
        );
      }

      setScanNotification({
        type: 'success',
        text: `Quét AI (2 trang đầu) thành công: Số hiệu [${data.metadata?.document_code || 'Không có'}], Cơ quan [${data.metadata?.issuing_authority || 'Không có'}], Ngày [${data.metadata?.issue_date || 'Chưa rõ'}].`,
      });
    } catch (err: any) {
      console.error('Lỗi quét AI tài liệu:', err);
      setScanNotification({
        type: 'error',
        text: `Lỗi quét AI "${doc.file_name}": ${err.message || 'Không thể kết nối máy chủ'}`,
      });
    } finally {
      setIsScanningAiDocId(null);
      setTimeout(() => {
        setScanNotification(null);
      }, 7000);
    }
  };

  // Hàm Quét AI hàng loạt cho các tài liệu chưa đủ metadata (Dành cho Admin)
  const handleBatchScanIncompleteAi = async () => {
    if (isBatchScanningAi || isScanningAiDocId) return;
    const targetDocs = documents.filter(isDocMissingMeta);
    if (targetDocs.length === 0) return;

    const confirmed = window.confirm(
      `Hệ thống phát hiện ${targetDocs.length} tài liệu chưa hiển thị đủ metadata.\nBạn có muốn tự động quét AI (cấu hình 2 trang đầu) để trích xuất và bổ sung Số hiệu, Đơn vị và Ngày ban hành không?`
    );
    if (!confirmed) return;

    setIsBatchScanningAi(true);
    setBatchScanProgress({ current: 0, total: targetDocs.length });
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < targetDocs.length; i++) {
      const doc = targetDocs[i];
      setBatchScanProgress({ current: i + 1, total: targetDocs.length });
      setIsScanningAiDocId(doc.id);

      try {
        const res = await fetch('/api/documents/scan-ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ doc_id: doc.id }),
        });
        const data = await res.json();
        if (res.ok && data.success && data.metadata) {
          successCount++;
          setDocuments((prev) =>
            prev.map((d) => (d.id === doc.id ? { ...d, ...data.metadata } : d))
          );
        } else {
          failCount++;
        }
      } catch (err) {
        failCount++;
        console.error(`Lỗi quét AI "${doc.file_name}":`, err);
      }
    }

    setIsScanningAiDocId(null);
    setIsBatchScanningAi(false);
    setBatchScanProgress(null);
    setScanNotification({
      type: successCount > 0 ? 'success' : 'error',
      text: `Hoàn tất quét AI tự động: Thành công ${successCount}/${targetDocs.length} tài liệu${failCount > 0 ? `, thất bại ${failCount}` : ''}.`,
    });
    setTimeout(() => {
      setScanNotification(null);
    }, 7000);
  };

  const activeDept = DEPARTMENTS.find((d) => d.id === activeFilter) || DEPARTMENTS[0];

  const getDeptConfig = (code: string) => {
    const found = DEPARTMENTS.find((d) => d.id === code);
    if (found) return found;

    // Rút gọn thông minh cho các tên/mã chuyên môn tự do
    const lower = (code || '').toLowerCase();
    let short = code || 'Chung';
    if (lower.includes('quản lý kỹ thuật') || lower.includes('quan ly ky thuat') || lower.includes('ql_ky_thuat')) short = 'QLKT';
    else if (lower.includes('công trình hàng không') || lower.includes('cong trinh hang khong') || lower.includes('cong_trinh_hk')) short = 'CTHK';
    else if (lower.includes('cục hàng không') || lower.includes('cuc hang khong') || lower.includes('chk') || lower.includes('caav')) short = 'CHK';

    return { id: code, label: code || 'Chung', shortLabel: short, dot: 'bg-slate-400', icon: FileText };
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

      {/* Khối Tiêu đề & Thanh Chuyên môn: Hỗ trợ linh hoạt 2 chủ đề: Sky Cloud (mặc định) & Deep Aero (Khí quyển sâu) */}
      <div
        className={`relative border-b shadow-sm shrink-0 overflow-hidden z-20 ${
          isDeepAero
            ? 'deep-aero-bg border-sky-950'
            : 'bg-gradient-to-r from-[#0284c7] via-[#0ea5e9] to-[#38bdf8] border-sky-300'
        }`}
      >
        {/* Các đám mây trắng bồng bềnh trang trí trên nền bầu trời (Chỉ hiện khi ở chủ đề Sky Cloud) */}
        {!isDeepAero && (
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
        )}

        {/* Top Bar Header */}
        <header className={`h-14 border-b flex items-center justify-between px-3.5 sm:px-6 relative z-10 ${isDeepAero ? 'border-white/10' : 'border-white/20'}`}>
          <div className="flex sm:hidden items-center gap-2 text-white font-bold text-xs drop-shadow-2xs">
            <img src="/attech-logo.png" alt="ATTECH" className="w-6 h-6 rounded-full object-contain shrink-0" />
            <span className="truncate">Kho Tài liệu ({filteredDocuments.length})</span>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-white font-bold text-sm drop-shadow-2xs">
            <Cloud className="w-4 h-4 text-white fill-white/80" />
            <span>Kho Văn bản &amp; Tài liệu Nghiệp vụ</span>
          </div>

          {/* Right Action Tools */}
          <div className="flex items-center gap-2 ml-auto">
            {/* Nút chuyển đổi Theme (Sky Cloud <-> Deep Aero) nằm bên trái Drive: Synced */}
            <ThemeToggleButton />

            {/* Trạng thái Google Drive dạng mờ Glassmorphism (bỏ Supabase Ready) */}
            <div className="hidden lg:flex items-center mr-1">
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs shadow-xs transition-all ${
                  isDeepAero
                    ? 'glass-pill-deep-aero'
                    : 'bg-white/40 backdrop-blur-[35px] border border-white/60 text-[#0f2043]'
                }`}
              >
                <span className={`p-0.5 rounded ${isDeepAero ? 'bg-sky-500/20 text-sky-300' : 'bg-white/50 border border-white/60 text-sky-700'}`}>
                  <Cloud className="w-3.5 h-3.5" />
                </span>
                <span className={`font-semibold ${isDeepAero ? 'text-slate-200' : 'text-[#0f2043]'}`}>Drive:</span>
                <span className="text-emerald-400 font-bold font-mono">Synced</span>
              </div>
            </div>

            {/* Admin Quét Drive Nhanh (Dạng mờ Glassmorphism) */}
            {isAdmin && (
              <button
                onClick={handleScanDrive}
                disabled={isScanningDrive}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-xs disabled:opacity-50 cursor-pointer ${
                  isDeepAero
                    ? 'glass-pill-deep-aero'
                    : 'bg-white/40 hover:bg-white/55 border border-white/60 hover:border-white/80 text-[#0f2043] backdrop-blur-[35px]'
                }`}
                title="Admin: Kích hoạt n8n quét và kiểm tra sự tồn tại của toàn bộ file trên Google Drive"
              >
                <span className={`p-0.5 rounded ${isDeepAero ? 'bg-amber-400/20 text-amber-300' : 'bg-white/50 border border-white/60 text-amber-700'}`}>
                  {isScanningDrive ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ShieldAlert className="w-3.5 h-3.5" />
                  )}
                </span>
                <span className="hidden sm:inline font-semibold">{isScanningDrive ? 'Đang quét...' : 'Quét Drive'}</span>
              </button>
            )}

            {/* Refresh button (Glassmorphism) */}
            <button
              onClick={fetchDocuments}
              disabled={isLoading}
              className={`p-2 rounded-lg transition-colors shadow-xs disabled:opacity-50 cursor-pointer ${
                isDeepAero
                  ? 'glass-pill-deep-aero'
                  : 'bg-white/40 hover:bg-white/55 border border-white/60 hover:border-white/80 text-[#0f2043] backdrop-blur-[35px]'
              }`}
              title="Làm mới danh sách"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>

            {/* View toggle (Chỉ hiển thị trên PC; trên iPhone tự động hiển thị Thẻ thông minh) */}
            <div className={`hidden md:flex items-center p-0.5 backdrop-blur-xs rounded-lg border ${isDeepAero ? 'bg-sky-950/40 border-white/15' : 'bg-sky-900/20 border-white/30'}`}>
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
                className={`flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 active:scale-95 text-white rounded-lg text-xs font-semibold transition-all shadow-md cursor-pointer ${
                  isDeepAero
                    ? 'bg-sky-600 hover:bg-sky-500 border border-sky-400/40 shadow-sky-900/50'
                    : 'bg-[#1b3252] hover:bg-slate-900 border border-white/25'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Thêm tài liệu</span>
                <span className="hidden sm:inline text-[10px] text-sky-200 font-mono ml-0.5">C</span>
              </button>
            )}

            {/* Menu Tài khoản User hình tròn góc phải trên cùng */}
            <UserAvatarMenu />
          </div>
        </header>

        {/* Sub-header / Filter Pills Bar trên PC (Dạng mờ Glassmorphism) */}
        <div className={`hidden md:flex px-6 py-2.5 items-center justify-between overflow-x-auto no-scrollbar relative z-10 border-t ${
          isDeepAero
            ? 'bg-black/20 backdrop-blur-[20px] border-white/10'
            : 'bg-white/20 backdrop-blur-[35px] border-white/40'
        }`}>
          {/* Department Pills */}
          <div className="flex items-center gap-2">
            {DEPARTMENTS.map((dept) => {
              const isActive = activeFilter === dept.id;
              const count = departmentCounts[dept.id] || 0;
              const DeptIcon = dept.icon;
              return (
                <button
                  key={dept.id}
                  onClick={() => {
                    setActiveFilter(dept.id);
                    setFilterMissingOnly(false);
                  }}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs transition-all shrink-0 cursor-pointer font-semibold ${
                    isDeepAero
                      ? isActive
                        ? 'glass-pill-deep-aero active'
                        : 'glass-pill-deep-aero'
                      : isActive
                        ? 'bg-white/95 text-[#0f2043] font-bold shadow-md border border-white'
                        : 'bg-white/40 hover:bg-white/55 text-[#0f2043] font-semibold border border-white/60 hover:border-white/80 backdrop-blur-[35px] shadow-xs'
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                      isDeepAero
                        ? isActive
                          ? 'bg-sky-600 text-white'
                          : 'bg-white/15 text-sky-200'
                        : isActive
                          ? 'bg-sky-600 text-white shadow-2xs'
                          : 'bg-white/50 backdrop-blur-[35px] border border-white/70 text-[#0f2043] shadow-2xs'
                    }`}
                  >
                    <DeptIcon className="w-3 h-3" />
                  </span>
                  <span>{dept.label}</span>
                  <span
                    className={`pill-badge text-[11px] font-mono px-1.5 py-0.2 rounded-full transition-colors ${
                      isDeepAero
                        ? ''
                        : isActive
                          ? 'bg-sky-100 text-sky-800 font-bold border border-sky-200'
                          : 'bg-white/50 text-[#0f2043] font-bold border border-white/60'
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

      {/* Banner Hỗ trợ Quét AI xử lý file chưa đủ metadata (Chỉ hiển thị cho Admin) */}
      {isAdmin && incompleteMetaCount > 0 && (
        <div className="mx-6 mt-3 p-3 rounded-xl bg-purple-50/90 border border-purple-200 flex flex-wrap items-center justify-between gap-2.5 text-xs text-purple-950 shrink-0 shadow-xs">
          <div className="flex items-center gap-2.5">
            <span className="p-1 rounded-lg bg-purple-100 text-purple-700 border border-purple-200">
              <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
            </span>
            <span>
              <strong>Quét AI trích xuất (2 trang đầu):</strong> Phát hiện{' '}
              <strong className="text-purple-900 underline">{incompleteMetaCount} tài liệu</strong> chưa hiển thị đủ metadata (Số hiệu, Đơn vị hoặc Ngày ban hành).
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilterIncompleteOnly(!filterIncompleteOnly)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                filterIncompleteOnly
                  ? 'bg-purple-700 text-white border-purple-800 shadow-2xs'
                  : 'bg-white hover:bg-purple-100 text-purple-900 border-purple-300'
              }`}
            >
              {filterIncompleteOnly ? 'Hiện tất cả' : 'Lọc file thiếu'}
            </button>
            <button
              onClick={handleBatchScanIncompleteAi}
              disabled={isBatchScanningAi || isScanningAiDocId !== null}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white transition-all shadow-xs disabled:opacity-50 cursor-pointer"
              title="Tự động quét AI (cấu hình 2 trang đầu) để bổ sung metadata cho toàn bộ file thiếu"
            >
              {isBatchScanningAi ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang quét AI ({batchScanProgress?.current}/{batchScanProgress?.total})...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Quét AI tự động ({incompleteMetaCount} file)</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Thanh Tìm kiếm & Lọc Đa Trường (Cố định phía trên danh sách) */}
      {!isLoading && isDbConfigured && (
        <>
          {/* GIAO DIỆN IPHONE / MOBILE: Sticky Search + Horizontal Filter Chips vuốt ngang 1 ngón cái */}
          <div className="flex md:hidden flex-col gap-2 px-3.5 py-2.5 bg-white border-b border-slate-200 shadow-xs shrink-0 z-20">
            {/* Hàng 1: Ô tìm kiếm (hỗ trợ đọc giọng nói Micro trên bàn phím iPhone) + Nút Tìm AI */}
            <div className="flex items-center gap-1.5">
              <div className="relative flex-1">
                {isAiSearching ? (
                  <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-600 w-4 h-4 animate-spin" />
                ) : isAiSearchMode ? (
                  <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-600 w-4 h-4" />
                ) : (
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-sky-600 w-4 h-4" />
                )}
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && isAiSearchMode) {
                      handleTriggerAiSearch();
                    }
                  }}
                  placeholder={
                    isAiSearchMode
                      ? 'Nhập nội dung cần quét AI...'
                      : 'Tìm số hiệu, trích yếu (bấm 🎙️ đọc giọng nói)...'
                  }
                  className={`w-full rounded-xl pl-9 pr-8 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden transition-all ${
                    isAiSearchMode
                      ? 'bg-indigo-50/60 focus:bg-white border border-indigo-300 focus:border-indigo-500'
                      : 'bg-slate-100/90 focus:bg-white border border-slate-200 focus:border-sky-500'
                  }`}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      if (isAiSearchMode) {
                        setAiSearchResults(null);
                        setAiSearchSummary(null);
                      }
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-600 p-0.5"
                    title="Xóa từ khóa"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  const nextMode = !isAiSearchMode;
                  setIsAiSearchMode(nextMode);
                  if (!nextMode) {
                    setAiSearchResults(null);
                    setAiSearchSummary(null);
                  } else if (searchQuery.trim()) {
                    handleTriggerAiSearch();
                  }
                }}
                className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-xs shrink-0 active:scale-95 ${
                  isAiSearchMode
                    ? 'bg-gradient-to-r from-indigo-600 to-sky-600 text-white ring-2 ring-indigo-300'
                    : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                }`}
              >
                <Sparkles className={`w-3.5 h-3.5 ${isAiSearchMode ? 'text-amber-300 animate-pulse' : 'text-indigo-600'}`} />
                <span>Tìm AI</span>
              </button>
            </div>

            {/* Hàng 2: Nút "Menu / Lọc" chuyên ngành ở đầu trang + Các nút lọc trạng thái (Không lặp lại các chip chuyên ngành kéo ngang) */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
              {/* Nút Menu / Lọc Chuyên ngành đặt ngay đầu trang Tab Tài liệu */}
              <button
                type="button"
                onClick={() => setIsMobileDeptMenuOpen(true)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold shrink-0 transition-all border shadow-2xs active:scale-95 ${
                  activeFilter !== 'ALL' || issuerFilter !== 'ALL' || yearFilter !== 'ALL'
                    ? 'bg-[#0f2043] text-white border-[#0f2043]'
                    : 'bg-sky-50 text-sky-900 border-sky-300'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>
                  {activeFilter === 'ALL'
                    ? 'Menu / Lọc'
                    : `Lọc: ${getDeptConfig(activeFilter).shortLabel || getDeptConfig(activeFilter).label}`}
                </span>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                    activeFilter !== 'ALL' || issuerFilter !== 'ALL' || yearFilter !== 'ALL'
                      ? 'bg-sky-500/30 text-sky-100'
                      : 'bg-sky-200/70 text-sky-900'
                  }`}
                >
                  {filteredDocuments.length}
                </span>
              </button>

              {/* Chip: Tất cả */}
              <button
                type="button"
                onClick={() => {
                  setActiveFilter('ALL');
                  setStatusFilter('ALL');
                  setIssuerFilter('ALL');
                  setYearFilter('ALL');
                  setFilterIncompleteOnly(false);
                  setFilterMissingOnly(false);
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-all border ${
                  activeFilter === 'ALL' &&
                  statusFilter === 'ALL' &&
                  issuerFilter === 'ALL' &&
                  yearFilter === 'ALL' &&
                  !filterIncompleteOnly &&
                  !filterMissingOnly
                    ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                    : 'bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                Tất cả ({documents.length})
              </button>

              {/* Chip: Có hiệu lực */}
              <button
                type="button"
                onClick={() => setStatusFilter(statusFilter === 'ACTIVE' ? 'ALL' : 'ACTIVE')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-all border ${
                  statusFilter === 'ACTIVE'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-emerald-50/70 text-emerald-800 border-emerald-200'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${statusFilter === 'ACTIVE' ? 'bg-white' : 'bg-emerald-500'}`} />
                <span>Có hiệu lực</span>
              </button>

              {/* Chip: Đã thay thế */}
              <button
                type="button"
                onClick={() => setStatusFilter(statusFilter === 'SUPERSEDED' ? 'ALL' : 'SUPERSEDED')}
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-all border ${
                  statusFilter === 'SUPERSEDED'
                    ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                    : 'bg-amber-50/70 text-amber-800 border-amber-200'
                }`}
              >
                <History className="w-3 h-3" />
                <span>Đã thay thế</span>
              </button>

              {/* Chip: Chưa đọc AI (nếu có file thiếu metadata) */}
              {incompleteMetaCount > 0 && (
                <button
                  type="button"
                  onClick={() => setFilterIncompleteOnly(!filterIncompleteOnly)}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-all border ${
                    filterIncompleteOnly
                      ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                      : 'bg-purple-50 text-purple-800 border-purple-200'
                  }`}
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Chưa đọc AI ({incompleteMetaCount})</span>
                </button>
              )}
            </div>
          </div>

          {/* GIAO DIỆN MÁY TÍNH (PC): Giữ nguyên 100% thanh lọc đa trường */}
          <div className="hidden md:flex px-6 py-2.5 bg-white border-b border-slate-200 shadow-2xs shrink-0 z-20 flex-col lg:flex-row lg:items-center justify-between gap-2.5">
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
              filterMissingOnly ||
              filterIncompleteOnly) && (
              <button
                type="button"
                onClick={() => {
                  setActiveFilter('ALL');
                  setIssuerFilter('ALL');
                  setYearFilter('ALL');
                  setStatusFilter('ALL');
                  setSearchQuery('');
                  setFilterMissingOnly(false);
                  setFilterIncompleteOnly(false);
                }}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer"
                title="Xóa toàn bộ điều kiện tìm kiếm và bộ lọc"
              >
                <X className="w-3 h-3" />
                <span>Xóa bộ lọc</span>
              </button>
            )}
          </div>

          {/* Phải: Các trường lọc nâng cao (Từ khóa / Tìm AI + Chuyên môn + Đơn vị ban hành + Năm ban hành + Hiệu lực) */}
          <div className="flex flex-wrap items-center gap-2 flex-1 justify-end">
            {/* Cụm Tìm kiếm: Ô nhập liệu + Nút Tìm AI */}
            <div className="flex items-center gap-1.5 flex-1 min-w-[280px] max-w-lg">
              <div className="relative flex-1">
                {isAiSearching ? (
                  <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-600 w-3.5 h-3.5 animate-spin" />
                ) : isAiSearchMode ? (
                  <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-600 w-3.5 h-3.5" />
                ) : (
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-sky-600 w-3.5 h-3.5" />
                )}
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && isAiSearchMode) {
                      handleTriggerAiSearch();
                    }
                  }}
                  placeholder={
                    isAiSearchMode
                      ? 'Nhập nội dung cần tìm (VD: khai thác thiết bị vor)... (Nhấn Enter)'
                      : 'Tìm từ khóa: tên văn bản + năm, số hiệu, đơn vị (VD: an toàn 2025)...'
                  }
                  className={`w-full rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden transition-all ${
                    isAiSearchMode
                      ? 'bg-indigo-50/50 focus:bg-white border border-indigo-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 shadow-2xs'
                      : 'bg-slate-50 focus:bg-white border border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/15'
                  }`}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      if (isAiSearchMode) {
                        setAiSearchResults(null);
                        setAiSearchSummary(null);
                      }
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-600 cursor-pointer"
                    title="Xóa từ khóa"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Nút Tìm AI */}
              <button
                type="button"
                onClick={() => {
                  const nextMode = !isAiSearchMode;
                  setIsAiSearchMode(nextMode);
                  if (!nextMode) {
                    setAiSearchResults(null);
                    setAiSearchSummary(null);
                  } else if (searchQuery.trim()) {
                    handleTriggerAiSearch();
                  }
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-xs cursor-pointer shrink-0 ${
                  isAiSearchMode
                    ? 'bg-gradient-to-r from-indigo-600 via-sky-600 to-indigo-700 text-white shadow-indigo-500/25 ring-2 ring-indigo-400/80 active:scale-95'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 active:scale-95'
                }`}
                title={isAiSearchMode ? 'Tắt chế độ Tìm AI (quay về Tìm nhanh)' : 'Bật chế độ Tìm AI (quét sâu nội dung bên trong văn bản)'}
              >
                <Sparkles className={`w-3.5 h-3.5 ${isAiSearchMode ? 'text-amber-300 animate-pulse' : 'text-indigo-600'}`} />
                <span>Tìm AI</span>
                {isAiSearchMode && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping ml-0.5" />
                )}
              </button>
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
        </>
      )}

      {/* Main Document Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Banner trạng thái Tìm AI */}
        {isAiSearchMode && (
          <div className="px-4 sm:px-6 py-2.5 bg-gradient-to-r from-indigo-50/90 via-sky-50/90 to-purple-50/90 border-b border-indigo-100 flex items-center justify-between text-xs text-indigo-900 shadow-2xs">
            <div className="flex items-center gap-2 min-w-0">
              {isAiSearching ? (
                <>
                  <Loader2 className="w-4 h-4 text-indigo-600 animate-spin shrink-0" />
                  <span className="font-medium text-indigo-900">
                    Trợ lý AI đang đọc quét toàn văn nội dung tài liệu...
                  </span>
                </>
              ) : aiSearchSummary ? (
                <>
                  <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span className="font-semibold text-indigo-950 truncate">{aiSearchSummary}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span className="text-slate-700">
                    Chế độ <strong>Tìm AI</strong> đang bật: Nhập nội dung tự nhiên vào ô tìm kiếm rồi nhấn <strong>Enter</strong> để quét nội dung toàn văn.
                  </span>
                  <button
                    type="button"
                    onClick={() => handleTriggerAiSearch()}
                    disabled={!searchQuery.trim()}
                    className="ml-2 px-2.5 py-0.5 rounded bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-[11px] shadow-2xs cursor-pointer"
                  >
                    Quét tìm ngay
                  </button>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setIsAiSearchMode(false);
                setAiSearchResults(null);
                setAiSearchSummary(null);
              }}
              className="text-xs text-indigo-600 hover:text-indigo-800 underline cursor-pointer shrink-0 ml-4 font-medium"
            >
              Tắt Tìm AI
            </button>
          </div>
        )}

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
                    setFilterIncompleteOnly(false);
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium border border-slate-200 shadow-xs transition-colors"
                >
                  Đặt lại bộ lọc
                </button>
              </div>
            ) : (
              <>
                {/* GIAO DIỆN THẺ VĂN BẢN THÔNG MINH TRÊN IPHONE (3 hàng gọn gàng, không bao giờ phải cuộn ngang) */}
                <div className="md:hidden px-3.5 pt-3 space-y-2.5">
                  {filteredDocuments.map((doc) => {
                    const deptCode = doc.department_access?.[0] || '';
                    const dept = getDeptConfig(deptCode);
                    const isMissingOnDrive = doc.sync_status === 'missing_on_drive';
                    const isSuperseded = doc.status === 'SUPERSEDED';
                    const aiSnippet = isAiSearchMode ? aiSearchResults?.find((r) => r.id === doc.id)?.snippet : null;
                    const isPinnedAi = selectedDocIds.includes(doc.id);

                    return (
                      <div
                        key={doc.id}
                        className={`rounded-2xl border p-3.5 shadow-xs transition-all bg-white ${
                          isMissingOnDrive
                            ? 'border-rose-300 bg-rose-50/20'
                            : isSuperseded
                              ? 'border-amber-200 bg-amber-50/15'
                              : isPinnedAi
                                ? 'border-indigo-400 ring-1 ring-indigo-300'
                                : 'border-slate-200/90'
                        }`}
                      >
                        {/* Hàng 1 (Tiêu đề ưu tiên số 1): Tên văn bản hiển thị ĐẦY ĐỦ 100%, không cắt chữ (...), bấm vào mở PDF ngay */}
                        <div
                          onClick={() => {
                            if (!isMissingOnDrive) setPreviewDoc(doc.drive_file_id);
                          }}
                          className={`mb-2 ${!isMissingOnDrive ? 'cursor-pointer active:opacity-75' : 'cursor-not-allowed'}`}
                        >
                          <div className="flex items-start gap-2">
                            <div className="shrink-0 mt-0.5">{getFileIcon(doc.file_name)}</div>
                            <h4
                              className={`text-[13.5px] font-bold leading-snug break-words whitespace-normal flex-1 ${
                                isMissingOnDrive
                                  ? 'line-through text-slate-400'
                                  : isSuperseded
                                    ? 'text-slate-700'
                                    : 'text-slate-900'
                              }`}
                            >
                              {doc.file_name}
                            </h4>
                          </div>
                          {aiSnippet && (
                            <div className="mt-1.5 p-2 rounded-lg bg-indigo-50/80 border border-indigo-200/70 text-[11px] text-indigo-950 break-words whitespace-normal">
                              <Sparkles className="w-3 h-3 text-indigo-600 inline mr-1" />
                              <strong className="text-indigo-800">AI:</strong> {aiSnippet}
                            </div>
                          )}
                        </div>

                        {/* Hàng 2 (Ngày ban hành & Định danh): Ưu tiên hiển thị rõ Ngày ban hành + Số/Ký hiệu + Trạng thái Hiệu lực */}
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5 px-2.5 py-1.5 rounded-xl bg-slate-50/90 border border-slate-100">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-semibold text-slate-500">Ngày ban hành:</span>
                            <span className="font-mono text-xs font-extrabold text-sky-800 bg-sky-50 border border-sky-200/80 px-2 py-0.5 rounded-md">
                              {doc.issue_date ? new Date(doc.issue_date).toLocaleDateString('vi-VN') : '---'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-mono text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded-md break-all">
                              {doc.document_code || `DOC-${doc.id.slice(0, 6).toUpperCase()}`}
                            </span>
                            {isSuperseded ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                                <History className="w-2.5 h-2.5" /> Hết HL
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Còn hiệu lực
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Hàng 3 (Đơn vị & Thao tác nhanh): Tên cơ quan ban hành + 3 nút tròn nhỏ gọn [👁️ Xem PDF] – [✨ Hỏi AI] – [🔄 Đối chiếu] */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-semibold truncate max-w-[115px]">
                              <Building className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate">{abbreviateIssuer(doc.issuing_authority)}</span>
                            </span>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-50 text-slate-600 border border-slate-200 shrink-0">
                              <span className={`w-1.5 h-1.5 rounded-full ${dept.dot}`} />
                              <span>{dept.shortLabel || dept.label}</span>
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                            {/* 1. [👁️ Xem PDF] */}
                            <button
                              type="button"
                              disabled={isMissingOnDrive}
                              onClick={() => !isMissingOnDrive && setPreviewDoc(doc.drive_file_id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-slate-100 active:bg-slate-200 text-slate-700 text-[11px] font-semibold border border-slate-200 disabled:opacity-40"
                              title="Xem PDF"
                            >
                              <Eye className="w-3.5 h-3.5 text-sky-600" />
                              <span>PDF</span>
                            </button>

                            {/* 2. [✨ Hỏi AI] (1 chạm gắn văn bản vào Chatbot) */}
                            <button
                              type="button"
                              data-assistant-trigger="true"
                              onClick={() => selectAndAskDoc(doc.id)}
                              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-bold transition-all shadow-2xs active:scale-95 ${
                                isPinnedAi
                                  ? 'bg-indigo-600 text-white border border-indigo-600'
                                  : 'bg-indigo-50 text-indigo-700 border border-indigo-200 active:bg-indigo-100'
                              }`}
                              title="Hỏi AI đúng văn bản này"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>Hỏi AI</span>
                            </button>

                            {/* 3. [🔄 Đối chiếu] */}
                            <button
                              type="button"
                              onClick={() => setMobileCompareDoc(doc)}
                              className="w-8 h-8 rounded-full bg-amber-50 active:bg-amber-100 text-amber-700 border border-amber-200 flex items-center justify-center"
                              title="Đối chiếu tình trạng hiệu lực & metadata"
                            >
                              <GitCompareArrows className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* GIAO DIỆN MÁY TÍNH (PC): Giữ nguyên Table / Grid */}
                <div className="hidden md:block">
                  {viewMode === 'list' ? (
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
                      <span className="w-24 sm:w-28 text-center">NGÀY BAN HÀNH</span>
                      <span className="w-32 text-center hidden lg:inline">CHUYÊN MÔN</span>
                      <span className="w-28 text-center hidden sm:inline">HIỆU LỰC</span>
                      <span className={`${isAdmin ? 'w-20' : 'w-10'} text-center`}></span>
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
                      const aiSnippet = isAiSearchMode ? aiSearchResults?.find((r) => r.id === doc.id)?.snippet : null;

                      return (
                        <div
                          key={doc.id}
                          className={`min-h-14 py-2.5 px-4 flex items-center justify-between hover:bg-slate-50 transition-colors group last:rounded-b-xl ${isMissingOnDrive
                              ? 'bg-rose-50/30'
                              : isSuperseded
                                ? 'bg-amber-50/20'
                                : 'bg-white'
                            }`}
                        >
                          {/* Left: Icon + File Name + Snippet -> Nhấn vào TÊN VĂN BẢN để mở xem trước */}
                          <div
                            className={`flex items-start gap-3 min-w-0 pr-3 flex-1 ${
                              !isMissingOnDrive ? 'cursor-pointer group/title' : 'cursor-not-allowed'
                            }`}
                            onClick={() => {
                              if (!isMissingOnDrive) setPreviewDoc(doc.drive_file_id);
                            }}
                            title={!isMissingOnDrive ? `Nhấn để xem trước: ${doc.file_name}` : 'File bị mất trên Google Drive'}
                          >
                            <div className="shrink-0 mt-0.5">{getFileIcon(doc.file_name)}</div>
                            <div className="min-w-0 flex-1">
                              <span
                                className={`text-xs font-semibold block whitespace-normal break-words lg:truncate ${isMissingOnDrive
                                    ? 'text-slate-400 line-through decoration-rose-500/50'
                                    : isSuperseded
                                      ? 'text-slate-600 group-hover/title:text-indigo-600 group-hover/title:underline'
                                      : 'text-slate-900 group-hover/title:text-indigo-600 group-hover/title:underline'
                                  } transition-colors`}
                              >
                                {doc.file_name}
                              </span>
                              {aiSnippet && (
                                <div className="mt-1 flex items-start gap-1.5 text-[11px] text-indigo-950 bg-indigo-50/90 px-2 py-0.5 rounded border border-indigo-200/70 max-w-2xl">
                                  <Sparkles className="w-3 h-3 text-indigo-600 shrink-0 mt-0.5" />
                                  <span className="line-clamp-2">
                                    <strong className="font-semibold text-indigo-800">Trích dẫn AI:</strong> {aiSnippet}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Right Columns */}
                          <div className="flex items-center gap-4 shrink-0">
                            {/* Số hiệu -> Không mở xem trước; Admin click 2 lần (double click) để sửa trực tiếp tại chỗ */}
                            <InlineEditable
                              docId={doc.id}
                              field="document_code"
                              type="text"
                              currentValue={doc.document_code || ''}
                              activeEdit={inlineEdit}
                              setActiveEdit={setInlineEdit}
                              onSave={handleSaveInline}
                              containerClassName="w-28 shrink-0"
                              inputClassName="w-full text-xs font-mono font-semibold px-1.5 py-0.5 bg-white border border-indigo-400 rounded focus:outline-hidden focus:ring-2 focus:ring-indigo-300 text-indigo-900 shadow-xs"
                              displayNode={
                                <span
                                  onClick={(e) => e.stopPropagation()}
                                  onDoubleClick={(e) => {
                                    e.stopPropagation();
                                    if (isAdmin) {
                                      setInlineEdit({ docId: doc.id, field: 'document_code', value: doc.document_code || '' });
                                    }
                                  }}
                                  className={`w-28 text-left font-mono text-xs font-semibold truncate hidden sm:inline px-1.5 py-0.5 rounded transition-all select-none ${
                                    isAdmin
                                      ? 'cursor-pointer text-indigo-700 hover:bg-sky-100/70 hover:shadow-2xs'
                                      : 'cursor-default text-indigo-700'
                                  }`}
                                >
                                  {doc.document_code || '---'}
                                </span>
                              }
                            />

                            {/* Đơn vị -> Không mở xem trước; Admin click 2 lần (double click) để sửa trực tiếp tại chỗ */}
                            <InlineEditable
                              docId={doc.id}
                              field="issuing_authority"
                              type="text"
                              currentValue={doc.issuing_authority || ''}
                              activeEdit={inlineEdit}
                              setActiveEdit={setInlineEdit}
                              onSave={handleSaveInline}
                              containerClassName="w-28 shrink-0"
                              inputClassName="w-full text-xs font-medium px-1.5 py-0.5 bg-white border border-indigo-400 rounded focus:outline-hidden focus:ring-2 focus:ring-indigo-300 text-slate-800 shadow-xs"
                              displayNode={
                                <span
                                  onClick={(e) => e.stopPropagation()}
                                  onDoubleClick={(e) => {
                                    e.stopPropagation();
                                    if (isAdmin) {
                                      setInlineEdit({ docId: doc.id, field: 'issuing_authority', value: doc.issuing_authority || '' });
                                    }
                                  }}
                                  className={`w-28 text-left text-xs font-medium truncate hidden md:inline px-1.5 py-0.5 rounded transition-all select-none ${
                                    isAdmin
                                      ? 'cursor-pointer text-slate-700 hover:bg-sky-100/70 hover:shadow-2xs'
                                      : 'cursor-default text-slate-700'
                                  }`}
                                >
                                  {abbreviateIssuer(doc.issuing_authority)}
                                </span>
                              }
                            />

                            {/* Ngày ban hành -> Không mở xem trước; Admin click 2 lần (double click) để sửa trực tiếp tại chỗ */}
                            <InlineEditable
                              docId={doc.id}
                              field="issue_date"
                              type="date"
                              currentValue={toYMD(doc.issue_date)}
                              activeEdit={inlineEdit}
                              setActiveEdit={setInlineEdit}
                              onSave={handleSaveInline}
                              containerClassName="w-28 shrink-0"
                              inputClassName="w-full text-xs font-mono font-medium px-1 py-0.5 bg-white border border-indigo-400 rounded focus:outline-hidden focus:ring-2 focus:ring-indigo-300 text-slate-800 shadow-xs"
                              displayNode={
                                <span
                                  onClick={(e) => e.stopPropagation()}
                                  onDoubleClick={(e) => {
                                    e.stopPropagation();
                                    if (isAdmin) {
                                      setInlineEdit({ docId: doc.id, field: 'issue_date', value: toYMD(doc.issue_date) });
                                    }
                                  }}
                                  className={`w-28 text-center font-mono text-xs font-medium px-1.5 py-0.5 rounded transition-all select-none ${
                                    isAdmin
                                      ? 'cursor-pointer text-slate-600 hover:bg-sky-100/70 hover:shadow-2xs'
                                      : 'cursor-default text-slate-600'
                                  }`}
                                >
                                  {doc.issue_date
                                    ? new Date(doc.issue_date).toLocaleDateString('vi-VN')
                                    : '---'}
                                </span>
                              }
                            />

                            {/* Chuyên môn (Rút gọn: QLKT, CTHK, CHK...) -> Không mở xem trước; Admin click 2 lần (double click) để sửa trực tiếp tại chỗ */}
                            <InlineEditable
                              docId={doc.id}
                              field="department_access"
                              type="select"
                              currentValue={doc.department_access?.[0] || 'QL_KY_THUAT'}
                              activeEdit={inlineEdit}
                              setActiveEdit={setInlineEdit}
                              onSave={handleSaveInline}
                              containerClassName="w-32 shrink-0 hidden lg:inline"
                              inputClassName="w-full text-xs font-semibold px-1 py-0.5 bg-white border border-indigo-400 rounded focus:outline-hidden focus:ring-2 focus:ring-indigo-300 text-slate-800 shadow-xs"
                              selectOptions={DEPARTMENTS.filter((d) => d.id !== 'all').map((d) => ({
                                id: d.id,
                                label: d.shortLabel || d.label,
                              }))}
                              displayNode={
                                <span
                                  onClick={(e) => e.stopPropagation()}
                                  onDoubleClick={(e) => {
                                    e.stopPropagation();
                                    if (isAdmin) {
                                      setInlineEdit({
                                        docId: doc.id,
                                        field: 'department_access',
                                        value: doc.department_access?.[0] || 'QL_KY_THUAT',
                                      });
                                    }
                                  }}
                                  className={`w-32 text-center hidden lg:inline px-1 py-0.5 rounded transition-all select-none ${
                                    isAdmin ? 'cursor-pointer hover:bg-sky-100/70' : 'cursor-default'
                                  }`}
                                >
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                    <span className={`w-1.5 h-1.5 rounded-full ${dept.dot}`} />
                                    <span className="truncate max-w-[100px]">{dept.shortLabel || dept.label}</span>
                                  </span>
                                </span>
                              }
                            />

                            {/* Trạng thái hiệu lực */}
                            <span className="w-28 text-center hidden sm:inline">
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

                            {/* Cột Thao tác: Quét AI (Chỉ Admin) & Chatbot AI ở cuối */}
                            <div
                              className={`${isAdmin ? 'w-20' : 'w-10'} flex items-center justify-end gap-1 shrink-0`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {/* Nút Quét AI (Chỉ Admin mới nhìn thấy và sử dụng) đặt TRƯỚC icon Chatbot */}
                              {isAdmin && (
                                <button
                                  onClick={() => handleScanSingleDocAi(doc)}
                                  disabled={isScanningAiDocId === doc.id || isBatchScanningAi}
                                  className={`p-1.5 rounded-lg transition-all cursor-pointer relative ${
                                    isDocMissingMeta(doc)
                                      ? 'bg-amber-50 hover:bg-amber-100 text-amber-600 border border-amber-300 shadow-2xs hover:shadow-xs'
                                      : 'hover:bg-purple-50 text-purple-600 hover:text-purple-700'
                                  } disabled:opacity-50`}
                                  title={
                                    isDocMissingMeta(doc)
                                      ? 'Tài liệu chưa đủ metadata: Nhấn để AI quét 2 trang đầu trích xuất Số hiệu, Đơn vị, Ngày'
                                      : 'Quét AI (2 trang đầu) để cập nhật lại metadata'
                                  }
                                >
                                  {isScanningAiDocId === doc.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                                  ) : (
                                    <>
                                      <Sparkles className="w-4 h-4" />
                                      {isDocMissingMeta(doc) && (
                                        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white animate-pulse" />
                                      )}
                                    </>
                                  )}
                                </button>
                              )}

                              <button
                                data-assistant-trigger="true"
                                onClick={() => selectAndAskDoc(doc.id)}
                                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                  selectedDocIds.includes(doc.id)
                                    ? 'bg-indigo-600 text-white shadow-2xs'
                                    : 'hover:bg-indigo-50 text-indigo-600 hover:text-indigo-700'
                                }`}
                                title="Ghim văn bản này vào Trợ lý AI để hỏi sâu nội dung"
                              >
                                <Bot className="w-4 h-4" />
                              </button>
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
                  const aiSnippet = isAiSearchMode ? aiSearchResults?.find((r) => r.id === doc.id)?.snippet : null;

                  return (
                    <div
                      key={doc.id}
                      className={`bg-white border ${isMissingOnDrive
                          ? 'border-rose-300 hover:border-rose-400'
                          : isSuperseded
                            ? 'border-amber-300 hover:border-amber-400 opacity-95 hover:opacity-100'
                            : 'border-slate-200 hover:border-indigo-400 hover:shadow-md'
                        } rounded-xl overflow-hidden transition-all group flex flex-col justify-between shadow-xs`}
                    >
                      {/* 1. Header Khung: Icon + Tên tài liệu + Hiệu lực + Actions */}
                      <div className="p-3.5 pb-2.5 flex items-start justify-between gap-2 border-b border-slate-100 bg-slate-50/70">
                        {/* Nhấn vào TÊN VĂN BẢN để mở xem trước */}
                        <div
                          className={`flex items-center gap-2.5 min-w-0 flex-1 ${
                            !isMissingOnDrive ? 'cursor-pointer group/title' : 'cursor-not-allowed'
                          }`}
                          onClick={() => {
                            if (!isMissingOnDrive) setPreviewDoc(doc.drive_file_id);
                          }}
                          title={!isMissingOnDrive ? `Nhấn để xem trước: ${doc.file_name}` : 'File bị mất trên Google Drive'}
                        >
                          <div className="p-2 rounded-lg bg-white border border-slate-200 shadow-xs shrink-0">
                            {getFileIcon(doc.file_name)}
                          </div>
                          <div className="min-w-0">
                            <h4
                              className={`text-xs font-bold truncate ${isMissingOnDrive
                                  ? 'line-through text-slate-400'
                                  : isSuperseded
                                    ? 'text-slate-600 group-hover/title:text-indigo-600 group-hover/title:underline'
                                    : 'text-slate-900 group-hover/title:text-indigo-600 group-hover/title:underline'
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

                        {/* Quick action: Icon Quét AI (Chỉ Admin) + Icon Bot */}
                        <div
                          className="flex items-center gap-1 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* Nút Quét AI (Chỉ Admin mới nhìn thấy và sử dụng) đặt TRƯỚC icon Chatbot */}
                          {isAdmin && (
                            <button
                              onClick={() => handleScanSingleDocAi(doc)}
                              disabled={isScanningAiDocId === doc.id || isBatchScanningAi}
                              className={`p-1.5 rounded-lg transition-all cursor-pointer relative ${
                                isDocMissingMeta(doc)
                                  ? 'bg-amber-50 hover:bg-amber-100 text-amber-600 border border-amber-300 shadow-2xs hover:shadow-xs'
                                  : 'hover:bg-purple-50 text-purple-600 hover:text-purple-700'
                              } disabled:opacity-50`}
                              title={
                                isDocMissingMeta(doc)
                                  ? 'Tài liệu chưa đủ metadata: Nhấn để AI quét 2 trang đầu trích xuất Số hiệu, Đơn vị, Ngày'
                                  : 'Quét AI (2 trang đầu) để cập nhật lại metadata'
                              }
                            >
                              {isScanningAiDocId === doc.id ? (
                                <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                              ) : (
                                <>
                                  <Sparkles className="w-4 h-4" />
                                  {isDocMissingMeta(doc) && (
                                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white animate-pulse" />
                                  )}
                                </>
                              )}
                            </button>
                          )}

                          <button
                            data-assistant-trigger="true"
                            onClick={() => selectAndAskDoc(doc.id)}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              selectedDocIds.includes(doc.id)
                                ? 'bg-indigo-600 text-white shadow-2xs'
                                : 'hover:bg-indigo-50 text-indigo-600 hover:text-indigo-700'
                            }`}
                            title="Ghim văn bản này vào Trợ lý AI để hỏi sâu nội dung"
                          >
                            <Bot className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* 2. Thân Khung: 4 trường thông tin chi tiết -> Admin nhấn 2 lần (double click) vào từng trường để sửa trực tiếp tại chỗ */}
                      <div className="p-3.5 space-y-2 bg-white flex-1">
                        {/* Số hiệu văn bản */}
                        <div className="flex items-center justify-between text-xs min-h-[26px]">
                          <span className="text-slate-500 flex items-center gap-1.5 font-medium shrink-0">
                            <Hash className="w-3 h-3 text-slate-400" /> Số hiệu:
                          </span>
                          <InlineEditable
                            docId={doc.id}
                            field="document_code"
                            type="text"
                            currentValue={doc.document_code || ''}
                            activeEdit={inlineEdit}
                            setActiveEdit={setInlineEdit}
                            onSave={handleSaveInline}
                            containerClassName="shrink-0"
                            inputClassName="w-36 text-xs font-mono font-semibold px-1 py-0.5 bg-white border border-indigo-400 rounded focus:outline-hidden focus:ring-2 focus:ring-indigo-300 text-indigo-900 shadow-xs"
                            displayNode={
                              <span
                                onClick={(e) => e.stopPropagation()}
                                onDoubleClick={(e) => {
                                  e.stopPropagation();
                                  if (isAdmin) {
                                    setInlineEdit({ docId: doc.id, field: 'document_code', value: doc.document_code || '' });
                                  }
                                }}
                                className={`font-mono font-semibold text-indigo-700 truncate max-w-[160px] px-1.5 py-0.5 rounded transition-all select-none ${
                                  isAdmin ? 'cursor-pointer hover:bg-sky-100/70 hover:shadow-2xs' : 'cursor-default'
                                }`}
                              >
                                {doc.document_code || '---'}
                              </span>
                            }
                          />
                        </div>

                        {/* Đơn vị ban hành */}
                        <div className="flex items-center justify-between text-xs min-h-[26px]">
                          <span className="text-slate-500 flex items-center gap-1.5 font-medium shrink-0">
                            <Building className="w-3 h-3 text-slate-400" /> Đơn vị:
                          </span>
                          <InlineEditable
                            docId={doc.id}
                            field="issuing_authority"
                            type="text"
                            currentValue={doc.issuing_authority || ''}
                            activeEdit={inlineEdit}
                            setActiveEdit={setInlineEdit}
                            onSave={handleSaveInline}
                            containerClassName="shrink-0"
                            inputClassName="w-36 text-xs font-medium px-1 py-0.5 bg-white border border-indigo-400 rounded focus:outline-hidden focus:ring-2 focus:ring-indigo-300 text-slate-800 shadow-xs"
                            displayNode={
                              <span
                                onClick={(e) => e.stopPropagation()}
                                onDoubleClick={(e) => {
                                  e.stopPropagation();
                                  if (isAdmin) {
                                    setInlineEdit({ docId: doc.id, field: 'issuing_authority', value: doc.issuing_authority || '' });
                                  }
                                }}
                                className={`text-slate-800 font-medium truncate max-w-[160px] px-1.5 py-0.5 rounded transition-all select-none ${
                                  isAdmin ? 'cursor-pointer hover:bg-sky-100/70 hover:shadow-2xs' : 'cursor-default'
                                }`}
                              >
                                {abbreviateIssuer(doc.issuing_authority)}
                              </span>
                            }
                          />
                        </div>

                        {/* Ngày ban hành */}
                        <div className="flex items-center justify-between text-xs min-h-[26px]">
                          <span className="text-slate-500 flex items-center gap-1.5 font-medium shrink-0">
                            <Calendar className="w-3 h-3 text-slate-400" /> Ban hành:
                          </span>
                          <InlineEditable
                            docId={doc.id}
                            field="issue_date"
                            type="date"
                            currentValue={toYMD(doc.issue_date)}
                            activeEdit={inlineEdit}
                            setActiveEdit={setInlineEdit}
                            onSave={handleSaveInline}
                            containerClassName="shrink-0"
                            inputClassName="w-36 text-xs font-mono font-medium px-1 py-0.5 bg-white border border-indigo-400 rounded focus:outline-hidden focus:ring-2 focus:ring-indigo-300 text-slate-800 shadow-xs"
                            displayNode={
                              <span
                                onClick={(e) => e.stopPropagation()}
                                onDoubleClick={(e) => {
                                  e.stopPropagation();
                                  if (isAdmin) {
                                    setInlineEdit({ docId: doc.id, field: 'issue_date', value: toYMD(doc.issue_date) });
                                  }
                                }}
                                className={`font-mono text-slate-700 font-medium px-1.5 py-0.5 rounded transition-all select-none ${
                                  isAdmin ? 'cursor-pointer hover:bg-sky-100/70 hover:shadow-2xs' : 'cursor-default'
                                }`}
                              >
                                {doc.issue_date
                                  ? new Date(doc.issue_date).toLocaleDateString('vi-VN')
                                  : '---'}
                              </span>
                            }
                          />
                        </div>

                        {/* Chuyên môn (Rút gọn: QLKT, CTHK, CHK...) */}
                        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 min-h-[30px]">
                          <span className="text-slate-500 font-medium shrink-0">Chuyên môn:</span>
                          <InlineEditable
                            docId={doc.id}
                            field="department_access"
                            type="select"
                            currentValue={doc.department_access?.[0] || 'QL_KY_THUAT'}
                            activeEdit={inlineEdit}
                            setActiveEdit={setInlineEdit}
                            onSave={handleSaveInline}
                            containerClassName="shrink-0"
                            inputClassName="w-36 text-xs font-semibold px-1 py-0.5 bg-white border border-indigo-400 rounded focus:outline-hidden focus:ring-2 focus:ring-indigo-300 text-slate-800 shadow-xs"
                            selectOptions={DEPARTMENTS.filter((d) => d.id !== 'all').map((d) => ({
                              id: d.id,
                              label: d.shortLabel || d.label,
                            }))}
                            displayNode={
                              <span
                                onClick={(e) => e.stopPropagation()}
                                onDoubleClick={(e) => {
                                  e.stopPropagation();
                                  if (isAdmin) {
                                    setInlineEdit({
                                      docId: doc.id,
                                      field: 'department_access',
                                      value: doc.department_access?.[0] || 'QL_KY_THUAT',
                                    });
                                  }
                                }}
                                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 transition-all select-none ${
                                  isAdmin ? 'cursor-pointer hover:bg-sky-100/70 hover:border-sky-300' : 'cursor-default'
                                }`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${dept.dot}`} />
                                <span className="truncate max-w-[120px]">{dept.shortLabel || dept.label}</span>
                              </span>
                            }
                          />
                        </div>
                      </div>

                      {/* Trích đoạn nội dung khớp do AI tìm thấy */}
                      {aiSnippet && (
                        <div className="px-3.5 py-2 bg-indigo-50/90 border-t border-indigo-100 text-[11px] text-indigo-950">
                          <div className="flex items-center gap-1 font-semibold text-indigo-800 mb-0.5">
                            <Sparkles className="w-3 h-3 text-indigo-600" />
                            <span>Khớp nội dung (AI):</span>
                          </div>
                          <p className="line-clamp-3 text-slate-700 italic">&quot;{aiSnippet}&quot;</p>
                        </div>
                      )}

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
              </>
            )}
          </div>
        )}
      </div>

      {/* Bottom Sheet: Menu / Lọc Chuyên ngành ở đầu trang Tab Tài liệu trên điện thoại */}
      {isMobileDeptMenuOpen && (
        <div
          className="fixed inset-0 z-50 md:hidden bg-slate-900/60 backdrop-blur-xs flex items-end animate-in fade-in duration-150"
          onClick={() => setIsMobileDeptMenuOpen(false)}
        >
          <div
            className="w-full max-h-[85dvh] overflow-y-auto bg-white text-slate-800 rounded-t-3xl p-5 pb-24 shadow-2xl space-y-4 animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-slate-300 rounded-full mx-auto mb-1" />
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-sky-600" />
                  <span>Menu / Lọc Kho Tài liệu</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Chọn chuyên ngành, đơn vị hoặc năm ban hành để lọc nhanh
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileDeptMenuOpen(false)}
                className="p-1.5 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Danh mục chuyên ngành */}
            <div className="grid grid-cols-2 gap-2">
              {DEPARTMENTS.map((dept) => {
                const DeptIcon = dept.icon;
                const isActive = activeFilter === dept.id;
                const count = departmentCounts[dept.id] || 0;
                return (
                  <button
                    key={dept.id}
                    type="button"
                    onClick={() => {
                      setActiveFilter(dept.id);
                      setFilterMissingOnly(false);
                      setIsMobileDeptMenuOpen(false);
                    }}
                    className={`flex items-center justify-between gap-2 p-2.5 rounded-xl border text-left transition-all active:scale-98 ${
                      isActive
                        ? 'bg-sky-50 border-sky-400 ring-1 ring-sky-300'
                        : 'border-slate-200 bg-slate-50 hover:bg-sky-50/50'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 shadow-2xs ${
                          isActive
                            ? 'bg-sky-600 text-white'
                            : 'bg-white border border-slate-200 text-sky-700'
                        }`}
                      >
                        <DeptIcon className="w-3.5 h-3.5" />
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-800 truncate">
                          {dept.shortLabel || dept.label}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate">{dept.label}</div>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                        isActive ? 'bg-sky-600 text-white' : 'bg-slate-200/80 text-slate-700'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Lọc theo Đơn vị ban hành & Năm ban hành */}
            <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Đơn vị ban hành
                </label>
                <select
                  value={issuerFilter}
                  onChange={(e) => setIssuerFilter(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 focus:outline-none focus:border-sky-500"
                >
                  <option value="ALL">Tất cả đơn vị</option>
                  {issuerOptions.map((opt) => (
                    <option key={opt.label} value={opt.label}>
                      {opt.label} ({opt.count})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Năm ban hành
                </label>
                <select
                  value={yearFilter}
                  onChange={(e) => setYearFilter(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 focus:outline-none focus:border-sky-500"
                >
                  <option value="ALL">Tất cả các năm</option>
                  {yearOptions.map((opt) => (
                    <option key={opt.year} value={opt.year}>
                      Năm {opt.year} ({opt.count})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setActiveFilter('ALL');
                  setIssuerFilter('ALL');
                  setYearFilter('ALL');
                  setStatusFilter('ALL');
                  setIsMobileDeptMenuOpen(false);
                }}
                className="px-3.5 py-2 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold"
              >
                Xóa bộ lọc
              </button>
              <button
                type="button"
                onClick={() => setIsMobileDeptMenuOpen(false)}
                className="px-4 py-2 rounded-xl bg-sky-600 text-white text-xs font-bold shadow-xs"
              >
                Xem kết quả ({filteredDocuments.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Đối chiếu nhanh văn bản trên iPhone (khi bấm nút 🔄 Đối chiếu trên Thẻ văn bản) */}
      {mobileCompareDoc && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150"
          onClick={() => setMobileCompareDoc(null)}
        >
          <div
            className="bg-white border border-slate-200 rounded-t-3xl sm:rounded-2xl max-w-lg w-full p-5 pb-8 sm:pb-5 shadow-2xl space-y-4 animate-in slide-in-from-bottom duration-200 text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-slate-300 rounded-full mx-auto sm:hidden" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
                  <GitCompareArrows className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Đối chiếu Hồ sơ &amp; Hiệu lực</h3>
                  <p className="text-[11px] text-slate-500">Kiểm tra tình trạng văn bản trong Kho chính thức</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileCompareDoc(null)}
                className="p-1.5 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="font-bold text-slate-900 text-[13px] leading-snug">
                {mobileCompareDoc.file_name}
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/80 text-[11px]">
                <div>
                  <span className="text-slate-400 block">Số / Ký hiệu:</span>
                  <span className="font-mono font-bold text-indigo-700">
                    {mobileCompareDoc.document_code || 'Chưa cập nhật'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Ngày ban hành:</span>
                  <span className="font-mono font-semibold text-slate-800">
                    {mobileCompareDoc.issue_date
                      ? new Date(mobileCompareDoc.issue_date).toLocaleDateString('vi-VN')
                      : '---'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Cơ quan ban hành:</span>
                  <span className="font-semibold text-slate-800">
                    {abbreviateIssuer(mobileCompareDoc.issuing_authority)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Trạng thái hiệu lực:</span>
                  {mobileCompareDoc.status === 'SUPERSEDED' ? (
                    <span className="font-bold text-amber-700">Đã bị thay thế</span>
                  ) : (
                    <span className="font-bold text-emerald-700">Đang còn hiệu lực</span>
                  )}
                </div>
              </div>
              <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Lớp văn bản AI (OCR):</span>
                {Boolean(mobileCompareDoc.ocr_content && String(mobileCompareDoc.ocr_content).trim().length > 0) ? (
                  <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Đã sẵn sàng hỏi đáp sâu
                  </span>
                ) : (
                  <span className="text-amber-700 font-medium">Chỉ có Metadata tóm tắt</span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    const target = mobileCompareDoc;
                    setMobileCompareDoc(null);
                    handleScanSingleDocAi(target);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-50 text-purple-700 border border-purple-200 font-semibold"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Quét AI cập nhật Metadata</span>
                </button>
              )}
              <button
                type="button"
                data-assistant-trigger="true"
                onClick={() => {
                  const id = mobileCompareDoc.id;
                  setMobileCompareDoc(null);
                  selectAndAskDoc(id);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold shadow-xs"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Hỏi AI về văn bản này</span>
              </button>
            </div>
          </div>
        </div>
      )}

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
