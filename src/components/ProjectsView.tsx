import { useEffect, useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  Edit3,
  ExternalLink,
  FolderGit2,
  GitBranch,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { api } from '../lib/api.ts';
import { ACTIVITY_EVENT_LABELS, formatDateTime, PROVIDER_LABELS } from '../lib/labels.ts';
import type { ActivityLog, Agent, Execution, Project, ProjectStatus, Task } from '../shared/types.ts';
import {
  ConnectionStatusTag,
  ExecutionStatusTag,
  ProjectStatusTag,
  PullRequestStatusTag,
  TaskStatusTag,
} from './StatusBadge.tsx';

interface ProjectsViewProps {
  selectedProjectId: string | null;
  onSelectProject: (id: string | null) => void;
  onOpenTask: (taskId: string) => void;
  onOpenExecution: (executionId: string) => void;
  onNotify: (type: 'success' | 'error' | 'info', title: string, detail?: string) => void;
}

export function ProjectsView({
  selectedProjectId,
  onSelectProject,
  onOpenTask,
  onOpenExecution,
  onNotify,
}: ProjectsViewProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ProjectStatus>('all');

  // Detail state
  const [detail, setDetail] = useState<{
    project: Project;
    tasks: Task[];
    executions: Execution[];
    agents: Agent[];
    activityLogs: ActivityLog[];
  } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Create/Edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [repositoryUrl, setRepositoryUrl] = useState('');
  const [defaultBranch, setDefaultBranch] = useState('main');
  const [status, setStatus] = useState<ProjectStatus>('active');
  const [saving, setSaving] = useState(false);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const res = await api.getProjects();
      setProjects(res.projects);
    } catch (err) {
      onNotify('error', 'プロジェクト取得エラー', err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (id: string) => {
    setDetailLoading(true);
    try {
      const res = await api.getProjectDetail(id);
      setDetail(res);
    } catch (err) {
      onNotify('error', 'プロジェクト詳細取得エラー', err instanceof Error ? err.message : undefined);
      onSelectProject(null);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      loadDetail(selectedProjectId);
    } else {
      setDetail(null);
    }
  }, [selectedProjectId]);

  const openCreateModal = () => {
    setEditing(null);
    setName('');
    setDescription('');
    setRepositoryUrl('');
    setDefaultBranch('main');
    setStatus('active');
    setModalOpen(true);
  };

  const openEditModal = (p: Project) => {
    setEditing(p);
    setName(p.name);
    setDescription(p.description);
    setRepositoryUrl(p.repositoryUrl);
    setDefaultBranch(p.defaultBranch);
    setStatus(p.status);
    setModalOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await api.updateProject(editing.id, {
          name,
          description,
          repositoryUrl,
          defaultBranch,
          status,
        });
        onNotify('success', 'プロジェクトを更新しました', name);
      } else {
        await api.createProject({
          name,
          description,
          repositoryUrl,
          defaultBranch,
          status,
        });
        onNotify('success', 'プロジェクトを作成しました', name);
      }
      setModalOpen(false);
      await loadProjects();
      if (selectedProjectId && editing?.id === selectedProjectId) {
        await loadDetail(selectedProjectId);
      }
    } catch (err) {
      onNotify('error', '保存に失敗しました', err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p: Project) => {
    try {
      await api.deleteProject(p.id);
      onNotify('success', 'プロジェクトを削除しました', p.name);
      if (selectedProjectId === p.id) onSelectProject(null);
      await loadProjects();
    } catch (err) {
      onNotify('error', '削除に失敗しました', err instanceof Error ? err.message : undefined);
    }
  };

  if (selectedProjectId) {
    if (detailLoading || !detail) {
      return <div className="p-8 text-sm text-[#5b6472]">プロジェクト詳細を読み込み中...</div>;
    }

    const openTasks = detail.tasks.filter(
      (t) => !['completed', 'cancelled', 'failed'].includes(t.status),
    );
    const linkedPrs = detail.tasks.filter((t) => t.pullRequest !== null);

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => onSelectProject(null)}
              className="inline-flex items-center gap-1.5 rounded-[3px] border border-[#d2d7e2] bg-[#ffffff] hover:bg-[#f8f9fb] px-3 py-1.5 text-xs text-[#374151] whitespace-nowrap"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              一覧に戻る
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <h1 className="font-display text-xl font-semibold text-[#111827] truncate">
                  {detail.project.name}
                </h1>
                <ProjectStatusTag status={detail.project.status} />
              </div>
              <p className="text-xs text-[#5b6472] mt-0.5 truncate">
                {detail.project.description || '説明なし'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => openEditModal(detail.project)}
              className="inline-flex items-center gap-1.5 rounded-[3px] border border-[#d2d7e2] bg-[#ffffff] hover:bg-[#f8f9fb] px-3 py-1.5 text-xs text-[#374151] whitespace-nowrap"
            >
              <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
              編集
            </button>
            <button
              type="button"
              onClick={() => handleDelete(detail.project)}
              className="inline-flex items-center gap-1.5 rounded-[3px] border border-red-200 bg-red-50 hover:bg-red-100 px-3 py-1.5 text-xs font-medium text-red-700 whitespace-nowrap"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              削除
            </button>
          </div>
        </div>

        {/* Project Overview Meta */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="rounded-[3px] border border-[#dfe3ea] bg-[#ffffff] p-4 md:col-span-2">
            <p className="text-xs text-[#5b6472]">GitHub リポジトリ</p>
            {detail.project.repositoryUrl ? (
              <a
                href={detail.project.repositoryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-mono text-[#0f766e] hover:text-[#0d645d] hover:underline break-all"
              >
                {detail.project.repositoryUrl}
                <ExternalLink className="w-3 h-3 shrink-0" />
              </a>
            ) : (
              <p className="mt-1.5 text-xs text-[#64748b]">未設定</p>
            )}
          </div>
          <div className="rounded-[3px] border border-[#dfe3ea] bg-[#ffffff] p-4">
            <p className="text-xs text-[#5b6472]">デフォルトブランチ</p>
            <p className="mt-1.5 inline-flex items-center gap-1.5 text-sm font-mono text-[#111827]">
              <GitBranch className="w-3.5 h-3.5 text-[#64748b]" aria-hidden="true" />
              {detail.project.defaultBranch}
            </p>
          </div>
          <div className="rounded-[3px] border border-[#dfe3ea] bg-[#ffffff] p-4">
            <p className="text-xs text-[#5b6472]">未完了タスク / 実行数</p>
            <p className="mt-1.5 text-sm font-mono tabular-nums text-[#111827]">
              {openTasks.length} タスク / {detail.executions.length} 実行
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Tasks */}
          <section className="lg:col-span-7 rounded-[3px] border border-[#dfe3ea] bg-[#ffffff] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#dfe3ea] bg-[#f8f9fb]">
              <h2 className="font-display text-sm font-medium text-[#111827]">
                プロジェクトタスク ({detail.tasks.length})
              </h2>
            </div>
            {detail.tasks.length === 0 ? (
              <div className="p-6 text-xs text-[#64748b] text-center">
                このプロジェクトにはタスクがありません。
              </div>
            ) : (
              <div className="divide-y divide-[#eef0f4]">
                {detail.tasks.map((t) => (
                  <div
                    key={t.id}
                    className="px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-[#f8fafc]"
                  >
                    <button
                      type="button"
                      onClick={() => onOpenTask(t.id)}
                      className="text-xs font-medium text-[#111827] hover:text-[#0f766e] text-left truncate"
                    >
                      {t.title}
                    </button>
                    <TaskStatusTag status={t.status} />
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Assigned Agents */}
          <section className="lg:col-span-5 rounded-[3px] border border-[#dfe3ea] bg-[#ffffff] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#dfe3ea] bg-[#f8f9fb]">
              <h2 className="font-display text-sm font-medium text-[#111827]">
                関連エージェント ({detail.agents.length})
              </h2>
            </div>
            {detail.agents.length === 0 ? (
              <div className="p-6 text-xs text-[#64748b] text-center">
                割り当てられたエージェントはまだありません。
              </div>
            ) : (
              <div className="divide-y divide-[#eef0f4]">
                {detail.agents.map((a) => (
                  <div key={a.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium text-[#111827]">{a.name}</p>
                      <p className="text-[11px] text-[#5b6472]">{PROVIDER_LABELS[a.provider]}</p>
                    </div>
                    <ConnectionStatusTag status={a.connectionStatus} />
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Executions & PRs */}
          <section className="lg:col-span-6 rounded-[3px] border border-[#dfe3ea] bg-[#ffffff] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#dfe3ea] bg-[#f8f9fb]">
              <h2 className="font-display text-sm font-medium text-[#111827]">最近の実行履歴</h2>
            </div>
            {detail.executions.length === 0 ? (
              <div className="p-6 text-xs text-[#64748b] text-center">実行履歴はありません。</div>
            ) : (
              <div className="divide-y divide-[#eef0f4]">
                {detail.executions.slice(0, 8).map((exec) => (
                  <div
                    key={exec.id}
                    className="px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-[#f8fafc]"
                  >
                    <button
                      type="button"
                      onClick={() => onOpenExecution(exec.id)}
                      className="text-xs text-[#374151] hover:text-[#0f766e] font-mono truncate"
                    >
                      {exec.id} · {formatDateTime(exec.startedAt)}
                    </button>
                    <ExecutionStatusTag status={exec.status} />
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="lg:col-span-6 rounded-[3px] border border-[#dfe3ea] bg-[#ffffff] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#dfe3ea] bg-[#f8f9fb]">
              <h2 className="font-display text-sm font-medium text-[#111827]">
                関連 Pull Requests & アクティビティ
              </h2>
            </div>
            <div className="divide-y divide-[#eef0f4]">
              {linkedPrs.map((t) => (
                <div key={t.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                  <a
                    href={t.pullRequest!.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[#0f766e] hover:text-[#0d645d] hover:underline truncate"
                  >
                    {t.pullRequest!.title}
                  </a>
                  <PullRequestStatusTag status={t.pullRequest!.status} />
                </div>
              ))}
              {detail.activityLogs.slice(0, 5).map((act) => (
                <div key={act.id} className="px-4 py-2.5 text-xs">
                  <p className="text-[#374151]">{act.description}</p>
                  <p className="text-[11px] text-[#64748b] mt-0.5 font-mono">
                    {ACTIVITY_EVENT_LABELS[act.eventType]} · {formatDateTime(act.createdAt)}
                  </p>
                </div>
              ))}
              {linkedPrs.length === 0 && detail.activityLogs.length === 0 && (
                <div className="p-6 text-xs text-[#64748b] text-center">
                  アクティビティ記録はまだありません。
                </div>
              )}
            </div>
          </section>
        </div>

        {modalOpen && (
          <ProjectModal
            editing={editing}
            name={name}
            setName={setName}
            description={description}
            setDescription={setDescription}
            repositoryUrl={repositoryUrl}
            setRepositoryUrl={setRepositoryUrl}
            defaultBranch={defaultBranch}
            setDefaultBranch={setDefaultBranch}
            status={status}
            setStatus={setStatus}
            saving={saving}
            onClose={() => setModalOpen(false)}
            onSubmit={handleSubmit}
          />
        )}
      </div>
    );
  }

  const filtered = projects.filter((p) => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.repositoryUrl.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-[#111827]">
            プロジェクト管理
          </h1>
          <p className="text-xs text-[#5b6472] mt-1">
            リポジトリ・デフォルトブランチ・開発プロジェクトの状態を管理します
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-1.5 rounded-[3px] bg-[#0f766e] hover:bg-[#0d645d] px-3.5 py-2 text-xs font-semibold text-[#ffffff] whitespace-nowrap"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          プロジェクト作成
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search
            className="w-3.5 h-3.5 text-[#64748b] absolute left-3 top-1/2 -translate-y-1/2"
            aria-hidden="true"
          />
          <input
            type="search"
            aria-label="プロジェクトを検索"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="プロジェクト名やリポジトリで検索..."
            className="w-full rounded-[3px] border border-[#d2d7e2] bg-[#ffffff] pl-8 pr-3 py-1.5 text-xs text-[#111827] placeholder:text-[#94a3b8] focus:border-[#0f766e] focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-1 p-1 rounded-[3px] border border-[#dfe3ea] bg-[#ffffff]">
          {(
            [
              { id: 'all', label: 'すべて' },
              { id: 'active', label: '稼働中' },
              { id: 'paused', label: '一時停止' },
              { id: 'archived', label: 'アーカイブ' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-2.5 py-1 rounded-[2px] text-xs font-medium whitespace-nowrap transition-colors ${
                statusFilter === tab.id
                  ? 'bg-[#f0fdfa] text-[#0f766e] border border-[#99f6e4]'
                  : 'text-[#5b6472] hover:text-[#111827] border border-transparent'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="rounded-[3px] border border-[#dfe3ea] bg-[#ffffff] p-8 text-center text-xs text-[#64748b]">
          読み込み中...
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-[3px] border border-[#dfe3ea] bg-[#ffffff] p-12 text-center">
          <FolderGit2 className="w-8 h-8 text-[#94a3b8] mx-auto mb-3" aria-hidden="true" />
          <p className="text-sm font-medium text-[#111827]">
            {projects.length === 0
              ? 'プロジェクトがまだ登録されていません'
              : '条件に一致するプロジェクトが見つかりません'}
          </p>
          <p className="text-xs text-[#64748b] mt-1">
            最初のプロジェクトを作成してタスクやエージェント実行を管理しましょう。
          </p>
          {projects.length === 0 && (
            <button
              type="button"
              onClick={openCreateModal}
              className="mt-4 inline-flex items-center gap-1.5 rounded-[3px] bg-[#0f766e] hover:bg-[#0d645d] px-3.5 py-2 text-xs font-semibold text-[#ffffff]"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              最初のプロジェクトを作成
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-[3px] border border-[#dfe3ea] bg-[#ffffff] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#dfe3ea] bg-[#f8f9fb] text-[11px] text-[#5b6472]">
                  <th className="py-2.5 px-4 font-medium">プロジェクト名</th>
                  <th className="py-2.5 px-4 font-medium">リポジトリ</th>
                  <th className="py-2.5 px-4 font-medium">ブランチ</th>
                  <th className="py-2.5 px-4 font-medium">ステータス</th>
                  <th className="py-2.5 px-4 font-medium">更新日時</th>
                  <th className="py-2.5 px-4 font-medium text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eef0f4] text-xs">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-[#f8fafc] transition-colors">
                    <td className="py-3 px-4 max-w-[260px]">
                      <button
                        type="button"
                        onClick={() => onSelectProject(p.id)}
                        className="font-medium text-[#111827] hover:text-[#0f766e] text-left block truncate max-w-full"
                      >
                        {p.name}
                      </button>
                      {p.description && (
                        <p className="text-[11px] text-[#64748b] truncate mt-0.5">{p.description}</p>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-[#5b6472] max-w-[220px] truncate">
                      {p.repositoryUrl || '—'}
                    </td>
                    <td className="py-3 px-4 font-mono text-[#374151] whitespace-nowrap">
                      {p.defaultBranch}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <ProjectStatusTag status={p.status} />
                    </td>
                    <td className="py-3 px-4 text-[#5b6472] font-mono tabular-nums whitespace-nowrap">
                      {formatDateTime(p.updatedAt)}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditModal(p)}
                          aria-label={`${p.name} を編集`}
                          className="p-1.5 rounded-[2px] text-[#5b6472] hover:text-[#111827] hover:bg-[#eef0f4]"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(p)}
                          aria-label={`${p.name} を削除`}
                          className="p-1.5 rounded-[2px] text-[#5b6472] hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modalOpen && (
        <ProjectModal
          editing={editing}
          name={name}
          setName={setName}
          description={description}
          setDescription={setDescription}
          repositoryUrl={repositoryUrl}
          setRepositoryUrl={setRepositoryUrl}
          defaultBranch={defaultBranch}
          setDefaultBranch={setDefaultBranch}
          status={status}
          setStatus={setStatus}
          saving={saving}
          onClose={() => setModalOpen(false)}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}

function ProjectModal(props: {
  editing: Project | null;
  name: string;
  setName: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  repositoryUrl: string;
  setRepositoryUrl: (v: string) => void;
  defaultBranch: string;
  setDefaultBranch: (v: string) => void;
  status: ProjectStatus;
  setStatus: (v: ProjectStatus) => void;
  saving: boolean;
  onClose: () => void;
  onSubmit: (e: FormEvent) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-[#0f172a]/40 backdrop-blur-[1px] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="project-modal-title"
    >
      <div className="w-full max-w-lg rounded-[3px] border border-[#dfe3ea] bg-[#ffffff] p-6 shadow-lg">
        <h2 id="project-modal-title" className="font-display text-base font-semibold text-[#111827]">
          {props.editing ? 'プロジェクトを編集' : '新規プロジェクト作成'}
        </h2>
        <form onSubmit={props.onSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="proj-name" className="block text-xs text-[#5b6472] mb-1">
              プロジェクト名 *
            </label>
            <input
              id="proj-name"
              required
              value={props.name}
              onChange={(e) => props.setName(e.target.value)}
              placeholder="例: Billing Core API"
              className="w-full rounded-[3px] border border-[#d2d7e2] bg-[#f8f9fb] px-3 py-2 text-sm text-[#111827] focus:border-[#0f766e] focus:bg-[#ffffff] focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="proj-desc" className="block text-xs text-[#5b6472] mb-1">
              説明
            </label>
            <textarea
              id="proj-desc"
              rows={2}
              value={props.description}
              onChange={(e) => props.setDescription(e.target.value)}
              placeholder="マイクロサービスの概要や目的..."
              className="w-full rounded-[3px] border border-[#d2d7e2] bg-[#f8f9fb] px-3 py-2 text-sm text-[#111827] focus:border-[#0f766e] focus:bg-[#ffffff] focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label htmlFor="proj-repo" className="block text-xs text-[#5b6472] mb-1">
                GitHub リポジトリ URL
              </label>
              <input
                id="proj-repo"
                value={props.repositoryUrl}
                onChange={(e) => props.setRepositoryUrl(e.target.value)}
                placeholder="https://github.com/org/repo"
                className="w-full rounded-[3px] border border-[#d2d7e2] bg-[#f8f9fb] px-3 py-2 text-sm text-[#111827] font-mono focus:border-[#0f766e] focus:bg-[#ffffff] focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="proj-branch" className="block text-xs text-[#5b6472] mb-1">
                デフォルトブランチ *
              </label>
              <input
                id="proj-branch"
                required
                value={props.defaultBranch}
                onChange={(e) => props.setDefaultBranch(e.target.value)}
                className="w-full rounded-[3px] border border-[#d2d7e2] bg-[#f8f9fb] px-3 py-2 text-sm text-[#111827] font-mono focus:border-[#0f766e] focus:bg-[#ffffff] focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label htmlFor="proj-status" className="block text-xs text-[#5b6472] mb-1">
              ステータス
            </label>
            <select
              id="proj-status"
              value={props.status}
              onChange={(e) => props.setStatus(e.target.value as ProjectStatus)}
              className="w-full rounded-[3px] border border-[#d2d7e2] bg-[#f8f9fb] px-3 py-2 text-sm text-[#111827] focus:border-[#0f766e] focus:bg-[#ffffff] focus:outline-none"
            >
              <option value="active">稼働中 (Active)</option>
              <option value="paused">一時停止 (Paused)</option>
              <option value="archived">アーカイブ (Archived)</option>
            </select>
          </div>
          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={props.onClose}
              className="rounded-[3px] border border-[#d2d7e2] bg-[#ffffff] px-3.5 py-2 text-xs text-[#374151] hover:bg-[#f8f9fb]"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={props.saving}
              className="rounded-[3px] bg-[#0f766e] hover:bg-[#0d645d] disabled:opacity-50 px-4 py-2 text-xs font-semibold text-[#ffffff]"
            >
              {props.editing ? '更新を保存' : '作成する'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
