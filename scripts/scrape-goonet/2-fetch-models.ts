// scripts/scrape-goonet/2-fetch-models.ts

import { chromium } from 'playwright';
import * as cheerio from 'cheerio';
import { getPrisma, sleep, retryWithBackoff, logProgress } from './utils';
import { Manufacturer } from '@prisma/client';

export async function fetchModels(manufacturers?: Manufacturer[]): Promise<number> {
  console.log('\n=== 車種一覧取得開始 ===\n');

  const prisma = getPrisma();
  let savedCount = 0;

  // メーカー一覧を取得
  if (!manufacturers) {
    manufacturers = await prisma.manufacturer.findMany({
      orderBy: { name: 'asc' }
    });
  }

  if (manufacturers.length === 0) {
    console.log('メーカーが登録されていません。先に1-fetch-manufacturers.tsを実行してください。');
    return 0;
  }

  console.log(`${manufacturers.length}メーカーの車種を取得します\n`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  try {
    for (let i = 0; i < manufacturers.length; i++) {
      const maker = manufacturers[i];

      if (!maker.goonetCode) {
        console.log(`⚠ ${maker.name}: Goo-netコードがありません (スキップ)`);
        continue;
      }

      console.log(`\n[${i + 1}/${manufacturers.length}] ${maker.name}の車種を取得中...`);

      const catalogUrl = `https://www.goo-net.com/catalog/${maker.goonetCode}/`;

      try {
        const page = await context.newPage();

        await retryWithBackoff(async () => {
          await page.goto(catalogUrl, { waitUntil: 'networkidle', timeout: 60000 });
        });

        await sleep(1000);

        const html = await page.content();
        const $ = cheerio.load(html);

        // 車種リンクを抽出（複数のセレクタパターンを試す）
        const models: Array<{ name: string; goonetCode: string }> = [];

        // パターン1: /catalog/{MAKER}/{MODEL}/ 形式のリンク
        $('a[href*="/catalog/"]').each((_, element) => {
          const href = $(element).attr('href');
          const text = $(element).text().trim();

          if (href && text) {
            const match = href.match(/\/catalog\/[A-Z_]+\/([A-Z0-9_-]+)\/?$/);
            if (match && match[1] && text.length > 1 && text.length < 50) {
              // 重複チェック
              if (!models.find(m => m.goonetCode === match[1])) {
                models.push({
                  name: text,
                  goonetCode: match[1]
                });
              }
            }
          }
        });

        console.log(`  ${models.length}車種を検出`);

        // データベースに保存
        for (const model of models) {
          try {
            // カナ変換（簡易的に名前をそのまま使用）
            const nameKana = model.name;

            await prisma.vehicleModel.upsert({
              where: {
                manufacturerId_name: {
                  manufacturerId: maker.id,
                  name: model.name
                }
              },
              update: {
                nameKana,
                goonetCode: model.goonetCode
              },
              create: {
                manufacturerId: maker.id,
                name: model.name,
                nameKana,
                goonetCode: model.goonetCode
              }
            });

            savedCount++;
          } catch (error) {
            console.error(`  ✗ ${model.name}の保存に失敗:`, error);
          }
        }

        console.log(`  ✓ ${models.length}車種を保存しました`);

        await page.close();

      } catch (error) {
        console.error(`  ✗ ${maker.name}の車種取得に失敗:`, error);
      }

      // レート制限: 2秒待機
      await sleep(2000);
    }

    console.log(`\n=== 車種一覧取得完了: ${savedCount}件 ===\n`);

    return savedCount;

  } catch (error) {
    console.error('車種一覧取得エラー:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

// スタンドアローン実行
if (require.main === module) {
  fetchModels()
    .then(count => {
      console.log(`完了: ${count}車種を保存しました`);
      process.exit(0);
    })
    .catch(error => {
      console.error('エラー:', error);
      process.exit(1);
    });
}
