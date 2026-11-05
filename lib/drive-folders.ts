/**
 * TẬP TIN CẤU HÌNH TRUNG TÂM CHO CÂY THƯ MỤC GOOGLE DRIVE (ATTECH_DOCUMENTS)
 * -------------------------------------------------------------------------
 * Khi bạn thay đổi cấu trúc thư mục hoặc tạo thư mục mới trên Google Drive,
 * bạn CHỈ CẦN kiểm tra / cập nhật duy nhất tại file này (`lib/drive-folders.ts`).
 *
 * Cấu trúc thực tế trên Google Drive:
 * ATTECH_DOCUMENTS/ (Root ID: 18Mb4S3_nS5mE4zGFxyWYQbFNavJJ9nlj)
 * ├── 00_TÀI LIỆU HIỆU LỰC/        (ID: 12U1vBQhxb7IC1PClPTDQWcK7nkDpMLC7)
 * │   ├── 00_VB_PHAP_LUAT          (ID: 1qapYCIZo4HskuqxmShw-8CJnhkJXFl0O)
 * │   ├── 01_QUAN_LY_KY_THUAT      (ID: 10pCwkwU1SFkGmiTV2aF8TtAOuI1U0DO2)
 * │   ├── 02_AN_TOAN_SMS           (ID: 1Ejjrnarjq9X_skDDBaBLP0d_CJEypGYA)
 * │   ├── 03_PCCC_VA_CHCN          (ID: 1-49MpPr7Ba97RLQpqdFeBPKhcUjeJbtU)
 * │   ├── 04_PCTT_VA_TKCN          (ID: 1zKKEIscwObvyJqhqmbbBbMnyC_1sSJGV)
 * │   ├── 05_ATVSLD                (ID: 1r0U79UySLEjKCXZHCs0Ullhi3BV28L-J)
 * │   └── 06_CONG_TRINH_HANG_KHONG (ID: 1Qvu0nqEqlNxlyuhGSPa1WuLXaRzeBD7y)
 * ├── 01_GIẤY PHÉP-CHỨNG CHỈ/      (ID: 1-pFYB0DUf9wN7eQ8YlwIQFs7pH1I_NFe)
 * │   ├── 00_GIẤY PHÉP             (ID: 1iohOYalHN4NWNOMAtjpkQ4VJTyXr5ayr - Dùng cho tab Giấy phép khai thác)
 * │   └── 01_CHỨNG CHỈ             (ID: 1xXiAg8ynWluxAU85M5nlrjSvDorx3-nA - Dùng cho tab Hồ sơ huấn luyện)
 * └── 03_TÀI LIỆU CHƯA XÁC THỰC/   (ID: 1aejD_BWF9ZtclJ2WCDRW34myR9iAWxmz - Dùng cho tab Công việc)
 */

export const ATTECH_DRIVE_ROOT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_DRIVE_PARENT_FOLDER_ID ||
  '18Mb4S3_nS5mE4zGFxyWYQbFNavJJ9nlj';

export const DRIVE_PARENT_FOLDERS = {
  TAI_LIEU_HIEU_LUC: '12U1vBQhxb7IC1PClPTDQWcK7nkDpMLC7',
  GIAY_PHEP_CHUNG_CHI: '1-pFYB0DUf9wN7eQ8YlwIQFs7pH1I_NFe',
  TAI_LIEU_CHUA_XAC_THUC: '1aejD_BWF9ZtclJ2WCDRW34myR9iAWxmz',
};

export interface DriveFolderDefinition {
  code: string;
  folderName: string;
  relativePath: string;
  folderId: string;
}

export const DRIVE_FOLDER_MAP: Record<string, DriveFolderDefinition> = {
  // 1. Nhánh: ATTECH_DOCUMENTS/00_TÀI LIỆU HIỆU LỰC/ (Tab Tài liệu)
  VB_PHAP_LUAT: {
    code: 'VB_PHAP_LUAT',
    folderName: '00_VB_PHAP_LUAT',
    relativePath: 'ATTECH_DOCUMENTS/00_TÀI LIỆU HIỆU LỰC/00_VB_PHAP_LUAT',
    folderId: '1qapYCIZo4HskuqxmShw-8CJnhkJXFl0O',
  },
  QL_KY_THUAT: {
    code: 'QL_KY_THUAT',
    folderName: '01_QUAN_LY_KY_THUAT',
    relativePath: 'ATTECH_DOCUMENTS/00_TÀI LIỆU HIỆU LỰC/01_QUAN_LY_KY_THUAT',
    folderId: '10pCwkwU1SFkGmiTV2aF8TtAOuI1U0DO2',
  },
  SMS: {
    code: 'SMS',
    folderName: '02_AN_TOAN_SMS',
    relativePath: 'ATTECH_DOCUMENTS/00_TÀI LIỆU HIỆU LỰC/02_AN_TOAN_SMS',
    folderId: '1Ejjrnarjq9X_skDDBaBLP0d_CJEypGYA',
  },
  PCCC_CHCN: {
    code: 'PCCC_CHCN',
    folderName: '03_PCCC_VA_CHCN',
    relativePath: 'ATTECH_DOCUMENTS/00_TÀI LIỆU HIỆU LỰC/03_PCCC_VA_CHCN',
    folderId: '1-49MpPr7Ba97RLQpqdFeBPKhcUjeJbtU',
  },
  PCTT_TKCN: {
    code: 'PCTT_TKCN',
    folderName: '04_PCTT_VA_TKCN',
    relativePath: 'ATTECH_DOCUMENTS/00_TÀI LIỆU HIỆU LỰC/04_PCTT_VA_TKCN',
    folderId: '1zKKEIscwObvyJqhqmbbBbMnyC_1sSJGV',
  },
  ATVSLD: {
    code: 'ATVSLD',
    folderName: '05_ATVSLD',
    relativePath: 'ATTECH_DOCUMENTS/00_TÀI LIỆU HIỆU LỰC/05_ATVSLD',
    folderId: '1r0U79UySLEjKCXZHCs0Ullhi3BV28L-J',
  },
  CONG_TRINH_HK: {
    code: 'CONG_TRINH_HK',
    folderName: '06_CONG_TRINH_HANG_KHONG',
    relativePath: 'ATTECH_DOCUMENTS/00_TÀI LIỆU HIỆU LỰC/06_CONG_TRINH_HANG_KHONG',
    folderId: '1Qvu0nqEqlNxlyuhGSPa1WuLXaRzeBD7y',
  },

  // 2. Nhánh: ATTECH_DOCUMENTS/01_GIẤY PHÉP-CHỨNG CHỈ/ (Tab Giấy phép khai thác & Hồ sơ huấn luyện)
  GIAY_PHEP_CC: {
    code: 'GIAY_PHEP_CC',
    folderName: '00_GIẤY PHÉP',
    relativePath: 'ATTECH_DOCUMENTS/01_GIẤY PHÉP-CHỨNG CHỈ/00_GIẤY PHÉP',
    folderId: process.env.DRIVE_FOLDER_ID_GIAY_PHEP_CC || '1iohOYalHN4NWNOMAtjpkQ4VJTyXr5ayr',
  },
  CHUNG_CHI_HL: {
    code: 'CHUNG_CHI_HL',
    folderName: '01_CHỨNG CHỈ',
    relativePath: 'ATTECH_DOCUMENTS/01_GIẤY PHÉP-CHỨNG CHỈ/01_CHỨNG CHỈ',
    folderId: process.env.DRIVE_FOLDER_ID_CHUNG_CHI || '1xXiAg8ynWluxAU85M5nlrjSvDorx3-nA',
  },

  // 3. Nhánh: ATTECH_DOCUMENTS/03_TÀI LIỆU CHƯA XÁC THỰC/ (Tab Công việc - Văn bản PDF từ Email)
  TAI_LIEU_CHUA_XAC_THUC: {
    code: 'TAI_LIEU_CHUA_XAC_THUC',
    folderName: '03_TÀI LIỆU CHƯA XÁC THỰC',
    relativePath: 'ATTECH_DOCUMENTS/03_TÀI LIỆU CHƯA XÁC THỰC',
    folderId: process.env.DRIVE_FOLDER_ID_CHUA_XAC_THUC || '1aejD_BWF9ZtclJ2WCDRW34myR9iAWxmz',
  },
};

const discoveredFolderCache: Record<string, string> = {};

function normalizeFolderName(name: string): string {
  return name
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/Đ/g, 'D')
    .replace(/\s+/g, ' ');
}

async function listPublicDriveSubfolders(
  parentFolderId: string
): Promise<Array<{ id: string; title: string }>> {
  try {
    const res = await fetch(
      `https://drive.google.com/embeddedfolderview?id=${parentFolderId}`,
      { next: { revalidate: 60 } }
    );
    if (!res.ok) return [];
    const html = await res.text();
    const regex = /folders\/([a-zA-Z0-9_-]+).*?flip-entry-title">([^<]+)</g;
    const items: Array<{ id: string; title: string }> = [];
    let match: RegExpExecArray | null;
    while ((match = regex.exec(html)) !== null) {
      items.push({ id: match[1], title: match[2].trim() });
    }
    return items;
  } catch {
    return [];
  }
}

export async function resolveDriveFolderId(codeKey: string): Promise<string> {
  const def = DRIVE_FOLDER_MAP[codeKey];
  if (def?.folderId && def.folderId.length > 10) {
    return def.folderId;
  }
  if (discoveredFolderCache[codeKey]) {
    return discoveredFolderCache[codeKey];
  }

  const targetNorm = normalizeFolderName(def?.folderName || codeKey);

  const level1 = await listPublicDriveSubfolders(ATTECH_DRIVE_ROOT_ID);
  for (const item of level1) {
    if (normalizeFolderName(item.title) === targetNorm) {
      discoveredFolderCache[codeKey] = item.id;
      return item.id;
    }
  }

  for (const parent of level1) {
    const pNorm = normalizeFolderName(parent.title);
    if (
      pNorm.includes('TAI LIEU') ||
      pNorm.includes('GIAY PHEP') ||
      pNorm.includes('CHUNG CHI')
    ) {
      const level2 = await listPublicDriveSubfolders(parent.id);
      for (const sub of level2) {
        if (normalizeFolderName(sub.title) === targetNorm) {
          discoveredFolderCache[codeKey] = sub.id;
          return sub.id;
        }
      }
    }
  }

  return ATTECH_DRIVE_ROOT_ID;
}
