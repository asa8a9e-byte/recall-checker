// scripts/resume-grade-scraping.ts
// 型式データがない車種のみを対象にスクレイピングを再開

import { chromium } from 'playwright';
import * as cheerio from 'cheerio';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface GradeDetail {
  gradeName: string;
  typeCode: string;
  displacement?: string;
  doors?: string;
  transmission?: string;
  driveSystem?: string;
  seatingCapacity?: string;
  fuelEfficiency?: string;
  weight?: string;
  dimensions?: string;
  price?: string;
  catalogUrl?: string;
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function extractGradeFromTableRow($: cheerio.CheerioAPI, $tr: cheerio.Cheerio<any>): GradeDetail | null {
  const cells = $tr.find('td');

  if (cells.length < 2) {
    return null;
  }

  const cellTexts = cells.map((_, cell) => {
    return $(cell).text().trim().replace(/\s+/g, ' ');
  }).get();

  const gradeCell = $(cells[0]);
  const gradeName = gradeCell.find('a').text().trim() || gradeCell.text().trim();

  if (!gradeName) {
    return null;
  }

  const typeCodeRaw = cellTexts[1] || '';
  const typeCode = typeCodeRaw.replace(/[\r\n\s]+/g, '').trim();

  const typeCodePattern = /^[A-Z0-9]{1,6}-[A-Z0-9]{2,10}(?:改)?$/;
  if (!typeCode || !typeCodePattern.test(typeCode)) {
    return null;
  }

  const catalogLink = gradeCell.find('a').attr('href');
  const catalogUrl = catalogLink ? `https://www.goo-net.com${catalogLink}` : undefined;

  const gradeDetail: GradeDetail = {
    gradeName,
    typeCode,
    catalogUrl
  };

  if (cellTexts.length >= 3) gradeDetail.displacement = cellTexts[2];
  if (cellTexts.length >= 4) gradeDetail.doors = cellTexts[3];
  if (cellTexts.length >= 5) gradeDetail.transmission = cellTexts[4];
  if (cellTexts.length >= 6) gradeDetail.driveSystem = cellTexts[5];
  if (cellTexts.length >= 7) gradeDetail.seatingCapacity = cellTexts[6];
  if (cellTexts.length >= 8) gradeDetail.fuelEfficiency = cellTexts[7];
  if (cellTexts.length >= 9) gradeDetail.weight = cellTexts[8];
  if (cellTexts.length >= 10) gradeDetail.dimensions = cellTexts[9];

  if (cellTexts.length >= 11) {
    const priceText = cellTexts[10];
    const priceMatch = priceText.replace(/[,円]/g, '').match(/\d+/);
    gradeDetail.price = priceMatch ? priceMatch[0] : undefined;
  }

  return gradeDetail;
}

async function main() {
  console.log('\n=== 型式データなし車種のグレード取得再開 ===\n');

  // 型式がない車種のみを取得
  const models = await prisma.vehicleModel.findMany({
    where: {
      modelTypes: { none: {} }
    },
    include: { manufacturer: true },
    orderBy: [
      { manufacturer: { name: 'asc' } },
      { name: 'asc' }
    ]
  });

  console.log(`対象車種: ${models.length}件\n`);

  if (models.length === 0) {
    console.log('全ての車種に型式データがあります。');
    return;
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  let totalSaved = 0;
  let errorCount = 0;
  let skippedCount = 0;
  const startTime = Date.now();

  try {
    for (let i = 0; i < models.length; i++) {
      const model = models[i];

      if (!model.goonetCode || !model.manufacturer.goonetCode) {
        console.log(`⚠ [${i + 1}/${models.length}] ${model.manufacturer.name} ${model.name}: コードなし (スキップ)`);
        skippedCount++;
        continue;
      }

      console.log(`[${i + 1}/${models.length}] ${model.manufacturer.name} ${model.name}...`);

      const catalogUrl = `https://www.goo-net.com/catalog/${model.manufacturer.goonetCode}/${model.goonetCode}/`;

      try {
        const page = await context.newPage();

        let retries = 0;
        const maxRetries = 3;

        while (retries < maxRetries) {
          try {
            await page.goto(catalogUrl, { waitUntil: 'networkidle', timeout: 30000 });
            break;
          } catch (e) {
            retries++;
            if (retries === maxRetries) throw e;
            console.log(`  リトライ ${retries}/${maxRetries}...`);
            await sleep(3000 * retries);
          }
        }

        await sleep(1500);

        // アコーディオンを展開
        try {
          const accordionButtons = await page.$$('button[data-toggle], .accordion-button, .year-toggle, button[aria-expanded]');
          for (const button of accordionButtons) {
            try {
              await button.click();
              await sleep(200);
            } catch (e) {}
          }
          await sleep(500);
        } catch (e) {}

        const html = await page.content();
        const $ = cheerio.load(html);

        const gradeDetails: GradeDetail[] = [];

        $('table tr').each((_, tr) => {
          const $tr = $(tr);
          const gradeDetail = extractGradeFromTableRow($, $tr);

          if (gradeDetail) {
            const exists = gradeDetails.find(g =>
              g.typeCode === gradeDetail.typeCode && g.gradeName === gradeDetail.gradeName
            );

            if (!exists) {
              gradeDetails.push(gradeDetail);
            }
          }
        });

        // データベースに保存
        let savedForModel = 0;
        for (const grade of gradeDetails) {
          try {
            await prisma.modelType.upsert({
              where: {
                vehicleModelId_typeCode: {
                  vehicleModelId: model.id,
                  typeCode: grade.typeCode
                }
              },
              update: {
                gradeName: grade.gradeName,
                displacement: grade.displacement,
                doors: grade.doors,
                transmission: grade.transmission,
                driveSystem: grade.driveSystem,
                seatingCapacity: grade.seatingCapacity,
                fuelEfficiency: grade.fuelEfficiency,
                weight: grade.weight,
                dimensions: grade.dimensions,
                price: grade.price,
                catalogUrl: grade.catalogUrl
              },
              create: {
                vehicleModelId: model.id,
                typeCode: grade.typeCode,
                gradeName: grade.gradeName,
                displacement: grade.displacement,
                doors: grade.doors,
                transmission: grade.transmission,
                driveSystem: grade.driveSystem,
                seatingCapacity: grade.seatingCapacity,
                fuelEfficiency: grade.fuelEfficiency,
                weight: grade.weight,
                dimensions: grade.dimensions,
                price: grade.price,
                catalogUrl: grade.catalogUrl
              }
            });
            savedForModel++;
            totalSaved++;
          } catch (error) {}
        }

        console.log(`  ✓ ${savedForModel}グレード保存`);
        await page.close();

      } catch (error) {
        console.log(`  ✗ エラー`);
        errorCount++;
      }

      // レート制限
      await sleep(2000 + Math.random() * 1000);

      // 50件ごとに進捗表示
      if ((i + 1) % 50 === 0) {
        const elapsed = (Date.now() - startTime) / 1000 / 60;
        const remaining = (models.length - i - 1) * (elapsed / (i + 1));
        console.log(`\n=== 進捗: ${i + 1}/${models.length} (${totalSaved}グレード, ${errorCount}エラー, 経過${elapsed.toFixed(1)}分, 残り約${remaining.toFixed(0)}分) ===\n`);
      }
    }

  } finally {
    await browser.close();
    await prisma.$disconnect();
  }

  const totalTime = (Date.now() - startTime) / 1000 / 60;
  console.log(`\n=== 完了 ===`);
  console.log(`保存: ${totalSaved}グレード`);
  console.log(`エラー: ${errorCount}件`);
  console.log(`スキップ: ${skippedCount}件`);
  console.log(`所要時間: ${totalTime.toFixed(1)}分`);
}

main().catch(console.error);
