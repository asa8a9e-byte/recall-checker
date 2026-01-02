// テスト用：特定の車種のみ型式を取得

import { chromium } from 'playwright';
import * as cheerio from 'cheerio';
import { getPrisma, sleep, retryWithBackoff } from './utils.js';

async function main() {
  console.log('\n=== テスト：型式取得 ===\n');

  const prisma = getPrisma();

  // テスト対象の車種（人気車種）
  const testModels = [
    { manufacturer: 'MAZDA', model: 'ROADSTER' },
    { manufacturer: 'TOYOTA', model: 'PRIUS' },
    { manufacturer: 'NISSAN', model: 'NOTE' },
    { manufacturer: 'HONDA', model: 'FIT' },
    { manufacturer: 'SUZUKI', model: 'ALTO' },
    { manufacturer: 'DAIHATSU', model: 'HIJET_CARGO' },
    { manufacturer: 'TOYOTA', model: 'ALPHARD' },
    { manufacturer: 'HONDA', model: 'N_BOX' },
  ];

  const browser = await chromium.launch({
    headless: false, // デバッグ用に表示
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  });

  try {
    for (const testModel of testModels) {
      console.log(`\n${testModel.manufacturer} ${testModel.model} の型式を取得中...`);

      const url = `https://www.goo-net.com/catalog/${testModel.manufacturer}/${testModel.model}/`;
      console.log(`  URL: ${url}`);

      const page = await context.newPage();

      try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
        await sleep(2000);

        // アコーディオンを展開（最初の3つ）
        console.log('  アコーディオンを展開中...');
        try {
          const buttons = await page.$$('button.accordion-toggle, button[data-bs-toggle="collapse"]');
          console.log(`  ${buttons.length}個のアコーディオンを検出`);
          
          for (let i = 0; i < Math.min(buttons.length, 3); i++) {
            try {
              await buttons[i].click();
              await sleep(500);
            } catch (e) {
              console.log(`    アコーディオン${i}のクリック失敗`);
            }
          }
          await sleep(1000);
        } catch (e) {
          console.log('  アコーディオン展開エラー:', e);
        }

        const html = await page.content();
        const $ = cheerio.load(html);

        const modelTypes: string[] = [];

        // テーブルから型式を抽出
        $('table tr').each((_, tr) => {
          const $tr = $(tr);
          const cells = $tr.find('td');

          cells.each((__, td) => {
            const text = $(td).text().trim();
            const typeCodePattern = /([A-Z0-9]{1,6}-[A-Z0-9]{2,10})/g;
            const matches = text.match(typeCodePattern);

            if (matches) {
              matches.forEach(typeCode => {
                if (!modelTypes.includes(typeCode)) {
                  modelTypes.push(typeCode);
                }
              });
            }
          });
        });

        console.log(`  ✓ ${modelTypes.length}個の型式を検出:`, modelTypes.slice(0, 5).join(', '), modelTypes.length > 5 ? '...' : '');

        // データベースに保存
        const vehicleModel = await prisma.vehicleModel.findFirst({
          where: {
            goonetCode: testModel.model,
            manufacturer: {
              goonetCode: testModel.manufacturer
            }
          }
        });

        if (vehicleModel && modelTypes.length > 0) {
          for (const typeCode of modelTypes) {
            await prisma.modelType.upsert({
              where: {
                vehicleModelId_typeCode: {
                  vehicleModelId: vehicleModel.id,
                  typeCode: typeCode
                }
              },
              update: {},
              create: {
                vehicleModelId: vehicleModel.id,
                typeCode: typeCode
              }
            });
          }
          console.log(`  ✓ データベースに保存完了`);
        } else if (!vehicleModel) {
          console.log(`  ⚠ データベースに車種が見つかりません`);
        }

      } catch (error) {
        console.error(`  ❌ エラー:`, error);
      } finally {
        await page.close();
      }

      await sleep(2000); // 次の車種まで2秒待機
    }

  } finally {
    await browser.close();
    await prisma.$disconnect();
  }

  console.log('\n✅ テスト完了\n');
}

main().catch(console.error);
