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
  ArrowDown,
  ArrowUp,
  Bot,
} from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import { useAuth } from '@/components/auth-context';
import { useTheme } from '@/components/theme-context';
import { useAssistant } from '@/components/assistant-context';
import ThemeToggleButton from '@/components/theme-toggle-button';
import UserAvatarMenu from '@/components/user-avatar-menu';
import {
  EmailDraftItem,
  DEFAULT_EMAIL_DRAFTS,
  formatToDMY,
  formatToDMYTime,
  parseReceivedTimestamp,
  sortDraftsByReceivedDate,
} from '@/lib/compliance';
import { abbreviateIssuer } from '@/lib/issuer';

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

// Lấy link xem trước trực tiếp file PDF (Google Drive hoặc Supabase/Storage)
function getDraftPreviewUrl(item: EmailDraftItem | null): string | null {
  if (!item) return null;
  if (item.driveFileId) {
    return `https://drive.google.com/file/d/${item.driveFileId}/preview`;
  }
  if (item.fileUrl) {
    const match = item.fileUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return `https://drive.google.com/file/d/${match[1]}/preview`;
    }
    return item.fileUrl;
  }
  return null;
}

export default function EmailDocumentTasksPage() {
  const { isAdmin } = useAuth();
  const { isDeepAero } = useTheme();
  const { setDocsContext, selectedDocIds, selectAndAskDoc } = useAssistant();
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
  const [unreadAiOnly, setUnreadAiOnly] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Phân trang (Pagination) để bảng hiển thị vừa vặn trong màn hình
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(15);
  // Sắp xếp theo ngày nhận email: Mặc định 'desc' để email mới nhất luôn ở trên cùng Page 1
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

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

  // Đóng modal xem trước khi nhấn phím Escape
  useEffect(() => {
    if (!previewItem) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreviewItem(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewItem]);

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
        setDrafts(sortDraftsByReceivedDate(data.emailDrafts, 'desc'));
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
        setDrafts(sortDraftsByReceivedDate(data.emailDrafts, 'desc'));
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
        setDrafts(sortDraftsByReceivedDate(data.emailDrafts, 'desc'));
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
    if (item.aiExtracted) {
      showToast('success', `Văn bản "${item.extractedTitle || item.pdfFileName}" đã được AI trích xuất trước đó.`);
      return;
    }
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
      } else if (metaData.updatedDraft) {
        setDrafts((prev) =>
          prev.map((d) => (d.id === item.id ? { ...d, ...metaData.updatedDraft } : d))
        );
      }

      showToast(
        'success',
        `AI đã đọc 2 trang đầu: ${data.metadata?.document_code || 'Chưa rõ số'} - ${abbreviateIssuer(data.metadata?.issuing_authority) || 'ATTECH'}`
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
      `Bắt đầu hàng đợi AI an toàn (${unScanned.length} văn bản chưa quét, tốc độ 12 file/phút để tuân thủ Gemini Free Tier)...`
    );

    let count = 0;
    for (const item of unScanned) {
      if (queueStopRef.current) break;
      if (item.aiExtracted) continue;
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
          if (m.issuing_authority) setExtractedIssuer(abbreviateIssuer(m.issuing_authority));
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
            extractedIssuer: abbreviateIssuer(extractedIssuer.trim()) || 'ATTECH',
            extractedIssueDate,
            scopeDomain,
            fileUrl,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Không thể lưu và đối chiếu');

      if (Array.isArray(data.emailDrafts)) {
        setDrafts(sortDraftsByReceivedDate(data.emailDrafts, 'desc'));
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
        setDrafts(sortDraftsByReceivedDate(data.emailDrafts, 'desc'));
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

    const targetItems = drafts.filter((d) => selectedIds.includes(d.id) && !d.aiExtracted);
    if (targetItems.length === 0) {
      showToast('success', 'Tất cả các văn bản đã chọn đều đã được AI trích xuất hoàn tất.');
      return;
    }

    setIsBatchAiRunning(true);
    batchAiStopRef.current = false;
    setBatchAiProgress({ current: 0, total: targetItems.length });

    showToast(
      'success',
      `Bắt đầu đọc AI 2 trang cho ${targetItems.length} văn bản đã chọn (bỏ qua các file đã quét)...`
    );

    let count = 0;
    for (const item of targetItems) {
      if (batchAiStopRef.current) break;
      if (item.aiExtracted) continue;
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
    const filtered = drafts.filter((item) => {
      if (unreadAiOnly && item.aiExtracted) return false;
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

    // Sắp xếp ưu tiên theo ngày nhận email: email mới nhất luôn hiển thị trên cùng page 1
    return sortDraftsByReceivedDate(filtered, sortOrder);
  }, [drafts, searchQuery, matchFilter, unreadAiOnly, fromDate, toDate, isAllTime, sortOrder]);

  // Đồng bộ danh sách văn bản ở tab Công việc sang Trợ lý AI để người dùng có thể bấm nút "Hỏi AI" 1 chạm ngay trên từng văn bản
  useEffect(() => {
    const mappedDocs = filteredDrafts.map((item) => ({
      id: item.id,
      file_name: item.extractedTitle,
      document_code: item.extractedCode || null,
      issuing_authority: abbreviateIssuer(item.extractedIssuer || 'ATTECH'),
      issue_date: item.extractedIssueDate || item.receivedDate || null,
      status: item.matchType === 'PROMOTED' ? 'ACTIVE' : 'DRAFT_EMAIL',
      drive_file_id: item.driveFileId || null,
      has_ocr: true,
      extra_context: [
        `Tên file PDF: ${item.pdfFileName}`,
        `Người gửi Email: ${item.senderEmail}`,
        `Tiêu đề Email: ${item.emailSubject}`,
        `Thư mục lưu tạm: ${item.driveFolderName}`,
        `Kết luận đối chiếu tự động: ${item.comparisonSummary}`,
        item.matchedOfficialDoc
          ? `Văn bản chính thức liên quan trong kho: ${item.matchedOfficialDoc.title} (Số hiệu: ${item.matchedOfficialDoc.code || '---'}, Ngày: ${item.matchedOfficialDoc.issueDate || '---'})`
          : 'Không có văn bản cũ trùng khớp trong kho chính thức (Văn bản mới).',
      ].join('\n'),
    }));
    setDocsContext(mappedDocs, 'Văn bản Công việc (Email / Drive)');
  }, [filteredDrafts, setDocsContext]);

  const handleAskAiForDraft = (item: EmailDraftItem) => {
    selectAndAskDoc({
      id: item.id,
      file_name: item.extractedTitle,
      document_code: item.extractedCode || null,
      issuing_authority: abbreviateIssuer(item.extractedIssuer || 'ATTECH'),
      issue_date: item.extractedIssueDate || item.receivedDate || null,
      status: item.matchType === 'PROMOTED' ? 'ACTIVE' : 'DRAFT_EMAIL',
      drive_file_id: item.driveFileId || null,
      has_ocr: true,
      extra_context: [
        `Tên file PDF: ${item.pdfFileName}`,
        `Người gửi Email: ${item.senderEmail}`,
        `Tiêu đề Email: ${item.emailSubject}`,
        `Thư mục lưu tạm: ${item.driveFolderName}`,
        `Kết luận đối chiếu tự động: ${item.comparisonSummary}`,
        item.matchedOfficialDoc
          ? `Văn bản chính thức liên quan trong kho: ${item.matchedOfficialDoc.title} (Số hiệu: ${item.matchedOfficialDoc.code || '---'}, Ngày: ${item.matchedOfficialDoc.issueDate || '---'})`
          : 'Không có văn bản cũ trùng khớp trong kho chính thức (Văn bản mới).',
      ].join('\n'),
    });
  };

  // Tự động reset về trang 1 khi thay đổi bộ lọc tìm kiếm hoặc kích thước trang hoặc chiều sắp xếp
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, matchFilter, unreadAiOnly, fromDate, toDate, isAllTime, pageSize, sortOrder]);

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
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-300 whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
          <span>Bản cập nhật ({item.similarityScore || 90}%)</span>
        </span>
      );
    }
    if (item.matchType === 'EXACT_DUPLICATE') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
          <span>Trùng số hiệu</span>
        </span>
      );
    }
    if (item.matchType === 'PROMOTED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
          <span>Đã chuyển Tài liệu</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-sky-50 text-sky-700 border border-sky-200 whitespace-nowrap">
        <span className="w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0" />
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

      {/* Khối Tiêu đề: Hỗ trợ linh hoạt 2 chủ đề: Sky Cloud (mặc định) & Deep Aero */}
      <div
        className={`relative border-b shadow-sm shrink-0 overflow-hidden z-20 ${isDeepAero
            ? 'deep-aero-bg border-sky-950'
            : 'bg-gradient-to-r from-[#0284c7] via-[#0ea5e9] to-[#38bdf8] border-sky-300'
          }`}
      >
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
        )}

        <header className={`h-14 flex items-center justify-between px-3.5 sm:px-6 relative z-10 ${isDeepAero ? 'border-b border-white/10' : ''}`}>
          <div className="flex items-center gap-2 text-white font-bold text-xs sm:text-sm drop-shadow-2xs min-w-0">
            <MailSearch className="w-4 h-4 text-white shrink-0" />
            <span className="truncate">Công việc &amp; Đối chiếu ({filteredDrafts.length})</span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2.5 ml-auto shrink-0">
            {/* Nút chuyển đổi Theme (Sky Cloud <-> Deep Aero) */}
            <ThemeToggleButton />

            <div className={`hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs shadow-xs border ${isDeepAero
                ? 'glass-pill-deep-aero'
                : 'bg-white/40 backdrop-blur-[35px] border-white/60 text-[#0f2043]'
              }`}>
              <span className={`p-0.5 rounded ${isDeepAero ? 'bg-sky-500/20 text-sky-300' : 'bg-white/50 border border-white/60 text-sky-700'}`}>
                <MailSearch className="w-3.5 h-3.5" />
              </span>
              <span className={`font-semibold ${isDeepAero ? 'text-slate-200' : 'text-[#0f2043]'}`}>Hộp thư:</span>
              <span className={`font-bold font-mono ${isDeepAero ? 'text-sky-300' : 'text-[#0f2043]'}`}>tuh@attech.com.vn</span>
            </div>

            {/* Nút Quét Email & Đối chiếu thường (Glassmorphism) */}
            <button
              onClick={handleScanEmailsByDateRange}
              disabled={isScanning}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-xs cursor-pointer disabled:opacity-60 border ${isDeepAero
                  ? 'glass-pill-deep-aero'
                  : 'bg-white/40 hover:bg-white/55 text-[#0f2043] border-white/60 hover:border-white/80 backdrop-blur-[35px]'
                }`}
              title="Quét Email theo khoảng thời gian và đối chiếu với kho Tài liệu chính thức"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isDeepAero ? 'text-sky-300' : 'text-sky-700'} ${isScanning ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline font-semibold">{isScanning ? 'Đang quét...' : 'Quét Email & Đối chiếu'}</span>
            </button>

            {/* Nút Quét Email & Đồng bộ Drive THỦ CÔNG DÀNH RIÊNG CHO ADMIN */}
            {isAdmin && (
              <button
                onClick={handleAdminManualScan}
                disabled={isScanning}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 active:scale-95 text-white rounded-lg text-xs font-semibold transition-all shadow-md cursor-pointer disabled:opacity-60 border border-amber-400/40"
                title="Admin: Quét trực tiếp hộp thư tuh@attech.com.vn và đồng bộ toàn bộ file PDF trong thư mục Google Drive 03_TÀI LIỆU CHƯA XÁC THỰC"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-white ${isScanning ? 'animate-spin' : ''}`} />
                <span>{isScanning ? 'Đang quét & đồng bộ...' : 'Quét Email & Drive thủ công'}</span>
                <span className="px-1.5 py-0.2 rounded text-[9px] bg-black/20 font-bold uppercase tracking-wider text-amber-100">
                  Admin
                </span>
              </button>
            )}

            {/* Nút Quét AI cố định trên Header */}
            {isAdmin && (
              <button
                onClick={handleToggleAiQueue}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-md cursor-pointer border ${isQueueRunning
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
                    <span>Dừng ({queueProgress?.current}/{queueProgress?.total})</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-200" />
                    <span>Quét AI</span>
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
                className="flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 bg-[#1b3252] hover:bg-slate-900 active:scale-95 text-white border border-white/25 rounded-lg text-xs font-semibold transition-all shadow-md cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Tải PDF từ Email</span>
              </button>
            )}

            {/* Menu Tài khoản User hình tròn góc phải trên cùng */}
            <UserAvatarMenu />
          </div>
        </header>
      </div>

      {/* Toast thông báo */}
      {toast && (
        <div
          className={`mx-3.5 sm:mx-6 mt-3 p-2.5 rounded-lg border text-xs flex items-center justify-between shadow-xs ${toast.type === 'success'
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

      {/* GIAO DIỆN IPHONE / MOBILE: Sticky Search + Horizontal Filter Chips vuốt ngang 1 ngón cái */}
      <div className="flex md:hidden flex-col gap-2 px-3.5 py-2.5 bg-white border-b border-slate-200 shadow-xs shrink-0 z-20">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-sky-600 w-4 h-4" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm số hiệu, trích yếu PDF email (bấm 🎙️ đọc giọng nói)..."
            className="w-full bg-slate-100/90 focus:bg-white border border-slate-200 focus:border-sky-500 rounded-xl pl-9 pr-8 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-600 p-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          <button
            type="button"
            onClick={() => {
              setMatchFilter('ALL');
              setUnreadAiOnly(false);
              setIsAllTime(true);
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-all border ${
              matchFilter === 'ALL' && !unreadAiOnly && isAllTime
                ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                : 'bg-slate-100 text-slate-700 border-slate-200'
            }`}
          >
            Tất cả ({drafts.length})
          </button>

          <button
            type="button"
            onClick={() => setUnreadAiOnly(!unreadAiOnly)}
            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-all border ${
              unreadAiOnly
                ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                : 'bg-purple-50 text-purple-800 border-purple-200'
            }`}
          >
            <Sparkles className="w-3 h-3" />
            <span>Chưa đọc AI ({drafts.filter((d) => !d.aiExtracted).length})</span>
          </button>

          <button
            type="button"
            onClick={() => setMatchFilter(matchFilter === 'UPDATE_CANDIDATE' ? 'ALL' : 'UPDATE_CANDIDATE')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-all border ${
              matchFilter === 'UPDATE_CANDIDATE'
                ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${matchFilter === 'UPDATE_CANDIDATE' ? 'bg-white' : 'bg-amber-500'}`} />
            <span>Bản cập nhật</span>
          </button>

          <button
            type="button"
            onClick={() => setMatchFilter(matchFilter === 'NEW_DRAFT' ? 'ALL' : 'NEW_DRAFT')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-all border ${
              matchFilter === 'NEW_DRAFT'
                ? 'bg-sky-700 text-white border-sky-700 shadow-xs'
                : 'bg-sky-50 text-sky-800 border-sky-200'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${matchFilter === 'NEW_DRAFT' ? 'bg-white' : 'bg-sky-500'}`} />
            <span>Dự thảo mới</span>
          </button>

          <button
            type="button"
            onClick={() => setMatchFilter(matchFilter === 'PROMOTED' ? 'ALL' : 'PROMOTED')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-all border ${
              matchFilter === 'PROMOTED'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${matchFilter === 'PROMOTED' ? 'bg-white' : 'bg-emerald-500'}`} />
            <span>Đã ban hành</span>
          </button>
        </div>
      </div>

      {/* Thanh chọn Khoảng thời gian Đọc Email & Bộ lọc Đối chiếu trên PC (Đồng bộ nền sáng với tab Tài liệu) */}
      <div className="hidden md:flex px-6 py-2.5 bg-white border-b border-slate-200 shadow-2xs shrink-0 z-20 flex-col gap-2">
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
                className={`px-2 py-1 rounded-md font-medium cursor-pointer transition-colors ${!isAllTime
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
                className={`px-2 py-1 rounded-md font-medium cursor-pointer transition-colors ${!isAllTime
                    ? 'bg-slate-100 hover:bg-sky-50 text-slate-600 hover:text-sky-700'
                    : 'bg-slate-100 text-slate-500'
                  }`}
              >
                30 ngày
              </button>
              <button
                type="button"
                onClick={() => setIsAllTime(true)}
                className={`px-2.5 py-1 rounded-md font-medium cursor-pointer transition-colors ${isAllTime
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
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${matchFilter === 'ALL'
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                Tất cả ({filteredDrafts.length})
              </button>
              <button
                type="button"
                onClick={() => setMatchFilter('UPDATE_CANDIDATE')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer ${matchFilter === 'UPDATE_CANDIDATE'
                    ? 'bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Bản cập nhật văn bản
              </button>
              <button
                type="button"
                onClick={() => setMatchFilter('NEW_DRAFT')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer ${matchFilter === 'NEW_DRAFT'
                    ? 'bg-sky-50 text-sky-700 border border-sky-200 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500" /> Dự thảo mới
              </button>
              <button
                type="button"
                onClick={() => setMatchFilter('PROMOTED')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer ${matchFilter === 'PROMOTED'
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

      {/* Vùng Bảng dữ liệu - Cố định Khung Tiêu đề làm giới hạn trên tuyệt đối, chỉ cuộn danh sách văn bản */}
      <div className="flex-1 flex flex-col min-h-0 px-3.5 sm:px-6 py-3">
        {isLoading ? (
          <div className="flex-1 border border-slate-200 rounded-xl bg-white p-16 flex flex-col items-center justify-center text-slate-500 text-xs gap-3 shadow-xs">
            <Loader2 className="w-6 h-6 animate-spin text-sky-600" />
            <span>Đang tải danh sách văn bản PDF lọc từ Email...</span>
          </div>
        ) : filteredDrafts.length === 0 ? (
          <div className="flex-1 border border-slate-200 rounded-xl bg-white p-16 flex flex-col items-center justify-center text-center shadow-xs">
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
            {/* GIAO DIỆN THẺ VĂN BẢN THÔNG MINH TRÊN IPHONE (3 hàng gọn gàng, không bao giờ phải cuộn ngang) */}
            <div className="flex-1 overflow-y-auto md:hidden space-y-2.5 pb-4">
              {paginatedDrafts.map((item) => {
                const previewUrl = getDraftPreviewUrl(item);
                const hasPreview = !!previewUrl;
                const isPinnedAi = selectedDocIds.includes(item.id);
                const displayDate = item.extractedIssueDate
                  ? formatToDMY(item.extractedIssueDate)
                  : item.receivedDate
                    ? formatToDMYTime(item.receivedDate)
                    : '---';

                return (
                  <div
                    key={item.id}
                    className={`rounded-2xl border p-3.5 shadow-xs bg-white transition-all ${
                      isPinnedAi
                        ? 'border-indigo-400 ring-1 ring-indigo-300'
                        : item.matchType === 'UPDATE_CANDIDATE'
                          ? 'border-amber-300/90'
                          : 'border-slate-200/90'
                    }`}
                  >
                    {/* Hàng 1 (Tiêu đề ưu tiên số 1): Tên văn bản hiển thị ĐẦY ĐỦ 100%, không cắt chữ (...), bấm vào mở PDF ngay */}
                    <div
                      onClick={() => {
                        if (hasPreview) setPreviewItem(item);
                      }}
                      className={`mb-2 ${hasPreview ? 'cursor-pointer active:opacity-75' : ''}`}
                    >
                      <h4 className="text-[13.5px] font-bold text-slate-900 leading-snug break-words whitespace-normal">
                        {item.extractedTitle}
                      </h4>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                        <span className="break-all font-mono text-slate-600">
                          📄 {item.pdfFileName}
                        </span>
                        {renderMatchBadge(item)}
                      </div>
                    </div>

                    {/* Hàng 2 (Ngày ban hành & Định danh): Ưu tiên hiển thị rõ Ngày ban hành + Số/Ký hiệu */}
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5 px-2.5 py-1.5 rounded-xl bg-slate-50/90 border border-slate-100">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-semibold text-slate-500">Ngày ban hành:</span>
                        <span className="font-mono text-xs font-extrabold text-sky-800 bg-sky-50 border border-sky-200/80 px-2 py-0.5 rounded-md">
                          {displayDate}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-mono text-[11px] font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded-md break-all">
                          {item.extractedCode || 'Chưa gắn số'}
                        </span>
                        {item.aiExtracted ? (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                            <Sparkles className="w-2.5 h-2.5" /> AI
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleScanSingleAi(item)}
                            disabled={aiScanningId === item.id}
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 shrink-0"
                          >
                            {aiScanningId === item.id ? (
                              <Loader2 className="w-2.5 h-2.5 animate-spin" />
                            ) : (
                              <Sparkles className="w-2.5 h-2.5" />
                            )}
                            <span>Đọc AI</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Hàng 3 (Đơn vị & Thao tác nhanh): Tên cơ quan ban hành + 3 nút tròn nhỏ gọn [👁️ Xem PDF] – [✨ Hỏi AI] – [🔄 Đối chiếu] */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-semibold truncate max-w-[130px]"
                        title={item.extractedIssuer || 'ATTECH'}
                      >
                        <Building className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">{abbreviateIssuer(item.extractedIssuer || 'ATTECH')}</span>
                      </span>

                      <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                        {/* 1. [👁️ Xem PDF] */}
                        <button
                          type="button"
                          disabled={!hasPreview}
                          onClick={() => hasPreview && setPreviewItem(item)}
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
                          onClick={() => handleAskAiForDraft(item)}
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
                          onClick={() => setCompareItem(item)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-amber-50 active:bg-amber-100 text-amber-800 text-[11px] font-semibold border border-amber-200"
                          title="Đối chiếu với kho Tài liệu chính thức"
                        >
                          <GitCompareArrows className="w-3.5 h-3.5" />
                          <span>Đối chiếu</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Phân trang gọn trên iPhone */}
              {totalPages > 1 && (
                <div className="pt-2 flex items-center justify-between bg-white p-3 rounded-2xl border border-slate-200 text-xs">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 font-semibold text-slate-700 disabled:opacity-40"
                  >
                    ← Trang trước
                  </button>
                  <span className="font-mono font-bold text-slate-700">
                    Trang {currentPage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 font-semibold text-slate-700 disabled:opacity-40"
                  >
                    Trang sau →
                  </button>
                </div>
              )}
            </div>

            {/* GIAO DIỆN MÁY TÍNH (PC): Giữ nguyên 100% bảng dữ liệu */}
            <div className="hidden md:flex flex-1 flex-col min-h-0 border border-slate-200 rounded-xl bg-white shadow-xs overflow-hidden">
            {/* Table Header - CỐ ĐỊNH LÀM GIỚI HẠN CHẶN TRÊN (Không cuộn, chặn đứng tài liệu không vượt lên trên) */}
            <div className="shrink-0 h-11 px-4 flex items-center justify-between bg-slate-100 text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200 z-10 shadow-2xs">
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
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <span className="truncate">VĂN BẢN</span>
                  {selectedIds.length > 0 && (
                    <div className="normal-case font-normal text-slate-500 text-[11px] flex items-center gap-2 shrink-0">
                      <span>(Đã chọn <strong className="text-sky-700 font-bold font-mono">{selectedIds.length}</strong>)</span>
                      <button
                        type="button"
                        onClick={() => setSelectedIds(filteredDrafts.map((d) => d.id))}
                        className="text-sky-600 hover:text-sky-800 underline font-medium cursor-pointer"
                      >
                        Chọn tất cả {filteredDrafts.length}
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedIds([])}
                        className="text-slate-400 hover:text-slate-600 underline cursor-pointer"
                      >
                        Bỏ chọn
                      </button>
                      {isAdmin && (
                        <>
                          <button
                            type="button"
                            onClick={handleBatchAiScan}
                            disabled={isBatchAiRunning}
                            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold shadow-2xs transition-all cursor-pointer ${isBatchAiRunning
                                ? 'bg-amber-600 hover:bg-amber-700 text-white animate-pulse'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                              }`}
                            title="Chỉ đọc AI cho các văn bản chưa được quét trong danh sách chọn"
                          >
                            <Sparkles className="w-3 h-3 text-amber-200" />
                            <span>
                              {isBatchAiRunning
                                ? `Đang đọc (${batchAiProgress?.current}/${batchAiProgress?.total})`
                                : `Quét AI (${drafts.filter((d) => selectedIds.includes(d.id) && !d.aiExtracted).length})`}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={handleBatchDelete}
                            disabled={isSaving}
                            className="flex items-center gap-1 px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[11px] font-bold shadow-2xs transition-all cursor-pointer"
                            title="Xóa các văn bản đã chọn"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Xóa ({selectedIds.length})</span>
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0 text-right">
                <span className="w-32 text-left hidden sm:inline">SỐ/KÝ HIỆU</span>
                <span className="w-40 text-left hidden md:inline">ĐƠN VỊ BAN HÀNH</span>
                <span className="w-28 text-center hidden lg:inline">NGÀY BAN HÀNH</span>
                <button
                  type="button"
                  onClick={() => setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
                  className="w-36 text-center hidden xl:inline-flex items-center justify-center gap-1 hover:text-sky-700 transition-colors cursor-pointer select-none group"
                  title="Sắp xếp theo ngày nhận email (Mặc định: Email mới nhất ở trên cùng page 1)"
                >
                  <span className="font-bold">NGÀY EMAIL</span>
                  {sortOrder === 'desc' ? (
                    <ArrowDown className="w-3.5 h-3.5 text-sky-600 group-hover:scale-110 transition-transform" />
                  ) : (
                    <ArrowUp className="w-3.5 h-3.5 text-sky-600 group-hover:scale-110 transition-transform" />
                  )}
                </button>
                <span className="w-40 text-center shrink-0">ĐỐI CHIẾU</span>
                <span className="w-44 text-right shrink-0">THAO TÁC</span>
              </div>
            </div>

            {/* Table Rows - VÙNG CUỘN DUY NHẤT (Khi cuộn chỉ di chuyển bên dưới Table Header) */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 min-h-0">
              {paginatedDrafts.map((item, idx) => {
                const isSelected = selectedIds.includes(item.id);
                const previewUrl = getDraftPreviewUrl(item);
                const hasPreview = !!previewUrl;

                return (
                  <div
                    key={item.id}
                    className={`py-2.5 px-4 flex items-center justify-between hover:bg-sky-50/50 transition-colors group ${isSelected ? 'bg-sky-50/70 border-l-4 border-l-sky-500' : 'bg-white'
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
                        className={`w-4 h-4 shrink-0 mt-0.5 ${item.matchType === 'UPDATE_CANDIDATE'
                            ? 'text-amber-600'
                            : 'text-sky-600'
                          }`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p
                            onClick={(e) => {
                              if (hasPreview) {
                                e.stopPropagation();
                                setPreviewItem(item);
                              }
                            }}
                            className={`text-xs font-semibold truncate ${hasPreview
                                ? 'text-slate-900 group-hover:text-sky-700 hover:underline cursor-pointer'
                                : 'text-slate-900 cursor-default'
                              }`}
                            title={hasPreview ? `Nhấn để xem trước file PDF: ${item.extractedTitle}` : item.extractedTitle}
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

                      <span className="w-40 text-left text-xs text-slate-700 font-medium truncate hidden md:inline" title={item.extractedIssuer || 'ATTECH'}>
                        {abbreviateIssuer(item.extractedIssuer || 'ATTECH')}
                      </span>

                      <span className="w-28 text-center font-mono text-xs text-slate-600 hidden lg:inline">
                        {item.extractedIssueDate ? formatToDMY(item.extractedIssueDate) : '---'}
                      </span>

                      <span
                        className={`w-36 text-center font-mono text-xs hidden xl:inline ${item.receivedDate ? 'text-slate-600 font-semibold' : 'text-slate-300'
                          }`}
                        title={item.receivedDate ? `Email nhận: ${formatToDMYTime(item.receivedDate)}` : 'Văn bản đồng bộ từ Google Drive (Không qua email)'}
                      >
                        {item.receivedDate ? formatToDMYTime(item.receivedDate) : '---'}
                      </span>

                      <div className="w-40 text-center shrink-0">{renderMatchBadge(item)}</div>

                      {/* Cột Thao tác */}
                      <div
                        className="w-44 shrink-0 text-right flex items-center justify-end gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Nút AI Quét 2 trang đầu */}
                        <button
                          onClick={() => !item.aiExtracted && handleScanSingleAi(item)}
                          disabled={aiScanningId === item.id || !!item.aiExtracted}
                          className={`p-1.5 rounded transition-colors ${item.aiExtracted
                              ? 'text-emerald-600 bg-emerald-50/70 cursor-default opacity-90'
                              : 'hover:bg-amber-50 text-amber-600 cursor-pointer'
                            }`}
                          title={
                            item.aiExtracted
                              ? 'AI đã trích xuất hoàn tất (Không quét lại)'
                              : 'Bấm để AI Gemini đọc 2 trang đầu trích xuất Số hiệu & Đơn vị ban hành'
                          }
                        >
                          {aiScanningId === item.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-600" />
                          ) : item.aiExtracted ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
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

                        {hasPreview && (
                          <button
                            onClick={() => setPreviewItem(item)}
                            className="p-1.5 rounded hover:bg-indigo-50 text-indigo-600 transition-colors cursor-pointer"
                            title="Xem trước trực tiếp file PDF"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          data-assistant-trigger="true"
                          onClick={() => handleAskAiForDraft(item)}
                          className={`p-1.5 rounded transition-colors cursor-pointer ${
                            selectedDocIds.includes(item.id)
                              ? 'bg-indigo-600 text-white shadow-2xs'
                              : 'hover:bg-indigo-50 text-indigo-600 hover:text-indigo-700'
                          }`}
                          title="Hỏi Trợ lý AI về văn bản này"
                        >
                          <Bot className="w-3.5 h-3.5" />
                        </button>

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

            {/* Thanh Phân Trang (Pagination Footer) - Cố định đáy bảng */}
            <div className="shrink-0 px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
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
                      {compareItem.receivedDate ? formatToDMYTime(compareItem.receivedDate) : 'Đồng bộ từ Drive'}
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
                      <strong>Đơn vị ban hành:</strong>{' '}
                      <span className="font-semibold text-slate-800" title={compareItem.extractedIssuer || 'ATTECH'}>
                        {abbreviateIssuer(compareItem.extractedIssuer || 'ATTECH')}
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
                    {getDraftPreviewUrl(compareItem) && (
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() => setPreviewItem(compareItem)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Xem trực tiếp file PDF này</span>
                        </button>
                      </div>
                    )}
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
                          <span className="font-semibold text-slate-800" title={compareItem.matchedOfficialDoc.issuer || 'ATTECH'}>
                            {abbreviateIssuer(compareItem.matchedOfficialDoc.issuer || 'ATTECH')}
                          </span>
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

      {/* Modal Xem trước File PDF (Trực tiếp qua luồng bảo mật ATTECH - Hỗ trợ Bottom Sheet trên iPhone) */}
      {previewItem && (() => {
        const previewUrl = getDraftPreviewUrl(previewItem);
        if (!previewUrl) return null;
        const nativeViewUrl = previewItem.driveFileId
          ? `/api/documents/stream/${encodeURIComponent(previewItem.driveFileId)}`
          : previewUrl;

        const handleShareDraftPdf = async () => {
          const shareLink = previewItem.driveFileId
            ? `${window.location.origin}${nativeViewUrl}`
            : nativeViewUrl;
          try {
            if (navigator.share) {
              await navigator.share({
                title: previewItem.extractedTitle,
                text: `Văn bản nội bộ ATTECH (Yêu cầu đăng nhập): ${previewItem.extractedTitle}`,
                url: shareLink,
              });
            } else {
              await navigator.clipboard.writeText(shareLink);
              showToast('success', 'Đã sao chép đường dẫn bảo mật nội bộ ATTECH!');
            }
          } catch {
            // Người dùng hủy chia sẻ
          }
        };

        return (
          <div
            className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150"
            onClick={() => setPreviewItem(null)}
          >
            <div
              className="bg-white border border-slate-200 rounded-t-3xl sm:rounded-2xl max-w-5xl w-full h-[92dvh] sm:h-[88vh] flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="pt-2 pb-0.5 bg-[#1b3252] sm:hidden flex justify-center">
                <div className="w-10 h-1 rounded-full bg-white/30" />
              </div>
              <div className="px-4 sm:px-5 py-2.5 sm:py-3 bg-[#1b3252] text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-4 h-4 text-sky-400 shrink-0" />
                  <span className="text-xs sm:text-sm font-bold truncate">{previewItem.extractedTitle}</span>
                  {previewItem.driveFileId && (
                    <span className="hidden md:inline font-mono text-[10px] text-emerald-200 bg-white/10 px-2 py-0.5 rounded border border-white/20">
                      {isAdmin ? `Protected · ${previewItem.driveFileId.slice(0, 10)}...` : 'ATTECH Secure Stream'}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleShareDraftPdf}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-500/25 hover:bg-sky-500/40 border border-sky-400/30 text-white text-xs font-semibold transition-colors"
                    title="Chia sẻ qua Zalo / Mail"
                  >
                    <span>Chia sẻ</span>
                  </button>
                  <a
                    href={nativeViewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-semibold transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Mở tab mới</span>
                    <span className="sm:hidden">Mở gốc</span>
                  </a>
                  <button
                    onClick={() => setPreviewItem(null)}
                    className="p-1.5 rounded-lg hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 transition-colors cursor-pointer"
                    title="Đóng (Esc)"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex-1 bg-slate-900 relative pb-safe">
                <iframe
                  src={previewUrl}
                  className="w-full h-full border-none bg-white"
                  title={previewItem.extractedTitle}
                  allow="autoplay"
                />
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
