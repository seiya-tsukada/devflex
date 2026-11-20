import { useState, type FormEvent } from 'react';
import { ArrowRight, CheckCircle2, Cpu, FolderGit2, ListTodo, Play, SkipForward } from 'lucide-react';
import { api } from '../lib/api.ts';
import type { AgentProvider, Execution, Project, Task } from '../shared/types.ts';

interface OnboardingWizardProps {
  onFinished: () => void;
  onNotify: (type: 'success' | 'error' | 'info', title: string, detail?: string) => void;
}

export function OnboardingWizard({ onFinished, onNotify }: OnboardingWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [busy, setBusy] = useState(false);

  const [projectName, setProjectName] = useState('SaaS Starter API');
  const [projectRepo, setProjectRepo] = useState('https://github.com/my-org/saas-starter');
  const [projectBranch, setProjectBranch] = useState('main');
  const [createdProject, setCreatedProject] = useState<Project | null>(null);

  const [agentName, setAgentName] = useState('Claude Code (Mock Runner)');
  const [agentProvider, setAgentProvider] = useState<AgentProvider>('claude_code');
  const [createdAgentId, setCreatedAgentId] = useState<string | null>(null);

  const [taskTitle, setTaskTitle] = useState('認証ミドルウェアのレート制限テストを追加');
  const [taskDesc, setTaskDesc] = useState(
    '1分あたり60リクエスト超過時に429を返すミドルウェアとテストを作成する。',
  );
  const [createdTask, setCreatedTask] = useState<Task | null>(null);

  const [createdExec, setCreatedExec] = useState<Execution | null>(null);

  const handleSkip = async () => {
    setBusy(true);
    try {
      await api.completeOnboarding();
      onFinished();
    } catch (err) {
      onNotify('error', 'スキップに失敗しました', err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const handleCreateProject = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.createProject({
        name: projectName,
        description: 'オンボーディングで作成された最初のプロジェクト',
        repositoryUrl: projectRepo,
        defaultBranch: projectBranch,
        status: 'active',
      });
      setCreatedProject(res.project);
      onNotify('success', 'プロジェクトを作成しました', res.project.name);
      setStep(2);
    } catch (err) {
      onNotify('error', 'プロジェクト作成エラー', err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const handleCreateAgent = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.createAgent({
        name: agentName,
        provider: agentProvider,
        description: 'デモ実行用の Mock Agent Adapter',
        connectionType: 'mock',
      });
      setCreatedAgentId(res.agent.id);
      onNotify('success', 'エージェントを登録しました', res.agent.name);
      setStep(3);
    } catch (err) {
      onNotify('error', 'エージェント登録エラー', err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const handleCreateTask = async (e: FormEvent) => {
    e.preventDefault();
    if (!createdProject) return;
    setBusy(true);
    try {
      const res = await api.createTask({
        projectId: createdProject.id,
        title: taskTitle,
        description: taskDesc,
        assignedAgentId: createdAgentId,
        priority: 'high',
        status: 'ready',
        dueDate: null,
      });
      setCreatedTask(res.task);
      onNotify('success', '開発タスクを作成しました', res.task.title);
      setStep(4);
    } catch (err) {
      onNotify('error', 'タスク作成エラー', err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const handleRunMockExecution = async () => {
    if (!createdProject || !createdTask || !createdAgentId) return;
    setBusy(true);
    try {
      const res = await api.startExecution({
        projectId: createdProject.id,
        taskId: createdTask.id,
        agentId: createdAgentId,
        instructions: `${createdTask.title}\n${createdTask.description}`,
      });
      setCreatedExec(res.execution);
      onNotify('info', 'モック実行を開始しました', 'シミュレーションログをバックグラウンドで生成中です');
      setStep(5);
    } catch (err) {
      onNotify('error', '実行開始エラー', err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const handleFinish = async () => {
    setBusy(true);
    try {
      await api.completeOnboarding();
      onFinished();
    } catch (err) {
      onNotify('error', '完了処理エラー', err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const steps = [
    { num: 1, label: 'プロジェクト', icon: FolderGit2 },
    { num: 2, label: 'エージェント', icon: Cpu },
    { num: 3, label: 'タスク', icon: ListTodo },
    { num: 4, label: 'モック実行', icon: Play },
    { num: 5, label: '完了', icon: CheckCircle2 },
  ];

  return (
    <div className="min-h-screen bg-canvas bg-architectural-grid text-ink flex items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-2xl border border-line rounded-[3px] bg-surface p-6 sm:p-8 shadow-xs">
        <div className="flex items-center justify-between gap-4 pb-6 border-b border-line">
          <div>
            <h1 className="font-display text-lg font-semibold text-ink">
              初期セットアップガイド
            </h1>
            <p className="text-xs text-muted mt-1">
              プロジェクト作成から Mock Agent 実行までの基本フローを体験します
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={handleSkip}
            className="inline-flex items-center gap-1.5 rounded-[3px] border border-line-strong bg-elevated px-3 py-1.5 text-xs text-muted hover:text-ink hover:bg-slate-100 whitespace-nowrap shrink-0"
          >
            <SkipForward className="w-3.5 h-3.5" aria-hidden="true" />
            スキップ
          </button>
        </div>

        <div className="grid grid-cols-5 border-b border-line divide-x divide-line">
          {steps.map((s) => {
            const Icon = s.icon;
            const active = step === s.num;
            const done = step > s.num;
            return (
              <div
                key={s.num}
                className={`flex flex-col items-center text-center gap-1.5 py-4 px-1 ${
                  active
                    ? 'text-accent bg-teal-50 font-medium'
                    : done
                      ? 'text-emerald-700 bg-emerald-50/50'
                      : 'text-subtle'
                }`}
              >
                <Icon className="w-4 h-4" aria-hidden="true" />
                <span className="text-[11px] font-medium truncate w-full">{s.label}</span>
              </div>
            );
          })}
        </div>

        <div className="pt-6">
          {step === 1 && (
            <form onSubmit={handleCreateProject} className="space-y-4">
              <h2 className="font-display text-base font-medium text-ink">
                ステップ 1: 最初のプロジェクトを作成
              </h2>
              <div>
                <label htmlFor="ob-proj-name" className="block text-xs text-muted mb-1.5">
                  プロジェクト名
                </label>
                <input
                  id="ob-proj-name"
                  required
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="w-full rounded-[3px] border border-line-strong bg-elevated px-3 py-2 text-sm text-ink focus:border-accent focus:bg-surface focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label htmlFor="ob-proj-repo" className="block text-xs text-muted mb-1.5">
                    GitHub リポジトリ URL
                  </label>
                  <input
                    id="ob-proj-repo"
                    value={projectRepo}
                    onChange={(e) => setProjectRepo(e.target.value)}
                    className="w-full rounded-[3px] border border-line-strong bg-elevated px-3 py-2 text-sm text-ink font-mono focus:border-accent focus:bg-surface focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="ob-proj-branch" className="block text-xs text-muted mb-1.5">
                    デフォルトブランチ
                  </label>
                  <input
                    id="ob-proj-branch"
                    required
                    value={projectBranch}
                    onChange={(e) => setProjectBranch(e.target.value)}
                    className="w-full rounded-[3px] border border-line-strong bg-elevated px-3 py-2 text-sm text-ink font-mono focus:border-accent focus:bg-surface focus:outline-none"
                  />
                </div>
              </div>
              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-[3px] bg-accent hover:bg-accent-hover disabled:opacity-50 px-4 py-2 text-sm font-semibold text-white whitespace-nowrap"
                >
                  プロジェクトを作成して次へ
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleCreateAgent} className="space-y-4">
              <h2 className="font-display text-base font-medium text-ink">
                ステップ 2: 最初のAIエージェントを登録
              </h2>
              <p className="text-xs text-muted">
                MVP検証用として安全に動作する Mock Agent Adapter モードで登録します。
              </p>
              <div>
                <label htmlFor="ob-agent-name" className="block text-xs text-muted mb-1.5">
                  エージェント名
                </label>
                <input
                  id="ob-agent-name"
                  required
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  className="w-full rounded-[3px] border border-line-strong bg-elevated px-3 py-2 text-sm text-ink focus:border-accent focus:bg-surface focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="ob-agent-provider" className="block text-xs text-muted mb-1.5">
                  プロバイダー種別
                </label>
                <select
                  id="ob-agent-provider"
                  value={agentProvider}
                  onChange={(e) => setAgentProvider(e.target.value as AgentProvider)}
                  className="w-full rounded-[3px] border border-line-strong bg-elevated px-3 py-2 text-sm text-ink focus:border-accent focus:bg-surface focus:outline-none"
                >
                  <option value="claude_code">Claude Code</option>
                  <option value="openai_codex">OpenAI Codex</option>
                  <option value="devin">Devin</option>
                  <option value="custom">Custom Agent</option>
                </select>
              </div>
              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-[3px] bg-accent hover:bg-accent-hover disabled:opacity-50 px-4 py-2 text-sm font-semibold text-white whitespace-nowrap"
                >
                  エージェントを登録して次へ
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </form>
          )}

          {step === 3 && (
            <form onSubmit={handleCreateTask} className="space-y-4">
              <h2 className="font-display text-base font-medium text-ink">
                ステップ 3: 最初の開発タスクを作成
              </h2>
              <div>
                <label htmlFor="ob-task-title" className="block text-xs text-muted mb-1.5">
                  タスクタイトル
                </label>
                <input
                  id="ob-task-title"
                  required
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  className="w-full rounded-[3px] border border-line-strong bg-elevated px-3 py-2 text-sm text-ink focus:border-accent focus:bg-surface focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="ob-task-desc" className="block text-xs text-muted mb-1.5">
                  詳細指示
                </label>
                <textarea
                  id="ob-task-desc"
                  rows={3}
                  value={taskDesc}
                  onChange={(e) => setTaskDesc(e.target.value)}
                  className="w-full rounded-[3px] border border-line-strong bg-elevated px-3 py-2 text-sm text-ink focus:border-accent focus:bg-surface focus:outline-none"
                />
              </div>
              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-[3px] bg-accent hover:bg-accent-hover disabled:opacity-50 px-4 py-2 text-sm font-semibold text-white whitespace-nowrap"
                >
                  タスクを作成して次へ
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </form>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h2 className="font-display text-base font-medium text-ink">
                ステップ 4: Mock Agent でデモ実行を開始
              </h2>
              <div className="rounded-[3px] border border-line bg-elevated p-4 text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted">プロジェクト</span>
                  <span className="text-ink font-medium">{createdProject?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">タスク</span>
                  <span className="text-ink font-medium">{createdTask?.title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">エージェント</span>
                  <span className="text-ink font-medium">{agentName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">実行モード</span>
                  <span className="text-accent font-medium">シミュレーション (Mock Adapter)</span>
                </div>
              </div>
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleRunMockExecution}
                  className="inline-flex items-center gap-2 rounded-[3px] bg-accent hover:bg-accent-hover disabled:opacity-50 px-4 py-2 text-sm font-semibold text-white whitespace-nowrap"
                >
                  <Play className="w-4 h-4" aria-hidden="true" />
                  デモ実行を開始する
                </button>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2.5 text-emerald-700">
                <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
                <h2 className="font-display text-base font-semibold">
                  セットアップが完了しました
                </h2>
              </div>
              <p className="text-sm text-ink-soft leading-relaxed">
                実行 ID <span className="font-mono text-ink font-medium">{createdExec?.id}</span> のシミュレーションを開始しました。ダッシュボードでリアルタイムの実行状況とメトリクスを確認できます。
              </p>
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleFinish}
                  className="inline-flex items-center gap-2 rounded-[3px] bg-accent hover:bg-accent-hover disabled:opacity-50 px-4 py-2 text-sm font-semibold text-white whitespace-nowrap"
                >
                  ダッシュボードを開く
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
