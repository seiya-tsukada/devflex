import { useEffect, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  ExternalLink,
  Play,
  RefreshCw,
  Terminal,
} from 'lucide-react';
import { api, type EnrichedExecution } from '../lib/api.ts';
import {
  EXECUTION_STATUS_LABELS,
  formatDateTime,
  formatDuration,
  PROVIDER_LABELS,
} from '../lib/labels.ts';
import type { Agent, Execution, Project, Task } from '../shared/types.ts';
import { ExecutionStatusTag } from './StatusBadge.tsx';

interface ExecutionsViewProps {
  selectedExecutionId: string | null;
  initialAgentFilter?: string;
  onSelectExecution: (id: string | null) => void;
  onOpenProject: (id: string) => void;
  onOpenTask: (id: string) => void;
  onNotify: (type: 'success' | 'error' | 'info', title: string, detail?: string) => void;
}

export function ExecutionsView({
  selectedExecutionId,
  initialAgentFilter = '',
  onSelectExecution,
  onOpenProject,
  onOpenTask,
  onNotify,
}: ExecutionsViewProps) {
  const [executions, setExecutions] = useState<EnrichedExecution[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterProject, setFilterProject] = useState('');
  const [filterAgent, setFilterAgent] = useState(initialAgentFilter);
  const [filterStatus, setFilterStatus] = useState('');

  // Launcher form
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [launchProjectId, setLaunchProjectId] = useState('');
  const [launchTaskId, setLaunchTaskId] = useState('');
  const [launchAgentId, setLaunchAgentId] = useState('');
  const [launchInstructions, setLaunchInstructions] = useState('');
  const [starting, setStarting] = useState(false);

  // Detail state
  const [detail, setDetail] = useState<{
    execution: Execution;
    project: Project | null;
    task: Task | null;
    agent: Agent | null;
  } | null>(null);

  const loadList = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [eRes, pRes, tRes, aRes] = await Promise.all([
        api.getExecutions({
          projectId: filterProject || undefined,
          agentId: filterAgent || undefined,
          status: filterStatus || undefined,
        }),
        api.getProjects(),
        api.getTasks(),
        api.getAgents(),
      ]);
      setExecutions(eRes.executions);
      setProjects(pRes.projects);
      setTasks(tRes.tasks);
      setAgents(aRes.agents);
      if (!launchProjectId && pRes.projects.length > 0) {
        const projectWithTasks = pRes.projects.find((p) =>
          tRes.tasks.some((t) => t.projectId === p.id),
        );
        setLaunchProjectId((projectWithTasks ?? pRes.projects[0]).id);
      }
      if (!launchAgentId && aRes.agents.length > 0) {
        const mockAgent = aRes.agents.find((a) => a.connectionType === 'mock');
        setLaunchAgentId((mockAgent ?? aRes.agents[0]).id);
      }
    } catch (err) {
      onNotify('error', '実行履歴の取得に失敗しました', err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (id: string) => {
    try {
      const res = await api.getExecutionDetail(id);
      setDetail(res);
    } catch (err) {
      onNotify('error', '実行詳細の取得に失敗しました', err instanceof Error ? err.message : undefined);
      onSelectExecution(null);
    }
  };

  useEffect(() => {
    setFilterAgent(initialAgentFilter);
  }, [initialAgentFilter]);

  useEffect(() => {
    loadList();
  }, [filterProject, filterAgent, filterStatus]);

  useEffect(() => {
    const hasRunning = executions.some(
      (e) => e.status === 'queued' || e.status === 'running',
    );
    if (!hasRunning) return;
    const timer = setInterval(() => loadList(true), 1500);
    return () => clearInterval(timer);
  }, [executions]);

  useEffect(() => {
    if (!selectedExecutionId) {
      setDetail(null);
      return;
    }
    loadDetail(selectedExecutionId);
    const timer = setInterval(() => loadDetail(selectedExecutionId), 1200);
    return () => clearInterval(timer);
  }, [selectedExecutionId]);

  const projectTasks = tasks.filter((t) => t.projectId === launchProjectId);

  useEffect(() => {
    if (projectTasks.length > 0) {
      const currentValid = projectTasks.some((t) => t.id === launchTaskId);
      if (!currentValid) {
        const first = projectTasks[0];
        setLaunchTaskId(first.id);
        setLaunchInstructions(`${first.title}\n${first.description}`.trim());
      }
    } else {
      setLaunchTaskId('');
      setLaunchInstructions('');
    }
  }, [launchProjectId, tasks]);

  const handleTaskSelectChange = (nextTaskId: string) => {
    setLaunchTaskId(nextTaskId);
    const found = tasks.find((t) => t.id === nextTaskId);
    if (found) {
      setLaunchInstructions(`${found.title}\n${found.description}`.trim());
      if (found.assignedAgentId) setLaunchAgentId(found.assignedAgentId);
    }
  };

  const handleStartExecution = async (e: FormEvent) => {
    e.preventDefault();
    setStarting(true);
    try {
      const res = await api.startExecution({
        projectId: launchProjectId,
        taskId: launchTaskId,
        agentId: launchAgentId,
        instructions: launchInstructions,
      });
      onNotify('info', '実行を開始しました', `ID: ${res.execution.id}`);
      setLauncherOpen(false);
      onSelectExecution(res.execution.id);
    } catch (err) {
      onNotify('error', '実行開始に失敗しました', err instanceof Error ? err.message : undefined);
    } finally {
      setStarting(false);
    }
  };

  const handleCancel = async (executionId: string) => {
    try {
      await api.cancelExecution(executionId);
      onNotify('info', '実行をキャンセルしました');
      await loadDetail(executionId);
      await loadList(true);
    } catch (err) {
      onNotify('error', 'キャンセル失敗', err instanceof Error ? err.message : undefined);
    }
  };

  if (selectedExecutionId) {
    if (!detail) {
      return <div className="p-8 text-sm text-[#5b6472]">実行詳細を読み込み中...</div>;
    }

    const ex = detail.execution;
    const isActive = ex.status === 'queued' || ex.status === 'running';

    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => onSelectExecution(null)}
              className="inline-flex items-center gap-1.5 rounded-[3px] border border-[#d2d7e2] bg-[#ffffff] hover:bg-[#f8f9fb] px-3 py-1.5 text-xs text-[#374151] whitespace-nowrap"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              実行一覧
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="font-display text-lg font-semibold text-[#111827] font-mono">
                  {ex.id}
                </h1>
                <ExecutionStatusTag status={ex.status} />
                {ex.isSimulated && (
                  <span className="text-xs text-[#0f766e] border border-[#99f6e4] bg-[#f0fdfa] rounded-[2px] px-2 py-0.5 font-medium whitespace-nowrap">
                    シミュレーション実行 (Mock Adapter)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-[#5b6472] mt-1 flex-wrap">
                {detail.project && (
                  <button
                    type="button"
                    onClick={() => onOpenProject(detail.project!.id)}
                    className="hover:text-[#0f766e] font-medium"
                  >
                    {detail.project.name}
                  </button>
                )}
                <span aria-hidden="true">·</span>
                {detail.task && (
                  <button
                    type="button"
                    onClick={() => onOpenTask(detail.task!.id)}
                    className="hover:text-[#0f766e] font-medium"
                  >
                    {detail.task.title}
                  </button>
                )}
                <span aria-hidden="true">·</span>
                <span>{detail.agent?.name ?? PROVIDER_LABELS[ex.provider]}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isActive && (
              <button
                type="button"
                onClick={() => handleCancel(ex.id)}
                className="inline-flex items-center gap-1.5 rounded-[3px] border border-red-200 bg-red-50 hover:bg-red-100 px-3 py-1.5 text-xs font-medium text-red-700 whitespace-nowrap"
              >
                <Ban className="w-3.5 h-3.5" aria-hidden="true" />
                実行をキャンセル
              </button>
            )}
            <button
              type="button"
              onClick={() => loadDetail(ex.id)}
              className="inline-flex items-center gap-1.5 rounded-[3px] border border-[#d2d7e2] bg-[#ffffff] hover:bg-[#f8f9fb] px-3 py-1.5 text-xs text-[#374151] whitespace-nowrap"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              再読込
            </button>
          </div>
        </div>

        {ex.isSimulated && (
          <div className="rounded-[3px] border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-2.5 text-xs text-amber-900">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
            <p>
              この実行は <strong>Mock Agent Adapter</strong> によるシミュレーションです。ログ・トークン数・コスト・PR参照は検証用の仮想データであり、実際の外部リポジトリ変更や課金は発生していません。
            </p>
          </div>
        )}

        {/* Metadata grid */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="rounded-[3px] border border-[#dfe3ea] bg-[#ffffff] p-3.5">
            <p className="text-[11px] text-[#5b6472]">開始時刻</p>
            <p className="mt-1 text-xs font-mono tabular-nums text-[#111827]">
              {formatDateTime(ex.startedAt)}
            </p>
          </div>
          <div className="rounded-[3px] border border-[#dfe3ea] bg-[#ffffff] p-3.5">
            <p className="text-[11px] text-[#5b6472]">終了時刻</p>
            <p className="mt-1 text-xs font-mono tabular-nums text-[#111827]">
              {formatDateTime(ex.completedAt)}
            </p>
          </div>
          <div className="rounded-[3px] border border-[#dfe3ea] bg-[#ffffff] p-3.5">
            <p className="text-[11px] text-[#5b6472]">所要時間</p>
            <p className="mt-1 text-xs font-mono tabular-nums text-[#111827]">
              {formatDuration(ex.durationMs)}
            </p>
          </div>
          <div className="rounded-[3px] border border-[#dfe3ea] bg-[#ffffff] p-3.5">
            <p className="text-[11px] text-[#5b6472]">
              トークン消費 {ex.isSimulated ? '(仮想)' : ''}
            </p>
            <p className="mt-1 text-xs font-mono tabular-nums text-[#111827]">
              {ex.tokenUsage !== null ? `${ex.tokenUsage.toLocaleString()} tok` : '未報告'}
            </p>
          </div>
          <div className="rounded-[3px] border border-[#dfe3ea] bg-[#ffffff] p-3.5">
            <p className="text-[11px] text-[#5b6472]">
              推定コスト {ex.isSimulated ? '(仮想)' : ''}
            </p>
            <p className="mt-1 text-xs font-mono tabular-nums text-[#111827]">
              {ex.costReported && ex.estimatedCostUsd !== null
                ? `$${ex.estimatedCostUsd.toFixed(4)}`
                : '未報告'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-5 space-y-4">
            <section className="rounded-[3px] border border-[#dfe3ea] bg-[#ffffff] p-4">
              <h2 className="text-xs font-medium text-[#5b6472] mb-2">実行指示 (Input)</h2>
              <p className="text-xs text-[#111827] whitespace-pre-wrap leading-relaxed">
                {ex.input}
              </p>
            </section>

            {ex.output && (
              <section className="rounded-[3px] border border-emerald-200 bg-emerald-50 p-4">
                <h2 className="text-xs font-semibold text-emerald-800 mb-2">実行結果サマリー</h2>
                <p className="text-xs text-emerald-950 whitespace-pre-wrap leading-relaxed">
                  {ex.output}
                </p>
                {ex.pullRequestUrl && (
                  <a
                    href={ex.pullRequestUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-mono text-[#0f766e] hover:text-[#0d645d] hover:underline break-all"
                  >
                    {ex.pullRequestUrl}
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                )}
              </section>
            )}

            {ex.error && (
              <section className="rounded-[3px] border border-red-200 bg-red-50 p-4">
                <h2 className="text-xs font-semibold text-red-800 mb-2">エラー詳細</h2>
                <p className="text-xs text-red-700 font-mono whitespace-pre-wrap">
                  {ex.error}
                </p>
              </section>
            )}
          </div>

          <section className="lg:col-span-7 rounded-[3px] border border-[#dfe3ea] bg-[#ffffff] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#dfe3ea] bg-[#f8f9fb] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-[#0f766e]" aria-hidden="true" />
                <h2 className="font-display text-sm font-medium text-[#111827]">時系列実行ログ</h2>
              </div>
              <span className="text-[11px] font-mono tabular-nums text-[#5b6472]">
                {ex.logs.length} 行
              </span>
            </div>
            <div className="p-4 space-y-2.5 font-mono text-xs max-h-[460px] overflow-y-auto bg-[#f8f9fb]">
              {ex.logs.map((log) => {
                const levelColor =
                  log.level === 'error'
                    ? 'text-red-700'
                    : log.level === 'warn'
                      ? 'text-amber-700'
                      : log.level === 'success'
                        ? 'text-emerald-700'
                        : 'text-sky-700';
                return (
                  <div key={log.id} className="flex items-start gap-2.5 leading-relaxed">
                    <span className="text-[11px] text-[#64748b] tabular-nums shrink-0">
                      {formatDateTime(log.timestamp)}
                    </span>
                    <span className={`text-[11px] font-semibold shrink-0 ${levelColor}`}>
                      [{log.phase}]
                    </span>
                    <span className="text-[#111827] break-words">{log.message}</span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-[#111827]">
            エージェント実行管理
          </h1>
          <p className="text-xs text-[#5b6472] mt-1">
            プロジェクト・タスク・エージェントを選択して実行を開始し、ログと結果を追跡します
          </p>
        </div>
        <button
          type="button"
          disabled={projects.length === 0 || tasks.length === 0 || agents.length === 0}
          onClick={() => setLauncherOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-[3px] bg-[#0f766e] hover:bg-[#0d645d] disabled:opacity-50 px-3.5 py-2 text-xs font-semibold text-[#ffffff] whitespace-nowrap"
        >
          <Play className="w-4 h-4" aria-hidden="true" />
          実行を新規作成
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          aria-label="プロジェクトで絞り込み"
          value={filterProject}
          onChange={(e) => setFilterProject(e.target.value)}
          className="rounded-[3px] border border-[#d2d7e2] bg-[#ffffff] px-3 py-1.5 text-xs text-[#374151] focus:border-[#0f766e] focus:outline-none"
        >
          <option value="">すべてのプロジェクト</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          aria-label="エージェントで絞り込み"
          value={filterAgent}
          onChange={(e) => setFilterAgent(e.target.value)}
          className="rounded-[3px] border border-[#d2d7e2] bg-[#ffffff] px-3 py-1.5 text-xs text-[#374151] focus:border-[#0f766e] focus:outline-none"
        >
          <option value="">すべてのエージェント</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <select
          aria-label="ステータスで絞り込み"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-[3px] border border-[#d2d7e2] bg-[#ffffff] px-3 py-1.5 text-xs text-[#374151] focus:border-[#0f766e] focus:outline-none"
        >
          <option value="">すべてのステータス</option>
          {(['queued', 'running', 'completed', 'failed', 'cancelled'] as const).map((s) => (
            <option key={s} value={s}>
              {EXECUTION_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="rounded-[3px] border border-[#dfe3ea] bg-[#ffffff] p-8 text-center text-xs text-[#64748b]">
          読み込み中...
        </div>
      ) : executions.length === 0 ? (
        <div className="rounded-[3px] border border-[#dfe3ea] bg-[#ffffff] p-12 text-center">
          <Terminal className="w-8 h-8 text-[#94a3b8] mx-auto mb-3" aria-hidden="true" />
          <p className="text-sm font-medium text-[#111827]">実行履歴がまだありません</p>
          <p className="text-xs text-[#64748b] mt-1">
            プロジェクト・タスク・エージェントが揃っていればすぐに実行を開始できます。
          </p>
          {projects.length > 0 && tasks.length > 0 && agents.length > 0 && (
            <button
              type="button"
              onClick={() => setLauncherOpen(true)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-[3px] bg-[#0f766e] hover:bg-[#0d645d] px-3.5 py-2 text-xs font-semibold text-[#ffffff]"
            >
              <Play className="w-4 h-4" aria-hidden="true" />
              最初の実行を開始
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-[3px] border border-[#dfe3ea] bg-[#ffffff] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#dfe3ea] bg-[#f8f9fb] text-[11px] text-[#5b6472]">
                  <th className="py-2.5 px-4 font-medium">タスク / 実行ID</th>
                  <th className="py-2.5 px-4 font-medium">プロジェクト</th>
                  <th className="py-2.5 px-4 font-medium">エージェント</th>
                  <th className="py-2.5 px-4 font-medium">ステータス</th>
                  <th className="py-2.5 px-4 font-medium">開始時刻</th>
                  <th className="py-2.5 px-4 font-medium text-right">所要時間</th>
                  <th className="py-2.5 px-4 font-medium text-right">推定コスト</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eef0f4] text-xs">
                {executions.map((exec) => (
                  <tr
                    key={exec.id}
                    onClick={() => onSelectExecution(exec.id)}
                    className="hover:bg-[#f8fafc] transition-colors cursor-pointer"
                  >
                    <td className="py-2.5 px-4 max-w-[260px]">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectExecution(exec.id);
                        }}
                        className="font-medium text-[#111827] hover:text-[#0f766e] text-left truncate block max-w-full"
                      >
                        {exec.taskTitle}
                      </button>
                      <span className="text-[11px] font-mono text-[#64748b]">{exec.id}</span>
                    </td>
                    <td className="py-2.5 px-4 text-[#374151] whitespace-nowrap">
                      {exec.projectName}
                    </td>
                    <td className="py-2.5 px-4 text-[#374151] whitespace-nowrap">
                      <span>{exec.agentName}</span>
                      {exec.isSimulated && (
                        <span className="ml-1.5 font-mono text-[10px] text-[#0f766e] font-medium">
                          SIM
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <ExecutionStatusTag status={exec.status} />
                    </td>
                    <td className="py-2.5 px-4 text-[#5b6472] font-mono tabular-nums whitespace-nowrap">
                      {formatDateTime(exec.startedAt)}
                    </td>
                    <td className="py-2.5 px-4 text-right text-[#374151] font-mono tabular-nums whitespace-nowrap">
                      {formatDuration(exec.durationMs)}
                    </td>
                    <td className="py-2.5 px-4 text-right text-[#374151] font-mono tabular-nums whitespace-nowrap">
                      {exec.costReported && exec.estimatedCostUsd !== null
                        ? `$${exec.estimatedCostUsd.toFixed(4)}`
                        : '未報告'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Unified Execution Launcher Modal */}
      {launcherOpen && (
        <div
          className="fixed inset-0 z-50 bg-[#0f172a]/40 backdrop-blur-[1px] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="launcher-modal-title"
        >
          <div className="w-full max-w-lg rounded-[3px] border border-[#dfe3ea] bg-[#ffffff] p-6 shadow-lg">
            <h2 id="launcher-modal-title" className="font-display text-base font-semibold text-[#111827]">
              エージェント実行を開始
            </h2>
            <form onSubmit={handleStartExecution} className="mt-4 space-y-4">
              <div>
                <label htmlFor="launch-proj" className="block text-xs text-[#5b6472] mb-1">
                  1. プロジェクトを選択 *
                </label>
                <select
                  id="launch-proj"
                  required
                  value={launchProjectId}
                  onChange={(e) => setLaunchProjectId(e.target.value)}
                  className="w-full rounded-[3px] border border-[#d2d7e2] bg-[#f8f9fb] px-3 py-2 text-sm text-[#111827] focus:border-[#0f766e] focus:bg-[#ffffff] focus:outline-none"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="launch-task" className="block text-xs text-[#5b6472] mb-1">
                  2. タスクを選択 *
                </label>
                <select
                  id="launch-task"
                  required
                  value={launchTaskId}
                  onChange={(e) => handleTaskSelectChange(e.target.value)}
                  className="w-full rounded-[3px] border border-[#d2d7e2] bg-[#f8f9fb] px-3 py-2 text-sm text-[#111827] focus:border-[#0f766e] focus:bg-[#ffffff] focus:outline-none"
                >
                  {projectTasks.length === 0 ? (
                    <option value="">このプロジェクトにタスクがありません</option>
                  ) : (
                    projectTasks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))
                  )}
                </select>
              </div>
              <div>
                <label htmlFor="launch-agent" className="block text-xs text-[#5b6472] mb-1">
                  3. エージェントを選択 *
                </label>
                <select
                  id="launch-agent"
                  required
                  value={launchAgentId}
                  onChange={(e) => setLaunchAgentId(e.target.value)}
                  className="w-full rounded-[3px] border border-[#d2d7e2] bg-[#f8f9fb] px-3 py-2 text-sm text-[#111827] focus:border-[#0f766e] focus:bg-[#ffffff] focus:outline-none"
                >
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.connectionType === 'mock' ? 'Mock シミュレーション' : '外部接続・要ランタイム'})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="launch-inst" className="block text-xs text-[#5b6472] mb-1">
                  4. 実行指示を確認・編集 *
                </label>
                <textarea
                  id="launch-inst"
                  required
                  rows={3}
                  value={launchInstructions}
                  onChange={(e) => setLaunchInstructions(e.target.value)}
                  className="w-full rounded-[3px] border border-[#d2d7e2] bg-[#f8f9fb] px-3 py-2 text-xs text-[#111827] focus:border-[#0f766e] focus:bg-[#ffffff] focus:outline-none"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setLauncherOpen(false)}
                  className="rounded-[3px] border border-[#d2d7e2] bg-[#ffffff] px-3.5 py-2 text-xs text-[#374151] hover:bg-[#f8f9fb]"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={starting || !launchTaskId || !launchAgentId}
                  className="inline-flex items-center gap-1.5 rounded-[3px] bg-[#0f766e] hover:bg-[#0d645d] disabled:opacity-50 px-4 py-2 text-xs font-semibold text-[#ffffff]"
                >
                  <Play className="w-3.5 h-3.5" aria-hidden="true" />
                  実行開始
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
