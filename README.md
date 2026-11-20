# Mini Software Factory

複数のソフトウェアプロジェクトと AI コーディングエージェントを一元管理する、マルチエージェント開発コントロールプレーンです。

- **フロントエンド**: React 19 + Vite + Tailwind CSS v4
- **バックエンド**: Express 5（Node.js のネイティブ TypeScript 実行）
- **永続化**: `.data/factory-db.json`（ローカル JSON ストア）

## 必要環境

- Node.js 22.18 以上（`.ts` ファイルを直接実行するため）

## セットアップ

```bash
npm install
cp .env.example .env   # 任意
npm run dev
```

http://localhost:3000 を開きます。`?autostart=1` を付けるとデモワークスペースに自動サインインします。

## スクリプト

| コマンド | 内容 |
| --- | --- |
| `npm run dev` | 開発サーバー（Vite ミドルウェア + HMR） |
| `npm run build` | クライアントを `dist/` にビルド |
| `npm start` | 本番モードで起動（事前に `npm run build`） |
| `npm run typecheck` | TypeScript の型チェック |
| `npm test` | `node:test` によるユニットテスト |

## ディレクトリ構成

```
server.ts               エントリーポイント（Express + Vite）
server/routes/api.ts    REST API
server/services/        エージェントアダプター / GitHub 連携
server/storage.ts       JSON ストア
src/                    React クライアント
src/shared/             クライアント・サーバー共通の型とロジック
```
