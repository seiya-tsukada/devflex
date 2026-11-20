import type {
  Agent,
  AgentConnectionStatus,
  AgentProvider,
  Execution,
  ExecutionLogEntry,
} from '../../src/shared/types.ts';
import { extractRepoNameFromUrl } from '../../src/shared/logic.ts';
import { generateId, logActivity, type Workspace } from '../storage.ts';

export interface ConnectionResult {
  ok: boolean;
  status: AgentConnectionStatus;
  mode: 'mock' | 'real';
  message: string;
  checkedAt: string;
}

export interface ExecutionStartInput {
  workspace: Workspace;
  execution: Execution;
  agent: Agent;
}

export interface AgentAdapter {
  id: string;
  provider: AgentProvider;
  supportsRealExecution: boolean;
  testConnection(agent: Agent, hasServerSecret: boolean): Promise<ConnectionResult>;
  startExecution(input: ExecutionStartInput): Promise<void>;
  cancel(workspace: Workspace, executionId: string): Promise<boolean>;
}

function appendExecutionLog(
  exec: Execution,
  level: ExecutionLogEntry['level'],
  phase: string,
  message: string,
  timestamp: string,
): void {
  exec.logs.push({ id: generateId('log'), timestamp, level, phase, message });
  exec.updatedAt = timestamp;
}

/** Elapsed-time offsets (ms from start) at which each mock milestone fires. */
function milestoneOffsets(latencyMs: number): number[] {
  return [450, Math.round(latencyMs * 0.4), Math.round(latencyMs * 0.72), latencyMs];
}

function applyMilestone(ws: Workspace, exec: Execution, stage: number, at: string): void {
  const sim = exec.simulation!;
  const task = ws.tasks.find((t) => t.id === exec.taskId);
  const agent = ws.agents.find((a) => a.id === exec.agentId);
  const project = ws.projects.find((p) => p.id === exec.projectId);
  const taskTitle = task?.title ?? '削除済みタスク';

  switch (stage) {
    case 0: {
      exec.status = 'running';
      if (task) {
        task.status = 'running';
        task.updatedAt = at;
      }
      appendExecutionLog(
        exec,
        'info',
        '実行開始',
        `[シミュレーション] 対象プロジェクト「${project?.name ?? '不明'}」のコンテキストを読み込みました。`,
        at,
      );
      return;
    }
    case 1:
      appendExecutionLog(
        exec,
        'info',
        '設計・計画',
        `[シミュレーション] 指示内容を解析し実装計画を立案: 「${exec.input.slice(0, 72)}」`,
        at,
      );
      return;
    case 2:
      appendExecutionLog(
        exec,
        sim.shouldFail ? 'warn' : 'info',
        '変更・テスト',
        sim.shouldFail
          ? '[シミュレーション] 仮想テストスイートで競合エラーを検知しました。再検証中...'
          : '[シミュレーション] 変更パッチを生成し仮想テストスイートを実行しています (4/4 passed)。',
        at,
      );
      return;
    default: {
      const durationMs = Math.max(500, new Date(at).getTime() - new Date(exec.startedAt).getTime());
      exec.completedAt = at;
      exec.durationMs = durationMs;
      exec.costReported = true;

      if (sim.shouldFail) {
        exec.status = 'failed';
        exec.error =
          '[Mock Simulation] エージェント設定のシミュレーション失敗フラグにより失敗として終了しました。';
        exec.tokenUsage = 1150;
        exec.estimatedCostUsd = 0.0058;
        if (task) {
          task.status = 'failed';
          task.updatedAt = at;
        }
        appendExecutionLog(
          exec,
          'error',
          '失敗終了',
          '[シミュレーション] 仮想実行が失敗ステータスで終了しました。',
          at,
        );
        logActivity(ws, {
          projectId: exec.projectId,
          taskId: exec.taskId,
          agentId: exec.agentId,
          eventType: 'execution_failed',
          description: `${agent?.name ?? 'Agent'} がタスク「${taskTitle}」のモック実行に失敗しました`,
          createdAt: at,
        });
        return;
      }

      const repositoryUrl = project?.repositoryUrl ?? '';
      const repoSlug = repositoryUrl ? extractRepoNameFromUrl(repositoryUrl) : 'local/simulated-repo';
      const simPrNumber = Math.floor(100 + (new Date(at).getTime() % 890));
      const simPrUrl = repositoryUrl ? `https://github.com/${repoSlug}/pull/${simPrNumber}` : null;

      exec.status = 'completed';
      exec.output = `[シミュレーション結果] タスク「${taskTitle}」の変更案を生成し、仮想検証を完了しました。（実際の外部リポジトリへのPushや実PR作成は行われていません）`;
      exec.tokenUsage = 2400 + Math.floor((exec.input.length % 15) * 120);
      exec.estimatedCostUsd = Math.round(exec.tokenUsage * 0.000005 * 10000) / 10000;
      exec.pullRequestUrl = simPrUrl;

      if (task) {
        task.status = 'review';
        task.updatedAt = at;
        if (simPrUrl && !task.pullRequest) {
          task.pullRequest = {
            url: simPrUrl,
            title: `[Simulated] ${taskTitle}`,
            repository: repoSlug,
            branch: `agent/${exec.id.slice(-6)}`,
            status: 'draft',
            isSimulated: true,
            updatedAt: at,
          };
        }
      }
      if (agent) {
        agent.lastActivityAt = at;
        agent.updatedAt = at;
      }
      appendExecutionLog(
        exec,
        'success',
        '完了',
        '[シミュレーション] 仮想実行が正常に完了しました。結果サマリーを確認できます。',
        at,
      );
      logActivity(ws, {
        projectId: exec.projectId,
        taskId: exec.taskId,
        agentId: exec.agentId,
        eventType: 'execution_completed',
        description: `${agent?.name ?? 'Agent'} がタスク「${taskTitle}」のモック実行を完了しました`,
        createdAt: at,
      });
    }
  }
}

/**
 * Advances every in-flight mock execution to the state it would have reached by `now`.
 * Called on each authenticated request instead of relying on setTimeout, which does not
 * survive past the response on serverless platforms.
 */
export function advanceSimulatedExecutions(ws: Workspace, now = Date.now()): void {
  for (const exec of ws.executions) {
    const sim = exec.simulation;
    if (!sim || (exec.status !== 'queued' && exec.status !== 'running')) continue;
    const startedMs = new Date(exec.startedAt).getTime();
    const offsets = milestoneOffsets(sim.latencyMs);
    while (sim.stage < offsets.length && startedMs + offsets[sim.stage] <= now) {
      applyMilestone(ws, exec, sim.stage, new Date(startedMs + offsets[sim.stage]).toISOString());
      sim.stage += 1;
    }
  }
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
    input.execution.simulation = {
      latencyMs: Math.min(Math.max(input.agent.configuration.simulatedLatencyMs ?? 3000, 1200), 8000),
      shouldFail: Boolean(input.agent.configuration.simulateFailure),
      stage: 0,
    };
  }

  async cancel(ws: Workspace, executionId: string): Promise<boolean> {
    const exec = ws.executions.find((e) => e.id === executionId);
    if (!exec || (exec.status !== 'queued' && exec.status !== 'running')) {
      return false;
    }
    const nowIso = new Date().toISOString();
    exec.status = 'cancelled';
    exec.completedAt = nowIso;
    exec.durationMs = Math.max(0, new Date(nowIso).getTime() - new Date(exec.startedAt).getTime());
    appendExecutionLog(
      exec,
      'warn',
      'キャンセル',
      '[シミュレーション] ユーザー操作により実行がキャンセルされました。',
      nowIso,
    );
    const task = ws.tasks.find((t) => t.id === exec.taskId);
    if (task && (task.status === 'queued' || task.status === 'running')) {
      task.status = 'cancelled';
      task.updatedAt = nowIso;
    }
    logActivity(ws, {
      projectId: exec.projectId,
      taskId: exec.taskId,
      agentId: exec.agentId,
      eventType: 'execution_cancelled',
      description: '実行がユーザーによりキャンセルされました',
    });
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
