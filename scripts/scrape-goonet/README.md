# Goo-net スクレイピングスクリプト

Goo-netから全メーカー・全車種・全グレードのデータを取得するスクリプト群です。

## 📋 取得できるデータ

### メーカー情報
- メーカー名
- Goo-netコード

### 車種情報
- 車種名
- 車種カナ
- Goo-netコード

### グレード・型式情報
- **グレード名** (例: XG)
- **型式コード** (例: 3BA-JB64W)
- **排気量** (例: 658cc)
- **ドア数** (例: 3)
- **変速機** (例: 5MT)
- **駆動方式** (例: パートタイム4WD)
- **乗車定員** (例: 4名)
- **燃費** (例: 16.6km/l)
- **車両重量** (例: 1060kg)
- **寸法** (例: 3395×1475×1725mm)
- **価格** (例: 1,918,400円)
- **カタログURL**

## 🚀 使い方

### 1. 全データを一括取得（推奨）

```bash
npm run scrape:all
```

このコマンドで以下が順次実行されます:
1. 全メーカーの取得
2. 各メーカーの全車種の取得
3. 各車種の全グレード・型式詳細の取得

**所要時間**: 数時間（データ量による）

### 2. 段階的に取得

#### ステップ1: メーカー一覧を取得
```bash
npm run scrape:manufacturers
```

#### ステップ2: 車種一覧を取得
```bash
npm run scrape:models
```

#### ステップ3: グレード・型式詳細を取得
```bash
npm run scrape:grades
```

### 3. テスト実行（スズキのみ）

```bash
npm run scrape:test-suzuki
```

スズキの最初の3車種のみを取得してテストします。

## 📁 スクリプト構成

```
scripts/scrape-goonet/
├── 1-fetch-manufacturers.ts  # メーカー一覧取得
├── 2-fetch-models.ts          # 車種一覧取得
├── 3-fetch-model-types.ts     # 型式取得（旧版）
├── 4-fetch-grade-details.ts   # グレード・型式詳細取得（新版）
├── run-all.ts                 # 全データ一括取得
├── test-suzuki.ts             # スズキテスト
├── utils.ts                   # ユーティリティ関数
└── README.md                  # このファイル
```

## 🗄️ データベーススキーマ

### Manufacturer（メーカー）
```prisma
model Manufacturer {
  id            String   @id @default(cuid())
  name          String   @unique
  goonetCode    String?  @unique
}
```

### VehicleModel（車種）
```prisma
model VehicleModel {
  id             String   @id @default(cuid())
  manufacturerId String
  name           String
  nameKana       String?
  goonetCode     String?
}
```

### ModelType（グレード・型式）
```prisma
model ModelType {
  id              String   @id @default(cuid())
  vehicleModelId  String
  typeCode        String   // 型式コード
  gradeName       String?  // グレード名
  displacement    String?  // 排気量
  doors           String?  // ドア数
  transmission    String?  // 変速機
  driveSystem     String?  // 駆動方式
  seatingCapacity String?  // 乗車定員
  fuelEfficiency  String?  // 燃費
  weight          String?  // 車両重量
  dimensions      String?  // 寸法
  price           String?  // 価格
  catalogUrl      String?  // カタログURL
}
```

## ⚙️ 動作の仕組み

### 1-fetch-manufacturers.ts
1. https://www.goo-net.com/catalog/ にアクセス
2. 全メーカーのリンクを抽出
3. データベースに保存

### 2-fetch-models.ts
1. 各メーカーのカタログページにアクセス
2. 車種リンクを抽出
3. データベースに保存

### 4-fetch-grade-details.ts
1. 各車種のカタログページにアクセス
2. 年式アコーディオンを全て展開
3. テーブルから各行（グレード）のデータを抽出:
   - グレード名
   - 型式コード
   - 排気量、ドア数、変速機など
4. データベースに保存

## 🔧 技術詳細

### スクレイピング
- **Playwright**: ブラウザ自動操作
- **Cheerio**: HTML解析
- **User-Agent**: Chrome 120を偽装

### レート制限
- 各ページ取得後、2-3秒待機
- リトライ機能（最大3回）

### エラーハンドリング
- 失敗した車種はスキップして続行
- エラー内容はコンソールに出力
- スクレイピングステータスをDBに記録

## 📊 取得データの確認

### Prisma Studio で確認
```bash
npm run db:studio
```

ブラウザで http://localhost:5555 が開き、データベースの内容を確認できます。

### 統計情報
`run-all.ts` 実行後、以下のような統計が表示されます:

```
【メーカー別データ統計】

  トヨタ: 150車種, 1200グレード
  日産: 120車種, 950グレード
  ホンダ: 100車種, 800グレード
  ...
```

## ⚠️ 注意事項

1. **実行時間**: 全データ取得には数時間かかる場合があります
2. **サーバー負荷**: レート制限を守り、サーバーに過度な負荷をかけないようにしてください
3. **データの正確性**: スクレイピング対象のサイト構造が変わると、データ取得に失敗する可能性があります
4. **利用規約**: Goo-netの利用規約を遵守してください

## 🐛 トラブルシューティング

### エラー: "型式コードがありません"
→ 車種データが正しく取得できていません。`scrape:models` を再実行してください。

### エラー: "Goo-netコードがありません"
→ メーカーデータが正しく取得できていません。`scrape:manufacturers` を再実行してください。

### エラー: "タイムアウト"
→ ネットワーク接続を確認してください。リトライ機能で自動的に再試行されます。

### データが取得できない
→ Goo-netのサイト構造が変わった可能性があります。スクリプトのセレクタを確認してください。

## 📝 今後の改善案

- [ ] 中断・再開機能の追加
- [ ] 並列処理による高速化
- [ ] 進捗状況の詳細表示
- [ ] データの差分更新機能
- [ ] エクスポート機能（CSV、JSON）
