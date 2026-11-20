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
    archived: 'text-[#4b5563] border-[#d1d5db] bg-[#f3f4f6]',
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
    backlog: 'text-[#4b5563] border-[#d1d5db] bg-[#f3f4f6]',
    ready: 'text-[#1f2937] border-[#cbd5e1] bg-[#f8fafc]',
    queued: 'text-amber-800 border-amber-200 bg-amber-50',
    running: 'text-[#0f766e] border-[#99f6e4] bg-[#f0fdfa]',
    review: 'text-sky-800 border-sky-200 bg-sky-50',
    completed: 'text-emerald-800 border-emerald-200 bg-emerald-50',
    failed: 'text-red-800 border-red-200 bg-red-50',
    cancelled: 'text-[#6b7280] border-[#e5e7eb] bg-[#f9fafb]',
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
    medium: 'text-[#374151] border-[#d1d5db] bg-[#f9fafb]',
    low: 'text-[#6b7280] border-[#e5e7eb] bg-[#f9fafb]',
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
    running: 'text-[#0f766e] border-[#99f6e4] bg-[#f0fdfa]',
    completed: 'text-emerald-800 border-emerald-200 bg-emerald-50',
    failed: 'text-red-800 border-red-200 bg-red-50',
    cancelled: 'text-[#6b7280] border-[#e5e7eb] bg-[#f9fafb]',
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
    not_configured: 'text-[#4b5563] border-[#d1d5db] bg-[#f3f4f6]',
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
    draft: 'text-[#4b5563] border-[#d1d5db] bg-[#f3f4f6]',
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
