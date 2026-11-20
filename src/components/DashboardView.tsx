import { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  Cpu,
  ExternalLink,
  FolderGit2,
  GitPullRequest,
  Play,
  RefreshCw,
} from 'lucide-react';
import { api, type DashboardResponse } from '../lib/api.ts';
import {
  formatDateTime,
  formatDuration,
  formatRelativeTime,
  PROVIDER_LABELS,
} from '../lib/labels.ts';
import {
  ConnectionStatusTag,
  ExecutionStatusTag,
  PullRequestStatusTag,
} from './StatusBadge.tsx';
import type { NavRoute } from './Sidebar.tsx';

interface DashboardViewProps {
  onNavigate: (route: NavRoute) => void;
  onOpenProject: (projectId: string) => void;
  onOpenTask: (taskId: string) => void;
  onOpenExecution: (executionId: string) => void;
  onError: (msg: string) => void;
}

export function DashboardView({
  onNavigate,
  onOpenProject,
  onOpenTask,
  onOpenExecution,
  onError,
}: DashboardViewProps) {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.getDashboard();
      setData(res);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'ダッシュボードの読み込みに失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const timer = setInterval(() => load(true), 3000);
    return () => clearInterval(timer);
  }, []);

  if (loading && !data) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-56 bg-[#e5e7eb] rounded-[2px]" />
        <div className="h-24 bg-[#ffffff] rounded-[3px] border border-[#dfe3ea]" />
        <div className="h-64 bg-[#ffffff] rounded-[3px] border border-[#dfe3ea]" />
      </div>
    );
  }

  const metrics = data?.metrics;

  const kpiCells = [
    {
      code: 'PRJ',
      label: 'プロジェクト総数',
      value: metrics?.totalProjects ?? 0,
      sub: `稼働中 ${metrics?.activeProjects ?? 0}`,
      onClick: () => onNavigate('projects'),
    },
    {
      code: 'AGT',
      label: '接続エージェント',
      value: metrics?.activeAgents ?? 0,
      sub: `登録数 ${metrics?.totalAgents ?? 0}`,
      onClick: () => onNavigate('agents'),
    },
    {
      code: 'RUN',
      label: '実行中のジョブ',
      value: metrics?.runningExecutions ?? 0,
      sub: 'キュー・実行中',
      highlight: (metrics?.runningExecutions ?? 0) > 0,
      onClick: () => onNavigate('executions'),
    },
    {
      code: 'OPN',
      label: '未完了タスク',
      value: metrics?.openTasks ?? 0,
      sub: '対応待ち・レビュー',
      onClick: () => onNavigate('tasks'),
    },
    {
      code: 'CMP',
      label: '完了タスク',
      value: metrics?.completedTasks ?? 0,
      sub: 'クローズ済み',
      onClick: () => onNavigate('tasks'),
    },
    {
      code: 'PRS',
      label: '未処理のPR',
      value: metrics?.pendingPullRequests ?? 0,
      sub: 'Open / Draft',
      onClick: () => onNavigate('tasks'),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-[#111827]">
            ダッシュボード
          </h1>
          <p className="text-xs text-[#5b6472] mt-1">
            プロジェクト・エージェント稼働・タスク実行状況のリアルタイム統合ビュー
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => load()}
            className="inline-flex items-center gap-1.5 rounded-[3px] border border-[#d2d7e2] bg-[#ffffff] hover:bg-[#f8f9fb] px-3 py-1.5 text-xs font-medium text-[#374151] whitespace-nowrap"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            更新
          </button>
          <button
            type="button"
            onClick={() => onNavigate('executions')}
            className="inline-flex items-center gap-1.5 rounded-[3px] bg-[#0f766e] hover:bg-[#0d645d] px-3.5 py-1.5 text-xs font-semibold text-[#ffffff] whitespace-nowrap"
          >
            <Play className="w-3.5 h-3.5" aria-hidden="true" />
            新規実行を開始
          </button>
        </div>
      </div>

      {/* Unified Architectural Telemetry Ledger Strip */}
      <section
        aria-label="主要メトリクス"
        className="rounded-[3px] border border-[#dfe3ea] bg-[#ffffff] grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 divide-y sm:divide-y-0 sm:divide-x divide-[#dfe3ea] overflow-hidden"
      >
        {kpiCells.map((kpi) => (
          <button
            key={kpi.label}
            type="button"
            onClick={kpi.onClick}
            className="text-left p-4 hover:bg-[#f8fafc] transition-colors flex flex-col justify-between"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-[#5b6472] truncate">{kpi.label}</span>
              <span className="text-[10px] font-mono text-[#94a3b8] shrink-0">{kpi.code}</span>
            </div>
            <p
              className={`mt-2.5 text-2xl sm:text-[28px] font-semibold font-mono tabular-nums tracking-tight ${
                kpi.highlight ? 'text-[#0f766e]' : 'text-[#111827]'
              }`}
            >
              {kpi.value}
            </p>
            <p className="mt-1 text-[11px] text-[#64748b] truncate">{kpi.sub}</p>
          </button>
        ))}
      </section>

      {/* Agent Activity */}
      <section className="rounded-[3px] border border-[#dfe3ea] bg-[#ffffff] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#dfe3ea] bg-[#f8f9fb] flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-[#0f766e]" aria-hidden="true" />
            <h2 className="font-display text-sm font-medium text-[#111827]">
              エージェント稼働状況
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('agents')}
            className="text-xs text-[#0f766e] hover:text-[#0d645d] font-medium inline-flex items-center gap-1 whitespace-nowrap"
          >
            すべて管理
            <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>

        {!data || data.agentActivities.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-[#5b6472]">登録されたエージェントがありません。</p>
            <button
              type="button"
              onClick={() => onNavigate('agents')}
              className="mt-3 inline-flex items-center gap-1.5 rounded-[3px] border border-[#d2d7e2] bg-[#f8f9fb] hover:bg-[#f1f5f9] px-3 py-1.5 text-xs font-medium text-[#111827]"
            >
              エージェントを登録
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#dfe3ea] text-[11px] text-[#5b6472]">
                  <th className="py-2.5 px-4 font-medium">エージェント名</th>
                  <th className="py-2.5 px-4 font-medium">プロバイダー</th>
                  <th className="py-2.5 px-4 font-medium">現在のタスク</th>
                  <th className="py-2.5 px-4 font-medium">関連プロジェクト</th>
                  <th className="py-2.5 px-4 font-medium">接続 / 実行状態</th>
                  <th className="py-2.5 px-4 font-medium text-right">最終アクティビティ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eef0f4] text-xs">
                {data.agentActivities.map((row) => (
                  <tr key={row.agentId} className="hover:bg-[#f8fafc] transition-colors">
                    <td className="py-2.5 px-4 font-medium text-[#111827] whitespace-nowrap">
                      <span>{row.agentName}</span>
                      {row.connectionType === 'mock' && (
                        <span className="ml-2 font-mono text-[10px] text-[#0f766e] font-medium">MOCK</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-[#374151] whitespace-nowrap">
                      {PROVIDER_LABELS[row.provider]}
                    </td>
                    <td className="py-2.5 px-4 text-[#374151] max-w-[220px] truncate">
                      {row.currentTaskId && row.currentTaskTitle ? (
                        <button
                          type="button"
                          onClick={() => onOpenTask(row.currentTaskId!)}
                          className="hover:text-[#0f766e] text-left truncate max-w-full"
                        >
                          {row.currentTaskTitle}
                        </button>
                      ) : (
                        <span className="text-[#94a3b8]">待機中</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-[#374151] whitespace-nowrap">
                      {row.projectId && row.projectName ? (
                        <button
                          type="button"
                          onClick={() => onOpenProject(row.projectId!)}
                          className="hover:text-[#0f766e]"
                        >
                          {row.projectName}
                        </button>
                      ) : (
                        <span className="text-[#94a3b8]">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <ConnectionStatusTag status={row.connectionStatus} />
                        {row.executionStatus && (
                          <ExecutionStatusTag status={row.executionStatus} />
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-right text-[#5b6472] font-mono tabular-nums whitespace-nowrap">
                      {formatRelativeTime(row.lastActivityAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        {/* Recent Executions */}
        <section className="xl:col-span-7 rounded-[3px] border border-[#dfe3ea] bg-[#ffffff] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#dfe3ea] bg-[#f8f9fb] flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Play className="w-4 h-4 text-[#0f766e]" aria-hidden="true" />
              <h2 className="font-display text-sm font-medium text-[#111827]">
                最近の実行履歴
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('executions')}
              className="text-xs text-[#0f766e] hover:text-[#0d645d] font-medium inline-flex items-center gap-1 whitespace-nowrap"
            >
              すべて表示
              <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>

          {!data || data.recentExecutions.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-[#5b6472]">実行履歴がまだありません。</p>
              <button
                type="button"
                onClick={() => onNavigate('executions')}
                className="mt-3 inline-flex items-center gap-1.5 rounded-[3px] border border-[#d2d7e2] bg-[#f8f9fb] hover:bg-[#f1f5f9] px-3 py-1.5 text-xs font-medium text-[#111827]"
              >
                最初の実行を開始
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#dfe3ea] text-[11px] text-[#5b6472]">
                    <th className="py-2 px-4 font-medium">タスク / プロジェクト</th>
                    <th className="py-2 px-4 font-medium">エージェント</th>
                    <th className="py-2 px-4 font-medium">ステータス</th>
                    <th className="py-2 px-4 font-medium text-right">所要時間</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eef0f4] text-xs">
                  {data.recentExecutions.map((exec) => (
                    <tr
                      key={exec.id}
                      className="hover:bg-[#f8fafc] transition-colors cursor-pointer"
                      onClick={() => onOpenExecution(exec.id)}
                    >
                      <td className="py-2.5 px-4 max-w-[260px]">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenExecution(exec.id);
                          }}
                          className="font-medium text-[#111827] hover:text-[#0f766e] text-left truncate block w-full"
                        >
                          {exec.taskTitle}
                        </button>
                        <div className="flex items-center gap-1.5 text-[11px] text-[#64748b] mt-0.5 min-w-0">
                          <span className="truncate">{exec.projectName}</span>
                          <span aria-hidden="true" className="shrink-0">
                            ·
                          </span>
                          <span className="font-mono tabular-nums whitespace-nowrap shrink-0">
                            {formatDateTime(exec.startedAt)}
                          </span>
                        </div>
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
                      <td className="py-2.5 px-4 text-right text-[#5b6472] font-mono tabular-nums whitespace-nowrap">
                        {formatDuration(exec.durationMs)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Recent Pull Requests */}
        <section className="xl:col-span-5 rounded-[3px] border border-[#dfe3ea] bg-[#ffffff] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#dfe3ea] bg-[#f8f9fb] flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <GitPullRequest className="w-4 h-4 text-[#0f766e]" aria-hidden="true" />
              <h2 className="font-display text-sm font-medium text-[#111827]">
                関連 Pull Requests
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('tasks')}
              className="text-xs text-[#0f766e] hover:text-[#0d645d] font-medium inline-flex items-center gap-1 whitespace-nowrap"
            >
              タスク一覧
              <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>

          {!data || data.recentPullRequests.length === 0 ? (
            <div className="p-8 text-center">
              <FolderGit2 className="w-6 h-6 text-[#94a3b8] mx-auto mb-2" aria-hidden="true" />
              <p className="text-sm text-[#5b6472]">関連付けられた GitHub PR はありません。</p>
              <p className="text-xs text-[#64748b] mt-1">
                タスク詳細画面から GitHub Pull Request URL を登録できます。
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#eef0f4]">
              {data.recentPullRequests.map((item) => (
                <div
                  key={item.taskId}
                  className="px-4 py-3 flex items-start justify-between gap-3 hover:bg-[#f8fafc]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onOpenTask(item.taskId)}
                        className="text-xs font-medium text-[#111827] hover:text-[#0f766e] truncate text-left"
                      >
                        {item.pullRequest.title}
                      </button>
                      {item.pullRequest.isSimulated && (
                        <span className="font-mono text-[10px] text-[#0f766e] font-medium shrink-0">
                          SIM
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-[#64748b] mt-1">
                      <span className="font-mono truncate">{item.pullRequest.repository}</span>
                      <span aria-hidden="true">·</span>
                      <span className="truncate">{item.projectName}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <PullRequestStatusTag status={item.pullRequest.status} />
                    <a
                      href={item.pullRequest.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`GitHub PR ${item.pullRequest.title} を開く`}
                      className="p-1 rounded-[2px] text-[#5b6472] hover:text-[#111827] hover:bg-[#eef0f4]"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
