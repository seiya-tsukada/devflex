import type {
  ActivityLog,
  Agent,
  AgentConnectionType,
  AgentProvider,
  AnalyticsSummary,
  DashboardMetrics,
  Execution,
  Project,
  ProjectStatus,
  PullRequestStatus,
  Task,
  TaskPriority,
  TaskStatus,
  UserProfile,
  UserSettings,
} from '../shared/types.ts';

const TOKEN_KEY = 'msf_session_token';

export function getStoredToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (token) {
      sessionStorage.setItem(TOKEN_KEY, token);
    } else {
      sessionStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

export class ApiError extends Error {
  override name = 'ApiError';
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type QueryParams = Record<string, string | undefined>;

/** Builds `?a=1&b=2`, skipping empty values. Returns '' when nothing is set. */
function toQuery(params: QueryParams = {}): string {
  const qs = new URLSearchParams(
    Object.entries(params).filter((entry): entry is [string, string] => Boolean(entry[1])),
  ).toString();
  return qs ? `?${qs}` : '';
}

const seg = encodeURIComponent;

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  const token = getStoredToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`/api${path}`, { ...init, headers });

  const text = await res.text();
  let data: unknown = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text || 'サーバー応答の解析に失敗しました。' };
  }

  if (!res.ok) {
    const { error } = data as { error?: unknown };
    throw new ApiError(typeof error === 'string' ? error : `HTTP ${res.status}`, res.status);
  }

  return data as T;
}

const send = <T>(method: 'POST' | 'PATCH' | 'DELETE', path: string, body?: unknown) =>
  request<T>(path, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

export interface DashboardResponse {
  metrics: DashboardMetrics;
  agentActivities: Array<{
    agentId: string;
    agentName: string;
    provider: AgentProvider;
    connectionType: AgentConnectionType;
    connectionStatus: Agent['connectionStatus'];
    currentTaskId: string | null;
    currentTaskTitle: string | null;
    projectId: string | null;
    projectName: string | null;
    executionStatus: Execution['status'] | null;
    lastActivityAt: string | null;
  }>;
  recentExecutions: Array<
    Execution & { taskTitle: string; projectName: string; agentName: string }
  >;
  recentPullRequests: Array<{
    taskId: string;
    taskTitle: string;
    projectId: string;
    projectName: string;
    pullRequest: NonNullable<Task['pullRequest']>;
  }>;
}

export interface AgentWithCounts extends Agent {
  runningCount: number;
  completedCount: number;
}

export interface EnrichedExecution extends Execution {
  projectName: string;
  taskTitle: string;
  agentName: string;
}

export interface ProjectInput {
  name: string;
  description: string;
  repositoryUrl: string;
  defaultBranch: string;
  status: ProjectStatus;
}

export interface TaskInput {
  projectId: string;
  title: string;
  description: string;
  assignedAgentId: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string | null;
}

export interface PullRequestInput {
  url: string;
  title: string;
  branch?: string;
  commitSha?: string;
  status: PullRequestStatus;
}

export interface AgentInput {
  name: string;
  provider: AgentProvider;
  description: string;
  connectionType: AgentConnectionType;
  endpointUrl?: string;
  apiKey?: string;
  model?: string;
  simulateFailure?: boolean;
}

export interface ExecutionInput {
  projectId: string;
  taskId: string;
  agentId: string;
  instructions: string;
}

export interface AgentTestResult {
  ok: boolean;
  status: Agent['connectionStatus'];
  mode: 'mock' | 'real';
  message: string;
  checkedAt: string;
}

type AuthResponse = { token: string; user: UserProfile };
type Ok = { ok: boolean };

export const api = {
  // Auth
  login: (email: string, displayName: string) =>
    send<AuthResponse>('POST', '/auth/login', { email, displayName }),
  loginDemo: () => send<AuthResponse>('POST', '/auth/demo'),
  logout: () => send<Ok>('POST', '/auth/logout'),
  me: () => request<{ user: UserProfile }>('/auth/me'),
  completeOnboarding: () => send<{ user: UserProfile }>('POST', '/auth/onboarding/complete'),

  // Dashboard
  getDashboard: () => request<DashboardResponse>('/dashboard'),

  // Projects
  getProjects: () => request<{ projects: Project[] }>('/projects'),
  getProjectDetail: (id: string) =>
    request<{
      project: Project;
      tasks: Task[];
      executions: Execution[];
      agents: Agent[];
      activityLogs: ActivityLog[];
    }>(`/projects/${seg(id)}`),
  createProject: (payload: ProjectInput) =>
    send<{ project: Project }>('POST', '/projects', payload),
  updateProject: (id: string, payload: Partial<ProjectInput>) =>
    send<{ project: Project }>('PATCH', `/projects/${seg(id)}`, payload),
  deleteProject: (id: string) => send<Ok>('DELETE', `/projects/${seg(id)}`),

  // Tasks
  getTasks: (params?: { projectId?: string; status?: string }) =>
    request<{ tasks: Task[] }>(`/tasks${toQuery(params)}`),
  getTaskDetail: (id: string) =>
    request<{
      task: Task;
      project: Project | null;
      agent: Agent | null;
      executions: Execution[];
    }>(`/tasks/${seg(id)}`),
  createTask: (payload: TaskInput) => send<{ task: Task }>('POST', '/tasks', payload),
  updateTask: (id: string, payload: Partial<Omit<TaskInput, 'projectId'>>) =>
    send<{ task: Task }>('PATCH', `/tasks/${seg(id)}`, payload),
  linkTaskPr: (id: string, payload: PullRequestInput) =>
    send<{ task: Task }>('POST', `/tasks/${seg(id)}/pr`, payload),
  deleteTask: (id: string) => send<Ok>('DELETE', `/tasks/${seg(id)}`),

  // Agents
  getAgents: () => request<{ agents: AgentWithCounts[] }>('/agents'),
  createAgent: (payload: AgentInput) => send<{ agent: Agent }>('POST', '/agents', payload),
  updateAgent: (id: string, payload: Partial<AgentInput>) =>
    send<{ agent: Agent }>('PATCH', `/agents/${seg(id)}`, payload),
  testAgent: (id: string) =>
    send<{ result: AgentTestResult; agent: Agent }>('POST', `/agents/${seg(id)}/test`),
  deleteAgent: (id: string) => send<Ok>('DELETE', `/agents/${seg(id)}`),

  // Executions
  getExecutions: (params?: { projectId?: string; agentId?: string; status?: string }) =>
    request<{ executions: EnrichedExecution[] }>(`/executions${toQuery(params)}`),
  getExecutionDetail: (id: string) =>
    request<{
      execution: Execution;
      project: Project | null;
      task: Task | null;
      agent: Agent | null;
    }>(`/executions/${seg(id)}`),
  startExecution: (payload: ExecutionInput) =>
    send<{ execution: Execution }>('POST', '/executions', payload),
  cancelExecution: (id: string) =>
    send<{ execution: Execution }>('POST', `/executions/${seg(id)}/cancel`),

  // Analytics & activity
  getAnalytics: (params?: { from?: string; to?: string; projectId?: string }) =>
    request<{ summary: AnalyticsSummary }>(`/analytics${toQuery(params)}`),
  getActivityLogs: (params?: {
    projectId?: string;
    agentId?: string;
    eventType?: string;
    from?: string;
    to?: string;
  }) => request<{ logs: ActivityLog[] }>(`/activity${toQuery(params)}`),

  // Settings
  getSettings: () => request<{ settings: UserSettings; user: UserProfile }>('/settings'),
  updateSettings: (payload: unknown) =>
    send<{ settings: UserSettings; user: UserProfile }>('PATCH', '/settings', payload),
};
