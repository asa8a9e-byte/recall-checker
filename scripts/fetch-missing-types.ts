// scripts/fetch-missing-types.ts
// グレードがない車種のみの型式を取得

import { chromium } from 'playwright';
import * as cheerio from 'cheerio';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('\n=== グレードなし車種の型式取得開始 ===\n');

  // グレードがない車種を取得
  const models = await prisma.vehicleModel.findMany({
    where: {
      modelTypes: { none: {} }
    },
    include: { manufacturer: true },
    orderBy: { name: 'asc' }
  });

  console.log(`${models.length}車種の型式を取得します\n`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  });

  let savedCount = 0;
  let errorCount = 0;

  try {
    for (let i = 0; i < models.length; i++) {
      const model = models[i];

      if (!model.goonetCode || !model.manufacturer.goonetCode) {
        console.log(`⚠ [${i + 1}/${models.length}] ${model.manufacturer.name} ${model.name}: コードなし (スキップ)`);
        continue;
      }

      console.log(`[${i + 1}/${models.length}] ${model.manufacturer.name} ${model.name}...`);

      const typeUrl = `https://www.goo-net.com/catalog/${model.manufacturer.goonetCode}/${model.goonetCode}/`;

      try {
        const page = await context.newPage();
        await page.goto(typeUrl, { waitUntil: 'networkidle', timeout: 30000 });
        await sleep(1500);

        const html = await page.content();
        const $ = cheerio.load(html);

        const modelTypes: Array<{ typeCode: string; description?: string }> = [];

        // テーブルから型式を抽出
        $('table tr').each((_, tr) => {
          const $tr = $(tr);
          const cells = $tr.find('td');

          cells.each((__, td) => {
            const text = $(td).text().trim();
            const typeCodePattern = /([A-Z0-9]{1,6}-[A-Z0-9]{2,10}(?:改)?)/g;
            const matches = text.match(typeCodePattern);

            if (matches) {
              matches.forEach(typeCode => {
                if (!modelTypes.find(t => t.typeCode === typeCode)) {
                  const firstCell = $tr.find('td').first().text().trim();
                  const description = firstCell && firstCell !== typeCode ? firstCell.substring(0, 100) : undefined;
                  modelTypes.push({ typeCode, description });
                }
              });
            }
          });
        });

        // リンクから型式を抽出
        $('a[href*="/type/"]').each((_, element) => {
          const href = $(element).attr('href');
          const text = $(element).text().trim();

          if (href) {
            const match = href.match(/\/type\/([A-Z0-9-]+)\/?$/);
            if (match && match[1]) {
              const typeCode = match[1];
              if (!modelTypes.find(t => t.typeCode === typeCode)) {
                modelTypes.push({
                  typeCode,
                  description: text.length > 0 && text.length < 100 ? text : undefined
                });
              }
            }
          }
        });

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
              update: { description: modelType.description },
              create: {
                vehicleModelId: model.id,
                typeCode: modelType.typeCode,
                description: modelType.description
              }
            });
            savedCount++;
          } catch (error) {
            // 保存エラーは無視
          }
        }

        console.log(`  ✓ ${modelTypes.length}型式`);
        await page.close();

      } catch (error) {
        console.log(`  ✗ エラー`);
        errorCount++;
      }

      // レート制限
      await sleep(2000);

      // 100件ごとに進捗表示
      if ((i + 1) % 100 === 0) {
        console.log(`\n=== 進捗: ${i + 1}/${models.length} (${savedCount}型式保存, ${errorCount}エラー) ===\n`);
      }
    }

  } finally {
    await browser.close();
    await prisma.$disconnect();
  }

  console.log(`\n=== 完了: ${savedCount}型式を保存 (${errorCount}エラー) ===\n`);
}

main().catch(console.error);
