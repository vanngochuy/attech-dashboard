import { CheckCircle2, Clock, Inbox, MoreHorizontal } from 'lucide-react';

// Mock data
const MOCK_TASKS = [
  { id: 1, title: 'Cập nhật tài liệu an toàn Q3/2026', status: 'pending', date: '10/10/2026', assignee: 'Nguyễn Văn A' },
  { id: 2, title: 'Rà soát quy trình PCCC', status: 'in_progress', date: '08/10/2026', assignee: 'Trần Thị B' },
  { id: 3, title: 'Kiểm tra trang thiết bị PCTT', status: 'completed', date: '05/10/2026', assignee: 'Lê Văn C' },
];

export default function TasksPage() {
  return (
    <div className="flex flex-col h-full">
      <header className="h-16 flex items-center justify-between px-6 border-b border-slate-800/50 bg-slate-900/40 backdrop-blur-md">
        <div>
          <h1 className="text-xl font-semibold text-white">Quản lý Công việc</h1>
          <p className="text-xs text-slate-400">Điều phối công việc tự động từ Email</p>
        </div>
        <button className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-indigo-500/20">
          Tạo công việc
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-6 no-scrollbar">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatCard title="Tổng số công việc" value="24" icon={<Inbox className="text-blue-400" />} />
          <StatCard title="Đang xử lý" value="8" icon={<Clock className="text-amber-400" />} />
          <StatCard title="Đã hoàn thành" value="16" icon={<CheckCircle2 className="text-emerald-400" />} />
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden backdrop-blur-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-800/50 text-slate-400 text-sm border-b border-slate-700/50">
                <th className="p-4 font-medium">Tên công việc</th>
                <th className="p-4 font-medium">Trạng thái</th>
                <th className="p-4 font-medium">Người phụ trách</th>
                <th className="p-4 font-medium">Thời hạn</th>
                <th className="p-4 font-medium text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {MOCK_TASKS.map(task => (
                <tr key={task.id} className="border-b border-slate-800/30 hover:bg-slate-800/30 transition-colors">
                  <td className="p-4 text-slate-200 font-medium">{task.title}</td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                      task.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                      task.status === 'in_progress' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                      'bg-slate-500/10 text-slate-400 border-slate-500/20'
                    }`}>
                      {task.status === 'completed' ? 'Hoàn thành' : task.status === 'in_progress' ? 'Đang làm' : 'Chờ xử lý'}
                    </span>
                  </td>
                  <td className="p-4 text-slate-300">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-xs text-white">
                        {task.assignee.charAt(0)}
                      </div>
                      {task.assignee}
                    </div>
                  </td>
                  <td className="p-4 text-slate-400">{task.date}</td>
                  <td className="p-4 text-right">
                    <button className="p-1 text-slate-500 hover:text-white transition-colors">
                      <MoreHorizontal size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon }: { title: string, value: string, icon: React.ReactNode }) {
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 backdrop-blur-sm flex items-center gap-4 hover:border-slate-700 transition-colors shadow-sm">
      <div className="w-12 h-12 rounded-lg bg-slate-800 flex items-center justify-center">
        {icon}
      </div>
      <div>
        <h3 className="text-slate-400 text-sm font-medium">{title}</h3>
        <p className="text-2xl font-bold text-white mt-1">{value}</p>
      </div>
    </div>
  );
}
