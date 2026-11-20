import { useCallback, useEffect, useState } from 'react';
import { api, getStoredToken, setStoredToken } from './lib/api.ts';
import type { UserProfile } from './shared/types.ts';
import { AgentsView } from './components/AgentsView.tsx';
import { AnalyticsView } from './components/AnalyticsView.tsx';
import { AuthScreen } from './components/AuthScreen.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { ExecutionsView } from './components/ExecutionsView.tsx';
import { OnboardingWizard } from './components/OnboardingWizard.tsx';
import { ProjectsView } from './components/ProjectsView.tsx';
import { SettingsView } from './components/SettingsView.tsx';
import { NAV_ITEMS, Sidebar, type NavRoute } from './components/Sidebar.tsx';
import { TasksView } from './components/TasksView.tsx';
import { ToastContainer, type ToastMessage } from './components/ToastContainer.tsx';

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [booting, setBooting] = useState(true);
  const [route, setRoute] = useState<NavRoute>('dashboard');

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedExecutionId, setSelectedExecutionId] = useState<string | null>(null);
  const [executionAgentFilter, setExecutionAgentFilter] = useState<string>('');
  const [runningCount, setRunningCount] = useState(0);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const notify = useCallback(
    (type: ToastMessage['type'], title: string, detail?: string) => {
      const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev, { id, type, title, detail }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4500);
    },
    [],
  );

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  useEffect(() => {
    const boot = async () => {
      const params = new URLSearchParams(window.location.search);
      const autostart = params.get('autostart') === '1';
      const existingToken = getStoredToken();

      if (existingToken) {
        try {
          const res = await api.me();
          setUser(res.user);
          setBooting(false);
          return;
        } catch {
          setStoredToken(null);
        }
      }

      if (autostart) {
        try {
          const res = await api.loginDemo();
          setStoredToken(res.token);
          setUser(res.user);
        } catch {
          // ignore
        }
      }
      setBooting(false);
    };
    boot();
  }, []);

  useEffect(() => {
    if (!user) return;
    const pollCounts = async () => {
      try {
        const res = await api.getDashboard();
        setRunningCount(res.metrics.runningExecutions);
      } catch {
        // ignore transient poll errors
      }
    };
    pollCounts();
    const timer = setInterval(pollCounts, runningCount > 0 ? 1500 : 4000);
    return () => clearInterval(timer);
  }, [user, runningCount]);

  const handleAuthenticated = (token: string, nextUser: UserProfile) => {
    setStoredToken(token);
    setUser(nextUser);
    setRoute('dashboard');
    notify('success', 'サインインしました', nextUser.displayName);
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      // ignore
    }
    setStoredToken(null);
    setUser(null);
    setSelectedProjectId(null);
    setSelectedTaskId(null);
    setSelectedExecutionId(null);
    notify('info', 'サインアウトしました');
  };

  const handleNavigate = (nextRoute: NavRoute) => {
    setRoute(nextRoute);
    if (nextRoute !== 'projects') setSelectedProjectId(null);
    if (nextRoute !== 'tasks') setSelectedTaskId(null);
    if (nextRoute !== 'executions') {
      setSelectedExecutionId(null);
      setExecutionAgentFilter('');
    }
  };

  const openProject = (projectId: string) => {
    setSelectedProjectId(projectId);
    setRoute('projects');
  };

  const openTask = (taskId: string) => {
    setSelectedTaskId(taskId);
    setRoute('tasks');
  };

  const openExecution = (executionId: string) => {
    setSelectedExecutionId(executionId);
    setRoute('executions');
  };

  const openAgentExecutions = (agentId: string) => {
    setExecutionAgentFilter(agentId);
    setSelectedExecutionId(null);
    setRoute('executions');
  };

  if (booting) {
    return (
      <div className="min-h-screen bg-[#f4f6f8] text-[#5b6472] flex items-center justify-center text-sm font-mono">
        ワークスペースを初期化しています...
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <AuthScreen
          onAuthenticated={handleAuthenticated}
          onError={(msg) => notify('error', '認証エラー', msg)}
        />
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  if (!user.onboardingCompleted) {
    return (
      <>
        <OnboardingWizard
          onFinished={async () => {
            try {
              const res = await api.me();
              setUser(res.user);
            } catch {
              setUser({ ...user, onboardingCompleted: true });
            }
          }}
          onNotify={notify}
        />
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  const currentNav = NAV_ITEMS.find((n) => n.id === route);

  return (
    <div className="min-h-screen bg-[#f4f6f8] text-[#111827] flex flex-col lg:flex-row">
      <Sidebar
        currentRoute={route}
        onNavigate={handleNavigate}
        user={user}
        onLogout={handleLogout}
        runningCount={runningCount}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Contextual Desktop Breadcrumb Bar */}
        <div className="hidden lg:flex h-13 px-8 items-center justify-between border-b border-[#dfe3ea] bg-[#ffffff]/95 sticky top-0 z-20 backdrop-blur">
          <div className="flex items-center gap-2 text-xs text-[#5b6472]">
            <button
              type="button"
              onClick={() => handleNavigate('dashboard')}
              className="hover:text-[#111827] transition-colors"
            >
              Factory
            </button>
            <span aria-hidden="true" className="text-[#94a3b8]">
              /
            </span>
            <span className="text-[#111827] font-medium">{currentNav?.label}</span>
            {(selectedProjectId || selectedTaskId || selectedExecutionId) && (
              <>
                <span aria-hidden="true" className="text-[#94a3b8]">
                  /
                </span>
                <span className="font-mono text-[11px] text-[#0f766e]">
                  {selectedProjectId ?? selectedTaskId ?? selectedExecutionId}
                </span>
              </>
            )}
          </div>
          <div className="text-[11px] font-mono text-[#64748b]">
            {user.displayName}
          </div>
        </div>

        <main className="flex-1 min-w-0 px-4 py-5 sm:px-6 lg:px-8 lg:py-6 max-w-[1440px] w-full">
          {route === 'dashboard' && (
            <DashboardView
              onNavigate={handleNavigate}
              onOpenProject={openProject}
              onOpenTask={openTask}
              onOpenExecution={openExecution}
              onError={(msg) => notify('error', '読み込みエラー', msg)}
            />
          )}

          {route === 'projects' && (
            <ProjectsView
              selectedProjectId={selectedProjectId}
              onSelectProject={setSelectedProjectId}
              onOpenTask={openTask}
              onOpenExecution={openExecution}
              onNotify={notify}
            />
          )}

          {route === 'tasks' && (
            <TasksView
              selectedTaskId={selectedTaskId}
              onSelectTask={setSelectedTaskId}
              onOpenProject={openProject}
              onOpenExecution={openExecution}
              onNotify={notify}
            />
          )}

          {route === 'agents' && (
            <AgentsView
              onViewAgentExecutions={openAgentExecutions}
              onNotify={notify}
            />
          )}

          {route === 'executions' && (
            <ExecutionsView
              selectedExecutionId={selectedExecutionId}
              initialAgentFilter={executionAgentFilter}
              onSelectExecution={setSelectedExecutionId}
              onOpenProject={openProject}
              onOpenTask={openTask}
              onNotify={notify}
            />
          )}

          {route === 'analytics' && (
            <AnalyticsView
              onError={(msg) => notify('error', '分析データエラー', msg)}
            />
          )}

          {route === 'settings' && (
            <SettingsView
              onUserUpdated={setUser}
              onNotify={notify}
            />
          )}
        </main>
      </div>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
