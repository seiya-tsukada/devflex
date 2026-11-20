import { useEffect, useState } from 'react';
import { Activity, BarChart3 } from 'lucide-react';
import { api } from '../lib/api.ts';
import {
  ACTIVITY_EVENT_LABELS,
  formatDateTime,
  formatDuration,
  PROVIDER_LABELS,
} from '../lib/labels.ts';
import type {
  ActivityEventType,
  ActivityLog,
  Agent,
  AnalyticsSummary,
  Project,
} from '../shared/types.ts';

interface AnalyticsViewProps {
  onError: (msg: string) => void;
}

export function AnalyticsView({ onError }: AnalyticsViewProps) {
  const [tab, setTab] = useState<'analytics' | 'activity'>('analytics');
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [projectId, setProjectId] = useState('');
  const [agentId, setAgentId] = useState('');
  const [eventType, setEventType] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [aRes, actRes, pRes, agRes] = await Promise.all([
        api.getAnalytics({
          from: fromDate || undefined,
          to: toDate || undefined,
          projectId: projectId || undefined,
        }),
        api.getActivityLogs({
          projectId: projectId || undefined,
          agentId: agentId || undefined,
          eventType: eventType || undefined,
          from: fromDate || undefined,
          to: toDate || undefined,
        }),
        api.getProjects(),
        api.getAgents(),
      ]);
      setSummary(aRes.summary);
      setLogs(actRes.logs);
      setProjects(pRes.projects);
      setAgents(agRes.agents);
    } catch (err) {
      onError(err instanceof Error ? err.message : '分析データの取得に失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [fromDate, toDate, projectId, agentId, eventType]);

  const maxDailyTotal = Math.max(
    1,
    ...(summary?.executionsOverTime.map((d) => d.total) ?? [1]),
  );
  const maxAgentCount = Math.max(
    1,
    ...(summary?.agentUsageDistribution.map((a) => a.count) ?? [1]),
  );
  const maxCost = Math.max(
    0.0001,
    ...(summary?.agentUsageDistribution.map((a) => a.estimatedCostUsd ?? 0) ?? [0.0001]),
  );

  const finishedTotal =
    (summary?.successfulExecutions ?? 0) + (summary?.failedExecutions ?? 0);
  const successRatio =
    finishedTotal > 0 ? ((summary?.successfulExecutions ?? 0) / finishedTotal) * 100 : 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-[#111827]">
            分析・アクティビティログ
          </h1>
          <p className="text-xs text-[#5b6472] mt-1">
            実行成功率・平均処理時間・コスト集計および全操作監査ログを確認します
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-[3px] border border-[#dfe3ea] bg-[#ffffff]">
          <button
            type="button"
            onClick={() => setTab('analytics')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[2px] text-xs font-medium whitespace-nowrap transition-colors ${
              tab === 'analytics'
                ? 'bg-[#f0fdfa] text-[#0f766e] border border-[#99f6e4]'
                : 'text-[#5b6472] hover:text-[#111827] border border-transparent'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" aria-hidden="true" />
            パフォーマンス分析
          </button>
          <button
            type="button"
            onClick={() => setTab('activity')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[2px] text-xs font-medium whitespace-nowrap transition-colors ${
              tab === 'activity'
                ? 'bg-[#f0fdfa] text-[#0f766e] border border-[#99f6e4]'
                : 'text-[#5b6472] hover:text-[#111827] border border-transparent'
            }`}
          >
            <Activity className="w-3.5 h-3.5" aria-hidden="true" />
            アクティビティログ ({logs.length})
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-xs text-[#5b6472]">
          <label htmlFor="an-from">開始日</label>
          <input
            id="an-from"
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="rounded-[3px] border border-[#d2d7e2] bg-[#ffffff] px-2.5 py-1.5 text-xs text-[#111827] font-mono focus:border-[#0f766e] focus:outline-none"
          />
          <label htmlFor="an-to">終了日</label>
          <input
            id="an-to"
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="rounded-[3px] border border-[#d2d7e2] bg-[#ffffff] px-2.5 py-1.5 text-xs text-[#111827] font-mono focus:border-[#0f766e] focus:outline-none"
          />
        </div>
        <select
          aria-label="プロジェクトで絞り込み"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="rounded-[3px] border border-[#d2d7e2] bg-[#ffffff] px-3 py-1.5 text-xs text-[#374151] focus:border-[#0f766e] focus:outline-none"
        >
          <option value="">すべてのプロジェクト</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {tab === 'activity' && (
          <>
            <select
              aria-label="エージェントで絞り込み"
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
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
              aria-label="イベント種別で絞り込み"
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              className="rounded-[3px] border border-[#d2d7e2] bg-[#ffffff] px-3 py-1.5 text-xs text-[#374151] focus:border-[#0f766e] focus:outline-none"
            >
              <option value="">すべてのイベント</option>
              {(Object.keys(ACTIVITY_EVENT_LABELS) as ActivityEventType[]).map((ev) => (
                <option key={ev} value={ev}>
                  {ACTIVITY_EVENT_LABELS[ev]}
                </option>
              ))}
            </select>
          </>
        )}
      </div>

      {loading && !summary ? (
        <div className="rounded-[3px] border border-[#dfe3ea] bg-[#ffffff] p-8 text-center text-xs text-[#64748b]">
          読み込み中...
        </div>
      ) : tab === 'analytics' ? (
        !summary || summary.totalExecutions === 0 ? (
          <div className="rounded-[3px] border border-[#dfe3ea] bg-[#ffffff] p-12 text-center">
            <BarChart3 className="w-8 h-8 text-[#94a3b8] mx-auto mb-3" aria-hidden="true" />
            <p className="text-sm font-medium text-[#111827]">
              対象期間の実行データがありません
            </p>
            <p className="text-xs text-[#64748b] mt-1">
              タスクを実行すると成功率、所要時間、エージェント分布グラフが集計されます。
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary KPIs Ledger */}
            <div className="rounded-[3px] border border-[#dfe3ea] bg-[#ffffff] grid grid-cols-2 lg:grid-cols-5 divide-y lg:divide-y-0 lg:divide-x divide-[#dfe3ea] overflow-hidden">
              <div className="p-4">
                <p className="text-xs text-[#5b6472]">総実行数</p>
                <p className="mt-2 text-2xl font-semibold text-[#111827] font-mono tabular-nums">
                  {summary.totalExecutions}
                </p>
              </div>
              <div className="p-4">
                <p className="text-xs text-[#5b6472]">成功 / 失敗</p>
                <p className="mt-2 text-2xl font-semibold text-[#111827] font-mono tabular-nums">
                  <span className="text-emerald-700">{summary.successfulExecutions}</span>
                  <span className="text-[#94a3b8] mx-1">/</span>
                  <span className="text-red-700">{summary.failedExecutions}</span>
                </p>
              </div>
              <div className="p-4">
                <p className="text-xs text-[#5b6472]">実行成功率</p>
                <p className="mt-2 text-2xl font-semibold text-[#111827] font-mono tabular-nums">
                  {summary.successRatePercent !== null
                    ? `${summary.successRatePercent}%`
                    : '—'}
                </p>
              </div>
              <div className="p-4">
                <p className="text-xs text-[#5b6472]">平均所要時間</p>
                <p className="mt-2 text-2xl font-semibold text-[#111827] font-mono tabular-nums">
                  {formatDuration(summary.averageDurationMs)}
                </p>
              </div>
              <div className="p-4">
                <p className="text-xs text-[#5b6472]">推定AIコスト</p>
                <p className="mt-2 text-xl font-semibold text-[#111827] font-mono tabular-nums">
                  {summary.totalReportedCostUsd !== null
                    ? `$${summary.totalReportedCostUsd.toFixed(4)}`
                    : summary.totalSimulatedCostUsd !== null
                      ? `$${summary.totalSimulatedCostUsd.toFixed(4)}`
                      : '未報告'}
                </p>
                <p className="text-[11px] text-[#0f766e] font-medium mt-0.5">
                  {summary.totalReportedCostUsd === null && summary.totalSimulatedCostUsd !== null
                    ? 'シミュレーション値 (実課金なし)'
                    : summary.totalReportedCostUsd === null
                      ? 'Unavailable'
                      : '実プロバイダー報告値'}
                </p>
              </div>
            </div>

            {/* 4 Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Chart 1: Executions Over Time */}
              <section className="rounded-[3px] border border-[#dfe3ea] bg-[#ffffff] p-4">
                <h2 className="font-display text-sm font-medium text-[#111827] mb-4">
                  日別実行数の推移
                </h2>
                <div className="space-y-2.5">
                  {summary.executionsOverTime.map((row) => (
                    <div key={row.date} className="space-y-1">
                      <div className="flex justify-between text-xs font-mono tabular-nums">
                        <span className="text-[#5b6472]">{row.date}</span>
                        <span className="text-[#111827]">
                          計 {row.total} (成功 {row.completed} / 失敗 {row.failed})
                        </span>
                      </div>
                      <div className="h-2.5 w-full rounded-[2px] bg-[#eef0f4] overflow-hidden flex">
                        <div
                          className="bg-emerald-600 h-full"
                          style={{ width: `${(row.completed / maxDailyTotal) * 100}%` }}
                        />
                        <div
                          className="bg-red-500 h-full"
                          style={{ width: `${(row.failed / maxDailyTotal) * 100}%` }}
                        />
                        <div
                          className="bg-[#94a3b8] h-full"
                          style={{ width: `${(row.cancelled / maxDailyTotal) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Chart 2: Success vs Failure + Project Distribution */}
              <section className="rounded-[3px] border border-[#dfe3ea] bg-[#ffffff] p-4 space-y-5">
                <div>
                  <h2 className="font-display text-sm font-medium text-[#111827] mb-3">
                    成功 vs 失敗の比率
                  </h2>
                  <div className="h-4 w-full rounded-[2px] bg-[#eef0f4] overflow-hidden flex">
                    <div
                      className="bg-emerald-600 h-full transition-all"
                      style={{ width: `${successRatio}%` }}
                    />
                    <div
                      className="bg-red-500 h-full transition-all"
                      style={{ width: `${finishedTotal > 0 ? 100 - successRatio : 0}%` }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs font-mono tabular-nums text-[#5b6472]">
                    <span>成功: {summary.successfulExecutions}</span>
                    <span>失敗: {summary.failedExecutions}</span>
                    <span>キャンセル: {summary.cancelledExecutions}</span>
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-medium text-[#374151] mb-2.5">
                    プロジェクト別アクティビティ分布
                  </h3>
                  <div className="space-y-2">
                    {summary.projectActivityDistribution.map((p) => (
                      <div key={p.projectId} className="flex items-center justify-between text-xs">
                        <span className="text-[#111827] truncate max-w-[60%]">{p.projectName}</span>
                        <span className="font-mono tabular-nums text-[#5b6472]">
                          {p.executionCount} 実行 · {p.taskCount} タスク
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {/* Chart 3: Agent Usage Distribution */}
              <section className="rounded-[3px] border border-[#dfe3ea] bg-[#ffffff] p-4">
                <h2 className="font-display text-sm font-medium text-[#111827] mb-4">
                  エージェント利用分布
                </h2>
                <div className="space-y-3">
                  {summary.agentUsageDistribution.map((item) => (
                    <div key={item.agentId} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-[#111827] truncate">
                          {item.agentName}{' '}
                          <span className="text-[#64748b]">({PROVIDER_LABELS[item.provider]})</span>
                        </span>
                        <span className="font-mono tabular-nums text-[#374151]">
                          {item.count} 回
                        </span>
                      </div>
                      <div className="h-2.5 w-full rounded-[2px] bg-[#eef0f4] overflow-hidden">
                        <div
                          className="bg-[#0f766e] h-full rounded-[2px]"
                          style={{ width: `${(item.count / maxAgentCount) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Chart 4: Estimated Costs by Agent */}
              <section className="rounded-[3px] border border-[#dfe3ea] bg-[#ffffff] p-4">
                <h2 className="font-display text-sm font-medium text-[#111827] mb-4">
                  エージェント別推定コスト (USD)
                </h2>
                <div className="space-y-3">
                  {summary.agentUsageDistribution.map((item) => (
                    <div key={item.agentId} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-[#111827] truncate">
                          {item.agentName}
                          {item.isSimulatedOnly && (
                            <span className="ml-1.5 text-[10px] font-mono font-medium text-amber-700">
                              Sim
                            </span>
                          )}
                        </span>
                        <span className="font-mono tabular-nums text-[#374151]">
                          {item.estimatedCostUsd !== null
                            ? `$${item.estimatedCostUsd.toFixed(4)}`
                            : '未報告 (Unavailable)'}
                        </span>
                      </div>
                      <div className="h-2.5 w-full rounded-[2px] bg-[#eef0f4] overflow-hidden">
                        <div
                          className="bg-amber-600 h-full rounded-[2px]"
                          style={{
                            width: `${((item.estimatedCostUsd ?? 0) / maxCost) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        )
      ) : (
        <div className="rounded-[3px] border border-[#dfe3ea] bg-[#ffffff] overflow-hidden">
          {logs.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#64748b]">
              条件に一致するアクティビティ履歴はありません。
            </div>
          ) : (
            <div className="divide-y divide-[#eef0f4]">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs hover:bg-[#f8fafc]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[#111827]">{log.description}</p>
                    <p className="text-[11px] text-[#64748b] mt-0.5">
                      {ACTIVITY_EVENT_LABELS[log.eventType]}
                    </p>
                  </div>
                  <span className="text-[11px] font-mono tabular-nums text-[#5b6472] shrink-0">
                    {formatDateTime(log.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
