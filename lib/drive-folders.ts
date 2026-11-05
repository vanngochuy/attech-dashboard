/**
 * TẬP TIN CẤU HÌNH TRUNG TÂM CHO CÂY THƯ MỤC GOOGLE DRIVE (ATTECH_DOCUMENTS)
 * -------------------------------------------------------------------------
 * Khi bạn thay đổi cấu trúc thư mục hoặc tạo thư mục mới trên Google Drive,
 * bạn CHỈ CẦN kiểm tra / cập nhật duy nhất tại file này (`lib/drive-folders.ts`).
 *
 * Cấu trúc chuẩn trên Google Drive:
 * ATTECH_DOCUMENTS/ (Root ID: 18Mb4S3_nS5mE4zGFxyWYQbFNavJJ9nlj)
 * ├── TÀI LIỆU HIỆU LỰC/
 * │   ├── 00_VB_PHAP_LUAT
 * │   ├── 01_QUAN_LY_KY_THUAT
 * │   ├── 02_AN_TOAN_SMS
 * │   ├── 03_PCCC_VA_CHCN
 * │   ├── 04_PCTT_VA_TKCN
 * │   ├── 05_ATVSLD
 * │   └── 06_CONG_TRINH_HANG_KHONG
 * ├── GIẤY PHÉP-CHỨNG CHỈ/
 * │   ├── GIẤY PHÉP-CC/          (Dùng cho tab Giấy phép khai thác)
 * │   └── CHỨNG CHỈ/             (Dùng cho tab Hồ sơ huấn luyện)
 * └── TÀI LIỆU CHƯA XÁC THỰC/    (Dùng cho tab Công việc - Lọc PDF từ Email)
 */

export const ATTECH_DRIVE_ROOT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_DRIVE_PARENT_FOLDER_ID ||
  '18Mb4S3_nS5mE4zGFxyWYQbFNavJJ9nlj';

export interface DriveFolderDefinition {
  code: string;
  folderName: string;
  relativePath: string;
  /**
   * Google Drive Folder ID (lấy từ đuôi URL: https://drive.google.com/drive/folders/<FOLDER_ID>).
   * Lưu ý:
   * - Khi bạn DI CHUYỂN (Move) một thư mục sẵn có sang thư mục cha mới trên Google Drive,
   *   Folder ID của nó KHÔNG ĐỔI.
   * - Khi bạn TẠO MỚI một thư mục trên Google Drive, hệ thống sẽ tự động dò tìm Folder ID
   *   theo tên thư mục (`folderName`) bên trong `ATTECH_DOCUMENTS`, hoặc bạn có thể điền trực tiếp ID vào đây.
   */
  folderId: string;
}

export const DRIVE_FOLDER_MAP: Record<string, DriveFolderDefinition> = {
  // 1. Nhánh: ATTECH_DOCUMENTS/TÀI LIỆU HIỆU LỰC/ (Tab Tài liệu)
  VB_PHAP_LUAT: {
    code: 'VB_PHAP_LUAT',
    folderName: '00_VB_PHAP_LUAT',
    relativePath: 'ATTECH_DOCUMENTS/TÀI LIỆU HIỆU LỰC/00_VB_PHAP_LUAT',
    folderId: '1qapYCIZo4HskuqxmShw-8CJnhkJXFl0O',
  },
  QL_KY_THUAT: {
    code: 'QL_KY_THUAT',
    folderName: '01_QUAN_LY_KY_THUAT',
    relativePath: 'ATTECH_DOCUMENTS/TÀI LIỆU HIỆU LỰC/01_QUAN_LY_KY_THUAT',
    folderId: '10pCwkwU1SFkGmiTV2aF8TtAOuI1U0DO2',
  },
  SMS: {
    code: 'SMS',
    folderName: '02_AN_TOAN_SMS',
    relativePath: 'ATTECH_DOCUMENTS/TÀI LIỆU HIỆU LỰC/02_AN_TOAN_SMS',
    folderId: '1Ejjrnarjq9X_skDDBaBLP0d_CJEypGYA',
  },
  PCCC_CHCN: {
    code: 'PCCC_CHCN',
    folderName: '03_PCCC_VA_CHCN',
    relativePath: 'ATTECH_DOCUMENTS/TÀI LIỆU HIỆU LỰC/03_PCCC_VA_CHCN',
    folderId: '1-49MpPr7Ba97RLQpqdFeBPKhcUjeJbtU',
  },
  PCTT_TKCN: {
    code: 'PCTT_TKCN',
    folderName: '04_PCTT_VA_TKCN',
    relativePath: 'ATTECH_DOCUMENTS/TÀI LIỆU HIỆU LỰC/04_PCTT_VA_TKCN',
    folderId: '1zKKEIscwObvyJqhqmbbBbMnyC_1sSJGV',
  },
  ATVSLD: {
    code: 'ATVSLD',
    folderName: '05_ATVSLD',
    relativePath: 'ATTECH_DOCUMENTS/TÀI LIỆU HIỆU LỰC/05_ATVSLD',
    folderId: '1r0U79UySLEjKCXZHCs0Ullhi3BV28L-J',
  },
  CONG_TRINH_HK: {
    code: 'CONG_TRINH_HK',
    folderName: '06_CONG_TRINH_HANG_KHONG',
    relativePath: 'ATTECH_DOCUMENTS/TÀI LIỆU HIỆU LỰC/06_CONG_TRINH_HANG_KHONG',
    folderId: '1Qvu0nqEqlNxlyuhGSPa1WuLXaRzeBD7y',
  },

  // 2. Nhánh: ATTECH_DOCUMENTS/GIẤY PHÉP-CHỨNG CHỈ/ (Tab Giấy phép khai thác & Hồ sơ huấn luyện)
  GIAY_PHEP_CC: {
    code: 'GIAY_PHEP_CC',
    folderName: 'GIẤY PHÉP-CC',
    relativePath: 'ATTECH_DOCUMENTS/GIẤY PHÉP-CHỨNG CHỈ/GIẤY PHÉP-CC',
    folderId: process.env.DRIVE_FOLDER_ID_GIAY_PHEP_CC || '',
  },
  CHUNG_CHI_HL: {
    code: 'CHUNG_CHI_HL',
    folderName: 'CHỨNG CHỈ',
    relativePath: 'ATTECH_DOCUMENTS/GIẤY PHÉP-CHỨNG CHỈ/CHỨNG CHỈ',
    folderId: process.env.DRIVE_FOLDER_ID_CHUNG_CHI || '',
  },

  // 3. Nhánh: ATTECH_DOCUMENTS/TÀI LIỆU CHƯA XÁC THỰC/ (Tab Công việc - Văn bản PDF từ Email)
  TAI_LIEU_CHUA_XAC_THUC: {
    code: 'TAI_LIEU_CHUA_XAC_THUC',
    folderName: 'TÀI LIỆU CHƯA XÁC THỰC',
    relativePath: 'ATTECH_DOCUMENTS/TÀI LIỆU CHƯA XÁC THỰC',
    folderId: process.env.DRIVE_FOLDER_ID_CHUA_XAC_THUC || '',
  },
};

// Bộ nhớ đệm tránh quét lại Google Drive nhiều lần trong cùng phiên
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

/**
 * Quét danh sách thư mục con bên trong 1 Folder Google Drive công khai (`embeddedfolderview`)
 */
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

/**
 * Tự động tìm Google Drive Folder ID cho bất kỳ mã thư mục nào trong `DRIVE_FOLDER_MAP`.
 * - Nếu đã có `folderId` cố định -> dùng ngay.
 * - Nếu chưa điền `folderId` (ví dụ bạn vừa tạo thư mục `GIẤY PHÉP-CHỨNG CHỈ/GIẤY PHÉP-CC`, `CHỨNG CHỈ`, hoặc `TÀI LIỆU CHƯA XÁC THỰC` trên Google Drive),
 *   hàm này sẽ tự động dò trong `ATTECH_DOCUMENTS` (và các thư mục cấp 1 bên trong) để lấy đúng Folder ID mà bạn không cần copy-paste thủ công!
 */
export async function resolveDriveFolderId(codeKey: string): Promise<string> {
  const def = DRIVE_FOLDER_MAP[codeKey];
  if (def?.folderId && def.folderId.length > 10) {
    return def.folderId;
  }
  if (discoveredFolderCache[codeKey]) {
    return discoveredFolderCache[codeKey];
  }

  const targetNorm = normalizeFolderName(def?.folderName || codeKey);

  // Bước 1: Quét cấp 1 bên trong ATTECH_DOCUMENTS
  const level1 = await listPublicDriveSubfolders(ATTECH_DRIVE_ROOT_ID);
  for (const item of level1) {
    if (normalizeFolderName(item.title) === targetNorm) {
      discoveredFolderCache[codeKey] = item.id;
      return item.id;
    }
  }

  // Bước 2: Quét cấp 2 bên trong các thư mục nhánh (TÀI LIỆU HIỆU LỰC, GIẤY PHÉP-CHỨNG CHỈ)
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

  // Fallback: Nếu tìm thấy thư mục cha `GIẤY PHÉP-CHỨNG CHỈ` thì lưu vào đó, nếu không thì lưu vào Root `ATTECH_DOCUMENTS`
  const gpParent = level1.find((i) =>
    normalizeFolderName(i.title).includes('GIAY PHEP')
  );
  if (
    gpParent &&
    (codeKey === 'GIAY_PHEP_CC' || codeKey === 'CHUNG_CHI_HL')
  ) {
    return gpParent.id;
  }

  return ATTECH_DRIVE_ROOT_ID;
}
