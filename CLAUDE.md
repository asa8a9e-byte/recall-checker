# 中古車リコールチェッカー - プロジェクト仕様書

## 概要

中古車販売店向けのリコール情報管理Webアプリ。車台番号を入力するとリコール対象かどうかを即座に確認でき、在庫車両を登録しておけば新リコール発表時に自動通知を受け取れる。

## 機能一覧

### MVP（Phase 1）
1. **単発チェック**: 車台番号入力 → リコール情報表示
2. **在庫登録**: 車両を登録して管理
3. **アラート**: 新リコール発表時に該当車両を通知

### 将来対応
- LINE連携
- パーツ情報（消耗部品の概算費用）
- PDF証明書出力

---

## 技術スタック

```
フロントエンド:
  - Next.js 14 (App Router)
  - TypeScript
  - Tailwind CSS
  - React Hook Form + Zod

バックエンド:
  - Next.js API Routes
  - Prisma ORM
  - SQLite（開発） → PostgreSQL（本番）

スクレイピング:
  - Playwright（ブラウザ自動操作）
  - Cheerio（HTML解析）

認証:
  - NextAuth.js（後で追加）

通知:
  - メール: Resend
  - ブラウザ: Web Push API

デプロイ:
  - Vercel
```

---

## ディレクトリ構成

```
recall-checker/
├── CLAUDE.md                 # この仕様書
├── package.json
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
├── prisma/
│   └── schema.prisma         # DBスキーマ
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx          # ホーム（単発チェック）
│   │   ├── inventory/
│   │   │   └── page.tsx      # 在庫管理
│   │   ├── alerts/
│   │   │   └── page.tsx      # アラート一覧
│   │   └── api/
│   │       ├── recall/
│   │       │   ├── check/route.ts      # 単発リコールチェック
│   │       │   └── bulk-check/route.ts # 一括チェック
│   │       ├── inventory/
│   │       │   └── route.ts  # 在庫CRUD
│   │       └── alerts/
│   │           └── route.ts  # アラート取得
│   ├── components/
│   │   ├── Header.tsx
│   │   ├── TabNav.tsx
│   │   ├── RecallSearchForm.tsx
│   │   ├── RecallResult.tsx
│   │   ├── InventoryTable.tsx
│   │   ├── InventoryAddForm.tsx
│   │   └── AlertList.tsx
│   ├── lib/
│   │   ├── db.ts             # Prismaクライアント
│   │   ├── recall-checker/
│   │   │   ├── index.ts      # 統合検索
│   │   │   ├── toyota.ts     # トヨタ用
│   │   │   ├── nissan.ts     # 日産用
│   │   │   ├── honda.ts      # ホンダ用
│   │   │   └── types.ts      # 型定義
│   │   └── utils.ts
│   └── types/
│       └── index.ts
└── scripts/
    └── check-new-recalls.ts  # 定期実行スクリプト
```

---

## データベース設計

### schema.prisma

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}

// 在庫車両
model Vehicle {
  id            String   @id @default(cuid())
  chassisNumber String   @unique  // 車台番号
  maker         String            // メーカー
  model         String?           // 車種名
  year          String?           // 年式
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  recalls       VehicleRecall[]
  alerts        Alert[]
}

// リコール情報
model Recall {
  id          String   @id @default(cuid())
  recallId    String   @unique  // メーカーのリコールID
  maker       String            // 対象メーカー
  title       String            // リコール名
  description String?           // 詳細
  severity    String   @default("medium")  // high/medium/low
  publishedAt DateTime          // 発表日
  createdAt   DateTime @default(now())
  
  vehicles    VehicleRecall[]
}

// 車両とリコールの関連
model VehicleRecall {
  id         String   @id @default(cuid())
  vehicleId  String
  recallId   String
  status     String   @default("pending")  // pending/completed
  checkedAt  DateTime @default(now())
  
  vehicle    Vehicle  @relation(fields: [vehicleId], references: [id], onDelete: Cascade)
  recall     Recall   @relation(fields: [recallId], references: [id], onDelete: Cascade)
  
  @@unique([vehicleId, recallId])
}

// アラート通知
model Alert {
  id        String   @id @default(cuid())
  vehicleId String
  title     String
  message   String?
  status    String   @default("unread")  // unread/read
  createdAt DateTime @default(now())
  
  vehicle   Vehicle  @relation(fields: [vehicleId], references: [id], onDelete: Cascade)
}
```

---

## API設計

### 1. リコールチェック

```typescript
// POST /api/recall/check
// 単発の車台番号チェック

// Request
{
  "chassisNumber": "ZWR80-1234567"
}

// Response
{
  "success": true,
  "data": {
    "chassisNumber": "ZWR80-1234567",
    "maker": "トヨタ",
    "hasRecall": true,
    "recalls": [
      {
        "id": "R2024-001",
        "title": "エアバッグインフレータ不具合",
        "description": "...",
        "severity": "high",
        "status": "pending",
        "publishedAt": "2024-10-15"
      }
    ]
  }
}
```

### 2. 在庫管理

```typescript
// GET /api/inventory
// 在庫一覧取得

// Response
{
  "success": true,
  "data": [
    {
      "id": "xxx",
      "chassisNumber": "ZWR80-1234567",
      "maker": "トヨタ",
      "model": "ヴォクシー",
      "year": "2019",
      "recallCount": 2,
      "hasUnresolvedRecall": true
    }
  ],
  "summary": {
    "total": 10,
    "withRecall": 3,
    "withoutRecall": 7
  }
}

// POST /api/inventory
// 在庫追加

// Request
{
  "chassisNumber": "ZWR80-1234567",
  "maker": "トヨタ",
  "model": "ヴォクシー",
  "year": "2019"
}

// DELETE /api/inventory/:id
// 在庫削除
```

### 3. アラート

```typescript
// GET /api/alerts
// アラート一覧

// Response
{
  "success": true,
  "data": [
    {
      "id": "xxx",
      "title": "新リコール発表",
      "message": "トヨタ ヴォクシー (ZWR80-1234567) が対象です",
      "status": "unread",
      "createdAt": "2025-01-15T10:00:00Z",
      "vehicle": {
        "chassisNumber": "ZWR80-1234567",
        "model": "ヴォクシー"
      }
    }
  ],
  "unreadCount": 2
}

// PATCH /api/alerts/:id
// 既読にする
{
  "status": "read"
}
```

---

## リコール検索ロジック

### 車台番号からメーカー判定

```typescript
// src/lib/recall-checker/index.ts

const MAKER_PREFIXES: Record<string, string[]> = {
  'トヨタ': ['JT', 'SB', 'JTE'],
  '日産': ['JN', 'SJ'],
  'ホンダ': ['JH', 'SH'],
  'マツダ': ['JM'],
  'スバル': ['JF'],
  'ダイハツ': ['LA', 'M3'],
  '三菱': ['JA', 'JMB'],
  'スズキ': ['JS', 'MA'],
};

function detectMaker(chassisNumber: string): string | null {
  const prefix = chassisNumber.substring(0, 2).toUpperCase();
  
  for (const [maker, prefixes] of Object.entries(MAKER_PREFIXES)) {
    if (prefixes.some(p => chassisNumber.toUpperCase().startsWith(p))) {
      return maker;
    }
  }
  return null;
}
```

### 各メーカーのスクレイピング

```typescript
// src/lib/recall-checker/toyota.ts

import { chromium } from 'playwright';

export async function checkToyotaRecall(chassisNumber: string) {
  // 車台番号を前後に分割
  const [prefix, suffix] = splitChassisNumber(chassisNumber);
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    await page.goto('https://www.toyota.co.jp/recall-search/dc/search');
    
    // フォームに入力
    await page.fill('input[name="chassisNoPrefix"]', prefix);
    await page.fill('input[name="chassisNoSuffix"]', suffix);
    
    // 検索実行
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');
    
    // 結果をパース
    const results = await parseRecallResults(page);
    
    return results;
  } finally {
    await browser.close();
  }
}

function splitChassisNumber(chassis: string): [string, string] {
  // ハイフンで分割、なければ適切な位置で分割
  if (chassis.includes('-')) {
    const parts = chassis.split('-');
    return [parts[0], parts.slice(1).join('-')];
  }
  // トヨタの場合、通常最初の部分が型式
  return [chassis.substring(0, 5), chassis.substring(5)];
}
```

---

## 実装手順

### Step 1: プロジェクト初期化
```bash
npx create-next-app@latest recall-checker --typescript --tailwind --app
cd recall-checker
npm install prisma @prisma/client playwright cheerio
npm install -D @types/cheerio
npx prisma init
```

### Step 2: DB設定
- `prisma/schema.prisma` を作成
- `npx prisma db push` でDB作成

### Step 3: リコール検索ロジック実装
1. `src/lib/recall-checker/types.ts` - 型定義
2. `src/lib/recall-checker/toyota.ts` - トヨタ用
3. `src/lib/recall-checker/nissan.ts` - 日産用
4. `src/lib/recall-checker/honda.ts` - ホンダ用
5. `src/lib/recall-checker/index.ts` - 統合

### Step 4: API実装
1. `/api/recall/check` - 単発チェック
2. `/api/inventory` - 在庫CRUD
3. `/api/alerts` - アラート

### Step 5: UI実装
1. レイアウト・ヘッダー
2. 単発チェック画面
3. 在庫管理画面
4. アラート画面

### Step 6: 定期チェック
- `scripts/check-new-recalls.ts` - 新リコール監視スクリプト
- Vercel Cron または外部スケジューラーで定期実行

---

## 環境変数

```env
# .env.local

DATABASE_URL="file:./dev.db"

# メール通知（Resend）
RESEND_API_KEY="re_xxx"

# 本番環境用
# DATABASE_URL="postgresql://..."
```

---

## UIデザイン参考

添付の `recall_checker_app.jsx` を参照。主な画面：

1. **単発チェック画面**
   - 大きな入力フォーム
   - 検索結果（リコールあり/なし）
   - リコール詳細カード

2. **在庫管理画面**
   - 追加フォーム
   - サマリー（総数/リコール対象/問題なし）
   - テーブル一覧

3. **アラート画面**
   - 新着通知リスト
   - 通知設定

---

## 注意事項

1. **スクレイピング頻度**
   - 各メーカーサイトへのアクセスは1秒以上間隔を空ける
   - 一括チェックは並列数を制限（同時3件まで等）

2. **エラーハンドリング**
   - メーカーサイトの構造変更に備えてセレクタを設定ファイル化
   - 検索失敗時は手動確認を促すメッセージ

3. **キャッシュ**
   - リコール情報は24時間キャッシュ
   - 同じ車台番号の再検索は即座に返す

---

## 完成後の確認項目

- [ ] トヨタの車台番号でリコール検索できる
- [ ] 日産の車台番号でリコール検索できる
- [ ] ホンダの車台番号でリコール検索できる
- [ ] 在庫に車両を追加できる
- [ ] 在庫一覧が表示される
- [ ] 在庫を削除できる
- [ ] 一括リコールチェックが動作する
- [ ] アラートが表示される
