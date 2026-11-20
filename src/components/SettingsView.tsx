import { useEffect, useState, type FormEvent } from 'react';
import { GitBranch, KeyRound, Save, ShieldCheck, Sliders, User } from 'lucide-react';
import { api } from '../lib/api.ts';
import type { UserProfile, UserSettings } from '../shared/types.ts';

interface SettingsViewProps {
  onUserUpdated: (user: UserProfile) => void;
  onNotify: (type: 'success' | 'error' | 'info', title: string, detail?: string) => void;
}

export function SettingsView({ onUserUpdated, onNotify }: SettingsViewProps) {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [displayName, setDisplayName] = useState('');
  const [ghUser, setGhUser] = useState('');
  const [ghOrg, setGhOrg] = useState('');
  const [ghBranch, setGhBranch] = useState('main');
  const [ghToken, setGhToken] = useState('');

  const [claudeModel, setClaudeModel] = useState('');
  const [claudeKey, setClaudeKey] = useState('');
  const [codexModel, setCodexModel] = useState('');
  const [codexKey, setCodexKey] = useState('');
  const [devinOrgId, setDevinOrgId] = useState('');
  const [devinKey, setDevinKey] = useState('');
  const [customEndpoint, setCustomEndpoint] = useState('');
  const [customKey, setCustomKey] = useState('');

  const [pollSec, setPollSec] = useState(2);
  const [notifyDone, setNotifyDone] = useState(true);
  const [notifyFail, setNotifyFail] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.getSettings();
      setSettings(res.settings);
      setUser(res.user);
      setDisplayName(res.user.displayName);
      setGhUser(res.settings.github.username);
      setGhOrg(res.settings.github.defaultOrg);
      setGhBranch(res.settings.github.defaultBranch);
      setClaudeModel(res.settings.providers.claude_code.defaultModel);
      setCodexModel(res.settings.providers.openai_codex.defaultModel);
      setDevinOrgId(res.settings.providers.devin.orgId);
      setCustomEndpoint(res.settings.providers.custom.endpointUrl);
      setPollSec(res.settings.preferences.autoPollIntervalSec);
      setNotifyDone(res.settings.preferences.notifyOnCompletion);
      setNotifyFail(res.settings.preferences.notifyOnFailure);
    } catch (err) {
      onNotify('error', '設定の読み込みに失敗しました', err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.updateSettings({
        displayName,
        github: {
          username: ghUser,
          defaultOrg: ghOrg,
          defaultBranch: ghBranch,
          ...(ghToken.trim() ? { personalToken: ghToken.trim() } : {}),
        },
        providers: {
          claude_code: {
            defaultModel: claudeModel,
            ...(claudeKey.trim() ? { apiKey: claudeKey.trim() } : {}),
          },
          openai_codex: {
            defaultModel: codexModel,
            ...(codexKey.trim() ? { apiKey: codexKey.trim() } : {}),
          },
          devin: {
            orgId: devinOrgId,
            ...(devinKey.trim() ? { apiKey: devinKey.trim() } : {}),
          },
          custom: {
            endpointUrl: customEndpoint,
            ...(customKey.trim() ? { apiKey: customKey.trim() } : {}),
          },
        },
        preferences: {
          autoPollIntervalSec: pollSec,
          notifyOnCompletion: notifyDone,
          notifyOnFailure: notifyFail,
        },
      });
      setSettings(res.settings);
      setUser(res.user);
      onUserUpdated(res.user);
      setGhToken('');
      setClaudeKey('');
      setCodexKey('');
      setDevinKey('');
      setCustomKey('');
      onNotify('success', '設定を保存しました', '認証情報はサーバー側で安全に保持されます');
    } catch (err) {
      onNotify('error', '設定保存エラー', err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnectGitHub = async () => {
    try {
      const res = await api.updateSettings({ github: { disconnectToken: true } });
      setSettings(res.settings);
      onNotify('info', 'GitHub トークンを削除しました');
    } catch (err) {
      onNotify('error', '削除に失敗しました', err instanceof Error ? err.message : undefined);
    }
  };

  if (loading || !settings || !user) {
    return <div className="p-8 text-sm text-[#5b6472]">設定を読み込み中...</div>;
  }

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-[#111827]">
            設定
          </h1>
          <p className="text-xs text-[#5b6472] mt-1">
            プロフィール・GitHub連携・プロバイダー認証情報・動作設定を管理します
          </p>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-[3px] bg-[#0f766e] hover:bg-[#0d645d] disabled:opacity-50 px-4 py-2 text-xs font-semibold text-[#ffffff] whitespace-nowrap"
        >
          <Save className="w-3.5 h-3.5" aria-hidden="true" />
          変更を保存
        </button>
      </div>

      {/* Profile & Auth */}
      <section className="rounded-[3px] border border-[#dfe3ea] bg-[#ffffff] p-5 space-y-4">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-[#0f766e]" aria-hidden="true" />
          <h2 className="font-display text-sm font-medium text-[#111827]">
            ユーザープロフィール・認証
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="set-name" className="block text-xs text-[#5b6472] mb-1">
              表示名
            </label>
            <input
              id="set-name"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-[3px] border border-[#d2d7e2] bg-[#f8f9fb] px-3 py-2 text-sm text-[#111827] focus:border-[#0f766e] focus:bg-[#ffffff] focus:outline-none"
            />
          </div>
          <div>
            <p className="text-xs text-[#5b6472] mb-1">メールアドレス / ユーザーID</p>
            <p className="rounded-[3px] border border-[#dfe3ea] bg-[#f8f9fb] px-3 py-2 text-xs font-mono text-[#374151] truncate">
              {user.email} · {user.id}
            </p>
          </div>
        </div>
        <div className="flex items-start gap-2 text-xs text-[#5b6472] pt-1">
          <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            認証・永続化状態: Firebase はプロビジョニング未承認のため、Node.js サーバー側のセッション認証とユーザー分離ストレージが有効です。APIキーやGitHubトークンがブラウザの localStorage やフロントエンドコードに露出することはありません。
          </span>
        </div>
      </section>

      {/* GitHub Integration */}
      <section className="rounded-[3px] border border-[#dfe3ea] bg-[#ffffff] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-[#0f766e]" aria-hidden="true" />
            <h2 className="font-display text-sm font-medium text-[#111827]">GitHub 連携設定</h2>
          </div>
          <span
            className={`text-xs font-medium ${
              settings.github.hasPersonalToken ? 'text-emerald-700' : 'text-[#64748b]'
            }`}
          >
            {settings.github.hasPersonalToken
              ? `トークン登録済み (${settings.github.maskedToken})`
              : '未接続（手動PR/リポジトリURL登録のみ利用中）'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label htmlFor="gh-user" className="block text-xs text-[#5b6472] mb-1">
              GitHub ユーザー名
            </label>
            <input
              id="gh-user"
              value={ghUser}
              onChange={(e) => setGhUser(e.target.value)}
              placeholder="octocat"
              className="w-full rounded-[3px] border border-[#d2d7e2] bg-[#f8f9fb] px-3 py-2 text-xs text-[#111827] font-mono focus:border-[#0f766e] focus:bg-[#ffffff] focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="gh-org" className="block text-xs text-[#5b6472] mb-1">
              デフォルト Organization
            </label>
            <input
              id="gh-org"
              value={ghOrg}
              onChange={(e) => setGhOrg(e.target.value)}
              placeholder="acme-indie"
              className="w-full rounded-[3px] border border-[#d2d7e2] bg-[#f8f9fb] px-3 py-2 text-xs text-[#111827] font-mono focus:border-[#0f766e] focus:bg-[#ffffff] focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="gh-branch" className="block text-xs text-[#5b6472] mb-1">
              デフォルトブランチ
            </label>
            <input
              id="gh-branch"
              value={ghBranch}
              onChange={(e) => setGhBranch(e.target.value)}
              className="w-full rounded-[3px] border border-[#d2d7e2] bg-[#f8f9fb] px-3 py-2 text-xs text-[#111827] font-mono focus:border-[#0f766e] focus:bg-[#ffffff] focus:outline-none"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[220px]">
            <label htmlFor="gh-token" className="block text-xs text-[#5b6472] mb-1">
              GitHub Personal Access Token（サーバー側保存・将来のGitHub App/OAuth連携用）
            </label>
            <input
              id="gh-token"
              type="password"
              value={ghToken}
              onChange={(e) => setGhToken(e.target.value)}
              placeholder={
                settings.github.hasPersonalToken
                  ? '更新する場合のみ新しいトークンを入力...'
                  : 'ghp_...'
              }
              className="w-full rounded-[3px] border border-[#d2d7e2] bg-[#f8f9fb] px-3 py-2 text-xs text-[#111827] font-mono focus:border-[#0f766e] focus:bg-[#ffffff] focus:outline-none"
            />
          </div>
          {settings.github.hasPersonalToken && (
            <button
              type="button"
              onClick={handleDisconnectGitHub}
              className="rounded-[3px] border border-red-200 bg-red-50 hover:bg-red-100 px-3 py-2 text-xs font-medium text-red-700 whitespace-nowrap"
            >
              トークンを削除
            </button>
          )}
        </div>
      </section>

      {/* Agent Provider Settings */}
      <section className="rounded-[3px] border border-[#dfe3ea] bg-[#ffffff] p-5 space-y-4">
        <div className="flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-[#0f766e]" aria-hidden="true" />
          <h2 className="font-display text-sm font-medium text-[#111827]">
            エージェントプロバイダー認証設定
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2 rounded-[3px] border border-[#dfe3ea] bg-[#f8f9fb] p-3.5">
            <p className="text-xs font-medium text-[#111827]">Claude Code</p>
            <input
              aria-label="Claude Code デフォルトモデル"
              value={claudeModel}
              onChange={(e) => setClaudeModel(e.target.value)}
              placeholder="claude-sonnet-4-5"
              className="w-full rounded-[3px] border border-[#d2d7e2] bg-[#ffffff] px-2.5 py-1.5 text-xs text-[#111827] font-mono focus:border-[#0f766e] focus:outline-none"
            />
            <input
              aria-label="Claude Code API キー"
              type="password"
              value={claudeKey}
              onChange={(e) => setClaudeKey(e.target.value)}
              placeholder={
                settings.providers.claude_code.hasApiKey
                  ? `設定済み (${settings.providers.claude_code.maskedApiKey})`
                  : 'ANTHROPIC_API_KEY を設定...'
              }
              className="w-full rounded-[3px] border border-[#d2d7e2] bg-[#ffffff] px-2.5 py-1.5 text-xs text-[#111827] font-mono focus:border-[#0f766e] focus:outline-none"
            />
          </div>

          <div className="space-y-2 rounded-[3px] border border-[#dfe3ea] bg-[#f8f9fb] p-3.5">
            <p className="text-xs font-medium text-[#111827]">OpenAI Codex</p>
            <input
              aria-label="OpenAI Codex デフォルトモデル"
              value={codexModel}
              onChange={(e) => setCodexModel(e.target.value)}
              placeholder="codex-mini-latest"
              className="w-full rounded-[3px] border border-[#d2d7e2] bg-[#ffffff] px-2.5 py-1.5 text-xs text-[#111827] font-mono focus:border-[#0f766e] focus:outline-none"
            />
            <input
              aria-label="OpenAI Codex API キー"
              type="password"
              value={codexKey}
              onChange={(e) => setCodexKey(e.target.value)}
              placeholder={
                settings.providers.openai_codex.hasApiKey
                  ? `設定済み (${settings.providers.openai_codex.maskedApiKey})`
                  : 'OPENAI_API_KEY を設定...'
              }
              className="w-full rounded-[3px] border border-[#d2d7e2] bg-[#ffffff] px-2.5 py-1.5 text-xs text-[#111827] font-mono focus:border-[#0f766e] focus:outline-none"
            />
          </div>

          <div className="space-y-2 rounded-[3px] border border-[#dfe3ea] bg-[#f8f9fb] p-3.5">
            <p className="text-xs font-medium text-[#111827]">Devin</p>
            <input
              aria-label="Devin Organization ID"
              value={devinOrgId}
              onChange={(e) => setDevinOrgId(e.target.value)}
              placeholder="Devin Org ID"
              className="w-full rounded-[3px] border border-[#d2d7e2] bg-[#ffffff] px-2.5 py-1.5 text-xs text-[#111827] font-mono focus:border-[#0f766e] focus:outline-none"
            />
            <input
              aria-label="Devin API キー"
              type="password"
              value={devinKey}
              onChange={(e) => setDevinKey(e.target.value)}
              placeholder={
                settings.providers.devin.hasApiKey
                  ? `設定済み (${settings.providers.devin.maskedApiKey})`
                  : 'Devin API Key を設定...'
              }
              className="w-full rounded-[3px] border border-[#d2d7e2] bg-[#ffffff] px-2.5 py-1.5 text-xs text-[#111827] font-mono focus:border-[#0f766e] focus:outline-none"
            />
          </div>

          <div className="space-y-2 rounded-[3px] border border-[#dfe3ea] bg-[#f8f9fb] p-3.5">
            <p className="text-xs font-medium text-[#111827]">Custom Agent Runner</p>
            <input
              aria-label="Custom エンドポイントURL"
              value={customEndpoint}
              onChange={(e) => setCustomEndpoint(e.target.value)}
              placeholder="https://runner.internal/v1"
              className="w-full rounded-[3px] border border-[#d2d7e2] bg-[#ffffff] px-2.5 py-1.5 text-xs text-[#111827] font-mono focus:border-[#0f766e] focus:outline-none"
            />
            <input
              aria-label="Custom Bearer トークン"
              type="password"
              value={customKey}
              onChange={(e) => setCustomKey(e.target.value)}
              placeholder={
                settings.providers.custom.hasApiKey
                  ? `設定済み (${settings.providers.custom.maskedApiKey})`
                  : 'Bearer Token を設定...'
              }
              className="w-full rounded-[3px] border border-[#d2d7e2] bg-[#ffffff] px-2.5 py-1.5 text-xs text-[#111827] font-mono focus:border-[#0f766e] focus:outline-none"
            />
          </div>
        </div>
      </section>

      {/* App Preferences */}
      <section className="rounded-[3px] border border-[#dfe3ea] bg-[#ffffff] p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-[#0f766e]" aria-hidden="true" />
          <h2 className="font-display text-sm font-medium text-[#111827]">アプリケーション設定</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
          <div>
            <label htmlFor="pref-poll" className="block text-xs text-[#5b6472] mb-1">
              実行ステータス自動更新間隔（秒）
            </label>
            <input
              id="pref-poll"
              type="number"
              min={1}
              max={30}
              value={pollSec}
              onChange={(e) => setPollSec(Number(e.target.value) || 2)}
              className="w-32 rounded-[3px] border border-[#d2d7e2] bg-[#f8f9fb] px-3 py-1.5 text-xs text-[#111827] font-mono focus:border-[#0f766e] focus:bg-[#ffffff] focus:outline-none"
            />
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs text-[#374151]">
              <input
                type="checkbox"
                checked={notifyDone}
                onChange={(e) => setNotifyDone(e.target.checked)}
                className="rounded border-[#d2d7e2] bg-[#ffffff] text-[#0f766e]"
              />
              実行完了時にトースト通知を表示する
            </label>
            <label className="flex items-center gap-2 text-xs text-[#374151]">
              <input
                type="checkbox"
                checked={notifyFail}
                onChange={(e) => setNotifyFail(e.target.checked)}
                className="rounded border-[#d2d7e2] bg-[#ffffff] text-[#0f766e]"
              />
              実行失敗・接続エラー時に通知を表示する
            </label>
          </div>
        </div>
      </section>
    </form>
  );
}
