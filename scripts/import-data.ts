// データをPostgreSQLにインポート
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

async function importData() {
  console.log('データインポート開始...');

  const rawData = fs.readFileSync('data-export.json', 'utf8');
  const data = JSON.parse(rawData);

  console.log(`読み込んだデータ:
  - メーカー: ${data.manufacturers.length}
  - 車種: ${data.vehicleModels.length}
  - グレード: ${data.modelTypes.length}
  `);

  // メーカーをインポート
  console.log('\nメーカーをインポート中...');
  for (const manufacturer of data.manufacturers) {
    await prisma.manufacturer.upsert({
      where: { id: manufacturer.id },
      update: manufacturer,
      create: manufacturer
    });
  }
  console.log(`✓ ${data.manufacturers.length}メーカーをインポート`);

  // 車種をインポート
  console.log('\n車種をインポート中...');
  for (const model of data.vehicleModels) {
    await prisma.vehicleModel.upsert({
      where: { id: model.id },
      update: model,
      create: model
    });
  }
  console.log(`✓ ${data.vehicleModels.length}車種をインポート`);

  // グレードをインポート（バッチ処理）
  console.log('\nグレードをインポート中...');
  let count = 0;
  for (const modelType of data.modelTypes) {
    await prisma.modelType.upsert({
      where: { id: modelType.id },
      update: modelType,
      create: modelType
    });
    count++;
    if (count % 100 === 0) {
      console.log(`  ${count}/${data.modelTypes.length}...`);
    }
  }
  console.log(`✓ ${data.modelTypes.length}グレードをインポート`);

  console.log('\n✨ インポート完了！');

  await prisma.$disconnect();
}

importData().catch(console.error);
