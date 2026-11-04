#!/usr/bin/env python3
"""
Script Đồng Bộ & Quét AI Hàng Loạt Tài Liệu (Calibre hoặc Thư Mục Bất Kỳ) sang Hệ Thống ATTECH AI
- Hỗ trợ đọc từ kho Calibre (metadata.db) HOẶC quét trực tiếp bất kỳ thư mục chứa file PDF/Word nào
- Tự động gọi AI đọc 2 trang đầu (/api/documents/extract-metadata) để trích xuất chuẩn xác:
  + Tiêu đề / Trích yếu văn bản
  + Số / Ký hiệu văn bản (VD: 750/QĐ-KTQLB)
  + Đơn vị ban hành (ATTECH, VATM, Bộ GTVT...)
  + Ngày ban hành (YYYY-MM-DD)
  + Chuyên môn (7 lĩnh vực) -> Đẩy vào đúng thư mục chuyên môn trên Google Drive
- Đối soát trùng lặp & tự động phát hiện văn bản mới thay thế văn bản cũ (/api/documents/check-duplicate)
- Tự động trích xuất OCR toàn văn 1 lần khi tải lên (hoặc tùy chọn --skip-ocr để tiết kiệm 50% quota)
- Cơ chế điều tiết nhịp độ (Rate Limit Throttling) & Tự động chờ 60s khi chạm trần Gemini Free Tier (HTTP 429)
"""

import os
import sys
import sqlite3

# Đảm bảo hiển thị tiếng Việt và biểu tượng cảm xúc không bị lỗi UnicodeEncodeError trên Windows Terminal
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')
import argparse
import time
import json
import mimetypes
import urllib.request
import urllib.parse
import urllib.error
from pathlib import Path

# Cấu hình mặc định
DEFAULT_CALIBRE_DIR = "/Users/huy_van/Library/CloudStorage/OneDrive-Personal/HỆ THỐNG TÀI LIỆU ĐÀI TUH/THU VIEN TUH"
PROJECT_DIR = Path(__file__).resolve().parent.parent
ENV_FILE = PROJECT_DIR / ".env.local"

# Bảng mã Chuyên môn chuẩn hóa của ATTECH (7 lĩnh vực)
DOMAIN_CONFIG = {
    'VB_PHAP_LUAT': {
        'label': 'Văn bản Pháp luật & Quy chế',
        'drive_subfolder': '00_VAN_BAN_PHAP_LUAT',
        'desc': 'Luật Hàng không, Nghị định, Thông tư, Quy chế cơ quan quản lý'
    },
    'QL_KY_THUAT': {
        'label': 'Quản lý Kỹ thuật (CNS, Selex)',
        'drive_subfolder': '01_QUAN_LY_KY_THUAT',
        'desc': 'Hồ sơ thiết bị CNS, Selex, DVOR/DME, Quy trình bảo dưỡng HDCV, TUH'
    },
    'SMS': {
        'label': 'An toàn (SMS)',
        'drive_subfolder': '02_AN_TOAN_SMS',
        'desc': 'Hệ thống an toàn quản lý, Báo cáo sự cố'
    },
    'PCCC_CHCN': {
        'label': 'PCCC & CHCN',
        'drive_subfolder': '03_PCCC_VA_CHCN',
        'desc': 'Phòng cháy chữa cháy, Kế hoạch & Hồ sơ diễn tập PCCC'
    },
    'PCTT_TKCN': {
        'label': 'PCTT & TKCN',
        'drive_subfolder': '04_PCTT_VA_TKCN',
        'desc': 'Phòng chống thiên tai & Tìm kiếm cứu nạn'
    },
    'ATVSLD': {
        'label': 'An toàn VSLĐ',
        'drive_subfolder': '05_AN_TOAN_VSLD',
        'desc': 'Bảo hộ lao động, An toàn điện, Làm việc trên cao'
    },
    'CONG_TRINH_HK': {
        'label': 'Công trình Hàng không',
        'drive_subfolder': '06_CONG_TRINH_HANG_KHONG',
        'desc': 'Hạ tầng đài trạm, Nhà trạm, Cột anten, ANHK'
    }
}


def load_env():
    """Đọc cấu hình từ .env.local"""
    env_vars = {}
    if ENV_FILE.exists():
        with open(ENV_FILE, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, val = line.split('=', 1)
                    env_vars[key.strip()] = val.strip().strip('"').strip("'")
    return env_vars


def map_to_domain(author, nhom, title):
    """Quy tắc phân loại chuyên môn dự phòng (fallback khi không bật AI)"""
    a = (author or '').upper().strip()
    n = (nhom or '').upper().strip()
    t = (title or '').upper().strip()

    if a == 'N1' or 'NHÓM 1' in n or 'NHOM 1' in n or n == 'N1':
        return 'VB_PHAP_LUAT'
    if any(k in t for k in ['LUẬT', 'LUAT ', 'NGHỊ ĐỊNH', 'NGHI DINH', 'THÔNG TƯ', 'THONG TU', 'HIẾN PHÁP', 'PHÁP LỆNH', 'QCVN', 'TCVN']):
        return 'VB_PHAP_LUAT'
    if 'PCCC' in a or 'PCCC' in t or 'CHCN' in a or 'CHCN' in t or 'CNCH' in t:
        return 'PCCC_CHCN'
    if 'PCTT' in a or 'PCTT' in t or 'TKCN' in a or 'TKCN' in t or 'THIÊN TAI' in t:
        return 'PCTT_TKCN'
    if 'SMS' in a or 'SMS' in t or 'AN TOÀN HÀNG KHÔNG' in t or 'AN TOÀN (SMS)' in t:
        return 'SMS'
    if 'ATVSLĐ' in a or 'ATVSLD' in a or 'BẢO HỘ' in t or 'VSLĐ' in t or 'VỆ SINH LAO ĐỘNG' in t:
        return 'ATVSLD'
    if 'ANHK' in a or 'CÔNG TRÌNH' in t or 'HẠ TẦNG' in t or 'NHÀ TRẠM' in t:
        return 'CONG_TRINH_HK'
    return 'QL_KY_THUAT'


def determine_issuing_authority(author, doc_number, title):
    """Xác định đơn vị ban hành dự phòng (fallback khi không bật AI)"""
    a = (author or '').strip()
    code = (doc_number or '').upper().strip()
    t = (title or '').upper()

    if 'QH' in code:
        return 'Quốc hội'
    if 'NĐ-CP' in code or '/CP' in code:
        return 'Chính phủ'
    if 'BGTVT' in code or 'BỘ GTVT' in t:
        return 'Bộ Giao thông vận tải'
    if 'TTLT' in code or 'BTTTT' in code:
        return 'Bộ TTTT - Bộ GTVT'
    if 'CHK' in code or 'CAA' in code or 'CỤC HK' in t:
        return 'Cục Hàng không Việt Nam'
    if 'KTQLB' in code or 'ATTECH' in code or a.upper() in ['KTQLB', 'ATTECH']:
        return 'Công ty TNHH Kỹ thuật Quản lý bay'
    if 'VATM' in code or a.upper() == 'VATM' or 'TCT QLB' in t or 'QLB' in code:
        return 'Tổng công ty Quản lý bay Việt Nam'
    if 'TUH' in code or a.upper() == 'TUH':
        return 'Đài KSKL Tuy Hòa'
    if a and a.upper() not in ['N1', 'UNKNOWN', 'CHƯA XÁC ĐỊNH']:
        return a
    if a.upper() == 'N1':
        return 'Cơ quan Nhà nước'
    return 'Công ty TNHH Kỹ thuật Quản lý bay'


def normalize_calibre_date(raw_date):
    """Chuyển ngày trong Calibre sang định dạng YYYY-MM-DD nếu hợp lệ"""
    if not raw_date:
        return ''
    s = str(raw_date).strip()[:10]
    if len(s) == 10 and s[4] == '-' and s[7] == '-':
        if s.startswith('0101') or s.startswith('1900'):
            return ''
        return s
    return ''


def read_calibre_books(target_dir):
    """
    Đọc danh sách tài liệu từ Calibre (metadata.db).
    Nếu thư mục không có metadata.db, tự động quét toàn bộ file PDF/Word trong thư mục.
    """
    db_path = os.path.join(target_dir, "metadata.db")
    if not os.path.exists(db_path):
        if not os.path.exists(target_dir):
            print(f"❌ Không tìm thấy thư mục: {target_dir}")
            sys.exit(1)
        print(f"ℹ️  Không thấy metadata.db tại {target_dir} ➔ Chuyển sang chế độ quét trực tiếp tất cả file trong thư mục.")
        return scan_plain_directory(target_dir)

    conn = sqlite3.connect(db_path)
    c = conn.cursor()

    query = '''
    SELECT 
        b.id,
        b.title,
        b.path,
        a.name as author,
        d.name as file_name,
        d.format,
        c_so.value as doc_number,
        c_ngay.value as doc_date,
        c_nhom.value as nhom
    FROM books b
    LEFT JOIN books_authors_link bal ON b.id = bal.book
    LEFT JOIN authors a ON bal.author = a.id
    LEFT JOIN data d ON b.id = d.book
    LEFT JOIN books_custom_column_4_link cl_so ON b.id = cl_so.book
    LEFT JOIN custom_column_4 c_so ON cl_so.value = c_so.id
    LEFT JOIN books_custom_column_2_link cl_ngay ON b.id = cl_ngay.book
    LEFT JOIN custom_column_2 c_ngay ON cl_ngay.value = c_ngay.id
    LEFT JOIN books_custom_column_3_link cl_nhom ON b.id = cl_nhom.book
    LEFT JOIN custom_column_3 c_nhom ON cl_nhom.value = c_nhom.id
    WHERE d.format IS NOT NULL
    ORDER BY b.id ASC
    '''

    c.execute(query)
    rows = c.fetchall()
    conn.close()

    books = []
    for r in rows:
        book_id, title, rel_dir, author, file_base, file_ext, doc_number, doc_date, nhom = r
        file_full_name = f"{file_base}.{file_ext}" if file_base and file_ext else ""
        file_path = os.path.join(target_dir, rel_dir, file_full_name) if rel_dir and file_full_name else ""

        domain = map_to_domain(author, nhom, title)
        issuing_authority = determine_issuing_authority(author, doc_number, title)

        books.append({
            'calibre_id': book_id,
            'title': title or file_base,
            'doc_number': doc_number or '',
            'issue_date': normalize_calibre_date(doc_date),
            'author': author or '',
            'issuing_authority': issuing_authority,
            'nhom': nhom or '',
            'domain': domain,
            'doc_type': 'QUY_DINH_QUY_CHE',
            'file_path': file_path,
            'file_name': file_full_name,
            'file_ext': file_ext.lower() if file_ext else '',
            'exists': os.path.exists(file_path) if file_path else False,
            'file_size': os.path.getsize(file_path) if file_path and os.path.exists(file_path) else 0
        })

    return books


def scan_plain_directory(root_dir):
    """Quét đệ quy mọi file PDF, Word trong thư mục bất kỳ (khi không dùng Calibre)"""
    allowed_exts = {'.pdf', '.doc', '.docx'}
    books = []
    idx = 1
    for dirpath, _, filenames in os.walk(root_dir):
        for fname in sorted(filenames):
            ext = os.path.splitext(fname)[1].lower()
            if ext in allowed_exts:
                fpath = os.path.join(dirpath, fname)
                base_title = os.path.splitext(fname)[0]
                domain = map_to_domain('', '', base_title)
                books.append({
                    'calibre_id': idx,
                    'title': base_title,
                    'doc_number': '',
                    'issue_date': '',
                    'author': '',
                    'issuing_authority': determine_issuing_authority('', '', base_title),
                    'nhom': '',
                    'domain': domain,
                    'doc_type': 'QUY_DINH_QUY_CHE',
                    'file_path': fpath,
                    'file_name': fname,
                    'file_ext': ext.lstrip('.'),
                    'exists': True,
                    'file_size': os.path.getsize(fpath)
                })
                idx += 1
    return books


def get_existing_supabase_docs(env):
    """Lấy danh sách tên và số hiệu đã có trên Supabase để bỏ qua nhanh trước khi gọi AI"""
    sb_url = env.get("NEXT_PUBLIC_SUPABASE_URL")
    sb_key = env.get("SUPABASE_SERVICE_ROLE_KEY") or env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")

    if not sb_url or not sb_key:
        return set(), set()

    try:
        url = f"{sb_url}/rest/v1/document_files?select=file_name,document_code"
        req = urllib.request.Request(url, headers={
            "apikey": sb_key,
            "Authorization": f"Bearer {sb_key}"
        })
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            titles = set((item.get('file_name') or '').strip().lower() for item in data if item.get('file_name'))
            codes = set((item.get('document_code') or '').strip().lower() for item in data if item.get('document_code'))
            return titles, codes
    except Exception as e:
        print(f"⚠️ Không thể kiểm tra trước danh sách Supabase: {e}")
        return set(), set()


def build_multipart(fields, files):
    """Tạo multipart/form-data payload thuần Python"""
    boundary = f"----WebKitFormBoundary{int(time.time()*1000)}"
    body = []

    for name, value in fields.items():
        if value is None or value == '':
            continue
        body.extend([
            f"--{boundary}".encode('utf-8'),
            f'Content-Disposition: form-data; name="{name}"'.encode('utf-8'),
            b'',
            str(value).encode('utf-8')
        ])

    for field_name, file_path in files.items():
        content_type, _ = mimetypes.guess_type(file_path)
        if not content_type:
            content_type = "application/pdf"
        filename = os.path.basename(file_path)
        with open(file_path, 'rb') as f:
            file_bytes = f.read()
        body.extend([
            f"--{boundary}".encode('utf-8'),
            f'Content-Disposition: form-data; name="{field_name}"; filename="{filename}"'.encode('utf-8'),
            f'Content-Type: {content_type}'.encode('utf-8'),
            b'',
            file_bytes
        ])

    body.extend([f"--{boundary}--".encode('utf-8'), b''])
    payload = b'\r\n'.join(body)
    return boundary, payload


def extract_metadata_with_ai(file_path, base_url, max_retries=3):
    """
    Gọi /api/documents/extract-metadata (AI cắt & đọc 2 trang đầu).
    Tự động retry nếu gặp lỗi giới hạn tốc độ HTTP 429 của gói Free Tier.
    """
    extract_url = f"{base_url.rstrip('/')}/api/documents/extract-metadata"
    boundary, payload = build_multipart({}, {'file': file_path})

    for attempt in range(1, max_retries + 1):
        req = urllib.request.Request(extract_url, data=payload, headers={
            'Content-Type': f'multipart/form-data; boundary={boundary}',
            'Content-Length': str(len(payload))
        })
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                if data.get('success') and data.get('metadata'):
                    return True, data['metadata']
                return False, data.get('error', 'Không có metadata trả về')
        except urllib.error.HTTPError as e:
            err_body = e.read().decode('utf-8', errors='ignore')
            if e.code == 429 or '429' in err_body or 'RESOURCE_EXHAUSTED' in err_body:
                wait_sec = 60 * attempt
                print(f"    ⏳ Chạm trần tốc độ Gemini Free Tier (429). Tự động nghỉ {wait_sec}s rồi thử lại (Lần {attempt}/{max_retries})...")
                time.sleep(wait_sec)
                continue
            return False, f"HTTP {e.code}: {err_body[:200]}"
        except Exception as e:
            return False, str(e)

    return False, "Quá số lần thử lại do chạm giới hạn Quota 429"


def check_duplicate_with_api(book, base_url):
    """Gọi /api/documents/check-duplicate để kiểm tra trùng lặp & phát hiện văn bản cũ cần thay thế"""
    check_url = f"{base_url.rstrip('/')}/api/documents/check-duplicate"
    payload = json.dumps({
        'title': book.get('title', ''),
        'document_code': book.get('doc_number', ''),
        'issuing_authority': book.get('issuing_authority', ''),
        'issue_date': book.get('issue_date', ''),
        'scope_domain': book.get('domain', '')
    }).encode('utf-8')

    req = urllib.request.Request(check_url, data=payload, headers={
        'Content-Type': 'application/json; charset=utf-8'
    })
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except Exception as e:
        print(f"    ⚠️ Không thể gọi check-duplicate: {e}")
        return {'isExactDuplicate': False, 'isPotentialSuperseded': False}


def upload_document(book, base_url, skip_ocr=False, replaces_doc_id=None, initial_status=None, max_retries=3):
    """Upload file + metadata đã được AI chuẩn hóa lên Google Drive & Supabase"""
    upload_url = f"{base_url.rstrip('/')}/api/documents/upload"
    fields = {
        'title': book['title'],
        'document_code': book.get('doc_number', ''),
        'issuing_authority': book.get('issuing_authority', ''),
        'issue_date': book.get('issue_date', ''),
        'scope_domain': book['domain'],
        'doc_type': book.get('doc_type', 'QUY_DINH_QUY_CHE'),
        'skip_ocr': 'true' if skip_ocr else 'false',
    }
    if replaces_doc_id:
        fields['replaces_doc_id'] = replaces_doc_id
    if initial_status:
        fields['initial_status'] = initial_status

    boundary, payload = build_multipart(fields, {'file': book['file_path']})

    for attempt in range(1, max_retries + 1):
        req = urllib.request.Request(upload_url, data=payload, headers={
            'Content-Type': f'multipart/form-data; boundary={boundary}',
            'Content-Length': str(len(payload))
        })
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                res_data = json.loads(resp.read().decode('utf-8'))
                return True, res_data
        except urllib.error.HTTPError as e:
            err_msg = e.read().decode('utf-8', errors='ignore')
            if e.code == 429 or '429' in err_msg:
                wait_sec = 60 * attempt
                print(f"    ⏳ Chạm giới hạn 429 khi Upload/OCR. Nghỉ {wait_sec}s rồi thử lại...")
                time.sleep(wait_sec)
                continue
            return False, f"HTTP {e.code}: {err_msg[:200]}"
        except Exception as e:
            return False, str(e)

    return False, "Thất bại sau nhiều lần thử lại"


def main():
    parser = argparse.ArgumentParser(description="Công cụ Nạp & Quét AI Hàng Loạt Tài Liệu sang Hệ Thống ATTECH")
    parser.add_argument("--dir", default=DEFAULT_CALIBRE_DIR, help="Đường dẫn thư mục Calibre hoặc thư mục chứa PDF")
    parser.add_argument("--scan", action="store_true", help="Chỉ quét và phân tích thống kê kho tài liệu (không upload)")
    parser.add_argument("--test", "--limit", dest="limit", type=int, default=0, help="Giới hạn nạp N tài liệu trong đợt chạy này (VD: --limit 50)")
    parser.add_argument("--domain", type=str, default="", help="Chỉ nạp tài liệu thuộc chuyên môn cụ thể (VD: VB_PHAP_LUAT, PCCC_CHCN...)")
    parser.add_argument("--all", action="store_true", help="Nạp toàn bộ tài liệu")
    parser.add_argument("--no-ai-meta", action="store_true", help="Tắt AI đọc 2 trang đầu (chỉ dùng metadata sẵn có trong Calibre)")
    parser.add_argument("--skip-ocr", action="store_true", help="Chỉ dùng AI đọc 2 trang phân loại Metadata & Folder Drive, bỏ qua OCR toàn văn lúc tải lên để tiết kiệm 50%% quota")
    parser.add_argument("--delay", type=float, default=-1, help="Số giây nghỉ giữa 2 file để bảo vệ Quota (Mặc định: 6s nếu --skip-ocr, 10s nếu có OCR)")
    parser.add_argument("--base-url", default="http://localhost:3000", help="Địa chỉ Web Server Next.js (mặc định: http://localhost:3000)")

    args = parser.parse_args()

    use_ai_meta = not args.no_ai_meta
    delay_sec = args.delay if args.delay >= 0 else (5.0 if args.skip_ocr else 9.0)

    print("\n" + "=" * 80)
    print("🚀 ATTECH AI - CÔNG CỤ IMPORT HÀNG LOẠT KÈM AI PHÂN LOẠI & OCR TỰ ĐỘNG")
    print("=" * 80)
    print(f"📂 Thư mục nguồn      : {args.dir}")
    print(f"🤖 AI đọc 2 trang đầu : {'BẬT (Tự động bóc tách Số hiệu, Ngày, Đơn vị & Chuyên môn)' if use_ai_meta else 'TẮT'}")
    print(f"📄 Quét OCR toàn văn  : {'TẮT (--skip-ocr: tiết kiệm 50% quota)' if args.skip_ocr else 'BẬT (Lưu toàn văn vào cột ocr_content trên Supabase)'}")
    print(f"⏱️  Nhịp nghỉ bảo vệ   : {delay_sec} giây / file (Tránh lỗi 429 Gemini Free Tier)")

    env = load_env()
    books = read_calibre_books(args.dir)
    print(f"📚 Tổng số tài liệu tìm thấy: {len(books)} tài liệu\n")

    # Thống kê sơ bộ
    domain_counts = {}
    for b in books:
        dom = b['domain']
        domain_counts[dom] = domain_counts.get(dom, 0) + 1

    print("📊 THỐNG KÊ SƠ BỘ THEO 7 LĨNH VỰC CHUYÊN MÔN:")
    print("-" * 80)
    for dom_code, conf in DOMAIN_CONFIG.items():
        count = domain_counts.get(dom_code, 0)
        subfolder = conf['drive_subfolder']
        label = conf['label']
        print(f"  • {label:<30} [{dom_code:<14}]: {count:>4} files  ➔ Drive: {subfolder}")
    print("-" * 80)

    if args.scan or (not args.limit and not args.domain and not args.all):
        print("\n💡 HƯỚNG DẪN CHẠY LỆNH IMPORT VỚI AI:")
        print("  1. Chạy thử 5 file (AI đọc 2 trang + OCR toàn văn):")
        print("     python scripts/import_calibre_to_system.py --dir \"ĐƯỜNG_DẪN_THƯ_MỤC\" --limit 5")
        print("  2. Nạp nhanh 200 file (AI đọc 2 trang xếp đúng Folder Drive, bỏ qua OCR toàn văn):")
        print("     python scripts/import_calibre_to_system.py --dir \"ĐƯỜNG_DẪN_THƯ_MỤC\" --limit 200 --skip-ocr")
        print("  3. Nạp toàn bộ kho tài liệu:")
        print("     python scripts/import_calibre_to_system.py --dir \"ĐƯỜNG_DẪN_THƯ_MỤC\" --all")
        print("=" * 80 + "\n")
        return

    print("\n🔍 Đang kiểm tra danh sách tài liệu đã có trên Supabase để tránh nạp trùng...")
    existing_titles, existing_codes = get_existing_supabase_docs(env)
    print(f"ℹ️  Đã có {len(existing_titles)} tài liệu trên hệ thống.")

    to_upload = []
    for b in books:
        if not b['exists']:
            continue
        if b['title'].strip().lower() in existing_titles:
            continue
        if b['doc_number'] and b['doc_number'].strip().lower() in existing_codes:
            continue
        if args.domain and b['domain'] != args.domain:
            continue
        to_upload.append(b)

    if args.limit and args.limit > 0:
        to_upload = to_upload[:args.limit]

    print(f"\n⚡ Số lượng tài liệu sẽ xử lý trong đợt này: {len(to_upload)} tài liệu")
    if not to_upload:
        print("✅ Tất cả tài liệu đã được nạp trước đó hoặc không có file phù hợp!")
        return

    success_count = 0
    skip_dup_count = 0
    fail_count = 0

    print("\n🚀 Bắt đầu quá trình Quét AI & Nạp lên Google Drive + Supabase...")
    print("-" * 80)

    for idx, b in enumerate(to_upload, 1):
        print(f"[{idx}/{len(to_upload)}] 📄 File gốc: {b['file_name']} ({b['file_size']/1024:.1f} KB)")

        # BƯỚC 1: Dùng AI đọc 2 trang đầu để lấy đúng Metadata & Chuyên môn (Folder Google Drive)
        if use_ai_meta and b['file_ext'] in ['pdf', 'png', 'jpg', 'jpeg']:
            print("    ├ ✨ Đang dùng AI đọc 2 trang đầu để bóc tách Metadata & phân loại Chuyên môn...")
            ai_ok, meta = extract_metadata_with_ai(b['file_path'], args.base_url)
            if ai_ok and isinstance(meta, dict):
                if meta.get('title'):
                    b['title'] = meta['title'].strip()
                if meta.get('document_code'):
                    b['doc_number'] = meta['document_code'].strip()
                if meta.get('issuing_authority'):
                    b['issuing_authority'] = meta['issuing_authority'].strip()
                if meta.get('issue_date'):
                    b['issue_date'] = meta['issue_date'].strip()
                if meta.get('scope_domain') in DOMAIN_CONFIG:
                    b['domain'] = meta['scope_domain']
                if meta.get('doc_type'):
                    b['doc_type'] = meta['doc_type']
                print(f"    ├ 🤖 AI Nhận diện: \"{b['title'][:65]}\"")
            else:
                print(f"    ├ ⚠️ AI không đọc được 2 trang đầu ({meta}), dùng thông tin mặc định.")

        dom_conf = DOMAIN_CONFIG.get(b['domain'], {})
        print(f"    ├ Số/Ký hiệu : {b['doc_number'] or '---'} | Ngày BH: {b['issue_date'] or '---'}")
        print(f"    ├ Đơn vị BH  : {b['issuing_authority']}")
        print(f"    ├ Chuyên môn : {dom_conf.get('label')} ➔ Folder Drive: {dom_conf.get('drive_subfolder')}")

        # BƯỚC 2: Kiểm tra trùng lặp hoặc thay thế văn bản cũ sau khi đã có Metadata chuẩn từ AI
        dup_info = check_duplicate_with_api(b, args.base_url)
        if dup_info.get('isExactDuplicate'):
            reason = dup_info.get('reason', 'Đã tồn tại trên hệ thống')
            print(f"    └ ⏭️  BỎ QUA (Trùng lặp): {reason}\n")
            skip_dup_count += 1
            continue

        replaces_id = None
        initial_status = None
        if dup_info.get('isPotentialSuperseded') and dup_info.get('supersededCandidate'):
            cand = dup_info['supersededCandidate']
            relation_type = dup_info.get('relationType', 'NEWER')
            if relation_type == 'OLDER':
                initial_status = 'SUPERSEDED'
                print(
                    f"    ├ 📜 Văn bản lịch sử (Ngày BH {b.get('issue_date')} < {cand.get('issue_date')}): "
                    f"Lưu ở trạng thái 'Đã thay thế', giữ hiệu lực bản mới ({cand.get('document_code') or cand.get('file_name')})"
                )
            else:
                replaces_id = cand.get('id')
                print(
                    f"    ├ 🔄 Phát hiện bản mới (Ngày BH {b.get('issue_date') or 'mới'} >= {cand.get('issue_date') or 'cũ'}) "
                    f"thay thế cho: {cand.get('document_code') or cand.get('file_name')}"
                )

        # BƯỚC 3: Upload lên Google Drive (đúng Folder Chuyên môn) + Lưu Supabase + Quét OCR
        ok, res = upload_document(
            b,
            args.base_url,
            skip_ocr=args.skip_ocr,
            replaces_doc_id=replaces_id,
            initial_status=initial_status,
        )
        if ok:
            has_ocr = res.get('hasOcr', False) if isinstance(res, dict) else False
            ocr_status = "Đã lưu OCR toàn văn" if has_ocr else "Chỉ lưu Metadata"
            print(f"    └ ✅ Thành công! ({ocr_status})\n")
            success_count += 1
            existing_titles.add(b['title'].strip().lower())
            if b.get('doc_number'):
                existing_codes.add(b['doc_number'].strip().lower())
        else:
            print(f"    └ ❌ Thất bại: {res}\n")
            fail_count += 1

        # Nghỉ điều tiết nhịp độ giữa các file để không chạm trần RPM của Gemini Free Tier
        if idx < len(to_upload):
            time.sleep(delay_sec)

    print("=" * 80)
    print(f"🎉 HOÀN THÀNH: Thành công {success_count} | Bỏ qua trùng lặp {skip_dup_count} | Thất bại {fail_count}")
    print("=" * 80 + "\n")


if __name__ == "__main__":
    main()
