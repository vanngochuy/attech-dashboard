'use client';

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

export interface AssistantDoc {
  id: string;
  file_name: string;
  document_code?: string | null;
  issuing_authority?: string | null;
  issue_date?: string | null;
  status?: string | null;
  department_access?: string[] | null;
  drive_file_id?: string | null;
  has_ocr?: boolean;
}

interface AssistantContextValue {
  docs: AssistantDoc[] | null;
  scopeLabel: string;
  setDocsContext: (docs: AssistantDoc[] | null, scopeLabel: string) => void;
  selectedDocIds: string[];
  toggleSelectDoc: (id: string) => void;
  selectAndAskDoc: (id: string) => void;
  clearSelectedDocs: () => void;
  markDocHasOcr: (id: string) => void;
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  isExpanded: boolean;
  setIsExpanded: (v: boolean) => void;
  previewFileId: string | null;
  setPreviewFileId: (id: string | null) => void;
}

const MAX_SELECTED = 2;

const AssistantContext = createContext<AssistantContextValue | null>(null);

export function AssistantProvider({ children }: { children: React.ReactNode }) {
  const [docs, setDocs] = useState<AssistantDoc[] | null>(null);
  const [scopeLabel, setScopeLabel] = useState('Toàn bộ hệ thống');
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [previewFileId, setPreviewFileId] = useState<string | null>(null);

  const setDocsContext = useCallback((d: AssistantDoc[] | null, label: string) => {
    setDocs(d);
    setScopeLabel(label);
  }, []);

  const toggleSelectDoc = useCallback((id: string) => {
    setSelectedDocIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }
      if (prev.length >= MAX_SELECTED) {
        // Nếu đã chọn đủ 2 file, thay thế file cũ nhất bằng file mới
        return [prev[1], id];
      }
      return [...prev, id];
    });
  }, []);

  const selectAndAskDoc = useCallback((id: string) => {
    setSelectedDocIds((prev) => {
      if (prev.includes(id)) return prev;
      if (prev.length >= MAX_SELECTED) return [prev[1], id];
      return [...prev, id];
    });
    setIsOpen(true);
  }, []);

  const clearSelectedDocs = useCallback(() => {
    setSelectedDocIds([]);
  }, []);

  const markDocHasOcr = useCallback((id: string) => {
    setDocs((prev) =>
      prev ? prev.map((d) => (d.id === id ? { ...d, has_ocr: true } : d)) : prev
    );
  }, []);

  const value = useMemo(
    () => ({
      docs,
      scopeLabel,
      setDocsContext,
      selectedDocIds,
      toggleSelectDoc,
      selectAndAskDoc,
      clearSelectedDocs,
      markDocHasOcr,
      isOpen,
      setIsOpen,
      isExpanded,
      setIsExpanded,
      previewFileId,
      setPreviewFileId,
    }),
    [
      docs,
      scopeLabel,
      setDocsContext,
      selectedDocIds,
      toggleSelectDoc,
      selectAndAskDoc,
      clearSelectedDocs,
      markDocHasOcr,
      isOpen,
      isExpanded,
      previewFileId,
    ]
  );

  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>;
}

export function useAssistant() {
  const ctx = useContext(AssistantContext);
  if (!ctx) throw new Error('useAssistant phải nằm trong AssistantProvider');
  return ctx;
}
