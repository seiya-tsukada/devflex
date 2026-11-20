export type ProjectStatus = 'active' | 'paused' | 'archived';

export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';

export type TaskStatus =
  | 'backlog'
  | 'ready'
  | 'queued'
  | 'running'
  | 'review'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type AgentProvider = 'claude_code' | 'openai_codex' | 'devin' | 'custom';

export type AgentConnectionType = 'mock' | 'api_key' | 'webhook' | 'oauth';

export type AgentConnectionStatus =
  | 'connected'
  | 'disconnected'
  | 'error'
  | 'not_configured';

export type ExecutionStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type PullRequestStatus = 'open' | 'merged' | 'closed' | 'draft';

export type ActivityEventType =
  | 'project_created'
  | 'project_updated'
  | 'project_deleted'
  | 'task_created'
  | 'task_updated'
  | 'task_assigned'
  | 'execution_started'
  | 'execution_completed'
  | 'execution_failed'
  | 'execution_cancelled'
  | 'pr_linked'
  | 'agent_created'
  | 'agent_updated'
  | 'agent_tested'
  | 'settings_updated';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  avatarColor: string;
  onboardingCompleted: boolean;
  createdAt: string;
}

export interface Project {
  id: string;
  userId: string;
  name: string;
  description: string;
  repositoryUrl: string;
  defaultBranch: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AgentConfiguration {
  model?: string;
  maxTokens?: number;
  endpointUrl?: string;
  hasApiKey: boolean;
  maskedApiKey?: string;
  simulateFailure?: boolean;
  simulatedLatencyMs?: number;
}

export interface Agent {
  id: string;
  userId: string;
  name: string;
  provider: AgentProvider;
  description: string;
  connectionType: AgentConnectionType;
  connectionStatus: AgentConnectionStatus;
  configuration: AgentConfiguration;
  lastActivityAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PullRequestRef {
  url: string;
  title: string;
  repository: string;
  branch?: string;
  commitSha?: string;
  status: PullRequestStatus;
  isSimulated: boolean;
  updatedAt: string;
}

export interface Task {
  id: string;
  userId: string;
  projectId: string;
  title: string;
  description: string;
  assignedAgentId: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string | null;
  pullRequest: PullRequestRef | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExecutionLogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  phase: string;
  message: string;
}

export interface Execution {
  id: string;
  userId: string;
  projectId: string;
  taskId: string;
  agentId: string;
  provider: AgentProvider;
  executionMode: 'mock' | 'real';
  isSimulated: boolean;
  status: ExecutionStatus;
  input: string;
  output: string | null;
  error: string | null;
  logs: ExecutionLogEntry[];
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  tokenUsage: number | null;
  estimatedCostUsd: number | null;
  costReported: boolean;
  pullRequestUrl: string | null;
  /**
   * Mock-run schedule. Progress is derived from elapsed time whenever the
   * execution is read, so no long-lived timers are needed (serverless-safe).
   */
  simulation?: {
    latencyMs: number;
    shouldFail: boolean;
    /** Number of milestones already applied (0-4). */
    stage: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ActivityLog {
  id: string;
  userId: string;
  projectId: string | null;
  taskId: string | null;
  agentId: string | null;
  eventType: ActivityEventType;
  description: string;
  createdAt: string;
}

export interface UserSettings {
  userId: string;
  github: {
    connected: boolean;
    username: string;
    defaultOrg: string;
    defaultBranch: string;
    hasPersonalToken: boolean;
    maskedToken?: string;
    webhookSecretConfigured: boolean;
  };
  providers: {
    claude_code: { hasApiKey: boolean; maskedApiKey?: string; defaultModel: string };
    openai_codex: { hasApiKey: boolean; maskedApiKey?: string; defaultModel: string };
    devin: { hasApiKey: boolean; maskedApiKey?: string; orgId: string };
    custom: { endpointUrl: string; hasApiKey: boolean; maskedApiKey?: string };
  };
  preferences: {
    autoPollIntervalSec: number;
    defaultExecutionMode: 'mock';
    notifyOnCompletion: boolean;
    notifyOnFailure: boolean;
  };
  updatedAt: string;
}

export interface DashboardMetrics {
  totalProjects: number;
  activeProjects: number;
  activeAgents: number;
  totalAgents: number;
  runningExecutions: number;
  openTasks: number;
  completedTasks: number;
  pendingPullRequests: number;
}

export interface AnalyticsSummary {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  cancelledExecutions: number;
  runningExecutions: number;
  successRatePercent: number | null;
  averageDurationMs: number | null;
  totalSimulatedCostUsd: number | null;
  totalReportedCostUsd: number | null;
  executionsOverTime: Array<{
    date: string;
    completed: number;
    failed: number;
    cancelled: number;
    total: number;
  }>;
  agentUsageDistribution: Array<{
    agentId: string;
    agentName: string;
    provider: AgentProvider;
    count: number;
    successCount: number;
    failedCount: number;
    estimatedCostUsd: number | null;
    isSimulatedOnly: boolean;
  }>;
  projectActivityDistribution: Array<{
    projectId: string;
    projectName: string;
    executionCount: number;
    taskCount: number;
  }>;
}
