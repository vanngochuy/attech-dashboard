'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  MailSearch,
  Search,
  Plus,
  Eye,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Upload,
  FileText,
  ExternalLink,
  X,
  Loader2,
  RefreshCw,
  FolderGit2,
  GitCompareArrows,
  ArrowUpRight,
  Sparkles,
  Calendar,
  UploadCloud,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Building,
  Play,
  Pause,
} from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import { useAuth } from '@/components/auth-context';
import {
  EmailDraftItem,
  DEFAULT_EMAIL_DRAFTS,
  formatToDMY,
} from '@/lib/compliance';

// Cắt tối đa 2 trang đầu của file PDF để AI Gemini trích xuất siêu tốc
async function slicePdfFirst2PagesForEmail(originalFile: File): Promise<File> {
  const isPdf =
    originalFile.type === 'application/pdf' ||
    originalFile.name.toLowerCase().endsWith('.pdf');
  if (!isPdf) return originalFile;

  try {
    const arrayBuffer = await originalFile.arrayBuffer();
    const srcDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
    if (srcDoc.getPageCount() <= 2) return originalFile;

    const trimmedDoc = await PDFDocument.create();
    const copiedPages = await trimmedDoc.copyPages(srcDoc, [0, 1]);
    copiedPages.forEach((p) => trimmedDoc.addPage(p));
    const trimmedBytes = await trimmedDoc.save();
    return new File(
      [trimmedBytes.buffer as ArrayBuffer],
      `preview_2pages_${originalFile.name}`,
      { type: 'application/pdf' }
    );
  } catch {
    return originalFile;
  }
}

export default function EmailDocumentTasksPage() {
  const { isAdmin } = useAuth();
  const [drafts, setDrafts] = useState<EmailDraftItem[]>(DEFAULT_EMAIL_DRAFTS);
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Bộ lọc khoảng thời gian đọc Email - Mặc định mở Tất cả ngày để hiển thị toàn bộ tài liệu từ Google Drive / Email
  const [isAllTime, setIsAllTime] = useState(true);
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 14);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [searchQuery, setSearchQuery] = useState('');
  const [matchFilter, setMatchFilter] = useState<'ALL' | 'UPDATE_CANDIDATE' | 'NEW_DRAFT' | 'PROMOTED'>('ALL');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Phân trang (Pagination) để bảng hiển thị vừa vặn trong màn hình
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(15);

  // Trạng thái AI quét 2 trang cho từng file
  const [aiScanningId, setAiScanningId] = useState<string | null>(null);

  // Trạng thái hàng đợi AI quét tuần tự an toàn (<15 RPM)
  const [isQueueRunning, setIsQueueRunning] = useState(false);
  const [queueProgress, setQueueProgress] = useState<{ current: number; total: number } | null>(null);
  const queueStopRef = useRef(false);

  // Danh sách ID các văn bản được tick chọn để thao tác hàng loạt (Đọc AI 2 trang / Xóa nhiều)
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBatchAiRunning, setIsBatchAiRunning] = useState(false);
  const [batchAiProgress, setBatchAiProgress] = useState<{ current: number; total: number } | null>(null);
  const batchAiStopRef = useRef(false);

  // Modal So sánh chi tiết Văn bản Email (Chưa chính thức) vs Văn bản chính thức ở tab Tài liệu
  const [compareItem, setCompareItem] = useState<EmailDraftItem | null>(null);

  // Modal Xem trước file PDF
  const [previewItem, setPreviewItem] = useState<EmailDraftItem | null>(null);

  // Modal Thêm / Giả lập PDF lọc từ Email để AI đọc & đối chiếu với kho Tài liệu
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [senderEmail, setSenderEmail] = useState('vanthu@attech.com.vn');
  const [extractedTitle, setExtractedTitle] = useState('');
  const [extractedCode, setExtractedCode] = useState('');
  const [extractedIssuer, setExtractedIssuer] = useState('ATTECH');
  const [extractedIssueDate, setExtractedIssueDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [scopeDomain, setScopeDomain] = useState('SMS');
  const [pdfFileName, setPdfFileName] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const [isExtractingAI, setIsExtractingAI] = useState(false);
  const [aiFilled, setAiFilled] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4500);
  };

  const fetchEmailDrafts = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/compliance?type=email_drafts', { cache: 'no-store' });
      const data = await res.json();
      if (Array.isArray(data.emailDrafts)) {
        setDrafts(data.emailDrafts);
      }
    } catch (err) {
      console.error('Lỗi tải danh sách văn bản email:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEmailDrafts();
  }, []);

  // Quét Email trong khoảng thời gian (Từ ngày -> Đến ngày) & Đối chiếu toàn bộ với bảng `document_files` ở tab Tài liệu
  const handleScanEmailsByDateRange = async () => {
    setIsScanning(true);
    try {
      const res = await fetch('/api/tasks/email-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SCAN_DATE_RANGE',
          fromDate,
          toDate,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Quét email thất bại');

      if (Array.isArray(data.emailDrafts)) {
        setDrafts(data.emailDrafts);
      }

      const updateCount = (data.emailDrafts || []).filter(
        (d: EmailDraftItem) => d.matchType === 'UPDATE_CANDIDATE'
      ).length;

      showToast(
        'success',
        `Đã quét email từ ${formatToDMY(fromDate)} đến ${formatToDMY(toDate)} & đối chiếu với kho Tài liệu: Phát hiện ${updateCount} bản cập nhật văn bản!`
      );
    } catch (err: any) {
      showToast('error', err.message || 'Không thể quét email');
    } finally {
      setIsScanning(false);
    }
  };

  // Nút Quét Email & Đồng bộ Drive thủ công dành riêng cho Admin
  const handleAdminManualScan = async () => {
    setIsScanning(true);
    try {
      const res = await fetch('/api/tasks/email-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SYNC_DRIVE_FOLDER',
          mailbox: 'tuh@attech.com.vn',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Quét và đồng bộ thất bại');

      if (Array.isArray(data.emailDrafts)) {
        setDrafts(data.emailDrafts);
      }
      setIsAllTime(true);

      const updateCount = (data.emailDrafts || []).filter(
        (d: EmailDraftItem) => d.matchType === 'UPDATE_CANDIDATE'
      ).length;

      showToast(
        'success',
        `Đã hoàn tất quét thủ công! Đồng bộ ${data.emailDrafts?.length || 0} văn bản PDF từ Google Drive & Email (Phát hiện ${updateCount} bản cập nhật văn bản).`
      );
    } catch (err: any) {
      showToast('error', err.message || 'Không thể đồng bộ dữ liệu');
    } finally {
      setIsScanning(false);
    }
  };

  // Bóc tách AI 2 trang đầu cho 1 văn bản cụ thể
  const handleScanSingleAi = async (item: EmailDraftItem) => {
    setAiScanningId(item.id);
    try {
      const fd = new FormData();
      if (item.driveFileId) {
        fd.append('drive_file_id', item.driveFileId);
      } else if (item.fileUrl) {
        fd.append('file_url', item.fileUrl);
      } else {
        throw new Error('Văn bản không có file đính kèm để AI đọc');
      }
      fd.append('mode', 'document');

      const res = await fetch('/api/documents/extract-metadata', {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'AI trích xuất thất bại');

      // Cập nhật lại vào Supabase Storage
      const metaRes = await fetch('/api/tasks/email-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'AI_EXTRACT_SINGLE',
          draftId: item.id,
          metadata: data.metadata,
        }),
      });
      const metaData = await metaRes.json();
      if (Array.isArray(metaData.emailDrafts)) {
        setDrafts(metaData.emailDrafts);
      }

      showToast(
        'success',
        `AI đã đọc 2 trang đầu: ${data.metadata?.document_code || 'Chưa rõ số'} - ${data.metadata?.issuing_authority || ''}`
      );
    } catch (err: any) {
      showToast('error', err.message || 'Lỗi quét AI');
    } finally {
      setAiScanningId(null);
    }
  };

  // Quét hàng đợi AI an toàn cho toàn bộ file chưa quét (Tốc độ 1 file / 5s để tránh vượt 15 RPM của Gemini Free)
  const handleToggleAiQueue = async () => {
    if (isQueueRunning) {
      queueStopRef.current = true;
      setIsQueueRunning(false);
      showToast('success', 'Đã tạm dừng hàng đợi quét AI.');
      return;
    }

    const unScanned = drafts.filter((d) => !d.aiExtracted);
    if (unScanned.length === 0) {
      showToast('success', 'Tất cả các văn bản đã được AI quét hoàn tất!');
      return;
    }

    setIsQueueRunning(true);
    queueStopRef.current = false;
    setQueueProgress({ current: 0, total: unScanned.length });

    showToast(
      'success',
      `Bắt đầu hàng đợi AI an toàn (${unScanned.length} văn bản, tốc độ 12 file/phút để tuân thủ Gemini Free Tier)...`
    );

    let count = 0;
    for (const item of unScanned) {
      if (queueStopRef.current) break;
      count++;
      setQueueProgress({ current: count, total: unScanned.length });

      try {
        await handleScanSingleAi(item);
      } catch {
        // Continue next
      }

      // Nghỉ 4.5 giây giữa mỗi lượt để đảm bảo luôn < 15 RPM của Gemini Free
      if (count < unScanned.length && !queueStopRef.current) {
        await new Promise((resolve) => setTimeout(resolve, 4500));
      }
    }

    setIsQueueRunning(false);
    setQueueProgress(null);
    showToast('success', `Đã hoàn tất hàng đợi AI cho ${count} văn bản!`);
  };

  // Xử lý khi chọn file PDF từ Email trong Modal: Upload vào thư mục Văn bản chưa chính thức + AI Gemini đọc Tên/Số hiệu
  const handleSelectEmailPdf = async (file: File) => {
    setIsUploadingPdf(true);
    setIsExtractingAI(true);
    setAiFilled(false);
    setPdfFileName(file.name);

    const uploadTask = (async () => {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder', 'email-drafts');
      const res = await fetch('/api/compliance', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Tải file PDF thất bại');
      setFileUrl(data.fileUrl);
    })();

    const aiTask = (async () => {
      try {
        const sliced = await slicePdfFirst2PagesForEmail(file);
        const aiFd = new FormData();
        aiFd.append('file', sliced);
        aiFd.append('mode', 'document');
        const aiRes = await fetch('/api/documents/extract-metadata', {
          method: 'POST',
          body: aiFd,
        });
        const aiData = await aiRes.json();
        if (aiRes.ok && aiData.success && aiData.metadata) {
          const m = aiData.metadata;
          if (m.title) {
            setExtractedTitle(m.title);
            if (!emailSubject) setEmailSubject(`V/v gửi văn bản: ${m.title}`);
          }
          if (m.document_code) setExtractedCode(m.document_code);
          if (m.issuing_authority) setExtractedIssuer(m.issuing_authority);
          if (m.issue_date) setExtractedIssueDate(m.issue_date);
          if (m.scope_domain) setScopeDomain(m.scope_domain);
          setAiFilled(true);
        } else {
          const fallbackTitle = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
          setExtractedTitle(fallbackTitle);
          if (!emailSubject) setEmailSubject(`Email đính kèm: ${fallbackTitle}`);
        }
      } catch {
        const fallbackTitle = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
        setExtractedTitle(fallbackTitle);
      }
    })();

    try {
      await Promise.all([uploadTask, aiTask]);
      showToast('success', `AI đã đọc xong file PDF "${file.name}"!`);
    } catch (err: any) {
      showToast('error', err.message || 'Lỗi tải file PDF');
    } finally {
      setIsUploadingPdf(false);
      setIsExtractingAI(false);
    }
  };

  // Lưu file PDF từ Email vào thư mục Văn bản chưa chính thức & tự động đối chiếu với kho Tài liệu
  const handleAddAndCompareSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extractedTitle.trim()) {
      showToast('error', 'Vui lòng nhập hoặc tải file PDF để lấy tên văn bản.');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/tasks/email-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ADD_AND_COMPARE',
          draftItem: {
            emailSubject: emailSubject.trim() || `Email đính kèm: ${extractedTitle.trim()}`,
            senderEmail: senderEmail.trim() || 'vanthu@attech.com.vn',
            receivedDate: `${new Date().toISOString().slice(0, 10)} ${new Date()
              .toTimeString()
              .slice(0, 5)}`,
            pdfFileName: pdfFileName || `${extractedTitle.trim().slice(0, 40)}.pdf`,
            extractedTitle: extractedTitle.trim(),
            extractedCode: extractedCode.trim(),
            extractedIssuer: extractedIssuer.trim(),
            extractedIssueDate,
            scopeDomain,
            fileUrl,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Không thể lưu và đối chiếu');

      if (Array.isArray(data.emailDrafts)) {
        setDrafts(data.emailDrafts);
      }
      setIsAddModalOpen(false);

      if (data.newDraft?.matchType === 'UPDATE_CANDIDATE') {
        showToast(
          'success',
          `Phát hiện văn bản cập nhật! Khớp ${data.newDraft.similarityScore}% với văn bản "${data.newDraft.matchedOfficialDoc?.code || data.newDraft.matchedOfficialDoc?.title}" ở tab Tài liệu.`
        );
      } else {
        showToast(
          'success',
          'Đã lưu vào thư mục Văn bản chưa chính thức và đối chiếu với kho Tài liệu!'
        );
      }
    } catch (err: any) {
      showToast('error', err.message || 'Lỗi khi đối chiếu');
    } finally {
      setIsSaving(false);
    }
  };

  // Duyệt chuyển văn bản từ thư mục chưa chính thức sang tab Tài liệu chính thức
  const handlePromoteToOfficial = async (item: EmailDraftItem) => {
    const confirmMsg = item.matchedOfficialDoc
      ? `Duyệt ban hành văn bản "${item.extractedTitle}" sang tab Tài liệu chính thức và đánh dấu văn bản cũ (${item.matchedOfficialDoc.code || item.matchedOfficialDoc.title}) là "Đã thay thế"?`
      : `Duyệt chuyển văn bản "${item.extractedTitle}" từ thư mục Dự thảo Email sang tab Tài liệu chính thức?`;

    if (!confirm(confirmMsg)) return;

    setIsSaving(true);
    try {
      const res = await fetch('/api/tasks/email-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'PROMOTE_TO_OFFICIAL',
          targetDraftId: item.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Không thể duyệt ban hành');

      if (Array.isArray(data.emailDrafts)) {
        setDrafts(data.emailDrafts);
      }
      setCompareItem(null);
      showToast('success', 'Đã chuyển sang tab Tài liệu chính thức và cập nhật phiên bản cũ!');
    } catch (err: any) {
      showToast('error', err.message || 'Lỗi khi duyệt ban hành');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteDraft = async (item: EmailDraftItem) => {
    if (!confirm(`Xóa văn bản dự thảo "${item.extractedTitle}" khỏi danh sách?`)) return;
    const updated = drafts.filter((d) => d.id !== item.id);
    setDrafts(updated);
    setSelectedIds((prev) => prev.filter((id) => id !== item.id));
    await fetch('/api/compliance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'email_drafts', records: updated }),
    });
    showToast('success', 'Đã xóa văn bản dự thảo khỏi danh sách.');
  };

  // Xóa hàng loạt văn bản đã được tick chọn
  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Bạn có chắc chắn muốn xóa ${selectedIds.length} văn bản đã chọn khỏi danh sách không?`)) return;

    setIsSaving(true);
    const toDeleteSet = new Set(selectedIds);
    const updated = drafts.filter((d) => !toDeleteSet.has(d.id));
    setDrafts(updated);
    const deletedCount = selectedIds.length;
    setSelectedIds([]);

    try {
      const res = await fetch('/api/compliance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'email_drafts', records: updated }),
      });
      if (!res.ok) throw new Error('Không thể lưu dữ liệu sau khi xóa');
      showToast('success', `Đã xóa thành công ${deletedCount} văn bản.`);
    } catch (err: any) {
      showToast('error', 'Lỗi khi xóa nhiều văn bản: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Đọc AI 2 trang hàng loạt cho các văn bản đã tick chọn
  const handleBatchAiScan = async () => {
    if (selectedIds.length === 0) return;

    if (isBatchAiRunning) {
      batchAiStopRef.current = true;
      setIsBatchAiRunning(false);
      showToast('success', 'Đã tạm dừng đọc AI cho các văn bản đã chọn.');
      return;
    }

    const targetItems = drafts.filter((d) => selectedIds.includes(d.id));
    setIsBatchAiRunning(true);
    batchAiStopRef.current = false;
    setBatchAiProgress({ current: 0, total: targetItems.length });

    showToast(
      'success',
      `Bắt đầu đọc AI 2 trang cho ${targetItems.length} văn bản đã chọn (tốc độ an toàn để không vượt quota)...`
    );

    let count = 0;
    for (const item of targetItems) {
      if (batchAiStopRef.current) break;
      count++;
      setBatchAiProgress({ current: count, total: targetItems.length });
      try {
        await handleScanSingleAi(item);
      } catch (err) {
        console.error('Lỗi khi AI đọc file:', item.id, err);
      }
      // Nghỉ 4.5s để đảm bảo không vượt 15 RPM của Gemini Free
      if (count < targetItems.length && !batchAiStopRef.current) {
        await new Promise((resolve) => setTimeout(resolve, 4500));
      }
    }

    setIsBatchAiRunning(false);
    setBatchAiProgress(null);
    showToast('success', `Đã hoàn tất đọc AI cho ${count} văn bản được chọn!`);
  };

  const filteredDrafts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return drafts.filter((item) => {
      if (matchFilter === 'UPDATE_CANDIDATE' && item.matchType !== 'UPDATE_CANDIDATE' && item.matchType !== 'EXACT_DUPLICATE') {
        return false;
      }
      if (matchFilter === 'NEW_DRAFT' && item.matchType !== 'NEW_DRAFT') return false;
      if (matchFilter === 'PROMOTED' && item.matchType !== 'PROMOTED') return false;

      // Lọc theo khoảng ngày nhận email (khi người dùng chủ động chọn khoảng ngày, không bật isAllTime)
      if (!isAllTime) {
        const itemDate = (item.receivedDate || '').slice(0, 10);
        if (fromDate && itemDate >= '2020-01-01' && itemDate < fromDate) return false;
        if (toDate && itemDate >= '2020-01-01' && itemDate > toDate) return false;
      }

      if (!q) return true;
      return (
        item.extractedTitle.toLowerCase().includes(q) ||
        (item.extractedCode || '').toLowerCase().includes(q) ||
        item.emailSubject.toLowerCase().includes(q) ||
        item.senderEmail.toLowerCase().includes(q) ||
        (item.matchedOfficialDoc?.title || '').toLowerCase().includes(q) ||
        (item.matchedOfficialDoc?.code || '').toLowerCase().includes(q)
      );
    });
  }, [drafts, searchQuery, matchFilter, fromDate, toDate, isAllTime]);

  // Tự động reset về trang 1 khi thay đổi bộ lọc tìm kiếm hoặc kích thước trang
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, matchFilter, fromDate, toDate, isAllTime, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredDrafts.length / pageSize));
  const paginatedDrafts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredDrafts.slice(start, start + pageSize);
  }, [filteredDrafts, currentPage, pageSize]);

  const setQuickRangeDays = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    setFromDate(start.toISOString().slice(0, 10));
    setToDate(end.toISOString().slice(0, 10));
  };

  const renderMatchBadge = (item: EmailDraftItem) => {
    if (item.matchType === 'UPDATE_CANDIDATE') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-300">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          <span>Bản cập nhật ({item.similarityScore || 90}%)</span>
        </span>
      );
    }
    if (item.matchType === 'EXACT_DUPLICATE') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
          <span>Trùng số hiệu</span>
        </span>
      );
    }
    if (item.matchType === 'PROMOTED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span>Đã chuyển Tài liệu</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-sky-50 text-sky-700 border border-sky-200">
        <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
        <span>Văn bản mới (Dự thảo)</span>
      </span>
    );
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

      {/* Khối Tiêu đề: Nền Xanh Bầu Trời & Mây Trắng (Đồng bộ 100% với các tab) */}
      <div className="relative bg-gradient-to-r from-[#0284c7] via-[#0ea5e9] to-[#38bdf8] border-b border-sky-300 shadow-sm shrink-0 overflow-hidden z-20">
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
            className="absolute top-1 left-[42%] w-52 text-white/30 fill-current"
            style={{ animation: 'driftCloudHeader2 18s ease-in-out infinite' }}
          >
            <path d="M35 65 H195 A20 20 0 0 0 195 28 A26 26 0 0 0 148 12 A32 32 0 0 0 82 18 A24 24 0 0 0 35 65 Z" />
          </svg>
          <svg
            viewBox="0 0 200 80"
            className="absolute -bottom-4 right-24 w-48 text-white/25 fill-current"
            style={{ animation: 'driftCloudHeader1 16s ease-in-out infinite' }}
          >
            <path d="M45 65 H165 A20 20 0 0 0 165 25 A22 22 0 0 0 125 12 A30 30 0 0 0 68 20 A24 24 0 0 0 45 65 Z" />
          </svg>
        </div>

        <header className="h-14 flex items-center justify-between px-6 relative z-10">
          <div className="flex items-center gap-2 text-white font-bold text-sm drop-shadow-2xs">
            <MailSearch className="w-4 h-4 text-white" />
            <span>Công việc: Lọc PDF Email (Văn bản chưa chính thức) &amp; Đối chiếu Tài liệu</span>
          </div>

          <div className="flex items-center gap-2.5 ml-auto">
            <div className="hidden md:flex items-center gap-1.5 bg-white/95 px-2.5 py-1.5 rounded-lg border border-white text-xs shadow-xs">
              <MailSearch className="w-3.5 h-3.5 text-sky-600 shrink-0" />
              <span className="text-slate-600 font-medium">Hộp thư:</span>
              <span className="text-sky-700 font-bold font-mono">tuh@attech.com.vn</span>
            </div>
            <div className="hidden xl:flex items-center gap-1.5 bg-white/95 px-2.5 py-1.5 rounded-lg border border-white text-xs shadow-xs">
              <FolderGit2 className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span className="text-slate-600 font-medium">Google Drive:</span>
              <span className="text-amber-700 font-bold font-mono">ATTECH_DOCUMENTS/03_TÀI LIỆU CHƯA XÁC THỰC</span>
            </div>

            {/* Nút Quét Email & Đối chiếu thường */}
            <button
              onClick={handleScanEmailsByDateRange}
              disabled={isScanning}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/95 hover:bg-white text-slate-800 hover:text-sky-700 border border-white rounded-lg text-xs font-semibold transition-all shadow-sm cursor-pointer disabled:opacity-60"
              title="Quét Email theo khoảng thời gian và đối chiếu với kho Tài liệu chính thức"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-sky-600 ${isScanning ? 'animate-spin' : ''}`} />
              <span>{isScanning ? 'Đang quét...' : 'Quét Email & Đối chiếu'}</span>
            </button>

            {/* Nút Quét Email & Đồng bộ Drive THỦ CÔNG DÀNH RIÊNG CHO ADMIN */}
            {isAdmin && (
              <button
                onClick={handleAdminManualScan}
                disabled={isScanning}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 active:scale-95 text-white rounded-lg text-xs font-semibold transition-all shadow-md cursor-pointer disabled:opacity-60 border border-amber-400/40"
                title="Admin: Quét trực tiếp hộp thư tuh@attech.com.vn và đồng bộ toàn bộ file PDF trong thư mục Google Drive 03_TÀI LIỆU CHƯA XÁC THỰC"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-white ${isScanning ? 'animate-spin' : ''}`} />
                <span>{isScanning ? 'Đang quét & đồng bộ...' : 'Quét Email & Drive thủ công'}</span>
                <span className="px-1.5 py-0.2 rounded text-[9px] bg-black/20 font-bold uppercase tracking-wider text-amber-100">
                  Admin
                </span>
              </button>
            )}

            {/* Nút Bật Hàng đợi AI quét 2 trang đầu an toàn (Free Tier Safe: 12 file/phút < 15 RPM) */}
            {isAdmin && (
              <button
                onClick={handleToggleAiQueue}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-md cursor-pointer border ${
                  isQueueRunning
                    ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-400 animate-pulse'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-400/40'
                }`}
                title={
                  isQueueRunning
                    ? 'Bấm để tạm dừng hàng đợi AI'
                    : 'Tự động quét lần lượt 2 trang đầu bằng AI cho các file chưa quét (Tốc độ an toàn 12 file/phút để không bị khóa API Free)'
                }
              >
                {isQueueRunning ? (
                  <>
                    <Pause className="w-3.5 h-3.5" />
                    <span>Dừng AI ({queueProgress?.current}/{queueProgress?.total})</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-200" />
                    <span>AI Quét hàng đợi</span>
                  </>
                )}
              </button>
            )}

            {isAdmin && (
              <button
                onClick={() => {
                  setEmailSubject('');
                  setExtractedTitle('');
                  setExtractedCode('');
                  setFileUrl('');
                  setPdfFileName('');
                  setAiFilled(false);
                  setIsAddModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#1b3252] hover:bg-slate-900 active:scale-95 text-white border border-white/25 rounded-lg text-xs font-semibold transition-all shadow-md cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tải PDF từ Email</span>
              </button>
            )}
          </div>
        </header>
      </div>

      {/* Toast thông báo */}
      {toast && (
        <div
          className={`mx-6 mt-3 p-2.5 rounded-lg border text-xs flex items-center justify-between shadow-xs ${
            toast.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="font-medium">{toast.text}</span>
          </div>
          <button onClick={() => setToast(null)} className="text-[11px] underline ml-3">
            Đóng
          </button>
        </div>
      )}

      {/* Thanh chọn Khoảng thời gian Đọc Email & Bộ lọc Đối chiếu (Đồng bộ nền sáng với tab Tài liệu) */}
      <div className="px-6 py-2.5 bg-white border-b border-slate-200 shadow-2xs shrink-0 z-20 flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Khoảng thời gian quét Email */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
              <Calendar className="w-3.5 h-3.5 text-sky-600" />
              <span>Khoảng thời gian Email:</span>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 text-xs">
              <span className="text-slate-500">Từ</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setIsAllTime(false);
                }}
                className="bg-transparent font-mono text-slate-800 focus:outline-none"
              />
              <span className="text-slate-400">→</span>
              <span className="text-slate-500">Đến</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setIsAllTime(false);
                }}
                className="bg-transparent font-mono text-slate-800 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1 text-[11px]">
              <button
                type="button"
                onClick={() => {
                  setQuickRangeDays(7);
                  setIsAllTime(false);
                }}
                className={`px-2 py-1 rounded-md font-medium cursor-pointer transition-colors ${
                  !isAllTime
                    ? 'bg-slate-100 hover:bg-sky-50 text-slate-600 hover:text-sky-700'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                7 ngày
              </button>
              <button
                type="button"
                onClick={() => {
                  setQuickRangeDays(30);
                  setIsAllTime(false);
                }}
                className={`px-2 py-1 rounded-md font-medium cursor-pointer transition-colors ${
                  !isAllTime
                    ? 'bg-slate-100 hover:bg-sky-50 text-slate-600 hover:text-sky-700'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                30 ngày
              </button>
              <button
                type="button"
                onClick={() => setIsAllTime(true)}
                className={`px-2.5 py-1 rounded-md font-medium cursor-pointer transition-colors ${
                  isAllTime
                    ? 'bg-sky-600 text-white font-semibold shadow-xs'
                    : 'bg-slate-100 hover:bg-sky-50 text-slate-600 hover:text-sky-700'
                }`}
              >
                Tất cả ngày ({drafts.length})
              </button>
            </div>
          </div>

          {/* Ô tìm kiếm + Bộ lọc trạng thái đối chiếu */}
          <div className="flex flex-wrap items-center gap-2 flex-1 justify-end">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-sky-600 w-3.5 h-3.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm tên PDF email, số hiệu, người gửi..."
                className="w-full bg-slate-50 focus:bg-white border border-slate-200 focus:border-sky-500 rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setMatchFilter('ALL')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  matchFilter === 'ALL'
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tất cả ({filteredDrafts.length})
              </button>
              <button
                type="button"
                onClick={() => setMatchFilter('UPDATE_CANDIDATE')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                  matchFilter === 'UPDATE_CANDIDATE'
                    ? 'bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Bản cập nhật văn bản
              </button>
              <button
                type="button"
                onClick={() => setMatchFilter('NEW_DRAFT')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                  matchFilter === 'NEW_DRAFT'
                    ? 'bg-sky-50 text-sky-700 border border-sky-200 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500" /> Dự thảo mới
              </button>
              <button
                type="button"
                onClick={() => setMatchFilter('PROMOTED')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                  matchFilter === 'PROMOTED'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Đã ban hành
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Vùng cuộn Bảng dữ liệu (Tiêu đề Freeze sticky top-0 giống tab Tài liệu) */}
      <div className="flex-1 overflow-y-auto px-6 pt-3 pb-12">
        {isLoading ? (
          <div className="p-16 flex flex-col items-center justify-center text-slate-500 text-xs gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-sky-600" />
            <span>Đang tải danh sách văn bản PDF lọc từ Email...</span>
          </div>
        ) : filteredDrafts.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 mb-3 shadow-xs">
              <MailSearch className="w-6 h-6 text-sky-600" />
            </div>
            <h4 className="text-sm font-semibold text-slate-900 mb-1">
              Không có văn bản PDF nào trong khoảng thời gian này
            </h4>
            <p className="text-slate-500 text-xs max-w-md">
              Hãy mở rộng khoảng thời gian quét Email hoặc bấm &quot;Tải PDF từ Email&quot; để đối chiếu thử với kho Tài liệu chính thức.
            </p>
          </div>
        ) : (
          <>
            {/* Thanh Thao Tác Hàng Loạt (Hiện khi có văn bản được tick chọn) */}
            {selectedIds.length > 0 && (
              <div className="mb-3 px-4 py-2.5 bg-gradient-to-r from-sky-50 to-indigo-50 border border-sky-200 rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center min-w-6 h-6 px-1.5 rounded-full bg-sky-600 text-white font-bold text-xs shadow-2xs">
                      {selectedIds.length}
                    </span>
                    <span className="text-xs font-bold text-slate-800">
                      văn bản đã chọn
                    </span>
                  </div>
                  <div className="h-4 w-px bg-slate-300" />
                  <button
                    type="button"
                    onClick={() => setSelectedIds(filteredDrafts.map((d) => d.id))}
                    className="text-xs font-semibold text-sky-700 hover:text-sky-900 hover:underline cursor-pointer"
                  >
                    Chọn tất cả {filteredDrafts.length} văn bản
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedIds([])}
                    className="text-xs font-medium text-slate-500 hover:text-slate-800 hover:underline cursor-pointer"
                  >
                    Bỏ chọn
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {/* Nút Đọc AI 2 trang cho các file đã tick */}
                  <button
                    type="button"
                    onClick={handleBatchAiScan}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-xs cursor-pointer transition-all border ${
                      isBatchAiRunning
                        ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-500 animate-pulse'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-500'
                    }`}
                    title="Đọc 2 trang đầu bằng AI cho các văn bản đã tick chọn"
                  >
                    {isBatchAiRunning ? (
                      <>
                        <Pause className="w-3.5 h-3.5" />
                        <span>Dừng đọc AI ({batchAiProgress?.current}/{batchAiProgress?.total})</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Đọc AI 2 trang ({selectedIds.length} file)</span>
                      </>
                    )}
                  </button>

                  {/* Nút Xóa nhiều file cùng lúc */}
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={handleBatchDelete}
                      disabled={isSaving || isBatchAiRunning}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer transition-all disabled:opacity-50 border border-rose-500"
                      title="Xóa vĩnh viễn các văn bản đã chọn khỏi danh sách"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Xóa đã chọn ({selectedIds.length} file)</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="border border-slate-200 rounded-xl bg-white shadow-xs">
              {/* Table Header - FREEZE (Sticky top-0 z-20) */}
              <div className="sticky top-0 z-20 h-11 px-4 flex items-center justify-between bg-slate-100/95 backdrop-blur-md text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200 rounded-t-xl shadow-2xs">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  {/* Ô Checkbox Chọn tất cả trên trang hiện tại */}
                  <div className="w-6 flex items-center justify-center">
                    <input
                      type="checkbox"
                      checked={paginatedDrafts.length > 0 && paginatedDrafts.every((d) => selectedIds.includes(d.id))}
                      onChange={() => {
                        const pageIds = paginatedDrafts.map((d) => d.id);
                        const isAllPageSelected = pageIds.length > 0 && pageIds.every((d) => selectedIds.includes(d));
                        if (isAllPageSelected) {
                          setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)));
                        } else {
                          setSelectedIds((prev) => Array.from(new Set([...prev, ...pageIds])));
                        }
                      }}
                      className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer accent-sky-600"
                      title="Chọn / Bỏ chọn tất cả văn bản trên trang này"
                    />
                  </div>
                  <span className="w-8 text-center">STT</span>
                  <span className="flex-1">VĂN BẢN (TRÍCH YẾU)</span>
                </div>
                <div className="flex items-center gap-3 shrink-0 text-right">
                  <span className="w-32 text-left hidden sm:inline">SỐ KÝ HIỆU</span>
                  <span className="w-40 text-left hidden md:inline">CƠ QUAN BAN HÀNH</span>
                  <span className="w-24 text-center hidden lg:inline">BAN HÀNH</span>
                  <span className="w-28 text-center hidden xl:inline">NGÀY EMAIL</span>
                  <span className="w-36 text-center">ĐỐI CHIẾU</span>
                  <span className="w-32 text-right">THAO TÁC</span>
                </div>
              </div>

              {/* Table Rows (Duyệt qua paginatedDrafts theo trang) */}
              <div className="divide-y divide-slate-100">
                {paginatedDrafts.map((item, idx) => {
                  const isSelected = selectedIds.includes(item.id);
                  return (
                    <div
                      key={item.id}
                      onClick={() => setCompareItem(item)}
                      className={`py-2.5 px-4 flex items-center justify-between hover:bg-sky-50/50 transition-colors group cursor-pointer ${
                        isSelected ? 'bg-sky-50/70 border-l-4 border-l-sky-500' : 'bg-white'
                      }`}
                    >
                      {/* Trái: Checkbox + STT + Tên văn bản PDF trong Email + Thông tin người gửi */}
                      <div className="flex items-start gap-2.5 min-w-0 pr-3 flex-1">
                        <div
                          className="w-6 flex items-center justify-center pt-0.5 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              e.stopPropagation();
                              setSelectedIds((prev) =>
                                prev.includes(item.id)
                                ? prev.filter((id) => id !== item.id)
                                : [...prev, item.id]
                              );
                            }}
                            className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer accent-sky-600"
                          />
                        </div>
                        <span className="w-8 text-center text-xs text-slate-400 font-mono mt-0.5">
                          {(currentPage - 1) * pageSize + idx + 1}
                        </span>
                        <FileText
                          className={`w-4 h-4 shrink-0 mt-0.5 ${
                            item.matchType === 'UPDATE_CANDIDATE'
                              ? 'text-amber-600'
                              : 'text-sky-600'
                          }`}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p
                              className="text-xs font-semibold text-slate-900 group-hover:text-sky-700 truncate"
                              title={item.extractedTitle}
                            >
                              {item.extractedTitle}
                            </p>
                            {item.aiExtracted && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                                <Sparkles className="w-2.5 h-2.5 text-emerald-600" /> AI Đã đọc
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                            <span className="font-mono text-slate-600 truncate max-w-[200px]" title={item.pdfFileName}>
                              📄 {item.pdfFileName}
                            </span>
                            <span>•</span>
                            <span className="truncate max-w-[220px]" title={item.emailSubject}>
                              📧 {item.senderEmail}
                            </span>
                          </div>
                        </div>
                      </div>

                  {/* Phải: Số hiệu, Cơ quan, Ngày ban hành, Ngày email, Nhãn đối chiếu, Thao tác */}
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="w-32 text-left font-mono text-xs text-indigo-700 font-bold truncate hidden sm:inline" title={item.extractedCode}>
                      {item.extractedCode || <span className="text-slate-300 font-normal italic">Chưa có</span>}
                    </span>

                    <span className="w-40 text-left text-xs text-slate-700 font-medium truncate hidden md:inline" title={item.extractedIssuer}>
                      {item.extractedIssuer || 'ATTECH'}
                    </span>

                    <span className="w-24 text-center font-mono text-xs text-slate-600 hidden lg:inline">
                      {item.extractedIssueDate ? formatToDMY(item.extractedIssueDate) : '---'}
                    </span>

                    <span className="w-28 text-center font-mono text-xs text-slate-500 hidden xl:inline" title={`Email nhận: ${item.receivedDate}`}>
                      {item.receivedDate.slice(0, 16)}
                    </span>

                    <div className="w-36 text-center">{renderMatchBadge(item)}</div>

                    {/* Cột Thao tác */}
                    <div
                      className="w-32 text-right flex items-center justify-end gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Nút AI Quét 2 trang đầu */}
                      <button
                        onClick={() => handleScanSingleAi(item)}
                        disabled={aiScanningId === item.id}
                        className={`p-1.5 rounded transition-colors cursor-pointer ${
                          item.aiExtracted
                            ? 'hover:bg-emerald-50 text-emerald-600'
                            : 'hover:bg-amber-50 text-amber-600'
                        }`}
                        title={
                          item.aiExtracted
                            ? 'AI đã đọc 2 trang đầu (Bấm để quét lại)'
                            : 'Bấm để AI Gemini đọc 2 trang đầu trích xuất Số hiệu & Cơ quan ban hành'
                        }
                      >
                        {aiScanningId === item.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-600" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5" />
                        )}
                      </button>

                      <button
                        onClick={() => setCompareItem(item)}
                        className="p-1.5 rounded hover:bg-amber-50 text-amber-700 transition-colors cursor-pointer"
                        title="So sánh chi tiết với văn bản ở tab Tài liệu"
                      >
                        <GitCompareArrows className="w-3.5 h-3.5" />
                      </button>

                      {item.fileUrl && (
                        <button
                          onClick={() => setPreviewItem(item)}
                          className="p-1.5 rounded hover:bg-indigo-50 text-indigo-600 transition-colors cursor-pointer"
                          title="Xem file PDF đính kèm từ Email"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {isAdmin && item.matchType !== 'PROMOTED' && (
                        <button
                          onClick={() => handlePromoteToOfficial(item)}
                          className="p-1.5 rounded hover:bg-emerald-50 text-emerald-600 transition-colors cursor-pointer"
                          title="Duyệt cập nhật / Chuyển sang tab Tài liệu chính thức"
                        >
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {isAdmin && (
                        <button
                          onClick={() => handleDeleteDraft(item)}
                          className="p-1.5 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                          title="Xóa bản dự thảo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            </div>

            {/* Thanh Phân Trang (Pagination Footer) */}
            <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 rounded-b-xl flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-slate-600">
                <span>
                  Hiển thị <span className="font-semibold text-slate-900 font-mono">{(currentPage - 1) * pageSize + 1}</span> - <span className="font-semibold text-slate-900 font-mono">{Math.min(currentPage * pageSize, filteredDrafts.length)}</span> trên tổng số <span className="font-semibold text-slate-900 font-mono">{filteredDrafts.length}</span> văn bản
                </span>
                <span className="text-slate-300">|</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500">Mỗi trang:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="bg-white border border-slate-200 rounded px-2 py-0.5 text-xs text-slate-700 font-medium focus:outline-none focus:border-sky-500"
                  >
                    <option value={15}>15 dòng</option>
                    <option value={20}>20 dòng</option>
                    <option value={50}>50 dòng</option>
                    <option value={100}>100 dòng</option>
                  </select>
                </div>
              </div>

              {/* Điều hướng trang */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="p-1 rounded border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  title="Trang đầu"
                >
                  <ChevronsLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1 rounded border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  title="Trang trước"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>

                <div className="flex items-center gap-1 px-2 font-mono text-xs text-slate-700">
                  <span>Trang</span>
                  <input
                    type="number"
                    min={1}
                    max={totalPages}
                    value={currentPage}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      if (val >= 1 && val <= totalPages) setCurrentPage(val);
                    }}
                    className="w-11 text-center bg-white border border-slate-200 rounded py-0.5 text-xs font-bold text-sky-700 focus:outline-none focus:border-sky-500"
                  />
                  <span>/ {totalPages}</span>
                </div>

                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1 rounded border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  title="Trang sau"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="p-1 rounded border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  title="Trang cuối"
                >
                  <ChevronsRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </>
        )}
      </div>

      {/* Modal So sánh chi tiết: Văn bản PDF Email (Chưa chính thức) vs Văn bản lưu ở tab Tài liệu */}
      {compareItem && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setCompareItem(null)}
        >
          <div
            className="bg-white border border-slate-200 rounded-2xl max-w-3xl w-full overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 bg-[#1b3252] text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <GitCompareArrows className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold">
                  Đối chiếu Văn bản PDF Email (Chưa chính thức) &amp; Kho Tài liệu Chính thức
                </h3>
              </div>
              <button
                onClick={() => setCompareItem(null)}
                className="p-1 rounded-lg hover:bg-white/15 text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Kết luận đối chiếu tự động:</p>
                  <p className="text-amber-800 mt-0.5">{compareItem.comparisonSummary}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Cột 1: Văn bản PDF lọc từ Email (Chưa chính thức) */}
                <div className="p-4 rounded-xl bg-sky-50/60 border border-sky-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded bg-sky-600 text-white font-bold text-[10px] uppercase">
                      1. Bản PDF từ Email (Chưa chính thức)
                    </span>
                    <span className="font-mono text-[11px] text-sky-700">
                      {compareItem.receivedDate}
                    </span>
                  </div>
                  <p className="font-bold text-slate-900 text-sm">{compareItem.extractedTitle}</p>
                  <div className="space-y-1 text-slate-600 pt-1 border-t border-sky-200/60">
                    <p>
                      <strong>Số / Ký hiệu:</strong>{' '}
                      <span className="font-mono font-semibold text-indigo-700">
                        {compareItem.extractedCode || 'Chưa gắn số'}
                      </span>
                    </p>
                    <p>
                      <strong>Người gửi Email:</strong> {compareItem.senderEmail}
                    </p>
                    <p>
                      <strong>Tiêu đề Email:</strong> {compareItem.emailSubject}
                    </p>
                    <p>
                      <strong>Thư mục lưu tạm:</strong>{' '}
                      <span className="font-mono text-amber-700">{compareItem.driveFolderName}</span>
                    </p>
                  </div>
                </div>

                {/* Cột 2: Văn bản đang lưu ở tab Tài liệu chính thức */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded bg-slate-700 text-white font-bold text-[10px] uppercase">
                      2. Văn bản lưu ở tab Tài liệu
                    </span>
                    {compareItem.similarityScore !== undefined && (
                      <span className="font-mono font-bold text-[11px] text-emerald-700">
                        Độ khớp: {compareItem.similarityScore}%
                      </span>
                    )}
                  </div>

                  {compareItem.matchedOfficialDoc ? (
                    <>
                      <p className="font-bold text-slate-900 text-sm">
                        {compareItem.matchedOfficialDoc.title}
                      </p>
                      <div className="space-y-1 text-slate-600 pt-1 border-t border-slate-200">
                        <p>
                          <strong>Số / Ký hiệu hiện hành:</strong>{' '}
                          <span className="font-mono font-semibold text-indigo-700">
                            {compareItem.matchedOfficialDoc.code || '---'}
                          </span>
                        </p>
                        <p>
                          <strong>Đơn vị ban hành:</strong>{' '}
                          {compareItem.matchedOfficialDoc.issuer || 'ATTECH'}
                        </p>
                        <p>
                          <strong>Ngày ban hành cũ:</strong>{' '}
                          <span className="font-mono">
                            {compareItem.matchedOfficialDoc.issueDate || '---'}
                          </span>
                        </p>
                        <p>
                          <strong>Trạng thái khi duyệt cập nhật:</strong>{' '}
                          <span className="text-amber-700 font-semibold">
                            Tự động chuyển sang &quot;Đã thay thế&quot;
                          </span>
                        </p>
                      </div>
                    </>
                  ) : (
                    <div className="py-8 text-center text-slate-400">
                      Không có văn bản cũ trùng khớp trong tab Tài liệu. Nếu duyệt ban hành, hệ thống sẽ thêm mới hoàn toàn vào tab Tài liệu.
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCompareItem(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold cursor-pointer"
                >
                  Đóng
                </button>
                {isAdmin && compareItem.matchType !== 'PROMOTED' && (
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => handlePromoteToOfficial(compareItem)}
                    className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#1b3252] hover:bg-slate-800 text-white font-semibold shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    <ArrowUpRight className="w-4 h-4" />
                    <span>
                      {compareItem.matchedOfficialDoc
                        ? 'Duyệt cập nhật & Thay thế văn bản cũ ở tab Tài liệu'
                        : 'Duyệt chuyển sang tab Tài liệu chính thức'}
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tải file PDF từ Email vào Thư mục Văn bản chưa chính thức & So sánh AI */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150 my-4">
            <div className="px-6 py-4 bg-[#1b3252] text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <MailSearch className="w-4 h-4 text-sky-400" />
                <div>
                  <h3 className="text-sm font-bold">
                    Thêm PDF từ Email vào Folder Văn bản chưa chính thức
                  </h3>
                  <p className="text-[11px] text-sky-200/80">
                    AI sẽ tự động đọc nội dung PDF và đối chiếu với 282 văn bản ở tab Tài liệu
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/15 text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddAndCompareSubmit} className="p-6 space-y-4 text-xs">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-sky-500 rounded-xl p-4 text-center cursor-pointer bg-slate-50/70 hover:bg-sky-50/30 transition-all"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (f) handleSelectEmailPdf(f);
                  }}
                  className="hidden"
                />
                {isUploadingPdf || isExtractingAI ? (
                  <div className="flex flex-col items-center justify-center py-2 gap-1.5 text-sky-700">
                    <Loader2 className="w-6 h-6 animate-spin text-sky-600" />
                    <span className="font-semibold">
                      Đang lưu vào Folder Văn bản chưa chính thức &amp; dùng AI Gemini đọc trích yếu...
                    </span>
                  </div>
                ) : pdfFileName ? (
                  <div className="flex items-center justify-center gap-2 text-emerald-700 font-semibold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Đã chọn: {pdfFileName} (Nhấn để đổi file khác)</span>
                  </div>
                ) : (
                  <div className="py-1">
                    <UploadCloud className="w-7 h-7 text-sky-600 mx-auto mb-1" />
                    <p className="font-semibold text-slate-800">
                      Chọn file PDF đính kèm từ Email để đưa vào kho Văn bản chưa chính thức
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Hệ thống sẽ tự động so sánh xem có phải là bản cập nhật của văn bản trong tab Tài liệu hay không
                    </p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Người gửi Email</label>
                  <input
                    type="text"
                    value={senderEmail}
                    onChange={(e) => setSenderEmail(e.target.value)}
                    placeholder="VD: antoan.sms@attech.com.vn"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-sky-600 focus:outline-none text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tiêu đề Email</label>
                  <input
                    type="text"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    placeholder="VD: V/v gửi dự thảo quy trình..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-sky-600 focus:outline-none text-slate-900"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-700">
                    Tên văn bản trích xuất từ PDF <span className="text-rose-500">*</span>
                  </label>
                  {aiFilled && (
                    <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5" /> AI tự động đọc
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  required
                  value={extractedTitle}
                  onChange={(e) => setExtractedTitle(e.target.value)}
                  placeholder="VD: Quyết định Phê duyệt Bộ chỉ số và giá trị an toàn chấp nhận được (ALOS)..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-sky-600 focus:outline-none text-slate-900 font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Số / Ký hiệu</label>
                  <input
                    type="text"
                    value={extractedCode}
                    onChange={(e) => setExtractedCode(e.target.value)}
                    placeholder="VD: 915/QĐ-KTQLB"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-sky-600 focus:outline-none text-slate-900 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Đơn vị ban hành</label>
                  <input
                    type="text"
                    value={extractedIssuer}
                    onChange={(e) => setExtractedIssuer(e.target.value)}
                    placeholder="ATTECH / VATM"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-sky-600 focus:outline-none text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Ngày văn bản</label>
                  <input
                    type="date"
                    value={extractedIssueDate}
                    onChange={(e) => setExtractedIssueDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-sky-600 focus:outline-none text-slate-900"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSaving || isUploadingPdf || isExtractingAI}
                  className="px-5 py-2 rounded-xl bg-[#1b3252] hover:bg-slate-800 text-white font-semibold shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {isSaving ? 'Đang đối chiếu...' : 'Lưu Dự thảo & Đối chiếu với Tài liệu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Xem trước File PDF từ Email */}
      {previewItem && previewItem.fileUrl && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setPreviewItem(null)}
        >
          <div
            className="bg-white border border-slate-200 rounded-2xl max-w-5xl w-full h-[88vh] flex flex-col overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3 bg-[#1b3252] text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <FileText className="w-4 h-4 text-sky-400 shrink-0" />
                <span className="text-sm font-bold truncate">{previewItem.extractedTitle}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={previewItem.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-semibold"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Mở tab mới</span>
                </a>
                <button
                  onClick={() => setPreviewItem(null)}
                  className="p-1.5 rounded-lg hover:bg-rose-500/20 text-slate-300 hover:text-rose-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 bg-slate-900">
              <iframe
                src={previewItem.fileUrl}
                className="w-full h-full border-none bg-white"
                title={previewItem.extractedTitle}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
