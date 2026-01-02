// scripts/scrape-goonet/4-fetch-grade-details.ts

import { chromium } from 'playwright';
import * as cheerio from 'cheerio';
import { getPrisma, sleep, retryWithBackoff } from './utils';
import { VehicleModel, Manufacturer } from '@prisma/client';

type VehicleModelWithManufacturer = VehicleModel & {
  manufacturer: Manufacturer;
};

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

/**
 * テーブル行からグレード詳細を抽出
 */
function extractGradeFromTableRow($: cheerio.CheerioAPI, $tr: cheerio.Cheerio<any>): GradeDetail | null {
  const cells = $tr.find('td');

  if (cells.length < 2) {
    return null;
  }

  // セルのテキストを配列で取得
  const cellTexts = cells.map((_, cell) => {
    return $(cell).text().trim().replace(/\s+/g, ' ');
  }).get();

  // グレード名を取得（最初のセル、リンクがある場合はリンクテキスト）
  const gradeCell = $(cells[0]);
  const gradeName = gradeCell.find('a').text().trim() || gradeCell.text().trim();

  if (!gradeName) {
    return null;
  }

  // 型式を取得（2番目のセル、改行を除去）
  const typeCodeRaw = cellTexts[1] || '';
  const typeCode = typeCodeRaw.replace(/[\r\n\s]+/g, '').trim();

  // 型式パターンのチェック（例: 3BA-JB64W, DBA-E12改）
  const typeCodePattern = /^[A-Z0-9]{1,6}-[A-Z0-9]{2,10}(?:改)?$/;
  if (!typeCode || !typeCodePattern.test(typeCode)) {
    return null;
  }

  // カタログURLを取得
  const catalogLink = gradeCell.find('a').attr('href');
  const catalogUrl = catalogLink ? `https://www.goo-net.com${catalogLink}` : undefined;

  // 各セルから情報を抽出（セルの順番に依存）
  const gradeDetail: GradeDetail = {
    gradeName,
    typeCode,
    catalogUrl
  };

  // セル数に応じて情報を抽出
  if (cellTexts.length >= 3) gradeDetail.displacement = cellTexts[2];
  if (cellTexts.length >= 4) gradeDetail.doors = cellTexts[3];
  if (cellTexts.length >= 5) gradeDetail.transmission = cellTexts[4];
  if (cellTexts.length >= 6) gradeDetail.driveSystem = cellTexts[5];
  if (cellTexts.length >= 7) gradeDetail.seatingCapacity = cellTexts[6];
  if (cellTexts.length >= 8) gradeDetail.fuelEfficiency = cellTexts[7];
  if (cellTexts.length >= 9) gradeDetail.weight = cellTexts[8];
  if (cellTexts.length >= 10) gradeDetail.dimensions = cellTexts[9];

  // 価格を抽出（最後のセル）
  if (cellTexts.length >= 11) {
    const priceText = cellTexts[10];
    const priceMatch = priceText.replace(/[,円]/g, '').match(/\d+/);
    gradeDetail.price = priceMatch ? priceMatch[0] : undefined;
  }

  return gradeDetail;
}

/**
 * 車種のグレード詳細を取得
 */
export async function fetchGradeDetails(models?: VehicleModelWithManufacturer[]): Promise<number> {
  console.log('\n=== グレード・型式詳細取得開始 ===\n');

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

  console.log(`${models.length}車種のグレード詳細を取得します\n`);

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

      console.log(`\n[${i + 1}/${models.length}] ${model.manufacturer.name} ${model.name}のグレード詳細を取得中...`);

      const catalogUrl = `https://www.goo-net.com/catalog/${model.manufacturer.goonetCode}/${model.goonetCode}/`;

      try {
        const page = await context.newPage();

        await retryWithBackoff(async () => {
          await page.goto(catalogUrl, { waitUntil: 'networkidle', timeout: 60000 });
        });

        // ページ読み込み後少し待機
        await sleep(2000);

        // 年式アコーディオンを全て展開（データをより多く取得）
        try {
          const accordionButtons = await page.$$('button[data-toggle], .accordion-button, .year-toggle, button[aria-expanded]');
          console.log(`  ${accordionButtons.length}個のアコーディオンを展開中...`);

          for (let j = 0; j < accordionButtons.length; j++) {
            try {
              await accordionButtons[j].click();
              await sleep(300);
            } catch (e) {
              // クリックできない場合は無視
            }
          }
          await sleep(1000);
        } catch (e) {
          console.log('  アコーディオンの展開をスキップ');
        }

        const html = await page.content();
        const $ = cheerio.load(html);

        const gradeDetails: GradeDetail[] = [];

        // テーブルからグレード情報を抽出
        $('table tr').each((_, tr) => {
          const $tr = $(tr);
          const gradeDetail = extractGradeFromTableRow($, $tr);

          if (gradeDetail) {
            // 重複チェック
            const exists = gradeDetails.find(g =>
              g.typeCode === gradeDetail.typeCode && g.gradeName === gradeDetail.gradeName
            );

            if (!exists) {
              gradeDetails.push(gradeDetail);
            }
          }
        });

        console.log(`  ${gradeDetails.length}グレードを検出`);

        // データベースに保存
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

            savedCount++;
          } catch (error) {
            console.error(`  ✗ ${grade.gradeName} (${grade.typeCode})の保存に失敗:`, error);
          }
        }

        console.log(`  ✓ ${gradeDetails.length}グレードを保存しました`);

        await page.close();

      } catch (error) {
        console.error(`  ✗ ${model.manufacturer.name} ${model.name}のグレード取得に失敗:`, error);
      }

      // レート制限: 2-3秒待機
      await sleep(2000 + Math.random() * 1000);
    }

    console.log(`\n=== グレード・型式詳細取得完了: ${savedCount}件 ===\n`);

    return savedCount;

  } catch (error) {
    console.error('グレード詳細取得エラー:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

// スタンドアローン実行
if (require.main === module) {
  fetchGradeDetails()
    .then(count => {
      console.log(`完了: ${count}グレードを保存しました`);
      process.exit(0);
    })
    .catch(error => {
      console.error('エラー:', error);
      process.exit(1);
    });
}
