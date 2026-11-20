import type {
  ActivityEventType,
  AgentConnectionStatus,
  AgentConnectionType,
  AgentProvider,
  ExecutionStatus,
  ProjectStatus,
  PullRequestStatus,
  TaskPriority,
  TaskStatus,
} from '../shared/types.ts';

export const PROVIDER_LABELS: Record<AgentProvider, string> = {
  claude_code: 'Claude Code',
  openai_codex: 'OpenAI Codex',
  devin: 'Devin',
  custom: 'Custom Agent',
};

export const CONNECTION_TYPE_LABELS: Record<AgentConnectionType, string> = {
  mock: 'Mock Adapter (シミュレーション)',
  api_key: 'APIキー接続 (外部)',
  webhook: 'Webhook / Runner (外部)',
  oauth: 'OAuth 連携 (外部)',
};

export const CONNECTION_STATUS_LABELS: Record<AgentConnectionStatus, string> = {
  connected: '接続済み',
  disconnected: '未接続',
  error: 'エラー',
  not_configured: '未設定',
};

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  active: '稼働中',
  paused: '一時停止',
  archived: 'アーカイブ',
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  critical: '緊急 (Critical)',
  high: '高 (High)',
  medium: '中 (Medium)',
  low: '低 (Low)',
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: 'バックログ',
  ready: '準備完了',
  queued: '待機中',
  running: '実行中',
  review: 'レビュー待ち',
  completed: '完了',
  failed: '失敗',
  cancelled: 'キャンセル',
};

export const EXECUTION_STATUS_LABELS: Record<ExecutionStatus, string> = {
  queued: 'キュー待機',
  running: '実行中',
  completed: '完了',
  failed: '失敗',
  cancelled: 'キャンセル',
};

export const PR_STATUS_LABELS: Record<PullRequestStatus, string> = {
  open: 'Open',
  merged: 'Merged',
  closed: 'Closed',
  draft: 'Draft',
};

export const ACTIVITY_EVENT_LABELS: Record<ActivityEventType, string> = {
  project_created: 'プロジェクト作成',
  project_updated: 'プロジェクト更新',
  project_deleted: 'プロジェクト削除',
  task_created: 'タスク作成',
  task_updated: 'タスク更新',
  task_assigned: 'エージェント割当',
  execution_started: '実行開始',
  execution_completed: '実行完了',
  execution_failed: '実行失敗',
  execution_cancelled: '実行キャンセル',
  pr_linked: 'PR関連付け',
  agent_created: 'エージェント登録',
  agent_updated: 'エージェント更新',
  agent_tested: '接続テスト',
  settings_updated: '設定更新',
};

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('ja-JP', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return '履歴なし';
  const diffSec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diffSec < 60) return `${Math.max(0, diffSec)}秒前`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}分前`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}時間前`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}日前`;
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return '—';
  if (ms < 1000) return `${ms}ms`;
  const sec = ms / 1000;
  if (sec < 60) return `${sec.toFixed(1)}秒`;
  const min = Math.floor(sec / 60);
  const rem = Math.round(sec % 60);
  return `${min}分${rem}秒`;
}
