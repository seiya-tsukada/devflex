import { useEffect, useState, type FormEvent } from 'react';
import {
  Cpu,
  Edit3,
  History,
  PlugZap,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { api, type AgentWithCounts } from '../lib/api.ts';
import {
  CONNECTION_TYPE_LABELS,
  formatRelativeTime,
  PROVIDER_LABELS,
} from '../lib/labels.ts';
import type {
  Agent,
  AgentConnectionType,
  AgentProvider,
} from '../shared/types.ts';
import { ConnectionStatusTag } from './StatusBadge.tsx';

interface AgentsViewProps {
  onViewAgentExecutions: (agentId: string) => void;
  onNotify: (type: 'success' | 'error' | 'info', title: string, detail?: string) => void;
}

export function AgentsView({ onViewAgentExecutions, onNotify }: AgentsViewProps) {
  const [agents, setAgents] = useState<AgentWithCounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [testingId, setTestingId] = useState<string | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Agent | null>(null);
  const [name, setName] = useState('');
  const [provider, setProvider] = useState<AgentProvider>('claude_code');
  const [description, setDescription] = useState('');
  const [connectionType, setConnectionType] = useState<AgentConnectionType>('mock');
  const [model, setModel] = useState('');
  const [endpointUrl, setEndpointUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [simulateFailure, setSimulateFailure] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.getAgents();
      setAgents(res.agents);
    } catch (err) {
      onNotify('error', 'エージェント取得エラー', err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setName('');
    setProvider('claude_code');
    setDescription('');
    setConnectionType('mock');
    setModel('');
    setEndpointUrl('');
    setApiKey('');
    setSimulateFailure(false);
    setModalOpen(true);
  };

  const openEdit = (agent: Agent) => {
    setEditing(agent);
    setName(agent.name);
    setProvider(agent.provider);
    setDescription(agent.description);
    setConnectionType(agent.connectionType);
    setModel(agent.configuration.model ?? '');
    setEndpointUrl(agent.configuration.endpointUrl ?? '');
    setApiKey('');
    setSimulateFailure(Boolean(agent.configuration.simulateFailure));
    setModalOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name,
        provider,
        description,
        connectionType,
        model: model || undefined,
        endpointUrl: endpointUrl || undefined,
        apiKey: apiKey || undefined,
        simulateFailure,
      };
      if (editing) {
        await api.updateAgent(editing.id, payload);
        onNotify('success', 'エージェントを更新しました', name);
      } else {
        await api.createAgent(payload);
        onNotify('success', 'エージェントを登録しました', name);
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      onNotify('error', 'エージェント保存エラー', err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (agent: Agent) => {
    setTestingId(agent.id);
    try {
      const res = await api.testAgent(agent.id);
      onNotify(
        res.result.ok ? 'success' : 'info',
        `${agent.name} 接続テスト: ${res.result.status}`,
        res.result.message,
      );
      await load();
    } catch (err) {
      onNotify('error', '接続テストエラー', err instanceof Error ? err.message : undefined);
    } finally {
      setTestingId(null);
    }
  };

  const handleDelete = async (agent: Agent) => {
    try {
      await api.deleteAgent(agent.id);
      onNotify('success', 'エージェントを削除しました', agent.name);
      await load();
    } catch (err) {
      onNotify('error', '削除エラー', err instanceof Error ? err.message : undefined);
    }
  };

  const filtered = agents.filter((a) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      a.name.toLowerCase().includes(q) ||
      PROVIDER_LABELS[a.provider].toLowerCase().includes(q) ||
      a.description.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
            エージェント管理
          </h1>
          <p className="text-xs text-muted mt-1">
            共通 Agent Adapter インターフェース経由で複数のコーディングエージェントを統合管理します
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 rounded-[3px] bg-accent hover:bg-accent-hover px-3.5 py-2 text-xs font-semibold text-white whitespace-nowrap"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          エージェント登録
        </button>
      </div>

      {/* Architecture Distinction Note */}
      <div className="rounded-[3px] border border-line bg-surface px-4 py-3 text-xs text-ink-soft flex flex-wrap items-center justify-between gap-2">
        <span>
          <strong className="text-ink font-semibold">接続モード仕様:</strong>{' '}
          Mock Adapter は安全なローカルシミュレーションを実行します。外部プロバイダー（Claude Code / OpenAI Codex / Devin）は未設定・未接続の場合、正直に未接続として表示され、擬似的な実接続成功を装うことはありません。
        </span>
      </div>

      <div className="relative max-w-sm">
        <Search
          className="w-3.5 h-3.5 text-subtle absolute left-3 top-1/2 -translate-y-1/2"
          aria-hidden="true"
        />
        <input
          type="search"
          aria-label="エージェントを検索"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="エージェント名・プロバイダーで検索..."
          className="w-full rounded-[3px] border border-line-strong bg-surface pl-8 pr-3 py-1.5 text-xs text-ink placeholder:text-faint focus:border-accent focus:outline-none"
        />
      </div>

      {loading ? (
        <div className="rounded-[3px] border border-line bg-surface p-8 text-center text-xs text-subtle">
          読み込み中...
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-[3px] border border-line bg-surface p-12 text-center">
          <Cpu className="w-8 h-8 text-faint mx-auto mb-3" aria-hidden="true" />
          <p className="text-sm font-medium text-ink">
            エージェントがまだ登録されていません
          </p>
          <p className="text-xs text-subtle mt-1">
            Claude Code、OpenAI Codex、Devin、またはカスタムエージェントを登録してタスクを割り当てましょう。
          </p>
          <button
            type="button"
            onClick={openCreate}
            className="mt-4 inline-flex items-center gap-1.5 rounded-[3px] bg-accent hover:bg-accent-hover px-3.5 py-2 text-xs font-semibold text-white"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            最初のエージェントを登録
          </button>
        </div>
      ) : (
        <div className="rounded-[3px] border border-line bg-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-line bg-elevated text-[11px] text-muted">
                  <th className="py-2.5 px-4 font-medium">エージェント名</th>
                  <th className="py-2.5 px-4 font-medium">プロバイダー</th>
                  <th className="py-2.5 px-4 font-medium">接続モード</th>
                  <th className="py-2.5 px-4 font-medium">接続ステータス</th>
                  <th className="py-2.5 px-4 font-medium text-right">実行中 / 完了</th>
                  <th className="py-2.5 px-4 font-medium text-right">最終稼働</th>
                  <th className="py-2.5 px-4 font-medium text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sunken text-xs">
                {filtered.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 max-w-[240px]">
                      <p className="font-medium text-ink truncate">{a.name}</p>
                      <p className="text-[11px] text-subtle truncate mt-0.5">
                        {a.description || '説明なし'}
                      </p>
                    </td>
                    <td className="py-3 px-4 text-ink-soft whitespace-nowrap">
                      {PROVIDER_LABELS[a.provider]}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`text-xs ${
                          a.connectionType === 'mock'
                            ? 'text-accent font-medium'
                            : 'text-ink-soft'
                        }`}
                      >
                        {CONNECTION_TYPE_LABELS[a.connectionType]}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <ConnectionStatusTag status={a.connectionStatus} />
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-ink-soft whitespace-nowrap">
                      {a.runningCount} / {a.completedCount}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-muted whitespace-nowrap">
                      {formatRelativeTime(a.lastActivityAt)}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          disabled={testingId === a.id}
                          onClick={() => handleTest(a)}
                          className="inline-flex items-center gap-1 rounded-[2px] border border-line-strong bg-elevated hover:bg-slate-100 px-2 py-1 text-[11px] text-ink-soft disabled:opacity-50"
                        >
                          <PlugZap className="w-3 h-3" aria-hidden="true" />
                          接続テスト
                        </button>
                        <button
                          type="button"
                          onClick={() => onViewAgentExecutions(a.id)}
                          aria-label={`${a.name} の実行履歴`}
                          title="実行履歴"
                          className="p-1.5 rounded-[2px] text-muted hover:text-ink hover:bg-sunken"
                        >
                          <History className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(a)}
                          aria-label={`${a.name} を編集`}
                          className="p-1.5 rounded-[2px] text-muted hover:text-ink hover:bg-sunken"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(a)}
                          aria-label={`${a.name} を削除`}
                          className="p-1.5 rounded-[2px] text-muted hover:text-red-700 hover:bg-red-50"
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
        <div
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[1px] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="agent-modal-title"
        >
          <div className="w-full max-w-lg rounded-[3px] border border-line bg-surface p-6 max-h-[90vh] overflow-y-auto shadow-lg">
            <h2 id="agent-modal-title" className="font-display text-base font-semibold text-ink">
              {editing ? 'エージェント設定を編集' : '新規エージェント登録'}
            </h2>
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label htmlFor="ag-name" className="block text-xs text-muted mb-1">
                  エージェント名 *
                </label>
                <input
                  id="ag-name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例: Claude Code (Backend Runner)"
                  className="w-full rounded-[3px] border border-line-strong bg-elevated px-3 py-2 text-sm text-ink focus:border-accent focus:bg-surface focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="ag-provider" className="block text-xs text-muted mb-1">
                    プロバイダー *
                  </label>
                  <select
                    id="ag-provider"
                    value={provider}
                    onChange={(e) => setProvider(e.target.value as AgentProvider)}
                    className="w-full rounded-[3px] border border-line-strong bg-elevated px-3 py-2 text-sm text-ink focus:border-accent focus:bg-surface focus:outline-none"
                  >
                    <option value="claude_code">Claude Code</option>
                    <option value="openai_codex">OpenAI Codex</option>
                    <option value="devin">Devin</option>
                    <option value="custom">Custom Agent</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="ag-conn" className="block text-xs text-muted mb-1">
                    接続タイプ *
                  </label>
                  <select
                    id="ag-conn"
                    value={connectionType}
                    onChange={(e) => setConnectionType(e.target.value as AgentConnectionType)}
                    className="w-full rounded-[3px] border border-line-strong bg-elevated px-3 py-2 text-sm text-ink focus:border-accent focus:bg-surface focus:outline-none"
                  >
                    <option value="mock">Mock Adapter (シミュレーション)</option>
                    <option value="api_key">APIキー接続 (実外部)</option>
                    <option value="webhook">Webhook / Runner (実外部)</option>
                    <option value="oauth">OAuth 連携 (実外部)</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="ag-desc" className="block text-xs text-muted mb-1">
                  説明
                </label>
                <textarea
                  id="ag-desc"
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-[3px] border border-line-strong bg-elevated px-3 py-2 text-sm text-ink focus:border-accent focus:bg-surface focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="ag-model" className="block text-xs text-muted mb-1">
                  モデル / プロファイル名（任意）
                </label>
                <input
                  id="ag-model"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="例: claude-sonnet-4-5"
                  className="w-full rounded-[3px] border border-line-strong bg-elevated px-3 py-2 text-xs text-ink font-mono focus:border-accent focus:bg-surface focus:outline-none"
                />
              </div>

              {connectionType === 'mock' ? (
                <label className="flex items-center gap-2 text-xs text-ink-soft pt-1">
                  <input
                    type="checkbox"
                    checked={simulateFailure}
                    onChange={(e) => setSimulateFailure(e.target.checked)}
                    className="rounded border-line-strong bg-surface text-accent"
                  />
                  失敗シナリオテスト用（このエージェントのモック実行を意図的に失敗させる）
                </label>
              ) : (
                <div className="space-y-3 rounded-[3px] border border-line bg-elevated p-3">
                  <p className="text-[11px] text-muted">
                    外部プロバイダー用の設定です。APIキーはサーバー側にのみ保存され、ブラウザには返却されません。
                  </p>
                  <div>
                    <label htmlFor="ag-endpoint" className="block text-xs text-muted mb-1">
                      エンドポイント URL
                    </label>
                    <input
                      id="ag-endpoint"
                      value={endpointUrl}
                      onChange={(e) => setEndpointUrl(e.target.value)}
                      placeholder="https://api.example.com/agent"
                      className="w-full rounded-[3px] border border-line-strong bg-surface px-3 py-1.5 text-xs text-ink font-mono focus:border-accent focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="ag-apikey" className="block text-xs text-muted mb-1">
                      API キー {editing?.configuration.maskedApiKey ? `(現在: ${editing.configuration.maskedApiKey})` : ''}
                    </label>
                    <input
                      id="ag-apikey"
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="変更する場合のみ入力..."
                      className="w-full rounded-[3px] border border-line-strong bg-surface px-3 py-1.5 text-xs text-ink font-mono focus:border-accent focus:outline-none"
                    />
                  </div>
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-[3px] border border-line-strong bg-surface px-3.5 py-2 text-xs text-ink-soft hover:bg-elevated"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-[3px] bg-accent hover:bg-accent-hover disabled:opacity-50 px-4 py-2 text-xs font-semibold text-white"
                >
                  {editing ? '更新を保存' : '登録する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
