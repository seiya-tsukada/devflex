import type {
  AgentProvider,
  AnalyticsSummary,
  DashboardMetrics,
  Execution,
  ExecutionStatus,
  Project,
  Task,
  TaskStatus,
} from './types.ts';

export const TASK_STATUS_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  backlog: ['ready', 'queued', 'cancelled'],
  ready: ['backlog', 'queued', 'running', 'review', 'cancelled'],
  queued: ['running', 'ready', 'cancelled', 'failed'],
  running: ['review', 'completed', 'failed', 'cancelled'],
  review: ['completed', 'ready', 'failed', 'cancelled'],
  completed: ['ready', 'review'],
  failed: ['ready', 'queued', 'backlog', 'cancelled'],
  cancelled: ['backlog', 'ready'],
};

export function canTransitionTaskStatus(from: TaskStatus, to: TaskStatus): boolean {
  if (from === to) return true;
  const allowed = TASK_STATUS_TRANSITIONS[from];
  return Array.isArray(allowed) && allowed.includes(to);
}

export const EXECUTION_STATUS_TRANSITIONS: Record<ExecutionStatus, ExecutionStatus[]> = {
  queued: ['running', 'cancelled', 'failed'],
  running: ['completed', 'failed', 'cancelled'],
  completed: [],
  failed: [],
  cancelled: [],
};

export function canTransitionExecutionStatus(
  from: ExecutionStatus,
  to: ExecutionStatus,
): boolean {
  if (from === to) return true;
  const allowed = EXECUTION_STATUS_TRANSITIONS[from];
  return Array.isArray(allowed) && allowed.includes(to);
}

export function isValidHttpUrl(value: string): boolean {
  if (!value.trim()) return false;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

export function isValidGitHubRepoUrl(value: string): boolean {
  if (!isValidHttpUrl(value)) return false;
  try {
    const url = new URL(value.trim());
    return url.hostname === 'github.com' || url.hostname.endsWith('.github.com');
  } catch {
    return false;
  }
}

export function extractRepoNameFromUrl(repoUrl: string): string {
  try {
    const url = new URL(repoUrl);
    const parts = url.pathname.replace(/^\/+|\/+$/g, '').split('/');
    if (parts.length >= 2) {
      return `${parts[0]}/${parts[1].replace(/\.git$/, '')}`;
    }
    return repoUrl;
  } catch {
    return repoUrl;
  }
}

export function validateProjectPayload(input: {
  name?: string;
  repositoryUrl?: string;
  defaultBranch?: string;
}): string | null {
  const name = input.name?.trim() ?? '';
  if (name.length < 2 || name.length > 80) {
    return 'プロジェクト名は2〜80文字で入力してください。';
  }
  const repo = input.repositoryUrl?.trim() ?? '';
  if (repo && !isValidHttpUrl(repo)) {
    return 'リポジトリURLは有効な http/https URL を入力してください。';
  }
  const branch = input.defaultBranch?.trim() ?? '';
  if (branch.length === 0 || branch.length > 64 || /\s/.test(branch)) {
    return 'デフォルトブランチ名は空白なしの1〜64文字で入力してください。';
  }
  return null;
}

export function validateTaskPayload(input: {
  title?: string;
  projectId?: string;
}): string | null {
  const title = input.title?.trim() ?? '';
  if (title.length < 2 || title.length > 140) {
    return 'タスク名は2〜140文字で入力してください。';
  }
  if (!input.projectId?.trim()) {
    return '対象プロジェクトを選択してください。';
  }
  return null;
}

export function validateAgentPayload(input: {
  name?: string;
  provider?: AgentProvider;
  endpointUrl?: string;
}): string | null {
  const name = input.name?.trim() ?? '';
  if (name.length < 2 || name.length > 80) {
    return 'エージェント名は2〜80文字で入力してください。';
  }
  const validProviders: AgentProvider[] = ['claude_code', 'openai_codex', 'devin', 'custom'];
  if (!input.provider || !validProviders.includes(input.provider)) {
    return '有効なプロバイダーを選択してください。';
  }
  if (input.endpointUrl && input.endpointUrl.trim() && !isValidHttpUrl(input.endpointUrl)) {
    return 'エンドポイントURLは有効な http/https URL を入力してください。';
  }
  return null;
}

export function calculateDashboardMetrics(params: {
  projects: Project[];
  agents: Array<{ connectionStatus: string }>;
  tasks: Task[];
  executions: Execution[];
}): DashboardMetrics {
  const openStatuses = new Set<TaskStatus>(['backlog', 'ready', 'queued', 'running', 'review']);
  const totalProjects = params.projects.length;
  const activeProjects = params.projects.filter((p) => p.status === 'active').length;
  const totalAgents = params.agents.length;
  const activeAgents = params.agents.filter((a) => a.connectionStatus === 'connected').length;
  const runningExecutions = params.executions.filter(
    (e) => e.status === 'running' || e.status === 'queued',
  ).length;
  const openTasks = params.tasks.filter((t) => openStatuses.has(t.status)).length;
  const completedTasks = params.tasks.filter((t) => t.status === 'completed').length;
  const pendingPullRequests = params.tasks.filter(
    (t) => t.pullRequest && (t.pullRequest.status === 'open' || t.pullRequest.status === 'draft'),
  ).length;

  return {
    totalProjects,
    activeProjects,
    activeAgents,
    totalAgents,
    runningExecutions,
    openTasks,
    completedTasks,
    pendingPullRequests,
  };
}

export function calculateAnalyticsSummary(params: {
  executions: Execution[];
  agents: Array<{ id: string; name: string; provider: AgentProvider }>;
  projects: Array<{ id: string; name: string }>;
  tasks: Task[];
  fromDate?: string | null;
  toDate?: string | null;
}): AnalyticsSummary {
  const fromMs = params.fromDate ? new Date(`${params.fromDate}T00:00:00.000Z`).getTime() : null;
  const toMs = params.toDate ? new Date(`${params.toDate}T23:59:59.999Z`).getTime() : null;

  const filtered = params.executions.filter((e) => {
    const ts = new Date(e.startedAt).getTime();
    if (fromMs !== null && ts < fromMs) return false;
    if (toMs !== null && ts > toMs) return false;
    return true;
  });

  const totalExecutions = filtered.length;
  const successfulExecutions = filtered.filter((e) => e.status === 'completed').length;
  const failedExecutions = filtered.filter((e) => e.status === 'failed').length;
  const cancelledExecutions = filtered.filter((e) => e.status === 'cancelled').length;
  const runningExecutions = filtered.filter(
    (e) => e.status === 'running' || e.status === 'queued',
  ).length;

  const finishedCount = successfulExecutions + failedExecutions;
  const successRatePercent =
    finishedCount > 0 ? Math.round((successfulExecutions / finishedCount) * 1000) / 10 : null;

  const durations = filtered
    .map((e) => e.durationMs)
    .filter((d): d is number => typeof d === 'number' && d >= 0);
  const averageDurationMs =
    durations.length > 0
      ? Math.round(durations.reduce((acc, v) => acc + v, 0) / durations.length)
      : null;

  const simCosts = filtered
    .filter((e) => e.isSimulated && e.costReported && typeof e.estimatedCostUsd === 'number')
    .map((e) => e.estimatedCostUsd as number);
  const realCosts = filtered
    .filter((e) => !e.isSimulated && e.costReported && typeof e.estimatedCostUsd === 'number')
    .map((e) => e.estimatedCostUsd as number);

  const totalSimulatedCostUsd =
    simCosts.length > 0 ? Math.round(simCosts.reduce((a, b) => a + b, 0) * 10000) / 10000 : null;
  const totalReportedCostUsd =
    realCosts.length > 0 ? Math.round(realCosts.reduce((a, b) => a + b, 0) * 10000) / 10000 : null;

  const byDate = new Map<
    string,
    { date: string; completed: number; failed: number; cancelled: number; total: number }
  >();
  for (const exec of filtered) {
    const day = exec.startedAt.slice(0, 10);
    const entry = byDate.get(day) ?? {
      date: day,
      completed: 0,
      failed: 0,
      cancelled: 0,
      total: 0,
    };
    entry.total += 1;
    if (exec.status === 'completed') entry.completed += 1;
    else if (exec.status === 'failed') entry.failed += 1;
    else if (exec.status === 'cancelled') entry.cancelled += 1;
    byDate.set(day, entry);
  }
  const executionsOverTime = Array.from(byDate.values()).sort((a, b) =>
    a.date.localeCompare(b.date),
  );

  const agentMap = new Map(params.agents.map((a) => [a.id, a]));
  const agentStats = new Map<
    string,
    {
      agentId: string;
      agentName: string;
      provider: AgentProvider;
      count: number;
      successCount: number;
      failedCount: number;
      costSum: number;
      hasCost: boolean;
      isSimulatedOnly: boolean;
    }
  >();

  for (const exec of filtered) {
    const agent = agentMap.get(exec.agentId);
    const cur = agentStats.get(exec.agentId) ?? {
      agentId: exec.agentId,
      agentName: agent?.name ?? '削除済みエージェント',
      provider: agent?.provider ?? exec.provider,
      count: 0,
      successCount: 0,
      failedCount: 0,
      costSum: 0,
      hasCost: false,
      isSimulatedOnly: true,
    };
    cur.count += 1;
    if (exec.status === 'completed') cur.successCount += 1;
    if (exec.status === 'failed') cur.failedCount += 1;
    if (!exec.isSimulated) cur.isSimulatedOnly = false;
    if (exec.costReported && typeof exec.estimatedCostUsd === 'number') {
      cur.costSum += exec.estimatedCostUsd;
      cur.hasCost = true;
    }
    agentStats.set(exec.agentId, cur);
  }

  const agentUsageDistribution = Array.from(agentStats.values())
    .map((item) => ({
      agentId: item.agentId,
      agentName: item.agentName,
      provider: item.provider,
      count: item.count,
      successCount: item.successCount,
      failedCount: item.failedCount,
      estimatedCostUsd: item.hasCost ? Math.round(item.costSum * 10000) / 10000 : null,
      isSimulatedOnly: item.isSimulatedOnly,
    }))
    .sort((a, b) => b.count - a.count);

  const projectActivityDistribution = params.projects
    .map((proj) => ({
      projectId: proj.id,
      projectName: proj.name,
      executionCount: filtered.filter((e) => e.projectId === proj.id).length,
      taskCount: params.tasks.filter((t) => t.projectId === proj.id).length,
    }))
    .sort((a, b) => b.executionCount - a.executionCount || b.taskCount - a.taskCount);

  return {
    totalExecutions,
    successfulExecutions,
    failedExecutions,
    cancelledExecutions,
    runningExecutions,
    successRatePercent,
    averageDurationMs,
    totalSimulatedCostUsd,
    totalReportedCostUsd,
    executionsOverTime,
    agentUsageDistribution,
    projectActivityDistribution,
  };
}
