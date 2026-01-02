# 車種・型式検索機能 セットアップガイド

## 実装完了内容

車台番号検索に加えて、**車種・型式での検索機能**を追加しました。

### 主な変更点

1. **データベース拡張**
   - Manufacturer（メーカー）テーブル
   - VehicleModel（車種）テーブル
   - ModelType（型式）テーブル
   - ScrapingMetadata（スクレイピング状態管理）テーブル

2. **Goo-netスクレイピングスクリプト**
   - 全メーカー・車種・型式データを自動取得
   - `/scripts/scrape-goonet/` ディレクトリ

3. **国交省サイト検索機能**
   - 車種・型式でリコール検索
   - `/src/lib/recall-checker/mlit.ts`

4. **新規API**
   - `GET /api/manufacturers` - メーカー一覧
   - `GET /api/models?maker=xxx&q=xxx` - 車種検索（インクリメンタル）
   - `GET /api/models/[modelId]/types` - 型式一覧
   - `POST /api/recall/check` - 検索方式拡張（chassis/model対応）

5. **フロントエンドUI**
   - 検索モード切り替えボタン
   - 車種・型式検索フォーム
   - インクリメンタル検索（入力に応じて候補表示）

---

## セットアップ手順

### 1. データベースマイグレーション実行

```bash
cd /Users/yuta/Desktop/開発/recall-checker-project
npm run db:push
```

これにより、新しいテーブルが作成されます。

### 2. Goo-netデータ取得（初回のみ）

全メーカー・車種・型式データをGoo-netから取得します。

```bash
# 全ステージ実行（メーカー → 車種 → 型式）
npm run scrape:goonet
```

**所要時間**: 車種数によりますが、数十分〜数時間かかります。

**個別実行も可能**:
```bash
# メーカーのみ
npm run scrape:manufacturers

# 車種のみ
npm run scrape:models

# 型式のみ
npm run scrape:types
```

**注意事項**:
- 2秒間隔でリクエストを送るため時間がかかります
- エラーが発生した場合は自動で3回リトライします
- 途中で中断した場合、再実行すれば途中から再開可能（upsert処理）

### 3. 開発サーバー起動

```bash
npm run dev
```

ブラウザで http://localhost:3000 を開きます。

---

## 使い方

### 車種・型式検索の流れ

1. **検索モード切り替え**
   - 「車種・型式で検索」ボタンをクリック

2. **メーカー選択**
   - ドロップダウンからメーカーを選択（例：日産）

3. **車種名入力**
   - 車種名を入力すると候補が表示されます
   - 例：「ノ」と入力 → 「ノート」「ノア」などが表示
   - 候補から選択

4. **型式選択**
   - 車種を選ぶと、その車種の型式一覧が表示されます
   - ドロップダウンから型式を選択（例：6AA-SNE13）

5. **検索実行**
   - 「リコールを検索」ボタンをクリック
   - 国土交通省のデータベースから検索結果を取得

### 既存機能（車台番号検索）

既存の車台番号検索も引き続き利用できます。

1. 「車台番号で検索」ボタンをクリック
2. 車台番号を入力
3. メーカーを選択
4. 検索

---

## トラブルシューティング

### データが表示されない

**原因**: Goo-netスクレイピングを実行していない

**解決策**:
```bash
npm run scrape:goonet
```

### 型式が表示されない

**原因**: 該当車種の型式データが取得できていない

**解決策**:
```bash
# 型式のみ再取得
npm run scrape:types
```

### 国交省サイトでエラーが出る

**原因**: サイトの構造が変更された可能性

**解決策**:
- `/src/lib/recall-checker/mlit.ts` のセレクタを確認
- 実際のサイトの構造と照らし合わせて修正

### Playwrightエラー

**原因**: ブラウザバイナリがインストールされていない

**解決策**:
```bash
npx playwright install
```

---

## ファイル構成

### 新規作成ファイル

```
scripts/scrape-goonet/
├── index.ts                    # メインスクリプト
├── 1-fetch-manufacturers.ts    # メーカー取得
├── 2-fetch-models.ts           # 車種取得
├── 3-fetch-model-types.ts      # 型式取得
└── utils.ts                    # 共通処理

src/lib/recall-checker/
└── mlit.ts                     # 国交省サイト検索

src/app/api/
├── manufacturers/route.ts      # メーカー一覧API
├── models/route.ts             # 車種検索API
└── models/[modelId]/types/route.ts  # 型式一覧API
```

### 主要な修正ファイル

```
prisma/schema.prisma            # DB拡張
src/app/page.tsx                # UI実装
src/app/api/recall/check/route.ts  # API拡張
src/types/index.ts              # 型定義追加
package.json                    # スクリプト追加
```

---

## データ更新について

### 定期更新の推奨

メーカーが新しい車種・型式をリリースした場合、定期的にデータを更新してください。

**月次更新例**:
```bash
# 毎月1日に実行
npm run scrape:goonet
```

**Cronジョブ設定例** (Linuxの場合):
```bash
0 0 1 * * cd /path/to/project && npm run scrape:goonet
```

### 差分更新

Upsert処理を使用しているため、同じスクリプトを再実行しても重複データは作成されません。

---

## 今後の拡張ポイント

### 1. キャッシュ機能
車種・型式検索結果をキャッシュして高速化

### 2. エラーハンドリング強化
国交省サイトの構造変更に対応

### 3. 検索履歴
よく検索される車種・型式を保存

### 4. バッチ検索
複数の車両を一括検索

---

## サポート

問題が発生した場合は、以下を確認してください：

1. データベースマイグレーションが完了しているか
2. Goo-netスクレイピングが完了しているか
3. 開発サーバーが起動しているか
4. Playwrightブラウザがインストールされているか

それでも解決しない場合は、エラーログを確認してください。
