import crypto from 'node:crypto';
import type {
  ActivityEventType,
  ActivityLog,
  Agent,
  Execution,
  Project,
  Task,
  UserProfile,
  UserSettings,
} from '../src/shared/types.ts';
import { kvStore } from './store.ts';

export interface ServerUserSecrets {
  githubToken?: string;
  claudeApiKey?: string;
  codexApiKey?: string;
  devinApiKey?: string;
  customApiKey?: string;
  agentKeys: Record<string, string>;
}

export interface SessionRecord {
  token: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
}

/**
 * Everything that belongs to one user, stored as a single document.
 * Each request loads only the caller's workspace, so concurrent users never
 * overwrite each other's data.
 */
export interface Workspace {
  user: UserProfile;
  projects: Project[];
  agents: Agent[];
  tasks: Task[];
  executions: Execution[];
  activityLogs: ActivityLog[];
  settings: UserSettings;
  secrets: ServerUserSecrets;
}

export const DEMO_USER_ID = 'demo-user';
const SESSION_TTL_SEC = 7 * 86400;
const MAX_ACTIVITY_LOGS = 1000;

const keys = {
  workspace: (userId: string) => `msf:workspace:${userId}`,
  email: (email: string) => `msf:email:${email}`,
  session: (token: string) => `msf:session:${token}`,
};

export function maskSecret(secret?: string): string | undefined {
  if (!secret) return undefined;
  const trimmed = secret.trim();
  if (trimmed.length <= 8) return '••••••••';
  return `${trimmed.slice(0, 4)}••••••••${trimmed.slice(-4)}`;
}

export function createDefaultSettings(userId: string): UserSettings {
  return {
    userId,
    github: {
      connected: false,
      username: '',
      defaultOrg: '',
      defaultBranch: 'main',
      hasPersonalToken: false,
      webhookSecretConfigured: false,
    },
    providers: {
      claude_code: { hasApiKey: false, defaultModel: 'claude-sonnet-4-5' },
      openai_codex: { hasApiKey: false, defaultModel: 'codex-mini-latest' },
      devin: { hasApiKey: false, orgId: '' },
      custom: { endpointUrl: '', hasApiKey: false },
    },
    preferences: {
      autoPollIntervalSec: 2,
      defaultExecutionMode: 'mock',
      notifyOnCompletion: true,
      notifyOnFailure: true,
    },
    updatedAt: new Date().toISOString(),
  };
}

function buildDemoWorkspace(): Workspace {
  const now = Date.now();
  const iso = (offsetMs: number) => new Date(now + offsetMs).toISOString();
  const demoUserId = DEMO_USER_ID;

  const demoUser: UserProfile = {
    id: demoUserId,
    email: 'demo@miniswfactory.dev',
    displayName: 'Demo Workspace (Indie Founder)',
    avatarColor: '#3b82f6',
    onboardingCompleted: true,
    createdAt: iso(-10 * 86400_000),
  };

  const projects: Project[] = [
    {
      id: 'proj_billing_core',
      userId: demoUserId,
      name: 'Billing Core API',
      description: 'Stripeサブスクリプション課金・請求書PDF生成マイクロサービス',
      repositoryUrl: 'https://github.com/acme-indie/billing-core',
      defaultBranch: 'main',
      status: 'active',
      createdAt: iso(-8 * 86400_000),
      updatedAt: iso(-3600_000),
    },
    {
      id: 'proj_admin_portal',
      userId: demoUserId,
      name: 'Customer Admin Portal',
      description: '顧客向けセルフサービス契約管理・利用量ダッシュボード',
      repositoryUrl: 'https://github.com/acme-indie/customer-portal',
      defaultBranch: 'main',
      status: 'active',
      createdAt: iso(-5 * 86400_000),
      updatedAt: iso(-7200_000),
    },
    {
      id: 'proj_cli_toolkit',
      userId: demoUserId,
      name: 'Developer CLI Toolkit',
      description: 'ローカル検証用CLIとOpenAPIスキーマ同期ツール',
      repositoryUrl: 'https://github.com/acme-indie/dev-cli',
      defaultBranch: 'develop',
      status: 'paused',
      createdAt: iso(-12 * 86400_000),
      updatedAt: iso(-2 * 86400_000),
    },
  ];

  const agents: Agent[] = [
    {
      id: 'agent_claude_sim',
      userId: demoUserId,
      name: 'Claude Code (Mock Runner)',
      provider: 'claude_code',
      description: 'リファクタリング・API実装向けのモック実行アダプター（デモ用シミュレーション）',
      connectionType: 'mock',
      connectionStatus: 'connected',
      configuration: {
        model: 'claude-sonnet-4-5 (simulated)',
        maxTokens: 8192,
        hasApiKey: false,
        simulatedLatencyMs: 3200,
      },
      lastActivityAt: iso(-1800_000),
      createdAt: iso(-7 * 86400_000),
      updatedAt: iso(-1800_000),
    },
    {
      id: 'agent_codex_sim',
      userId: demoUserId,
      name: 'OpenAI Codex (Mock Runner)',
      provider: 'openai_codex',
      description: '単体テスト生成・バグ修正向けのモック実行アダプター（デモ用シミュレーション）',
      connectionType: 'mock',
      connectionStatus: 'connected',
      configuration: {
        model: 'codex-mini (simulated)',
        maxTokens: 4096,
        hasApiKey: false,
        simulatedLatencyMs: 2800,
      },
      lastActivityAt: iso(-5400_000),
      createdAt: iso(-6 * 86400_000),
      updatedAt: iso(-5400_000),
    },
    {
      id: 'agent_devin_real',
      userId: demoUserId,
      name: 'Devin Production Bridge',
      provider: 'devin',
      description: '本番Devin API連携用スロット（APIキー未設定のため未接続）',
      connectionType: 'api_key',
      connectionStatus: 'not_configured',
      configuration: {
        hasApiKey: false,
      },
      lastActivityAt: null,
      createdAt: iso(-4 * 86400_000),
      updatedAt: iso(-4 * 86400_000),
    },
  ];

  const tasks: Task[] = [
    {
      id: 'task_webhook_retry',
      userId: demoUserId,
      projectId: 'proj_billing_core',
      title: 'Stripe Webhook 冪等性チェックと指数バックオフ実装',
      description: 'invoice.payment_failed イベントの重複処理を防止し、失敗時に最大5回の指数バックオフリトライを追加する。',
      assignedAgentId: 'agent_claude_sim',
      priority: 'critical',
      status: 'completed',
      dueDate: iso(2 * 86400_000).slice(0, 10),
      pullRequest: {
        url: 'https://github.com/acme-indie/billing-core/pull/104',
        title: 'feat(webhook): add idempotency key & exponential backoff',
        repository: 'acme-indie/billing-core',
        branch: 'feat/webhook-idempotency',
        commitSha: 'a8f31c2',
        status: 'open',
        isSimulated: true,
        updatedAt: iso(-1800_000),
      },
      createdAt: iso(-3 * 86400_000),
      updatedAt: iso(-1800_000),
    },
    {
      id: 'task_pdf_invoice',
      userId: demoUserId,
      projectId: 'proj_billing_core',
      title: 'インボイス制度対応の日本語請求書テンプレート修正',
      description: '登録番号表示と税率別合計欄のレイアウト崩れを修正し、スナップショットテストを追加する。',
      assignedAgentId: 'agent_codex_sim',
      priority: 'high',
      status: 'review',
      dueDate: iso(3 * 86400_000).slice(0, 10),
      pullRequest: {
        url: 'https://github.com/acme-indie/billing-core/pull/105',
        title: 'fix(pdf): qualified invoice layout & tax breakdown',
        repository: 'acme-indie/billing-core',
        branch: 'fix/invoice-tax-layout',
        commitSha: '9d21b0e',
        status: 'merged',
        isSimulated: true,
        updatedAt: iso(-5400_000),
      },
      createdAt: iso(-2 * 86400_000),
      updatedAt: iso(-5400_000),
    },
    {
      id: 'task_usage_chart',
      userId: demoUserId,
      projectId: 'proj_admin_portal',
      title: '日次APIコール集計テーブルのCSVエクスポート機能',
      description: '期間指定した日次API使用量データをUTF-8 BOM付きCSVでエクスポートできるようにする。',
      assignedAgentId: 'agent_claude_sim',
      priority: 'medium',
      status: 'ready',
      dueDate: iso(5 * 86400_000).slice(0, 10),
      pullRequest: null,
      createdAt: iso(-1 * 86400_000),
      updatedAt: iso(-1 * 86400_000),
    },
    {
      id: 'task_sso_guard',
      userId: demoUserId,
      projectId: 'proj_admin_portal',
      title: '組織招待リンクの有効期限検証ミドルウェア追加',
      description: '期限切れまたは使用済みトークンの際に明確な410エラーメッセージを返す。',
      assignedAgentId: null,
      priority: 'high',
      status: 'backlog',
      dueDate: iso(7 * 86400_000).slice(0, 10),
      pullRequest: null,
      createdAt: iso(-12 * 3600_000),
      updatedAt: iso(-12 * 3600_000),
    },
    {
      id: 'task_cli_schema',
      userId: demoUserId,
      projectId: 'proj_cli_toolkit',
      title: 'OpenAPI 3.1 バリデーションエラーの出力改善',
      description: 'ネストしたスキーマ違反時にJSONパスをハイライト表示する。',
      assignedAgentId: 'agent_codex_sim',
      priority: 'low',
      status: 'failed',
      dueDate: null,
      pullRequest: null,
      createdAt: iso(-4 * 86400_000),
      updatedAt: iso(-3 * 86400_000),
    },
  ];

  const executions: Execution[] = [
    {
      id: 'exec_demo_01',
      userId: demoUserId,
      projectId: 'proj_billing_core',
      taskId: 'task_webhook_retry',
      agentId: 'agent_claude_sim',
      provider: 'claude_code',
      executionMode: 'mock',
      isSimulated: true,
      status: 'completed',
      input: 'Stripe Webhook 冪等性チェックと指数バックオフを実装し、単体テストを追加してください。',
      output: '[シミュレーション結果] 3ファイルを更新し、7件のテストが通過しました。PR案を作成しました。',
      error: null,
      logs: [
        {
          id: 'log_1',
          timestamp: iso(-1860_000),
          level: 'info',
          phase: '初期化',
          message: '[Mock Simulation] Claude Code モックランナーを起動しました。',
        },
        {
          id: 'log_2',
          timestamp: iso(-1845_000),
          level: 'info',
          phase: 'コード解析',
          message: '[Mock Simulation] src/webhooks/stripe.ts とテストスイートを解析中...',
        },
        {
          id: 'log_3',
          timestamp: iso(-1820_000),
          level: 'info',
          phase: '実装・検証',
          message: '[Mock Simulation] 冪等性ストアとリトライロジックを生成しテストを実行 (7/7 passed)。',
        },
        {
          id: 'log_4',
          timestamp: iso(-1800_000),
          level: 'success',
          phase: '完了',
          message: '[Mock Simulation] 実行完了。参考PR URL を記録しました。',
        },
      ],
      startedAt: iso(-1860_000),
      completedAt: iso(-1800_000),
      durationMs: 60000,
      tokenUsage: 4820,
      estimatedCostUsd: 0.0241,
      costReported: true,
      pullRequestUrl: 'https://github.com/acme-indie/billing-core/pull/104',
      createdAt: iso(-1860_000),
      updatedAt: iso(-1800_000),
    },
    {
      id: 'exec_demo_02',
      userId: demoUserId,
      projectId: 'proj_billing_core',
      taskId: 'task_pdf_invoice',
      agentId: 'agent_codex_sim',
      provider: 'openai_codex',
      executionMode: 'mock',
      isSimulated: true,
      status: 'completed',
      input: 'インボイス制度対応テンプレートの税率別小計レイアウト崩れを修正してください。',
      output: '[シミュレーション結果] PDFレイアウトコンポーネントを修正し、スナップショットテストを更新しました。',
      error: null,
      logs: [
        {
          id: 'log_21',
          timestamp: iso(-5445_000),
          level: 'info',
          phase: '初期化',
          message: '[Mock Simulation] OpenAI Codex モックランナーを起動しました。',
        },
        {
          id: 'log_22',
          timestamp: iso(-5420_000),
          level: 'info',
          phase: '修正',
          message: '[Mock Simulation] InvoiceTaxSummary.tsx の列幅とマージンを修正しました。',
        },
        {
          id: 'log_23',
          timestamp: iso(-5400_000),
          level: 'success',
          phase: '完了',
          message: '[Mock Simulation] 全テスト合格。シミュレーション実行が完了しました。',
        },
      ],
      startedAt: iso(-5445_000),
      completedAt: iso(-5400_000),
      durationMs: 45000,
      tokenUsage: 3150,
      estimatedCostUsd: 0.0158,
      costReported: true,
      pullRequestUrl: 'https://github.com/acme-indie/billing-core/pull/105',
      createdAt: iso(-5445_000),
      updatedAt: iso(-5400_000),
    },
    {
      id: 'exec_demo_03',
      userId: demoUserId,
      projectId: 'proj_cli_toolkit',
      taskId: 'task_cli_schema',
      agentId: 'agent_codex_sim',
      provider: 'openai_codex',
      executionMode: 'mock',
      isSimulated: true,
      status: 'failed',
      input: 'OpenAPI 3.1 バリデーションエラー出力をJSONパスハイライト対応にしてください。',
      output: null,
      error: '[シミュレーションエラー] モックテスト実行中に依存パッケージバージョン不一致を検出しました。',
      logs: [
        {
          id: 'log_31',
          timestamp: iso(-3 * 86400_000 - 30_000),
          level: 'info',
          phase: '初期化',
          message: '[Mock Simulation] OpenAI Codex モックランナーを起動しました。',
        },
        {
          id: 'log_32',
          timestamp: iso(-3 * 86400_000),
          level: 'error',
          phase: 'テスト失敗',
          message: '[Mock Simulation] テストケース openapi_v31.spec.ts がアサーションエラーで終了しました。',
        },
      ],
      startedAt: iso(-3 * 86400_000 - 30_000),
      completedAt: iso(-3 * 86400_000),
      durationMs: 30000,
      tokenUsage: 1420,
      estimatedCostUsd: 0.0071,
      costReported: true,
      pullRequestUrl: null,
      createdAt: iso(-3 * 86400_000 - 30_000),
      updatedAt: iso(-3 * 86400_000),
    },
  ];

  const activityLogs: ActivityLog[] = [
    {
      id: 'act_1',
      userId: demoUserId,
      projectId: 'proj_billing_core',
      taskId: 'task_webhook_retry',
      agentId: 'agent_claude_sim',
      eventType: 'execution_completed',
      description: 'Claude Code (Mock Runner) がタスク「Stripe Webhook 冪等性チェックと指数バックオフ実装」のシミュレーション実行を完了しました',
      createdAt: iso(-1800_000),
    },
    {
      id: 'act_2',
      userId: demoUserId,
      projectId: 'proj_billing_core',
      taskId: 'task_webhook_retry',
      agentId: null,
      eventType: 'pr_linked',
      description: 'GitHub PR (#104) がタスク「Stripe Webhook 冪等性チェックと指数バックオフ実装」に関連付けられました',
      createdAt: iso(-1790_000),
    },
    {
      id: 'act_3',
      userId: demoUserId,
      projectId: 'proj_billing_core',
      taskId: 'task_pdf_invoice',
      agentId: 'agent_codex_sim',
      eventType: 'execution_completed',
      description: 'OpenAI Codex (Mock Runner) がタスク「インボイス制度対応の日本語請求書テンプレート修正」を完了しました',
      createdAt: iso(-5400_000),
    },
    {
      id: 'act_4',
      userId: demoUserId,
      projectId: 'proj_admin_portal',
      taskId: 'task_usage_chart',
      agentId: 'agent_claude_sim',
      eventType: 'task_assigned',
      description: 'タスク「日次APIコール集計テーブルのCSVエクスポート機能」を Claude Code (Mock Runner) に割り当てました',
      createdAt: iso(-86400_000),
    },
  ];

  return {
    user: demoUser,
    projects,
    agents,
    tasks,
    executions,
    activityLogs,
    settings: createDefaultSettings(demoUserId),
    secrets: { agentKeys: {} },
  };
}

export function generateId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(6).toString('hex')}`;
}

export function storageMode(): string {
  return kvStore.kind;
}

// --- Workspaces ---

function normalizeWorkspace(ws: Workspace): Workspace {
  return {
    ...ws,
    projects: ws.projects ?? [],
    agents: ws.agents ?? [],
    tasks: ws.tasks ?? [],
    executions: ws.executions ?? [],
    activityLogs: ws.activityLogs ?? [],
    settings: ws.settings ?? createDefaultSettings(ws.user.id),
    secrets: ws.secrets ?? { agentKeys: {} },
  };
}

export async function loadWorkspace(userId: string): Promise<Workspace | null> {
  const ws = await kvStore.get<Workspace>(keys.workspace(userId));
  if (ws) return normalizeWorkspace(ws);
  if (userId === DEMO_USER_ID) {
    const seeded = buildDemoWorkspace();
    await saveWorkspace(seeded);
    return seeded;
  }
  return null;
}

export async function saveWorkspace(ws: Workspace): Promise<void> {
  if (ws.activityLogs.length > MAX_ACTIVITY_LOGS) {
    ws.activityLogs = ws.activityLogs.slice(0, MAX_ACTIVITY_LOGS);
  }
  await kvStore.set(keys.workspace(ws.user.id), ws);
}

// --- Users & sessions ---

export async function findOrCreateUser(email: string, displayName?: string): Promise<UserProfile> {
  const normalizedEmail = email.trim().toLowerCase();
  const name = displayName?.trim() ?? '';
  const existingId = await kvStore.get<string>(keys.email(normalizedEmail));
  const existing = existingId ? await loadWorkspace(existingId) : null;
  if (existing) {
    if (name && existing.user.displayName !== name) {
      existing.user.displayName = name;
      await saveWorkspace(existing);
    }
    return existing.user;
  }

  const user: UserProfile = {
    id: generateId('user'),
    email: normalizedEmail,
    displayName: name || normalizedEmail.split('@')[0],
    avatarColor: '#6366f1',
    onboardingCompleted: false,
    createdAt: new Date().toISOString(),
  };
  await saveWorkspace({
    user,
    projects: [],
    agents: [],
    tasks: [],
    executions: [],
    activityLogs: [],
    settings: createDefaultSettings(user.id),
    secrets: { agentKeys: {} },
  });
  await kvStore.set(keys.email(normalizedEmail), user.id);
  return user;
}

export async function getDemoUser(): Promise<UserProfile> {
  const ws = await loadWorkspace(DEMO_USER_ID);
  return ws!.user;
}

export async function createSession(userId: string): Promise<SessionRecord> {
  const now = new Date();
  const session: SessionRecord = {
    token: crypto.randomBytes(24).toString('hex'),
    userId,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + SESSION_TTL_SEC * 1000).toISOString(),
  };
  await kvStore.set(keys.session(session.token), session, { ttlSec: SESSION_TTL_SEC });
  return session;
}

export async function findSession(token: string): Promise<SessionRecord | null> {
  const session = await kvStore.get<SessionRecord>(keys.session(token));
  if (!session || new Date(session.expiresAt).getTime() <= Date.now()) return null;
  return session;
}

export async function removeSession(token: string): Promise<void> {
  await kvStore.del(keys.session(token));
}

// --- Activity log ---

export function logActivity(
  ws: Workspace,
  params: {
    projectId?: string | null;
    taskId?: string | null;
    agentId?: string | null;
    eventType: ActivityEventType;
    description: string;
    createdAt?: string;
  },
): ActivityLog {
  const entry: ActivityLog = {
    id: generateId('act'),
    userId: ws.user.id,
    projectId: params.projectId ?? null,
    taskId: params.taskId ?? null,
    agentId: params.agentId ?? null,
    eventType: params.eventType,
    description: params.description,
    createdAt: params.createdAt ?? new Date().toISOString(),
  };
  ws.activityLogs.unshift(entry);
  return entry;
}
