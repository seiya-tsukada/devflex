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
  public readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`/api${path}`, {
    ...init,
    headers,
  });

  const text = await res.text();
  let data: unknown = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text || 'サーバー応答の解析に失敗しました。' };
  }

  if (!res.ok) {
    const errMsg =
      typeof (data as { error?: string }).error === 'string'
        ? (data as { error: string }).error
        : `HTTP ${res.status}`;
    throw new ApiError(errMsg, res.status);
  }

  return data as T;
}

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

export const api = {
  login: (email: string, displayName: string) =>
    request<{ token: string; user: UserProfile }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, displayName }),
    }),
  loginDemo: () =>
    request<{ token: string; user: UserProfile }>('/auth/demo', {
      method: 'POST',
    }),
  logout: () => request<{ ok: boolean }>('/auth/logout', { method: 'POST' }),
  me: () => request<{ user: UserProfile }>('/auth/me'),
  completeOnboarding: () =>
    request<{ user: UserProfile }>('/auth/onboarding/complete', { method: 'POST' }),

  getDashboard: () => request<DashboardResponse>('/dashboard'),

  getProjects: () => request<{ projects: Project[] }>('/projects'),
  getProjectDetail: (id: string) =>
    request<{
      project: Project;
      tasks: Task[];
      executions: Execution[];
      agents: Agent[];
      activityLogs: ActivityLog[];
    }>(`/projects/${encodeURIComponent(id)}`),
  createProject: (payload: {
    name: string;
    description: string;
    repositoryUrl: string;
    defaultBranch: string;
    status: ProjectStatus;
  }) =>
    request<{ project: Project }>('/projects', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateProject: (
    id: string,
    payload: Partial<{
      name: string;
      description: string;
      repositoryUrl: string;
      defaultBranch: string;
      status: ProjectStatus;
    }>,
  ) =>
    request<{ project: Project }>(`/projects/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteProject: (id: string) =>
    request<{ ok: boolean }>(`/projects/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  getTasks: (params?: { projectId?: string; status?: string }) => {
    const qs = new URLSearchParams();
    if (params?.projectId) qs.set('projectId', params.projectId);
    if (params?.status) qs.set('status', params.status);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return request<{ tasks: Task[] }>(`/tasks${suffix}`);
  },
  getTaskDetail: (id: string) =>
    request<{
      task: Task;
      project: Project | null;
      agent: Agent | null;
      executions: Execution[];
    }>(`/tasks/${encodeURIComponent(id)}`),
  createTask: (payload: {
    projectId: string;
    title: string;
    description: string;
    assignedAgentId: string | null;
    priority: TaskPriority;
    status: TaskStatus;
    dueDate: string | null;
  }) =>
    request<{ task: Task }>('/tasks', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateTask: (
    id: string,
    payload: Partial<{
      title: string;
      description: string;
      assignedAgentId: string | null;
      priority: TaskPriority;
      status: TaskStatus;
      dueDate: string | null;
    }>,
  ) =>
    request<{ task: Task }>(`/tasks/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  linkTaskPr: (
    id: string,
    payload: {
      url: string;
      title: string;
      branch?: string;
      commitSha?: string;
      status: PullRequestStatus;
    },
  ) =>
    request<{ task: Task }>(`/tasks/${encodeURIComponent(id)}/pr`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  deleteTask: (id: string) =>
    request<{ ok: boolean }>(`/tasks/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  getAgents: () => request<{ agents: AgentWithCounts[] }>('/agents'),
  createAgent: (payload: {
    name: string;
    provider: AgentProvider;
    description: string;
    connectionType: AgentConnectionType;
    endpointUrl?: string;
    apiKey?: string;
    model?: string;
    simulateFailure?: boolean;
  }) =>
    request<{ agent: Agent }>('/agents', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateAgent: (
    id: string,
    payload: Partial<{
      name: string;
      provider: AgentProvider;
      description: string;
      connectionType: AgentConnectionType;
      endpointUrl?: string;
      apiKey?: string;
      model?: string;
      simulateFailure?: boolean;
    }>,
  ) =>
    request<{ agent: Agent }>(`/agents/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  testAgent: (id: string) =>
    request<{
      result: {
        ok: boolean;
        status: Agent['connectionStatus'];
        mode: 'mock' | 'real';
        message: string;
        checkedAt: string;
      };
      agent: Agent;
    }>(`/agents/${encodeURIComponent(id)}/test`, { method: 'POST' }),
  deleteAgent: (id: string) =>
    request<{ ok: boolean }>(`/agents/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  getExecutions: (params?: { projectId?: string; agentId?: string; status?: string }) => {
    const qs = new URLSearchParams();
    if (params?.projectId) qs.set('projectId', params.projectId);
    if (params?.agentId) qs.set('agentId', params.agentId);
    if (params?.status) qs.set('status', params.status);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return request<{ executions: EnrichedExecution[] }>(`/executions${suffix}`);
  },
  getExecutionDetail: (id: string) =>
    request<{
      execution: Execution;
      project: Project | null;
      task: Task | null;
      agent: Agent | null;
    }>(`/executions/${encodeURIComponent(id)}`),
  startExecution: (payload: {
    projectId: string;
    taskId: string;
    agentId: string;
    instructions: string;
  }) =>
    request<{ execution: Execution }>('/executions', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  cancelExecution: (id: string) =>
    request<{ execution: Execution }>(`/executions/${encodeURIComponent(id)}/cancel`, {
      method: 'POST',
    }),

  getAnalytics: (params?: { from?: string; to?: string; projectId?: string }) => {
    const qs = new URLSearchParams();
    if (params?.from) qs.set('from', params.from);
    if (params?.to) qs.set('to', params.to);
    if (params?.projectId) qs.set('projectId', params.projectId);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return request<{ summary: AnalyticsSummary }>(`/analytics${suffix}`);
  },

  getActivityLogs: (params?: {
    projectId?: string;
    agentId?: string;
    eventType?: string;
    from?: string;
    to?: string;
  }) => {
    const qs = new URLSearchParams();
    if (params?.projectId) qs.set('projectId', params.projectId);
    if (params?.agentId) qs.set('agentId', params.agentId);
    if (params?.eventType) qs.set('eventType', params.eventType);
    if (params?.from) qs.set('from', params.from);
    if (params?.to) qs.set('to', params.to);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return request<{ logs: ActivityLog[] }>(`/activity${suffix}`);
  },

  getSettings: () => request<{ settings: UserSettings; user: UserProfile }>('/settings'),
  updateSettings: (payload: unknown) =>
    request<{ settings: UserSettings; user: UserProfile }>('/settings', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
};
