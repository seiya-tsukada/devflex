import { useState, type FormEvent } from 'react';
import { ArrowRight } from 'lucide-react';
import { api } from '../lib/api.ts';
import type { UserProfile } from '../shared/types.ts';

interface AuthScreenProps {
  onAuthenticated: (token: string, user: UserProfile) => void;
  onError: (message: string) => void;
}

export function AuthScreen({ onAuthenticated, onError }: AuthScreenProps) {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) {
      onError('有効なメールアドレスを入力してください。');
      return;
    }
    setLoading(true);
    try {
      const res = await api.login(email.trim(), displayName.trim());
      onAuthenticated(res.token, res.user);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'サインインに失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  const handleDemo = async () => {
    setLoading(true);
    try {
      const res = await api.loginDemo();
      onAuthenticated(res.token, res.user);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'デモ環境へのログインに失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f6f8] text-[#111827] grid grid-cols-1 lg:grid-cols-12">
      {/* Left Architectural Editorial Column */}
      <div className="lg:col-span-7 bg-[#f4f6f8] bg-architectural-grid border-b lg:border-b-0 lg:border-r border-[#dfe3ea] p-8 sm:p-12 lg:p-16 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-3">
            <svg
              width="28"
              height="28"
              viewBox="0 0 28 28"
              fill="none"
              aria-hidden="true"
              className="shrink-0"
            >
              <rect x="1" y="1" width="26" height="26" rx="2" stroke="#d2d7e2" fill="#ffffff" />
              <rect x="6" y="6" width="7" height="7" fill="#0f766e" />
              <rect x="15" y="6" width="7" height="7" fill="#111827" />
              <rect x="6" y="15" width="16" height="7" fill="#cbd5e1" />
            </svg>
            <span className="font-display text-base font-semibold tracking-normal text-[#111827] whitespace-nowrap">
              Mini Software Factory
            </span>
          </div>

          <h1 className="mt-12 lg:mt-20 font-display text-3xl sm:text-4xl lg:text-[42px] font-semibold tracking-tight text-[#111827] leading-[1.2] max-w-2xl [text-wrap:balance]">
            複数のAIコーディングエージェントを、ひとつの精密な管制基盤へ。
          </h1>
          <p className="mt-5 text-sm sm:text-base text-[#5b6472] leading-relaxed max-w-xl">
            Claude Code、OpenAI Codex、Devin、カスタムエージェントを共通アダプターで統括。プロジェクト単位のタスク配分、実行ログ監視、Pull Request 追跡、コスト分析を一つのワークスペースで完結させます。
          </p>
        </div>

        <div className="mt-12 pt-8 border-t border-[#dfe3ea] grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs">
          <div>
            <p className="font-mono text-[#0f766e] font-semibold mb-1">01.</p>
            <p className="font-medium text-[#111827]">マルチプロバイダー制御</p>
            <p className="text-[#5b6472] mt-1 leading-relaxed">
              ベンダー非依存の共通 Agent Adapter で実行と接続状態を厳密に管理。
            </p>
          </div>
          <div>
            <p className="font-mono text-[#0f766e] font-semibold mb-1">02.</p>
            <p className="font-medium text-[#111827]">安全なシミュレーション</p>
            <p className="text-[#5b6472] mt-1 leading-relaxed">
              Mock Adapter による段階ログ検証と、実外部接続の明確な分離。
            </p>
          </div>
          <div>
            <p className="font-mono text-[#0f766e] font-semibold mb-1">03.</p>
            <p className="font-medium text-[#111827]">ユーザー単位の分離永続化</p>
            <p className="text-[#5b6472] mt-1 leading-relaxed">
              サーバー側データ分離とマスキングされた認証情報管理を標準搭載。
            </p>
          </div>
        </div>
      </div>

      {/* Right Sign-In Column */}
      <div className="lg:col-span-5 bg-[#ffffff] p-8 sm:p-12 lg:p-16 flex flex-col justify-center">
        <div className="w-full max-w-sm mx-auto">
          <h2 className="font-display text-xl font-semibold text-[#111827]">
            ワークスペースへサインイン
          </h2>
          <p className="mt-1.5 text-xs text-[#5b6472] leading-relaxed">
            新しいメールアドレスを入力すると専用ワークスペースとオンボーディングが開始されます。
          </p>

          <form onSubmit={handleLogin} className="mt-7 space-y-4">
            <div>
              <label htmlFor="auth-email" className="block text-xs font-medium text-[#374151] mb-1.5">
                メールアドレス
              </label>
              <input
                id="auth-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.dev"
                className="w-full rounded-[3px] border border-[#d2d7e2] bg-[#f8f9fb] px-3.5 py-2.5 text-sm text-[#111827] placeholder:text-[#94a3b8] focus:border-[#0f766e] focus:bg-[#ffffff] focus:outline-none font-mono"
              />
            </div>

            <div>
              <label htmlFor="auth-name" className="block text-xs font-medium text-[#374151] mb-1.5">
                表示名（任意）
              </label>
              <input
                id="auth-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="例: Kenji Tsukada"
                className="w-full rounded-[3px] border border-[#d2d7e2] bg-[#f8f9fb] px-3.5 py-2.5 text-sm text-[#111827] placeholder:text-[#94a3b8] focus:border-[#0f766e] focus:bg-[#ffffff] focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-[3px] bg-[#0f766e] hover:bg-[#0d645d] disabled:opacity-50 px-4 py-2.5 text-sm font-semibold text-[#ffffff] transition-colors whitespace-nowrap"
            >
              <span>サインイン / 新規ワークスペース開始</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-[#dfe3ea]" />
            <span className="text-[11px] font-mono text-[#64748b]">OR</span>
            <div className="h-px flex-1 bg-[#dfe3ea]" />
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={handleDemo}
            className="w-full rounded-[3px] border border-[#d2d7e2] bg-[#f8f9fb] hover:bg-[#f1f5f9] hover:border-[#cbd5e1] disabled:opacity-50 px-4 py-2.5 text-sm font-medium text-[#111827] transition-colors whitespace-nowrap"
          >
            デモワークスペースで試す（サンプルデータ入）
          </button>

          <p className="mt-6 text-[11px] text-[#64748b] leading-relaxed">
            注記: Firebase セットアップが見送られたため、Node.js サーバー側の永続データベースとセッショントークン認証によりユーザー分離を実装しています。
          </p>
        </div>
      </div>
    </div>
  );
}
