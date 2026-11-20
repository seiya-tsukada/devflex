import type {
  Agent,
  AgentConnectionStatus,
  AgentProvider,
  Execution,
  ExecutionLogEntry,
  ExecutionStatus,
} from '../../src/shared/types.ts';
import { extractRepoNameFromUrl } from '../../src/shared/logic.ts';
import { storage } from '../storage.ts';

export interface ConnectionResult {
  ok: boolean;
  status: AgentConnectionStatus;
  mode: 'mock' | 'real';
  message: string;
  checkedAt: string;
}

export interface ExecutionStartInput {
  executionId: string;
  userId: string;
  agent: Agent;
  taskTitle: string;
  projectName: string;
  repositoryUrl: string;
  instructions: string;
}

export interface AgentAdapter {
  id: string;
  provider: AgentProvider;
  supportsRealExecution: boolean;
  testConnection(agent: Agent, hasServerSecret: boolean): Promise<ConnectionResult>;
  startExecution(input: ExecutionStartInput): Promise<void>;
  getStatus(executionId: string, userId: string): Promise<ExecutionStatus | null>;
  cancel(executionId: string, userId: string): Promise<boolean>;
}

const activeTimers = new Map<string, ReturnType<typeof setTimeout>[]>();

function clearExecutionTimers(executionId: string): void {
  const timers = activeTimers.get(executionId);
  if (timers) {
    for (const timer of timers) clearTimeout(timer);
    activeTimers.delete(executionId);
  }
}

function appendExecutionLog(
  executionId: string,
  level: ExecutionLogEntry['level'],
  phase: string,
  message: string,
): void {
  const db = storage.getDb();
  const exec = db.executions.find((e) => e.id === executionId);
  if (!exec) return;
  exec.logs.push({
    id: storage.generateId('log'),
    timestamp: new Date().toISOString(),
    level,
    phase,
    message,
  });
  exec.updatedAt = new Date().toISOString();
  storage.save();
}

export class MockAgentAdapter implements AgentAdapter {
  public readonly id = 'mock_adapter';
  public readonly provider: AgentProvider;
  public readonly supportsRealExecution = false;

  constructor(provider: AgentProvider) {
    this.provider = provider;
  }

  async testConnection(agent: Agent): Promise<ConnectionResult> {
    const providerLabel =
      agent.provider === 'claude_code'
        ? 'Claude Code'
        : agent.provider === 'openai_codex'
          ? 'OpenAI Codex'
          : agent.provider === 'devin'
            ? 'Devin'
            : 'Custom Agent';
    return {
      ok: true,
      status: 'connected',
      mode: 'mock',
      message: `${providerLabel} は Mock Agent Adapter（シミュレーションモード）として接続準備が完了しています。外部API通信は行いません。`,
      checkedAt: new Date().toISOString(),
    };
  }

  async startExecution(input: ExecutionStartInput): Promise<void> {
    const latencyBase = Math.min(
      Math.max(input.agent.configuration.simulatedLatencyMs ?? 3000, 1200),
      8000,
    );
    const shouldFail = Boolean(input.agent.configuration.simulateFailure);
    const db = storage.getDb();
    const exec = db.executions.find(
      (e) => e.id === input.executionId && e.userId === input.userId,
    );
    if (!exec) return;

    const timers: ReturnType<typeof setTimeout>[] = [];

    // Step 1: Queued -> Running
    timers.push(
      setTimeout(() => {
        const current = storage.getDb().executions.find((e) => e.id === input.executionId);
        if (!current || current.status === 'cancelled') return;
        current.status = 'running';
        current.updatedAt = new Date().toISOString();
        const task = storage.getDb().tasks.find((t) => t.id === current.taskId);
        if (task) {
          task.status = 'running';
          task.updatedAt = new Date().toISOString();
        }
        appendExecutionLog(
          input.executionId,
          'info',
          '実行開始',
          `[シミュレーション] 対象プロジェクト「${input.projectName}」のコンテキストを読み込みました。`,
        );
      }, 450),
    );

    // Step 2: Planning
    timers.push(
      setTimeout(() => {
        const current = storage.getDb().executions.find((e) => e.id === input.executionId);
        if (!current || current.status !== 'running') return;
        appendExecutionLog(
          input.executionId,
          'info',
          '設計・計画',
          `[シミュレーション] 指示内容を解析し実装計画を立案: 「${input.instructions.slice(0, 72)}」`,
        );
      }, Math.round(latencyBase * 0.4)),
    );

    // Step 3: Code & Test Simulation
    timers.push(
      setTimeout(() => {
        const current = storage.getDb().executions.find((e) => e.id === input.executionId);
        if (!current || current.status !== 'running') return;
        appendExecutionLog(
          input.executionId,
          shouldFail ? 'warn' : 'info',
          '変更・テスト',
          shouldFail
            ? '[シミュレーション] 仮想テストスイートで競合エラーを検知しました。再検証中...'
            : '[シミュレーション] 変更パッチを生成し仮想テストスイートを実行しています (4/4 passed)。',
        );
      }, Math.round(latencyBase * 0.72)),
    );

    // Step 4: Completion or Simulated Failure
    timers.push(
      setTimeout(() => {
        const currentDb = storage.getDb();
        const current = currentDb.executions.find((e) => e.id === input.executionId);
        if (!current || current.status !== 'running') return;

        const nowIso = new Date().toISOString();
        const durationMs = Math.max(
          500,
          new Date(nowIso).getTime() - new Date(current.startedAt).getTime(),
        );
        const task = currentDb.tasks.find((t) => t.id === current.taskId);
        const agent = currentDb.agents.find((a) => a.id === current.agentId);

        if (shouldFail) {
          current.status = 'failed';
          current.completedAt = nowIso;
          current.durationMs = durationMs;
          current.error =
            '[Mock Simulation] エージェント設定のシミュレーション失敗フラグにより失敗として終了しました。';
          current.tokenUsage = 1150;
          current.estimatedCostUsd = 0.0058;
          current.costReported = true;
          current.updatedAt = nowIso;
          if (task) {
            task.status = 'failed';
            task.updatedAt = nowIso;
          }
          appendExecutionLog(
            input.executionId,
            'error',
            '失敗終了',
            '[シミュレーション] 仮想実行が失敗ステータスで終了しました。',
          );
          storage.logActivity({
            userId: input.userId,
            projectId: current.projectId,
            taskId: current.taskId,
            agentId: current.agentId,
            eventType: 'execution_failed',
            description: `${agent?.name ?? 'Agent'} がタスク「${input.taskTitle}」のモック実行に失敗しました`,
          });
        } else {
          const repoSlug = input.repositoryUrl
            ? extractRepoNameFromUrl(input.repositoryUrl)
            : 'local/simulated-repo';
          const simPrNumber = Math.floor(100 + (Date.now() % 890));
          const simPrUrl = input.repositoryUrl
            ? `https://github.com/${repoSlug}/pull/${simPrNumber}`
            : null;

          current.status = 'completed';
          current.completedAt = nowIso;
          current.durationMs = durationMs;
          current.output = `[シミュレーション結果] タスク「${input.taskTitle}」の変更案を生成し、仮想検証を完了しました。（実際の外部リポジトリへのPushや実PR作成は行われていません）`;
          current.tokenUsage = 2400 + Math.floor((input.instructions.length % 15) * 120);
          current.estimatedCostUsd = Math.round((current.tokenUsage * 0.000005) * 10000) / 10000;
          current.costReported = true;
          current.pullRequestUrl = simPrUrl;
          current.updatedAt = nowIso;

          if (task) {
            task.status = 'review';
            task.updatedAt = nowIso;
            if (simPrUrl && !task.pullRequest) {
              task.pullRequest = {
                url: simPrUrl,
                title: `[Simulated] ${input.taskTitle}`,
                repository: repoSlug,
                branch: `agent/${current.id.slice(-6)}`,
                status: 'draft',
                isSimulated: true,
                updatedAt: nowIso,
              };
            }
          }
          if (agent) {
            agent.lastActivityAt = nowIso;
            agent.updatedAt = nowIso;
          }
          appendExecutionLog(
            input.executionId,
            'success',
            '完了',
            '[シミュレーション] 仮想実行が正常に完了しました。結果サマリーを確認できます。',
          );
          storage.logActivity({
            userId: input.userId,
            projectId: current.projectId,
            taskId: current.taskId,
            agentId: current.agentId,
            eventType: 'execution_completed',
            description: `${agent?.name ?? 'Agent'} がタスク「${input.taskTitle}」のモック実行を完了しました`,
          });
        }

        storage.save();
        clearExecutionTimers(input.executionId);
      }, latencyBase),
    );

    activeTimers.set(input.executionId, timers);
  }

  async getStatus(executionId: string, userId: string): Promise<ExecutionStatus | null> {
    const exec = storage
      .getDb()
      .executions.find((e) => e.id === executionId && e.userId === userId);
    return exec ? exec.status : null;
  }

  async cancel(executionId: string, userId: string): Promise<boolean> {
    const db = storage.getDb();
    const exec = db.executions.find((e) => e.id === executionId && e.userId === userId);
    if (!exec || (exec.status !== 'queued' && exec.status !== 'running')) {
      return false;
    }
    clearExecutionTimers(executionId);
    const nowIso = new Date().toISOString();
    exec.status = 'cancelled';
    exec.completedAt = nowIso;
    exec.durationMs = Math.max(0, new Date(nowIso).getTime() - new Date(exec.startedAt).getTime());
    exec.updatedAt = nowIso;
    exec.logs.push({
      id: storage.generateId('log'),
      timestamp: nowIso,
      level: 'warn',
      phase: 'キャンセル',
      message: '[シミュレーション] ユーザー操作により実行がキャンセルされました。',
    });
    const task = db.tasks.find((t) => t.id === exec.taskId && t.userId === userId);
    if (task && (task.status === 'queued' || task.status === 'running')) {
      task.status = 'cancelled';
      task.updatedAt = nowIso;
    }
    storage.logActivity({
      userId,
      projectId: exec.projectId,
      taskId: exec.taskId,
      agentId: exec.agentId,
      eventType: 'execution_cancelled',
      description: '実行がユーザーによりキャンセルされました',
    });
    storage.save();
    return true;
  }
}

export class ExternalProviderPlaceholderAdapter implements AgentAdapter {
  public readonly id: string;
  public readonly provider: AgentProvider;
  public readonly supportsRealExecution = false;

  constructor(provider: AgentProvider) {
    this.id = `${provider}_external_adapter`;
    this.provider = provider;
  }

  async testConnection(agent: Agent, hasServerSecret: boolean): Promise<ConnectionResult> {
    const checkedAt = new Date().toISOString();
    if (!hasServerSecret) {
      return {
        ok: false,
        status: 'not_configured',
        mode: 'real',
        message:
          '外部プロバイダーの認証情報（APIキーまたはエンドポイント）がサーバー側に未設定です。設定画面で認証情報を登録するか、デモ用に Mock Adapter へ切り替えてください。',
        checkedAt,
      };
    }
    return {
      ok: false,
      status: 'disconnected',
      mode: 'real',
      message:
        '認証情報はサーバー側に保存されていますが、実プロバイダーの外部ワーカーランタイム（CLI/Webhookブリッジ）が未接続です。MVPでは Mock Adapter を利用してシミュレーション実行できます。',
      checkedAt,
    };
  }

  async startExecution(_input: ExecutionStartInput): Promise<void> {
    throw new Error(
      'このエージェントは実外部接続モードに設定されていますが、実外部ランタイムが未接続のため実行できません。設定で Mock Adapter に切り替えるか、外部ワーカーブリッジを接続してください。',
    );
  }

  async getStatus(executionId: string, userId: string): Promise<ExecutionStatus | null> {
    const exec = storage
      .getDb()
      .executions.find((e) => e.id === executionId && e.userId === userId);
    return exec ? exec.status : null;
  }

  async cancel(): Promise<boolean> {
    return false;
  }
}

export function resolveAgentAdapter(agent: Agent): AgentAdapter {
  if (agent.connectionType === 'mock') {
    return new MockAgentAdapter(agent.provider);
  }
  return new ExternalProviderPlaceholderAdapter(agent.provider);
}
