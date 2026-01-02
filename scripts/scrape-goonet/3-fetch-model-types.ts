// scripts/scrape-goonet/3-fetch-model-types.ts

import { chromium } from 'playwright';
import * as cheerio from 'cheerio';
import { getPrisma, sleep, retryWithBackoff, logProgress } from './utils';
import { VehicleModel, Manufacturer } from '@prisma/client';

type VehicleModelWithManufacturer = VehicleModel & {
  manufacturer: Manufacturer;
};

export async function fetchModelTypes(models?: VehicleModelWithManufacturer[]): Promise<number> {
  console.log('\n=== 型式一覧取得開始 ===\n');

  const prisma = getPrisma();
  let savedCount = 0;

  // 車種一覧を取得
  if (!models) {
    models = await prisma.vehicleModel.findMany({
      include: { manufacturer: true },
      orderBy: { name: 'asc' }
    }) as VehicleModelWithManufacturer[];
  }

  if (models.length === 0) {
    console.log('車種が登録されていません。先に2-fetch-models.tsを実行してください。');
    return 0;
  }

  console.log(`${models.length}車種の型式を取得します\n`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  try {
    for (let i = 0; i < models.length; i++) {
      const model = models[i];

      if (!model.goonetCode || !model.manufacturer.goonetCode) {
        console.log(`⚠ ${model.manufacturer.name} ${model.name}: Goo-netコードがありません (スキップ)`);
        continue;
      }

      console.log(`\n[${i + 1}/${models.length}] ${model.manufacturer.name} ${model.name}の型式を取得中...`);

      const typeUrl = `https://www.goo-net.com/catalog/${model.manufacturer.goonetCode}/${model.goonetCode}/`;

      try {
        const page = await context.newPage();

        await retryWithBackoff(async () => {
          await page.goto(typeUrl, { waitUntil: 'networkidle', timeout: 60000 });
        });

        // ページ読み込み後少し待機
        await sleep(2000);

        // 年式アコーディオンを全て展開（最初の5つのみ - データ量削減のため）
        try {
          const accordionButtons = await page.$$('button[data-toggle], .accordion-button, .year-toggle');
          for (let j = 0; j < Math.min(accordionButtons.length, 5); j++) {
            try {
              await accordionButtons[j].click();
              await sleep(500);
            } catch (e) {
              // クリックできない場合は無視
            }
          }
          await sleep(1000);
        } catch (e) {
          // アコーディオンがない場合は無視
        }

        const html = await page.content();
        const $ = cheerio.load(html);

        // 型式情報を抽出
        const modelTypes: Array<{ typeCode: string; description?: string; startYear?: string; endYear?: string }> = [];

        // テーブルから型式を抽出（型式列を探す）
        $('table tr').each((_, tr) => {
          const $tr = $(tr);
          const cells = $tr.find('td');

          // 各セルをチェックして型式パターンを探す
          cells.each((__, td) => {
            const text = $(td).text().trim();

            // 型式コードを探す（5BA-HA37S, DBA-E12改 などの形式）
            const typeCodePattern = /([A-Z0-9]{1,6}-[A-Z0-9]{2,10}(?:改)?)/g;
            const matches = text.match(typeCodePattern);

            if (matches) {
              matches.forEach(typeCode => {
                // 重複チェック
                if (!modelTypes.find(t => t.typeCode === typeCode)) {
                  // 同じ行から説明を取得（グレード名など）
                  const firstCell = $tr.find('td').first().text().trim();

                  // 年式情報を取得（親要素から）
                  let startYear: string | undefined;
                  let endYear: string | undefined;
                  const parentText = $tr.closest('div, section').find('h2, h3, .year-range').text();
                  const yearPattern = /(\d{4})年.*?[〜～-].*?(\d{4})年?/;
                  const yearMatch = parentText.match(yearPattern);

                  if (yearMatch) {
                    startYear = yearMatch[1];
                    endYear = yearMatch[2];
                  } else {
                    // 単一年式の場合（例: 2019年）
                    const singleYearMatch = text.match(/(\d{4})年/);
                    if (singleYearMatch) {
                      startYear = singleYearMatch[1];
                    }
                  }

                  // 説明文を取得（グレード名など）
                  const description = firstCell && firstCell !== typeCode ? firstCell : undefined;

                  modelTypes.push({
                    typeCode,
                    description: description?.substring(0, 100),
                    startYear,
                    endYear
                });
              }
            });
          }
        });

        // パターン2: リンクのhref属性から型式を抽出
        $('a[href*="/type/"]').each((_, element) => {
          const href = $(element).attr('href');
          const text = $(element).text().trim();

          if (href) {
            const match = href.match(/\/type\/([A-Z0-9-]+)\/?$/);
            if (match && match[1]) {
              const typeCode = match[1];

              // 重複チェック
              if (!modelTypes.find(t => t.typeCode === typeCode)) {
                modelTypes.push({
                  typeCode,
                  description: text.length > 0 && text.length < 100 ? text : undefined
                });
              }
            }
          }
        });

        console.log(`  ${modelTypes.length}型式を検出`);

        // データベースに保存
        for (const modelType of modelTypes) {
          try {
            await prisma.modelType.upsert({
              where: {
                vehicleModelId_typeCode: {
                  vehicleModelId: model.id,
                  typeCode: modelType.typeCode
                }
              },
              update: {
                description: modelType.description,
                startYear: modelType.startYear,
                endYear: modelType.endYear
              },
              create: {
                vehicleModelId: model.id,
                typeCode: modelType.typeCode,
                description: modelType.description,
                startYear: modelType.startYear,
                endYear: modelType.endYear
              }
            });

            savedCount++;
          } catch (error) {
            console.error(`  ✗ ${modelType.typeCode}の保存に失敗:`, error);
          }
        }

        console.log(`  ✓ ${modelTypes.length}型式を保存しました`);

        await page.close();

      } catch (error) {
        console.error(`  ✗ ${model.manufacturer.name} ${model.name}の型式取得に失敗:`, error);
      }

      // レート制限: 2秒待機
      await sleep(2000);
    }

    console.log(`\n=== 型式一覧取得完了: ${savedCount}件 ===\n`);

    return savedCount;

  } catch (error) {
    console.error('型式一覧取得エラー:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

// スタンドアローン実行
if (require.main === module) {
  fetchModelTypes()
    .then(count => {
      console.log(`完了: ${count}型式を保存しました`);
      process.exit(0);
    })
    .catch(error => {
      console.error('エラー:', error);
      process.exit(1);
    });
}
