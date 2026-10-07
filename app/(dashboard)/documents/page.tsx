import { Search, Filter, Folder, File, ExternalLink } from 'lucide-react';

const DEPARTMENTS = ['Tất cả', 'Kỹ thuật', 'An toàn', 'PCCC', 'PCTT & TKCN', 'Hành chính'];
const MOCK_DOCS = [
  { id: 1, name: 'Quy_trinh_an_toan_dien_2026.pdf', dept: 'An toàn', date: '01/10/2026', drive_id: 'mock1' },
  { id: 2, name: 'Ke_hoach_PCCC_Q4.docx', dept: 'PCCC', date: '28/09/2026', drive_id: 'mock2' },
  { id: 3, name: 'Bao_cao_bao_tri_he_thong.pdf', dept: 'Kỹ thuật', date: '15/09/2026', drive_id: 'mock3' },
];

export default function DocumentsPage() {
  return (
    <div className="flex flex-col h-full">
      <header className="h-16 flex items-center justify-between px-6 border-b border-slate-800/50 bg-slate-900/40 backdrop-blur-md">
        <div>
          <h1 className="text-xl font-semibold text-white">Quản lý Tài liệu</h1>
          <p className="text-xs text-slate-400">Lưu trữ trên Google Drive & Vector Database</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 no-scrollbar flex gap-6 flex-col md:flex-row">
        {/* Sidebar Filters */}
        <div className="w-full md:w-64 space-y-6">
          <div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
              <input 
                type="text" 
                placeholder="Tìm kiếm tài liệu..." 
                className="w-full bg-slate-900/50 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 transition-colors"
              />
            </div>
          </div>
          
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Filter className="w-3 h-3" /> Chuyên đề
            </h3>
            <ul className="space-y-1">
              {DEPARTMENTS.map((dept, i) => (
                <li key={i}>
                  <button className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${i === 0 ? 'bg-indigo-500/10 text-indigo-400' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}>
                    {dept}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Document List */}
        <div className="flex-1 bg-slate-900/30 border border-slate-800 rounded-xl overflow-hidden backdrop-blur-sm">
          <div className="p-4 border-b border-slate-800/50 bg-slate-900/50 flex justify-between items-center">
            <h2 className="text-sm font-medium text-slate-200 flex items-center gap-2">
              <Folder className="w-4 h-4 text-indigo-400" />
              Tài liệu được chia sẻ
            </h2>
            <span className="text-xs text-slate-500">{MOCK_DOCS.length} files</span>
          </div>
          <div className="divide-y divide-slate-800/30">
            {MOCK_DOCS.map(doc => (
              <div key={doc.id} className="p-4 hover:bg-slate-800/30 transition-colors flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-indigo-400 group-hover:bg-indigo-500/10 transition-colors">
                    <File size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-slate-200 group-hover:text-indigo-300 transition-colors">{doc.name}</h4>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                      <span className="px-2 py-0.5 rounded-sm bg-slate-800 border border-slate-700/50">{doc.dept}</span>
                      <span>Cập nhật: {doc.date}</span>
                    </div>
                  </div>
                </div>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <a 
                    href={`https://drive.google.com/file/d/${doc.drive_id}/view`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-slate-800 hover:bg-indigo-500 hover:text-white text-slate-400 rounded-lg transition-colors flex items-center gap-2 text-xs font-medium border border-slate-700"
                  >
                    <ExternalLink size={14} /> Drive
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
