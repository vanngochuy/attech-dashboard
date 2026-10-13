#!/usr/bin/env python3
"""
Script Đồng Bộ Kho Tài Liệu Calibre sang Hệ Thống ATTECH AI
- Đọc metadata & file gốc từ Calibre SQLite (metadata.db)
- Phân loại chuyên môn chuẩn hóa (7 lĩnh vực bao gồm Văn bản Pháp luật)
- Tự động bóc tách Số hiệu văn bản & Đơn vị ban hành
- Kiểm tra tránh trùng lặp với Supabase
- Nạp tài liệu lên Web & Google Drive vào đúng thư mục chuyên đề
"""

import os
import sys
import sqlite3
import argparse
import time
import json
import urllib.request
import urllib.parse
from pathlib import Path

# Cấu hình mặc định
DEFAULT_CALIBRE_DIR = "/Users/huy_van/Library/CloudStorage/OneDrive-Personal/HỆ THỐNG TÀI LIỆU ĐÀI TUH/THU VIEN TUH"
PROJECT_DIR = Path(__file__).resolve().parent.parent
ENV_FILE = PROJECT_DIR / ".env.local"

# Bảng mã Chuyên môn chuẩn hóa của ATTECH (7 chuyên môn)
DOMAIN_CONFIG = {
    'VB_PHAP_LUAT': {
        'label': 'Văn bản Pháp luật',
        'drive_subfolder': '00_VAN_BAN_PHAP_LUAT',
        'desc': 'Luật Hàng không, Nghị định, Thông tư, Quy chế cơ quan quản lý'
    },
    'QL_KY_THUAT': {
        'label': 'Quản lý Kỹ thuật',
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
    """Quy tắc phân loại chuyên môn tự động từ metadata Calibre"""
    a = (author or '').upper().strip()
    n = (nhom or '').upper().strip()
    t = (title or '').upper().strip()

    # Nhóm 1: Văn bản quy phạm pháp luật & Tiêu chuẩn ngành
    if a == 'N1' or 'NHÓM 1' in n or 'NHOM 1' in n or n == 'N1':
        return 'VB_PHAP_LUAT'
    if any(k in t for k in ['LUẬT', 'LUAT ', 'NGHỊ ĐỊNH', 'NGHI DINH', 'THÔNG TƯ', 'THONG TU', 'HIẾN PHÁP', 'PHÁP LỆNH', 'QCVN', 'TCVN']):
        return 'VB_PHAP_LUAT'

    # Nhóm PCCC & CHCN
    if 'PCCC' in a or 'PCCC' in t or 'CHCN' in a or 'CHCN' in t:
        return 'PCCC_CHCN'

    # Nhóm PCTT & TKCN
    if 'PCTT' in a or 'PCTT' in t or 'TKCN' in a or 'TKCN' in t:
        return 'PCTT_TKCN'

    # Nhóm An toàn SMS
    if 'SMS' in a or 'SMS' in t or 'AN TOÀN HÀNG KHÔNG' in t or 'AN TOÀN (SMS)' in t:
        return 'SMS'

    # Nhóm An toàn VSLĐ
    if 'ATVSLĐ' in a or 'ATVSLD' in a or 'BẢO HỘ' in t or 'VSLĐ' in t or 'VỆ SINH LAO ĐỘNG' in t:
        return 'ATVSLD'

    # Nhóm Công trình Hàng không
    if 'ANHK' in a or 'CÔNG TRÌNH' in t or 'HẠ TẦNG' in t or 'NHÀ TRẠM' in t:
        return 'CONG_TRINH_HK'
    
    # Mặc định: Quản lý Kỹ thuật (HDCV, TUH, ATTECH, VATM, CNS, Thiết bị...)
    return 'QL_KY_THUAT'

def determine_issuing_authority(author, doc_number, title):
    """Xác định đơn vị ban hành từ metadata và số văn bản"""
    a = (author or '').strip()
    code = (doc_number or '').upper().strip()
    t = (title or '').upper()

    if 'QH' in code:
        return 'Quốc hội'
    if 'NĐ-CP' in code or '/CP' in code:
        return 'Chính phủ'
    if 'BGTVT' in code or 'BỘ GTVT' in t:
        return 'Bộ GTVT'
    if 'TTLT' in code or 'BTTTT' in code:
        return 'Bộ TTTT - Bộ GTVT'
    if 'CHK' in code or 'CAA' in code or 'CỤC HK' in t:
        return 'Cục Hàng không VN'
    if 'KTQLB' in code or 'KTQLB' in a.upper():
        return 'Ban Kỹ thuật - TCT QLB'
    if 'VATM' in code or a.upper() == 'VATM' or 'TCT QLB' in t or 'QLB' in code:
        return 'Tổng công ty Quản lý bay VN'
    if 'ATTECH' in code or a.upper() == 'ATTECH':
        return 'Công ty ATTECH'
    if 'TUH' in code or a.upper() == 'TUH':
        return 'Đài KSKL Tuy Hòa'
    if a and a.upper() not in ['N1', 'UNKNOWN', 'CHƯA XÁC ĐỊNH']:
        return a
    if a.upper() == 'N1':
        return 'Cơ quan Nhà nước'
    return 'ATTECH'

def read_calibre_books(calibre_dir):
    """Truy vấn toàn bộ sách và metadata từ Calibre SQLite"""
    db_path = os.path.join(calibre_dir, "metadata.db")
    if not os.path.exists(db_path):
        print(f"❌ Không tìm thấy database Calibre tại: {db_path}")
        sys.exit(1)

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
        
        # Đường dẫn vật lý trên đĩa
        file_full_name = f"{file_base}.{file_ext}" if file_base and file_ext else ""
        file_path = os.path.join(calibre_dir, rel_dir, file_full_name) if rel_dir and file_full_name else ""
        
        domain = map_to_domain(author, nhom, title)
        issuing_authority = determine_issuing_authority(author, doc_number, title)

        books.append({
            'calibre_id': book_id,
            'title': title or file_base,
            'doc_number': doc_number or '',
            'doc_date': doc_date or '',
            'author': author or '',
            'issuing_authority': issuing_authority,
            'nhom': nhom or '',
            'domain': domain,
            'file_path': file_path,
            'file_name': file_full_name,
            'file_ext': file_ext.lower() if file_ext else '',
            'exists': os.path.exists(file_path) if file_path else False,
            'file_size': os.path.getsize(file_path) if file_path and os.path.exists(file_path) else 0
        })

    return books

def get_existing_supabase_files(env):
    """Lấy danh sách các file đã tồn tại trên Supabase để chống trùng lặp"""
    sb_url = env.get("NEXT_PUBLIC_SUPABASE_URL")
    sb_key = env.get("SUPABASE_SERVICE_ROLE_KEY") or env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")

    if not sb_url or not sb_key:
        return set()

    try:
        url = f"{sb_url}/rest/v1/document_files?select=file_name"
        req = urllib.request.Request(url, headers={
            "apikey": sb_key,
            "Authorization": f"Bearer {sb_key}"
        })
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            return set(item.get('file_name', '') for item in data)
    except Exception as e:
        print(f"⚠️ Không thể kiểm tra Supabase (sẽ tiếp tục nạp): {e}")
        return set()

def upload_document(book, upload_url):
    """Upload một file tài liệu kèm đầy đủ metadata qua Web API endpoint"""
    file_path = book['file_path']
    if not os.path.exists(file_path):
        return False, f"File không tồn tại: {file_path}"

    import mimetypes
    content_type, _ = mimetypes.guess_type(file_path)
    if not content_type:
        content_type = "application/octet-stream"

    boundary = f"----WebKitFormBoundary{int(time.time()*1000)}"
    
    # Đọc file binary
    with open(file_path, 'rb') as f:
        file_bytes = f.read()

    body = []
    # Title
    body.extend([
        f"--{boundary}".encode(),
        b'Content-Disposition: form-data; name="title"',
        b'',
        book['title'].encode('utf-8')
    ])
    # Document Code (Số văn bản)
    if book.get('doc_number'):
        body.extend([
            f"--{boundary}".encode(),
            b'Content-Disposition: form-data; name="document_code"',
            b'',
            book['doc_number'].encode('utf-8')
        ])
    # Issuing Authority (Đơn vị ban hành)
    if book.get('issuing_authority'):
        body.extend([
            f"--{boundary}".encode(),
            b'Content-Disposition: form-data; name="issuing_authority"',
            b'',
            book['issuing_authority'].encode('utf-8')
        ])
    # Scope Domain
    body.extend([
        f"--{boundary}".encode(),
        b'Content-Disposition: form-data; name="scope_domain"',
        b'',
        book['domain'].encode('utf-8')
    ])
    # Doc Type
    body.extend([
        f"--{boundary}".encode(),
        b'Content-Disposition: form-data; name="doc_type"',
        b'',
        b'QUY_TRINH_HDCV'
    ])
    # File binary
    filename = os.path.basename(file_path)
    body.extend([
        f"--{boundary}".encode(),
        f'Content-Disposition: form-data; name="file"; filename="{filename}"'.encode('utf-8'),
        f'Content-Type: {content_type}'.encode(),
        b'',
        file_bytes,
        f"--{boundary}--".encode(),
        b''
    ])

    payload = b'\r\n'.join(body)

    req = urllib.request.Request(upload_url, data=payload, headers={
        'Content-Type': f'multipart/form-data; boundary={boundary}',
        'Content-Length': str(len(payload))
    })

    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            res_data = json.loads(resp.read().decode('utf-8'))
            return True, res_data
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode('utf-8', errors='ignore')
        return False, f"HTTP {e.code}: {err_msg}"
    except Exception as e:
        return False, str(e)

def main():
    parser = argparse.ArgumentParser(description="Script Nạp Kho Tài Liệu Calibre sang Hệ Thống ATTECH")
    parser.add_argument("--dir", default=DEFAULT_CALIBRE_DIR, help="Đường dẫn thư mục Calibre")
    parser.add_argument("--scan", action="store_true", help="Chỉ quét và phân tích thống kê kho tài liệu (không upload)")
    parser.add_argument("--test", type=int, default=0, help="Nạp thử nghiệm N tài liệu đầu tiên")
    parser.add_argument("--domain", type=str, default="", help="Chỉ nạp tài liệu thuộc chuyên môn cụ thể (VD: VB_PHAP_LUAT, PCCC_CHCN, SMS...)")
    parser.add_argument("--all", action="store_true", help="Nạp toàn bộ tài liệu")
    parser.add_argument("--api-url", default="http://localhost:3000/api/documents/upload", help="URL API upload tài liệu")

    args = parser.parse_args()

    print("\n" + "="*75)
    print("🚀 ATTECH AI - CÔNG CỤ ĐỒNG BỘ KHO TÀI LIỆU CALIBRE SANG HỆ THỐNG")
    print("="*75)
    print(f"📂 Thư mục Calibre: {args.dir}")

    # Đọc cấu hình
    env = load_env()
    books = read_calibre_books(args.dir)
    print(f"📚 Tổng số tài liệu tìm thấy trong Calibre: {len(books)} tài liệu\n")

    # Thống kê theo chuyên môn
    domain_counts = {}
    for b in books:
        dom = b['domain']
        domain_counts[dom] = domain_counts.get(dom, 0) + 1

    print("📊 THỐNG KÊ PHÂN LOẠI CHUYÊN MÔN (7 LĨNH VỰC):")
    print("-" * 75)
    for dom_code, conf in DOMAIN_CONFIG.items():
        count = domain_counts.get(dom_code, 0)
        subfolder = conf['drive_subfolder']
        label = conf['label']
        print(f"  • {label:<22} [{dom_code:<14}]: {count:>3} files  ➔ Drive: {subfolder}")
    print("-" * 75)

    # Nếu chỉ scan
    if args.scan or (not args.test and not args.domain and not args.all):
        print("\n💡 GỢI Ý CÁCH CHẠY NẠP DỮ LIỆU:")
        print("  1. Nạp thử nghiệm 3 file Pháp luật: python3 scripts/import_calibre_to_system.py --domain VB_PHAP_LUAT --test 3")
        print("  2. Nạp toàn bộ Văn bản Pháp luật:   python3 scripts/import_calibre_to_system.py --domain VB_PHAP_LUAT")
        print("  3. Nạp riêng 37 file PCCC:         python3 scripts/import_calibre_to_system.py --domain PCCC_CHCN")
        print("  4. Nạp toàn bộ kho tài liệu:       python3 scripts/import_calibre_to_system.py --all")
        print("="*75 + "\n")
        return

    # Lấy danh sách file đã tồn tại trên Supabase để chống trùng lặp
    print("\n🔍 Đang kiểm tra danh sách file đã có trên Supabase để chống trùng lặp...")
    existing_files = get_existing_supabase_files(env)
    print(f"ℹ️  Đã có {len(existing_files)} tài liệu trên hệ thống.")

    # Lọc danh sách cần nạp
    to_upload = []
    for b in books:
        if not b['exists']:
            continue
        # Bỏ qua nếu đã có trên Supabase theo title
        if b['title'] in existing_files:
            continue
        # Lọc theo domain nếu có yêu cầu
        if args.domain and b['domain'] != args.domain:
            continue
        to_upload.append(b)

    # Giới hạn số lượng test
    if args.test and args.test > 0:
        to_upload = to_upload[:args.test]

    print(f"\n⚡ Số lượng tài liệu sẽ tiến hành nạp: {len(to_upload)} tài liệu")
    if not to_upload:
        print("✅ Tất cả tài liệu đã được nạp trước đó hoặc không có file phù hợp!")
        return

    # Bắt đầu nạp
    success_count = 0
    fail_count = 0

    print("\n🚀 Bắt đầu quá trình nạp...")
    print("-" * 75)

    for idx, b in enumerate(to_upload, 1):
        dom_conf = DOMAIN_CONFIG.get(b['domain'], {})
        print(f"[{idx}/{len(to_upload)}] Đang nạp: {b['title'][:40]}...")
        print(f"    ├ Số/Ký hiệu: {b['doc_number'] or 'Không'}")
        print(f"    ├ Đơn vị BH : {b['issuing_authority']}")
        print(f"    ├ Chuyên môn: {dom_conf.get('label')} ➔ {dom_conf.get('drive_subfolder')}")
        print(f"    └ Tệp tin   : {b['file_name']} ({b['file_size']/1024:.1f} KB)")

        ok, res = upload_document(b, args.api_url)
        if ok:
            print("    ✅ Thành công!\n")
            success_count += 1
        else:
            print(f"    ❌ Thất bại: {res}\n")
            fail_count += 1

        # Nghỉ ngắn giữa các request để giảm tải Google Drive API
        time.sleep(1)

    print("=" * 75)
    print(f"🎉 HOÀN THÀNH: Thành công {success_count} | Thất bại {fail_count}")
    print("=" * 75 + "\n")

if __name__ == "__main__":
    main()
