# 🚗 中古車リコールチェッカー

中古車販売店向けのリコール情報管理Webアプリ

## 機能

- **単発チェック**: 車台番号を入力 → リコール情報を即表示
- **在庫管理**: 車両を登録して一括管理
- **アラート**: 新リコール発表時に該当車両を自動通知

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. Playwrightのセットアップ

```bash
npx playwright install chromium
```

### 3. 環境変数の設定

```bash
cp .env.example .env
```

### 4. データベースの初期化

```bash
npx prisma db push
```

### 5. 開発サーバーの起動

```bash
npm run dev
```

http://localhost:3000 でアクセス

## 本番デプロイ

### Vercel

```bash
vercel
```

環境変数を設定:
- `DATABASE_URL`: PostgreSQL接続文字列

## 定期リコールチェック

在庫車両のリコールを定期チェック:

```bash
npm run check-recalls
```

Vercel Cronで毎日実行する場合は `vercel.json` に設定:

```json
{
  "crons": [{
    "path": "/api/cron/check-recalls",
    "schedule": "0 9 * * *"
  }]
}
```

## 対応メーカー

- ✅ トヨタ
- ✅ 日産
- ✅ ホンダ
- 🚧 マツダ（実装予定）
- 🚧 スバル（実装予定）
- 🚧 ダイハツ（実装予定）
- 🚧 三菱（実装予定）
- 🚧 スズキ（実装予定）

## 技術スタック

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Prisma + SQLite/PostgreSQL
- Playwright（スクレイピング）

## ライセンス

MIT
