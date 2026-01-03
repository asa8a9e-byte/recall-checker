import { PrismaClient } from '@prisma/client';
import { chromium } from 'playwright';
import * as cheerio from 'cheerio';

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

async function scrapeExtail() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // エクストレイルのモデルを取得
    const extailModel = await prisma.vehicleModel.findFirst({
      where: {
        name: {
          contains: 'エクストレイル'
        }
      }
    });

    if (!extailModel) {
      console.log('エクストレイルが見つかりませんでした');
      return;
    }

    console.log(`エクストレイル取得: ${extailModel.name} (${extailModel.goonetCode})`);

    const url = `https://www.goo-net.com/catalog/${extailModel.goonetCode}/`;
    console.log(`URL: ${url}`);

    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    const html = await page.content();
    const $ = cheerio.load(html);

    const grades: GradeDetail[] = [];

    // グレード表のテーブルを探す
    $('table').each((_, table) => {
      const $table = $(table);
      const headers = $table.find('th').map((_, th) => $(th).text().trim()).get();

      // "グレード名" または "型式" カラムがあるテーブルを探す
      if (headers.some(h => h.includes('グレード') || h.includes('型式'))) {
        console.log('グレードテーブル発見:', headers);

        $table.find('tr').each((index, row) => {
          if (index === 0) return; // ヘッダー行スキップ

          const $row = $(row);
          const cells = $row.find('td');

          if (cells.length < 2) return;

          const gradeCell = $(cells[0]);
          const typeCodeCell = $(cells[1]);

          const gradeName = gradeCell.find('a').text().trim() || gradeCell.text().trim();
          const typeCode = typeCodeCell.text().trim().replace(/[\r\n\s]+/g, '').trim();

          if (gradeName && typeCode && typeCode.length > 3) {
            const grade: GradeDetail = {
              gradeName,
              typeCode
            };

            // 他のセルからデータを抽出
            const cellTexts = cells.map((_, cell) => $(cell).text().trim().replace(/\s+/g, ' ')).get();
            if (cellTexts.length >= 3) grade.displacement = cellTexts[2];
            if (cellTexts.length >= 4) grade.doors = cellTexts[3];
            if (cellTexts.length >= 5) grade.transmission = cellTexts[4];
            if (cellTexts.length >= 6) grade.driveSystem = cellTexts[5];
            if (cellTexts.length >= 7) grade.seatingCapacity = cellTexts[6];
            if (cellTexts.length >= 8) grade.fuelEfficiency = cellTexts[7];
            if (cellTexts.length >= 9) grade.weight = cellTexts[8];
            if (cellTexts.length >= 10) grade.dimensions = cellTexts[9];
            if (cellTexts.length >= 11) grade.price = cellTexts[10];

            // カタログURLを取得
            const link = gradeCell.find('a').attr('href');
            if (link) {
              grade.catalogUrl = link.startsWith('http') ? link : `https://www.goo-net.com${link}`;
            }

            grades.push(grade);
            console.log(`  グレード: ${gradeName} / ${typeCode}`);
          }
        });
      }
    });

    console.log(`\n合計 ${grades.length} グレードを発見`);

    // DBに保存
    for (const grade of grades) {
      await prisma.modelType.create({
        data: {
          vehicleModelId: extailModel.id,
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
    }

    console.log(`✓ ${grades.length}グレードをDBに保存しました`);

  } catch (error) {
    console.error('エラー:', error);
  } finally {
    await browser.close();
    await prisma.$disconnect();
  }
}

scrapeExtail();
