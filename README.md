# Mini Software Factory

複数のソフトウェアプロジェクトと AI コーディングエージェント（Claude Code / OpenAI Codex / Devin / カスタム）を一元管理する、マルチエージェント開発コントロールプレーンです。プロジェクトごとにタスクを作り、エージェントに割り当てて実行し、その結果（ログ・所要時間・コスト・Pull Request）を追跡します。

> **現在は MVP です。** エージェントの実行は **Mock Adapter によるシミュレーション** のみ対応しています。外部プロバイダーへの実接続（API キー / Webhook / OAuth）は、認証情報の保存と接続テストまで実装済みです。実行はまだできません。

## 技術スタック

| 領域 | 内容 |
| --- | --- |
| フロントエンド | React 19 + Vite 8 + Tailwind CSS v4、lucide-react |
| バックエンド | Express 5（ローカルは Node.js のネイティブ TypeScript 実行、Vercel では 1 つの関数にバンドル） |
| 永続化 | ローカルは `.data/kv-store.json`、Vercel ではメモリ（デモデータは初回アクセス時に投入） |
| テスト | `node:test` |

## 必要環境

- Node.js 22.18 以上（`.ts` ファイルを直接実行するため）

## セットアップ

```bash
npm install
cp .env.example .env   # 任意
npm run dev
```

http://localhost:3000 を開きます。`?autostart=1` を付けると、デモワークスペースに自動でサインインします。

### 環境変数

| 変数 | 既定値 | 説明 |
| --- | --- | --- |
| `PORT` | `3000` | 待ち受けポート |
| `HOST` | `localhost` | 待ち受けアドレス。コンテナ等で公開する場合は `0.0.0.0` |
| `NODE_ENV` | — | `production` のとき `dist/` を配信（`npm start` が自動で設定） |

## スクリプト

| コマンド | 内容 |
| --- | --- |
| `npm run dev` | 開発サーバー（Vite ミドルウェア + HMR）。サーバー側コードの変更は手動で再起動 |
| `npm run build` | クライアントを `dist/` にビルド |
| `npm run build:vercel` | Vercel 用の出力（`.vercel/output`）を生成。Vercel のビルドコマンドとして使用 |
| `npm start` | 本番モードで起動（事前に `npm run build`） |
| `npm run typecheck` | TypeScript の型チェック |
| `npm test` | ユニットテスト（状態遷移・バリデーション・集計ロジック） |

## Vercel へのデプロイ

設定は [vercel.json](vercel.json) にあります。リポジトリをインポートすれば、`npm run build:vercel` が次の内容を `.vercel/output` に出力します（Build Output API）。

- `static/`：ビルドしたフロントエンド
- `functions/api.func`：`/api/*` をすべて処理する 1 つの Node.js 関数（[server/vercel.ts](server/vercel.ts) をバンドルしたもの）
- ルーティング：静的ファイル → `/api/*` は関数 → それ以外は `index.html`

> **Vercel 上のデータはメモリにしか保存されません。** 関数インスタンスが入れ替わるとデータとログイン状態がリセットされます。詳しくは [docs/improvements.md](docs/improvements.md) を参照してください。

## 機能

### 認証・オンボーディング
- メールアドレスと表示名でサインインします（パスワードなし、未登録なら自動作成）。デモワークスペースにはワンクリックで入れます。
- セッションはトークン方式で、有効期限は 7 日です。トークンはブラウザの `sessionStorage` に保存し、`Authorization: Bearer` ヘッダーで送ります。
- 新規ユーザーは最初にオンボーディングウィザードを進めます（プロジェクト → エージェント → タスク → モック実行 → 完了）。

### 画面

| 画面 | 内容 |
| --- | --- |
| ダッシュボード | KPI（プロジェクト数、稼働エージェント、実行中、未完了 / 完了タスク、未マージ PR）、エージェント稼働状況、最近の実行、最近の PR |
| プロジェクト | 作成・編集・削除（関連タスクと実行履歴も削除）、詳細画面でタスク・実行・アクティビティを表示 |
| タスク | 作成・編集・削除、ステータス変更、エージェント割り当て、Pull Request の紐付け、検索とフィルター |
| エージェント | 登録・編集・削除、接続テスト、エージェント別の実行履歴へ移動 |
| 実行履歴 | 実行の開始・キャンセル、ステータスと段階別ログの表示。実行中は自動で更新 |
| 分析・ログ | 成功率、平均所要時間、コスト、日別推移、エージェント別 / プロジェクト別の分布、アクティビティログ |
| 設定 | プロフィール、GitHub 連携情報、プロバイダーごとの API キーと既定モデル、通知・ポーリング設定 |

実行中のジョブがあると、画面は 1.5 秒間隔で状態を取りに行きます。ないときは 4 秒間隔です。

## ドメインモデル

| エンティティ | 主な属性 |
| --- | --- |
| `Project` | 名前、説明、リポジトリ URL、既定ブランチ、ステータス（`active` / `paused` / `archived`） |
| `Task` | プロジェクト、タイトル、説明、担当エージェント、優先度（`critical` / `high` / `medium` / `low`）、ステータス、期日、紐付け PR |
| `Agent` | プロバイダー（`claude_code` / `openai_codex` / `devin` / `custom`）、接続方式（`mock` / `api_key` / `webhook` / `oauth`）、接続状態、モデル、失敗シミュレーション |
| `Execution` | タスク・エージェント、実行モード（`mock` / `real`）、ステータス、入力指示、出力 / エラー、段階別ログ、所要時間、トークン数、推定コスト、PR URL |
| `ActivityLog` | 作成・更新・割り当て・実行・PR 紐付け・設定変更などのイベント履歴 |
| `UserSettings` | GitHub 連携、プロバイダー別設定、各種設定（通知、ポーリング間隔） |

型定義は [src/shared/types.ts](src/shared/types.ts) にあります。

### タスクのステータス遷移

| 現在 | 遷移できる先 |
| --- | --- |
| `backlog` | `ready`, `queued`, `cancelled` |
| `ready` | `backlog`, `queued`, `running`, `review`, `cancelled` |
| `queued` | `running`, `ready`, `cancelled`, `failed` |
| `running` | `review`, `completed`, `failed`, `cancelled` |
| `review` | `completed`, `ready`, `failed`, `cancelled` |
| `completed` | `ready`, `review` |
| `failed` | `ready`, `queued`, `backlog`, `cancelled` |
| `cancelled` | `backlog`, `ready` |

### 実行のステータス遷移

`queued` → `running` → `completed` / `failed` / `cancelled` の順に進みます。`queued` からは `cancelled` / `failed` にも移れます。終了した状態（`completed` / `failed` / `cancelled`）からは変更できません。

遷移ルールは [src/shared/logic.ts](src/shared/logic.ts) で定義しています。クライアントとサーバーの両方が同じ定義を使います。

## エージェントアダプター

アダプターはエージェントの接続方式で決まります（[server/services/agentAdapters.ts](server/services/agentAdapters.ts)）。

- **Mock Adapter**（`connectionType: mock`）
  - 実行を数秒かけてシミュレーションします：キュー → 実行開始 → 設計・計画 → 変更・テスト → 完了。
  - タイマーは使わず、API が呼ばれるたびに経過時間から状態を進めます（サーバーレス対応）。
  - 完了すると、ダミーの出力、トークン数、推定コスト、シミュレーション PR の URL を記録します。タスクのステータスも連動して更新されます。
  - エージェントに「失敗をシミュレート」を設定すると、必ず `failed` で終わります。
  - 外部への通信は一切しません。
- **External Provider Adapter**（`api_key` / `webhook` / `oauth`）
  - 接続テストでは、認証情報が未登録なら `not_configured`、登録済みなら `disconnected` を返します。外部ランタイムがまだ接続されていないためです。
  - 実行を開始しようとすると `422` エラーになります。

実行ルール：
- 同じタスクで待機中または実行中の実行がある間は、新しい実行を開始できません（`409`）。
- キャンセルできるのは Mock Adapter の実行だけです。

### 認証情報の扱い

API キーや GitHub トークンはサーバー側のストア（`secrets`）にだけ保存します。クライアントには `abcd••••••••wxyz` のようにマスクした値しか返しません。エージェントを削除すると、そのエージェントの API キーも削除され、割り当てられていたタスクは未割り当てに戻ります。

## REST API

`/api/health` と認証系の一部を除き、すべて `Authorization: Bearer <token>` が必要です。

| メソッド | パス | 内容 |
| --- | --- | --- |
| GET | `/api/health` | ヘルスチェック |
| POST | `/api/auth/login` | サインイン（`email`, `displayName`） |
| POST | `/api/auth/demo` | デモユーザーでサインイン |
| POST | `/api/auth/logout` | サインアウト |
| GET | `/api/auth/me` | 現在のユーザー |
| POST | `/api/auth/onboarding/complete` | オンボーディング完了 |
| GET | `/api/dashboard` | ダッシュボード集計 |
| GET / POST | `/api/projects` | 一覧 / 作成 |
| GET / PATCH / DELETE | `/api/projects/:id` | 詳細 / 更新 / 削除 |
| GET / POST | `/api/tasks` | 一覧（`projectId`, `status`）/ 作成 |
| GET / PATCH / DELETE | `/api/tasks/:id` | 詳細 / 更新 / 削除 |
| POST | `/api/tasks/:id/pr` | Pull Request の紐付け（GitHub URL のみ） |
| GET / POST | `/api/agents` | 一覧（実行数付き）/ 登録 |
| PATCH / DELETE | `/api/agents/:id` | 更新 / 削除 |
| POST | `/api/agents/:id/test` | 接続テスト |
| GET / POST | `/api/executions` | 一覧（`projectId`, `agentId`, `status`）/ 実行開始 |
| GET | `/api/executions/:id` | 詳細 |
| POST | `/api/executions/:id/cancel` | キャンセル |
| GET | `/api/analytics` | 分析集計（`from`, `to`, `projectId`） |
| GET | `/api/activity` | アクティビティログ（`projectId`, `agentId`, `eventType`, `from`, `to`） |
| GET / PATCH | `/api/settings` | 設定の取得 / 更新 |

エラー時は `{ "error": "メッセージ" }` を、適切な HTTP ステータス（400 / 401 / 404 / 409 / 422）と一緒に返します。すべてのデータはユーザー単位で分かれています。

## ディレクトリ構成

```
server.ts                       ローカル用エントリーポイント（Express + Vite ミドルウェア）
server/app.ts                   Express アプリ本体（ローカルと Vercel で共通）
server/vercel.ts                Vercel Function のエントリーポイント
server/routes/api.ts            REST API
server/services/agentAdapters.ts エージェントアダプター（Mock / External）
server/services/githubService.ts Pull Request URL の検証と参照の生成
server/storage.ts               ワークスペース、セッション、シークレット、シードデータ
server/store.ts                 保存先の切り替え（ファイル / メモリ）
scripts/build-vercel.ts         Vercel 用ビルド出力の生成
docs/improvements.md            改善ポイント
src/App.tsx                     アプリシェル（認証、ルーティング、ポーリング）
src/components/                 各画面のコンポーネント
src/hooks/                      カスタムフック
src/lib/api.ts                  型付き API クライアント
src/lib/labels.ts               表示ラベル
src/shared/                     クライアントとサーバーで共有する型・ロジック・テスト
```

## 今後の課題

詳細と対応方針は [docs/improvements.md](docs/improvements.md) にまとめています。主なものは次のとおりです。

- Vercel 上のデータがメモリにしか残らない（インスタンスの入れ替えやデプロイでリセット、複数インスタンスで不整合）
- 同じユーザーの同時更新で後から保存した方が勝つ
- パスワードなしのメールログインのため、なりすましができる
- デモワークスペースを全訪問者で共有している
- 実プロバイダー（Claude Code / Codex / Devin）向けワーカーランタイムとの接続、GitHub PR ステータスの自動同期
