import { useEffect, useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  CheckSquare,
  ExternalLink,
  GitPullRequest,
  Play,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { api } from '../lib/api.ts';
import {
  formatDateTime,
  formatDuration,
  PROVIDER_LABELS,
  TASK_STATUS_LABELS,
} from '../lib/labels.ts';
import { canTransitionTaskStatus, TASK_STATUS_TRANSITIONS } from '../shared/logic.ts';
import type {
  Agent,
  Execution,
  Project,
  PullRequestStatus,
  Task,
  TaskPriority,
  TaskStatus,
} from '../shared/types.ts';
import {
  ExecutionStatusTag,
  PriorityTag,
  PullRequestStatusTag,
  TaskStatusTag,
} from './StatusBadge.tsx';

interface TasksViewProps {
  selectedTaskId: string | null;
  onSelectTask: (id: string | null) => void;
  onOpenProject: (projectId: string) => void;
  onOpenExecution: (executionId: string) => void;
  onNotify: (type: 'success' | 'error' | 'info', title: string, detail?: string) => void;
}

export function TasksView({
  selectedTaskId,
  onSelectTask,
  onOpenProject,
  onOpenExecution,
  onNotify,
}: TasksViewProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Task detail
  const [detail, setDetail] = useState<{
    task: Task;
    project: Project | null;
    agent: Agent | null;
    executions: Execution[];
  } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Create modal
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState('');
  const [assignedAgentId, setAssignedAgentId] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);

  // Execute modal inside detail
  const [execAgentId, setExecAgentId] = useState('');
  const [execInstructions, setExecInstructions] = useState('');
  const [executing, setExecuting] = useState(false);

  // PR link form inside detail
  const [prUrl, setPrUrl] = useState('');
  const [prTitle, setPrTitle] = useState('');
  const [prBranch, setPrBranch] = useState('');
  const [prStatus, setPrStatus] = useState<PullRequestStatus>('open');

  const loadAll = async () => {
    setLoading(true);
    try {
      const [tRes, pRes, aRes] = await Promise.all([
        api.getTasks(),
        api.getProjects(),
        api.getAgents(),
      ]);
      setTasks(tRes.tasks);
      setProjects(pRes.projects);
      setAgents(aRes.agents);
      if (!projectId && pRes.projects.length > 0) {
        setProjectId(pRes.projects[0].id);
      }
    } catch (err) {
      onNotify('error', 'タスク取得エラー', err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (id: string) => {
    setDetailLoading(true);
    try {
      const res = await api.getTaskDetail(id);
      setDetail(res);
      setExecAgentId(
        res.task.assignedAgentId ??
          agents.find((a) => a.connectionType === 'mock')?.id ??
          agents[0]?.id ??
          '',
      );
      setExecInstructions(
        `${res.task.title}\n${res.task.description}`.trim(),
      );
      if (res.task.pullRequest) {
        setPrUrl(res.task.pullRequest.url);
        setPrTitle(res.task.pullRequest.title);
        setPrBranch(res.task.pullRequest.branch ?? '');
        setPrStatus(res.task.pullRequest.status);
      } else {
        setPrUrl('');
        setPrTitle(res.task.title);
        setPrBranch('');
        setPrStatus('open');
      }
    } catch (err) {
      onNotify('error', 'タスク詳細取得エラー', err instanceof Error ? err.message : undefined);
      onSelectTask(null);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (selectedTaskId) {
      loadDetail(selectedTaskId);
    } else {
      setDetail(null);
    }
  }, [selectedTaskId]);

  const handleCreateTask = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.createTask({
        projectId,
        title,
        description,
        assignedAgentId: assignedAgentId || null,
        priority,
        status: 'ready',
        dueDate: dueDate || null,
      });
      onNotify('success', 'タスクを作成しました', res.task.title);
      setCreateOpen(false);
      setTitle('');
      setDescription('');
      await loadAll();
    } catch (err) {
      onNotify('error', 'タスク作成エラー', err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (task: Task, nextStatus: TaskStatus) => {
    if (!canTransitionTaskStatus(task.status, nextStatus)) {
      onNotify('error', '無効なステータス遷移です');
      return;
    }
    try {
      await api.updateTask(task.id, { status: nextStatus });
      onNotify('success', 'ステータスを更新しました', TASK_STATUS_LABELS[nextStatus]);
      await loadAll();
      if (selectedTaskId === task.id) await loadDetail(task.id);
    } catch (err) {
      onNotify('error', '更新エラー', err instanceof Error ? err.message : undefined);
    }
  };

  const handleAssignAndExecute = async (e: FormEvent) => {
    e.preventDefault();
    if (!detail) return;
    setExecuting(true);
    try {
      const res = await api.startExecution({
        projectId: detail.task.projectId,
        taskId: detail.task.id,
        agentId: execAgentId,
        instructions: execInstructions,
      });
      onNotify('info', 'エージェント実行を開始しました', `Execution ID: ${res.execution.id}`);
      onOpenExecution(res.execution.id);
    } catch (err) {
      onNotify('error', '実行開始エラー', err instanceof Error ? err.message : undefined);
    } finally {
      setExecuting(false);
    }
  };

  const handleLinkPr = async (e: FormEvent) => {
    e.preventDefault();
    if (!detail) return;
    try {
      await api.linkTaskPr(detail.task.id, {
        url: prUrl,
        title: prTitle,
        branch: prBranch,
        status: prStatus,
      });
      onNotify('success', 'GitHub PR を関連付けました');
      await loadDetail(detail.task.id);
      await loadAll();
    } catch (err) {
      onNotify('error', 'PR登録エラー', err instanceof Error ? err.message : undefined);
    }
  };

  const handleDeleteTask = async (task: Task) => {
    try {
      await api.deleteTask(task.id);
      onNotify('success', 'タスクを削除しました', task.title);
      if (selectedTaskId === task.id) onSelectTask(null);
      await loadAll();
    } catch (err) {
      onNotify('error', '削除エラー', err instanceof Error ? err.message : undefined);
    }
  };

  if (selectedTaskId) {
    if (detailLoading || !detail) {
      return <div className="p-8 text-sm text-muted">タスク詳細を読み込み中...</div>;
    }

    const t = detail.task;
    const allowedTransitions = [t.status, ...(TASK_STATUS_TRANSITIONS[t.status] ?? [])];
    const latestError = detail.executions.find((e) => e.error)?.error ?? null;
    const latestLogs = detail.executions[0]?.logs ?? [];

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => onSelectTask(null)}
              className="inline-flex items-center gap-1.5 rounded-[3px] border border-line-strong bg-surface hover:bg-elevated px-3 py-1.5 text-xs text-ink-soft whitespace-nowrap"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              タスク一覧
            </button>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-lg font-semibold text-ink">{t.title}</h1>
                <TaskStatusTag status={t.status} />
                <PriorityTag priority={t.priority} />
              </div>
              <div className="flex items-center gap-2 text-xs text-muted mt-1">
                {detail.project && (
                  <button
                    type="button"
                    onClick={() => onOpenProject(detail.project!.id)}
                    className="hover:text-accent font-medium"
                  >
                    {detail.project.name}
                  </button>
                )}
                <span aria-hidden="true">·</span>
                <span className="font-mono">作成: {formatDateTime(t.createdAt)}</span>
                {t.dueDate && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono">期限: {t.dueDate}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <label htmlFor="task-status-select" className="text-xs text-muted">
              状態変更:
            </label>
            <select
              id="task-status-select"
              value={t.status}
              onChange={(e) => handleStatusChange(t, e.target.value as TaskStatus)}
              className="rounded-[3px] border border-line-strong bg-surface px-2.5 py-1.5 text-xs text-ink focus:border-accent focus:outline-none"
            >
              {allowedTransitions.map((s) => (
                <option key={s} value={s}>
                  {TASK_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => handleDeleteTask(t)}
              aria-label="このタスクを削除"
              className="p-2 rounded-[3px] border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-7 space-y-4">
            {/* Description */}
            <section className="rounded-[3px] border border-line bg-surface p-4">
              <h2 className="text-xs font-medium text-muted mb-2">タスク詳細説明</h2>
              <p className="text-sm text-ink whitespace-pre-wrap leading-relaxed">
                {t.description || '詳細な説明はありません。'}
              </p>
            </section>

            {/* Assign & Execute */}
            <section className="rounded-[3px] border border-line bg-surface p-4">
              <h2 className="font-display text-sm font-medium text-ink mb-3">
                エージェントに割り当てて実行
              </h2>
              <form onSubmit={handleAssignAndExecute} className="space-y-3">
                <div>
                  <label htmlFor="exec-agent" className="block text-xs text-muted mb-1">
                    実行エージェント
                  </label>
                  <select
                    id="exec-agent"
                    required
                    value={execAgentId}
                    onChange={(e) => setExecAgentId(e.target.value)}
                    className="w-full rounded-[3px] border border-line-strong bg-elevated px-3 py-2 text-xs text-ink focus:border-accent focus:bg-surface focus:outline-none"
                  >
                    <option value="">エージェントを選択...</option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({PROVIDER_LABELS[a.provider]} ·{' '}
                        {a.connectionType === 'mock' ? 'Mock Adapter' : '外部接続'})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="exec-inst" className="block text-xs text-muted mb-1">
                    実行指示プロンプト
                  </label>
                  <textarea
                    id="exec-inst"
                    rows={3}
                    required
                    value={execInstructions}
                    onChange={(e) => setExecInstructions(e.target.value)}
                    className="w-full rounded-[3px] border border-line-strong bg-elevated px-3 py-2 text-xs text-ink focus:border-accent focus:bg-surface focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={executing || !execAgentId}
                  className="inline-flex items-center gap-1.5 rounded-[3px] bg-accent hover:bg-accent-hover disabled:opacity-50 px-4 py-2 text-xs font-semibold text-white whitespace-nowrap"
                >
                  <Play className="w-3.5 h-3.5" aria-hidden="true" />
                  割り当てて実行開始
                </button>
              </form>
            </section>

            {/* Execution Logs / Errors */}
            {latestError && (
              <section className="rounded-[3px] border border-red-200 bg-red-50 p-4">
                <h2 className="text-xs font-semibold text-red-800">最新のエラー情報</h2>
                <p className="text-xs text-red-700 mt-1 font-mono">{latestError}</p>
              </section>
            )}

            <section className="rounded-[3px] border border-line bg-surface overflow-hidden">
              <div className="px-4 py-3 border-b border-line bg-elevated">
                <h2 className="font-display text-sm font-medium text-ink">
                  実行履歴 ({detail.executions.length})
                </h2>
              </div>
              {detail.executions.length === 0 ? (
                <div className="p-6 text-xs text-subtle text-center">
                  このタスクの実行履歴はまだありません。
                </div>
              ) : (
                <div className="divide-y divide-sunken">
                  {detail.executions.map((exec) => (
                    <div
                      key={exec.id}
                      className="px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-slate-50"
                    >
                      <button
                        type="button"
                        onClick={() => onOpenExecution(exec.id)}
                        className="text-xs font-mono text-ink-soft hover:text-accent truncate text-left"
                      >
                        {exec.id} · {formatDateTime(exec.startedAt)} ·{' '}
                        {formatDuration(exec.durationMs)}
                      </button>
                      <ExecutionStatusTag status={exec.status} />
                    </div>
                  ))}
                </div>
              )}
              {latestLogs.length > 0 && (
                <div className="p-4 border-t border-line bg-elevated">
                  <p className="text-[11px] text-muted mb-2">最新実行ログ抜粋</p>
                  <div className="space-y-1 font-mono text-[11px]">
                    {latestLogs.map((log) => (
                      <div key={log.id} className="text-ink-soft">
                        <span className="text-subtle">[{log.phase}]</span> {log.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </div>

          <div className="lg:col-span-5 space-y-4">
            {/* GitHub PR */}
            <section className="rounded-[3px] border border-line bg-surface p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GitPullRequest className="w-4 h-4 text-accent" aria-hidden="true" />
                  <h2 className="font-display text-sm font-medium text-ink">
                    関連 GitHub Pull Request
                  </h2>
                </div>
                {t.pullRequest && <PullRequestStatusTag status={t.pullRequest.status} />}
              </div>

              {t.pullRequest && (
                <div className="rounded-[3px] border border-line bg-elevated p-3 text-xs space-y-1">
                  <a
                    href={t.pullRequest.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:text-accent-hover hover:underline inline-flex items-center gap-1 break-all font-mono"
                  >
                    {t.pullRequest.url}
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                  {t.pullRequest.isSimulated && (
                    <p className="text-[11px] text-accent font-medium">
                      ※ Mock実行により生成された仮想PR参照です
                    </p>
                  )}
                </div>
              )}

              <form onSubmit={handleLinkPr} className="space-y-2.5 pt-1">
                <div>
                  <label htmlFor="pr-url" className="block text-xs text-muted mb-1">
                    PR URL
                  </label>
                  <input
                    id="pr-url"
                    required
                    value={prUrl}
                    onChange={(e) => setPrUrl(e.target.value)}
                    placeholder="https://github.com/org/repo/pull/123"
                    className="w-full rounded-[3px] border border-line-strong bg-elevated px-3 py-1.5 text-xs text-ink font-mono focus:border-accent focus:bg-surface focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="pr-title" className="block text-xs text-muted mb-1">
                    PR タイトル
                  </label>
                  <input
                    id="pr-title"
                    value={prTitle}
                    onChange={(e) => setPrTitle(e.target.value)}
                    className="w-full rounded-[3px] border border-line-strong bg-elevated px-3 py-1.5 text-xs text-ink focus:border-accent focus:bg-surface focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label htmlFor="pr-branch" className="block text-xs text-muted mb-1">
                      ブランチ
                    </label>
                    <input
                      id="pr-branch"
                      value={prBranch}
                      onChange={(e) => setPrBranch(e.target.value)}
                      placeholder="feat/my-change"
                      className="w-full rounded-[3px] border border-line-strong bg-elevated px-3 py-1.5 text-xs text-ink font-mono focus:border-accent focus:bg-surface focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="pr-status" className="block text-xs text-muted mb-1">
                      PR ステータス
                    </label>
                    <select
                      id="pr-status"
                      value={prStatus}
                      onChange={(e) => setPrStatus(e.target.value as PullRequestStatus)}
                      className="w-full rounded-[3px] border border-line-strong bg-elevated px-3 py-1.5 text-xs text-ink focus:border-accent focus:bg-surface focus:outline-none"
                    >
                      <option value="open">Open</option>
                      <option value="draft">Draft</option>
                      <option value="merged">Merged</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full rounded-[3px] border border-line-strong bg-elevated hover:bg-slate-100 py-1.5 text-xs font-medium text-ink"
                >
                  PR情報を保存・更新
                </button>
              </form>
            </section>
          </div>
        </div>
      </div>
    );
  }

  const projectMap = new Map(projects.map((p) => [p.id, p]));
  const agentMap = new Map(agents.map((a) => [a.id, a]));

  const filtered = tasks.filter((t) => {
    if (projectFilter && t.projectId !== projectFilter) return false;
    if (statusFilter && t.status !== statusFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
            タスク管理
          </h1>
          <p className="text-xs text-muted mt-1">
            開発タスクの作成・エージェント割り当て・ステータス管理を行います
          </p>
        </div>
        <button
          type="button"
          disabled={projects.length === 0}
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-[3px] bg-accent hover:bg-accent-hover disabled:opacity-50 px-3.5 py-2 text-xs font-semibold text-white whitespace-nowrap"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          タスク作成
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search
            className="w-3.5 h-3.5 text-subtle absolute left-3 top-1/2 -translate-y-1/2"
            aria-hidden="true"
          />
          <input
            type="search"
            aria-label="タスクを検索"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="タスク名で検索..."
            className="w-full rounded-[3px] border border-line-strong bg-surface pl-8 pr-3 py-1.5 text-xs text-ink placeholder:text-faint focus:border-accent focus:outline-none"
          />
        </div>
        <select
          aria-label="プロジェクトで絞り込み"
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="rounded-[3px] border border-line-strong bg-surface px-3 py-1.5 text-xs text-ink-soft focus:border-accent focus:outline-none"
        >
          <option value="">すべてのプロジェクト</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          aria-label="ステータスで絞り込み"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-[3px] border border-line-strong bg-surface px-3 py-1.5 text-xs text-ink-soft focus:border-accent focus:outline-none"
        >
          <option value="">すべてのステータス</option>
          {(Object.keys(TASK_STATUS_LABELS) as TaskStatus[]).map((s) => (
            <option key={s} value={s}>
              {TASK_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="rounded-[3px] border border-line bg-surface p-8 text-center text-xs text-subtle">
          読み込み中...
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-[3px] border border-line bg-surface p-12 text-center">
          <CheckSquare className="w-8 h-8 text-faint mx-auto mb-3" aria-hidden="true" />
          <p className="text-sm font-medium text-ink">
            {projects.length === 0
              ? 'タスクを作成する前にプロジェクトを作成してください'
              : tasks.length === 0
                ? '開発タスクがまだありません'
                : '条件に一致するタスクがありません'}
          </p>
          {projects.length > 0 && tasks.length === 0 && (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-[3px] bg-accent hover:bg-accent-hover px-3.5 py-2 text-xs font-semibold text-white"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              最初のタスクを作成
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-[3px] border border-line bg-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-line bg-elevated text-[11px] text-muted">
                  <th className="py-2.5 px-4 font-medium">タスク名</th>
                  <th className="py-2.5 px-4 font-medium">プロジェクト</th>
                  <th className="py-2.5 px-4 font-medium">担当エージェント</th>
                  <th className="py-2.5 px-4 font-medium">優先度</th>
                  <th className="py-2.5 px-4 font-medium">ステータス</th>
                  <th className="py-2.5 px-4 font-medium">PR</th>
                  <th className="py-2.5 px-4 font-medium text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sunken text-xs">
                {filtered.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-4 max-w-[260px]">
                      <button
                        type="button"
                        onClick={() => onSelectTask(t.id)}
                        className="font-medium text-ink hover:text-accent text-left truncate block max-w-full"
                      >
                        {t.title}
                      </button>
                    </td>
                    <td className="py-2.5 px-4 text-ink-soft whitespace-nowrap">
                      {projectMap.get(t.projectId)?.name ?? '—'}
                    </td>
                    <td className="py-2.5 px-4 text-ink-soft whitespace-nowrap">
                      {t.assignedAgentId
                        ? agentMap.get(t.assignedAgentId)?.name ?? '未登録'
                        : '未割当'}
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <PriorityTag priority={t.priority} />
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <TaskStatusTag status={t.status} />
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      {t.pullRequest ? (
                        <PullRequestStatusTag status={t.pullRequest.status} />
                      ) : (
                        <span className="text-faint">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleDeleteTask(t)}
                        aria-label={`${t.title} を削除`}
                        className="p-1.5 rounded-[2px] text-muted hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {createOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[1px] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="task-modal-title"
        >
          <div className="w-full max-w-lg rounded-[3px] border border-line bg-surface p-6 shadow-lg">
            <h2 id="task-modal-title" className="font-display text-base font-semibold text-ink">
              新規タスク作成
            </h2>
            <form onSubmit={handleCreateTask} className="mt-4 space-y-4">
              <div>
                <label htmlFor="task-proj" className="block text-xs text-muted mb-1">
                  プロジェクト *
                </label>
                <select
                  id="task-proj"
                  required
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="w-full rounded-[3px] border border-line-strong bg-elevated px-3 py-2 text-sm text-ink focus:border-accent focus:bg-surface focus:outline-none"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="task-title" className="block text-xs text-muted mb-1">
                  タスクタイトル *
                </label>
                <input
                  id="task-title"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="例: OAuthコールバックのCSRF対策追加"
                  className="w-full rounded-[3px] border border-line-strong bg-elevated px-3 py-2 text-sm text-ink focus:border-accent focus:bg-surface focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="task-desc" className="block text-xs text-muted mb-1">
                  詳細説明
                </label>
                <textarea
                  id="task-desc"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-[3px] border border-line-strong bg-elevated px-3 py-2 text-sm text-ink focus:border-accent focus:bg-surface focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="task-agent" className="block text-xs text-muted mb-1">
                    担当エージェント
                  </label>
                  <select
                    id="task-agent"
                    value={assignedAgentId}
                    onChange={(e) => setAssignedAgentId(e.target.value)}
                    className="w-full rounded-[3px] border border-line-strong bg-elevated px-3 py-2 text-xs text-ink focus:border-accent focus:bg-surface focus:outline-none"
                  >
                    <option value="">未割当</option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="task-priority" className="block text-xs text-muted mb-1">
                    優先度
                  </label>
                  <select
                    id="task-priority"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as TaskPriority)}
                    className="w-full rounded-[3px] border border-line-strong bg-elevated px-3 py-2 text-xs text-ink focus:border-accent focus:bg-surface focus:outline-none"
                  >
                    <option value="critical">緊急 (Critical)</option>
                    <option value="high">高 (High)</option>
                    <option value="medium">中 (Medium)</option>
                    <option value="low">低 (Low)</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="task-due" className="block text-xs text-muted mb-1">
                    期限日
                  </label>
                  <input
                    id="task-due"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full rounded-[3px] border border-line-strong bg-elevated px-3 py-2 text-xs text-ink font-mono focus:border-accent focus:bg-surface focus:outline-none"
                  />
                </div>
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="rounded-[3px] border border-line-strong bg-surface px-3.5 py-2 text-xs text-ink-soft hover:bg-elevated"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-[3px] bg-accent hover:bg-accent-hover disabled:opacity-50 px-4 py-2 text-xs font-semibold text-white"
                >
                  作成する
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
