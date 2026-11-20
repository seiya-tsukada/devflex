import {
  Activity,
  BarChart3,
  CheckSquare,
  Cpu,
  FolderGit2,
  LayoutDashboard,
  LogOut,
  Menu,
  Play,
  Settings,
  X,
} from 'lucide-react';
import { useState } from 'react';
import type { UserProfile } from '../shared/types.ts';

export type NavRoute =
  | 'dashboard'
  | 'projects'
  | 'tasks'
  | 'agents'
  | 'executions'
  | 'analytics'
  | 'settings';

interface SidebarProps {
  currentRoute: NavRoute;
  onNavigate: (route: NavRoute) => void;
  user: UserProfile;
  onLogout: () => void;
  runningCount: number;
}

export const NAV_ITEMS: Array<{
  id: NavRoute;
  label: string;
  index: string;
  icon: typeof LayoutDashboard;
}> = [
  { id: 'dashboard', label: 'ダッシュボード', index: '01', icon: LayoutDashboard },
  { id: 'projects', label: 'プロジェクト', index: '02', icon: FolderGit2 },
  { id: 'tasks', label: 'タスク', index: '03', icon: CheckSquare },
  { id: 'agents', label: 'エージェント', index: '04', icon: Cpu },
  { id: 'executions', label: '実行履歴', index: '05', icon: Play },
  { id: 'analytics', label: '分析・ログ', index: '06', icon: BarChart3 },
  { id: 'settings', label: '設定', index: '07', icon: Settings },
];

export function Sidebar({
  currentRoute,
  onNavigate,
  user,
  onLogout,
  runningCount,
}: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSelect = (route: NavRoute) => {
    onNavigate(route);
    setMobileOpen(false);
  };

  const navContent = (
    <div className="flex flex-col h-full bg-[#ffffff] border-r border-[#dfe3ea]">
      <div className="h-13 px-4 flex items-center justify-between border-b border-[#dfe3ea] shrink-0">
        <button
          type="button"
          onClick={() => handleSelect('dashboard')}
          className="flex items-center gap-2.5 text-left rounded-[2px]"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 28 28"
            fill="none"
            aria-hidden="true"
            className="shrink-0"
          >
            <rect x="1" y="1" width="26" height="26" rx="2" stroke="#d2d7e2" fill="#ffffff" />
            <rect x="6" y="6" width="7" height="7" fill="#0f766e" />
            <rect x="15" y="6" width="7" height="7" fill="#111827" />
            <rect x="6" y="15" width="16" height="7" fill="#cbd5e1" />
          </svg>
          <span className="font-display text-sm font-semibold tracking-normal text-[#111827] whitespace-nowrap">
            Mini Software Factory
          </span>
        </button>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          aria-label="ナビゲーションを閉じる"
          className="lg:hidden p-1.5 text-[#5b6472] hover:text-[#111827] rounded-[2px]"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <nav className="flex-1 p-2.5 space-y-0.5 overflow-y-auto" aria-label="メインナビゲーション">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = currentRoute === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelect(item.id)}
              aria-current={active ? 'page' : undefined}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-[3px] text-[13px] transition-colors whitespace-nowrap ${
                active
                  ? 'bg-[#f0fdfa] text-[#0f766e] font-semibold border border-[#99f6e4]'
                  : 'text-[#5b6472] hover:text-[#111827] hover:bg-[#f4f6f9] border border-transparent'
              }`}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <Icon
                  className={`w-4 h-4 shrink-0 ${active ? 'text-[#0f766e]' : 'text-[#64748b]'}`}
                  aria-hidden="true"
                />
                <span className="truncate">{item.label}</span>
              </span>
              {item.id === 'executions' && runningCount > 0 ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-mono tabular-nums text-[#0f766e]">
                  <Activity className="w-3 h-3" aria-hidden="true" />
                  {runningCount}
                </span>
              ) : (
                <span
                  className={`text-[10px] font-mono tabular-nums ${
                    active ? 'text-[#0f766e]' : 'text-[#94a3b8]'
                  }`}
                >
                  {item.index}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-3 border-t border-[#dfe3ea] shrink-0 bg-[#f8f9fb]">
        <div className="flex items-center gap-2.5 px-1.5 py-1">
          <div
            className="w-7 h-7 rounded-[2px] border border-[#99f6e4] bg-[#f0fdfa] flex items-center justify-center text-xs font-mono font-semibold text-[#0f766e] shrink-0"
            aria-hidden="true"
          >
            {user.displayName.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-[#111827] truncate">{user.displayName}</p>
            <p className="text-[11px] font-mono text-[#64748b] truncate">{user.email}</p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            aria-label="サインアウト"
            title="サインアウト"
            className="p-1.5 rounded-[2px] text-[#5b6472] hover:text-[#111827] hover:bg-[#eef0f4] transition-colors shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <header className="lg:hidden sticky top-0 z-30 h-12 px-4 flex items-center justify-between bg-[#ffffff]/95 backdrop-blur border-b border-[#dfe3ea]">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="メニューを開く"
            className="p-1.5 -ml-1.5 rounded-[2px] text-[#374151] hover:text-[#111827] hover:bg-[#f4f6f9]"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-display text-sm font-semibold text-[#111827] whitespace-nowrap">
            Mini Software Factory
          </span>
        </div>
        <span className="text-xs font-mono text-[#0f766e] font-medium truncate max-w-[140px]">
          {NAV_ITEMS.find((i) => i.id === currentRoute)?.label}
        </span>
      </header>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div
            className="fixed inset-0 bg-[#0f172a]/40 backdrop-blur-[1px]"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative w-64 max-w-[80vw] h-full z-50">{navContent}</aside>
        </div>
      )}

      <aside className="hidden lg:block w-60 shrink-0 h-screen sticky top-0">
        {navContent}
      </aside>
    </>
  );
}
