import {
  AlertCircle,
  Ban,
  CheckCircle2,
  Clock,
  Eye,
  GitMerge,
  GitPullRequest,
  Loader2,
  PauseCircle,
  Unplug,
} from 'lucide-react';
import type {
  AgentConnectionStatus,
  ExecutionStatus,
  ProjectStatus,
  PullRequestStatus,
  TaskPriority,
  TaskStatus,
} from '../shared/types.ts';
import {
  CONNECTION_STATUS_LABELS,
  EXECUTION_STATUS_LABELS,
  PROJECT_STATUS_LABELS,
  PR_STATUS_LABELS,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
} from '../lib/labels.ts';

export function ProjectStatusTag({ status }: { status: ProjectStatus }) {
  const styles: Record<ProjectStatus, string> = {
    active: 'text-emerald-800 border-emerald-200 bg-emerald-50',
    paused: 'text-amber-800 border-amber-200 bg-amber-50',
    archived: 'text-gray-600 border-gray-300 bg-gray-100',
  };
  const Icon = status === 'active' ? CheckCircle2 : status === 'paused' ? PauseCircle : Ban;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[2px] px-2 py-0.5 text-[11px] font-medium border whitespace-nowrap shrink-0 ${styles[status]}`}
    >
      <Icon className="w-3 h-3" aria-hidden="true" />
      {PROJECT_STATUS_LABELS[status]}
    </span>
  );
}

export function TaskStatusTag({ status }: { status: TaskStatus }) {
  const styles: Record<TaskStatus, string> = {
    backlog: 'text-gray-600 border-gray-300 bg-gray-100',
    ready: 'text-gray-800 border-slate-300 bg-slate-50',
    queued: 'text-amber-800 border-amber-200 bg-amber-50',
    running: 'text-accent border-teal-200 bg-teal-50',
    review: 'text-sky-800 border-sky-200 bg-sky-50',
    completed: 'text-emerald-800 border-emerald-200 bg-emerald-50',
    failed: 'text-red-800 border-red-200 bg-red-50',
    cancelled: 'text-gray-500 border-gray-200 bg-gray-50',
  };
  const Icon =
    status === 'running'
      ? Loader2
      : status === 'completed'
        ? CheckCircle2
        : status === 'failed'
          ? AlertCircle
          : status === 'review'
            ? Eye
            : status === 'cancelled'
              ? Ban
              : Clock;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[2px] px-2 py-0.5 text-[11px] font-medium border whitespace-nowrap shrink-0 ${styles[status]}`}
    >
      <Icon
        className={`w-3 h-3 ${status === 'running' ? 'animate-spin' : ''}`}
        aria-hidden="true"
      />
      {TASK_STATUS_LABELS[status]}
    </span>
  );
}

export function PriorityTag({ priority }: { priority: TaskPriority }) {
  const styles: Record<TaskPriority, string> = {
    critical: 'text-red-800 border-red-200 bg-red-50',
    high: 'text-amber-800 border-amber-200 bg-amber-50',
    medium: 'text-ink-soft border-gray-300 bg-gray-50',
    low: 'text-gray-500 border-gray-200 bg-gray-50',
  };
  return (
    <span
      className={`inline-flex items-center rounded-[2px] px-2 py-0.5 text-[11px] font-medium border whitespace-nowrap shrink-0 ${styles[priority]}`}
    >
      {TASK_PRIORITY_LABELS[priority]}
    </span>
  );
}

export function ExecutionStatusTag({ status }: { status: ExecutionStatus }) {
  const styles: Record<ExecutionStatus, string> = {
    queued: 'text-amber-800 border-amber-200 bg-amber-50',
    running: 'text-accent border-teal-200 bg-teal-50',
    completed: 'text-emerald-800 border-emerald-200 bg-emerald-50',
    failed: 'text-red-800 border-red-200 bg-red-50',
    cancelled: 'text-gray-500 border-gray-200 bg-gray-50',
  };
  const Icon =
    status === 'running'
      ? Loader2
      : status === 'completed'
        ? CheckCircle2
        : status === 'failed'
          ? AlertCircle
          : status === 'cancelled'
            ? Ban
            : Clock;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[2px] px-2 py-0.5 text-[11px] font-medium border whitespace-nowrap shrink-0 ${styles[status]}`}
    >
      <Icon
        className={`w-3 h-3 ${status === 'running' ? 'animate-spin' : ''}`}
        aria-hidden="true"
      />
      {EXECUTION_STATUS_LABELS[status]}
    </span>
  );
}

export function ConnectionStatusTag({ status }: { status: AgentConnectionStatus }) {
  const styles: Record<AgentConnectionStatus, string> = {
    connected: 'text-emerald-800 border-emerald-200 bg-emerald-50',
    disconnected: 'text-amber-800 border-amber-200 bg-amber-50',
    error: 'text-red-800 border-red-200 bg-red-50',
    not_configured: 'text-gray-600 border-gray-300 bg-gray-100',
  };
  const Icon =
    status === 'connected'
      ? CheckCircle2
      : status === 'error'
        ? AlertCircle
        : Unplug;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[2px] px-2 py-0.5 text-[11px] font-medium border whitespace-nowrap shrink-0 ${styles[status]}`}
    >
      <Icon className="w-3 h-3" aria-hidden="true" />
      {CONNECTION_STATUS_LABELS[status]}
    </span>
  );
}

export function PullRequestStatusTag({ status }: { status: PullRequestStatus }) {
  const styles: Record<PullRequestStatus, string> = {
    open: 'text-emerald-800 border-emerald-200 bg-emerald-50',
    merged: 'text-sky-800 border-sky-200 bg-sky-50',
    closed: 'text-red-800 border-red-200 bg-red-50',
    draft: 'text-gray-600 border-gray-300 bg-gray-100',
  };
  const Icon = status === 'merged' ? GitMerge : GitPullRequest;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[2px] px-2 py-0.5 text-[11px] font-medium border whitespace-nowrap shrink-0 ${styles[status]}`}
    >
      <Icon className="w-3 h-3" aria-hidden="true" />
      {PR_STATUS_LABELS[status]}
    </span>
  );
}
