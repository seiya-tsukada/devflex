import { lazy, Suspense, useEffect, useState } from 'react';
import { api, getStoredToken, setStoredToken } from './lib/api.ts';
import type { UserProfile } from './shared/types.ts';
import { AuthScreen } from './components/AuthScreen.tsx';
import { NAV_ITEMS, Sidebar, type NavRoute } from './components/Sidebar.tsx';
import { ToastContainer } from './components/ToastContainer.tsx';
import { useToasts } from './hooks/useToasts.ts';

// Route-level code splitting: each view is loaded on first visit.
const DashboardView = lazy(() =>
  import('./components/DashboardView.tsx').then((m) => ({ default: m.DashboardView })),
);
const ProjectsView = lazy(() =>
  import('./components/ProjectsView.tsx').then((m) => ({ default: m.ProjectsView })),
);
const TasksView = lazy(() =>
  import('./components/TasksView.tsx').then((m) => ({ default: m.TasksView })),
);
const AgentsView = lazy(() =>
  import('./components/AgentsView.tsx').then((m) => ({ default: m.AgentsView })),
);
const ExecutionsView = lazy(() =>
  import('./components/ExecutionsView.tsx').then((m) => ({ default: m.ExecutionsView })),
);
const AnalyticsView = lazy(() =>
  import('./components/AnalyticsView.tsx').then((m) => ({ default: m.AnalyticsView })),
);
const SettingsView = lazy(() =>
  import('./components/SettingsView.tsx').then((m) => ({ default: m.SettingsView })),
);
const OnboardingWizard = lazy(() =>
  import('./components/OnboardingWizard.tsx').then((m) => ({ default: m.OnboardingWizard })),
);

function LoadingScreen({ label }: { label: string }) {
  return (
    <div className="min-h-screen bg-canvas text-muted flex items-center justify-center text-sm font-mono">
      {label}
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [booting, setBooting] = useState(true);
  const [route, setRoute] = useState<NavRoute>('dashboard');

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedExecutionId, setSelectedExecutionId] = useState<string | null>(null);
  const [executionAgentFilter, setExecutionAgentFilter] = useState<string>('');
  const [runningCount, setRunningCount] = useState(0);
  const { toasts, notify, dismiss: dismissToast } = useToasts();

  useEffect(() => {
    let cancelled = false;

    const resolveUser = async (): Promise<UserProfile | null> => {
      if (getStoredToken()) {
        try {
          return (await api.me()).user;
        } catch {
          setStoredToken(null);
        }
      }
      if (new URLSearchParams(window.location.search).get('autostart') === '1') {
        try {
          const { token, user } = await api.loginDemo();
          setStoredToken(token);
          return user;
        } catch {
          // Fall through to the sign-in screen.
        }
      }
      return null;
    };

    void resolveUser().then((resolved) => {
      if (cancelled) return;
      setUser(resolved);
      setBooting(false);
    });

    return () => {
      cancelled = true;
    };
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
    void pollCounts();
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
    return <LoadingScreen label="ワークスペースを初期化しています..." />;
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
      <Suspense fallback={<LoadingScreen label="読み込み中..." />}>
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
      </Suspense>
    );
  }

  const currentNav = NAV_ITEMS.find((n) => n.id === route);

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col lg:flex-row">
      <Sidebar
        currentRoute={route}
        onNavigate={handleNavigate}
        user={user}
        onLogout={handleLogout}
        runningCount={runningCount}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Contextual Desktop Breadcrumb Bar */}
        <div className="hidden lg:flex h-13 px-8 items-center justify-between border-b border-line bg-surface/95 sticky top-0 z-20 backdrop-blur">
          <div className="flex items-center gap-2 text-xs text-muted">
            <button
              type="button"
              onClick={() => handleNavigate('dashboard')}
              className="hover:text-ink transition-colors"
            >
              Factory
            </button>
            <span aria-hidden="true" className="text-faint">
              /
            </span>
            <span className="text-ink font-medium">{currentNav?.label}</span>
            {(selectedProjectId || selectedTaskId || selectedExecutionId) && (
              <>
                <span aria-hidden="true" className="text-faint">
                  /
                </span>
                <span className="font-mono text-[11px] text-accent">
                  {selectedProjectId ?? selectedTaskId ?? selectedExecutionId}
                </span>
              </>
            )}
          </div>
          <div className="text-[11px] font-mono text-subtle">
            {user.displayName}
          </div>
        </div>

        <main className="flex-1 min-w-0 px-4 py-5 sm:px-6 lg:px-8 lg:py-6 max-w-[1440px] w-full">
          <Suspense fallback={<p className="text-sm font-mono text-muted">読み込み中...</p>}>
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
          </Suspense>
        </main>
      </div>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
