// データをJSONでエクスポート
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:./prisma/dev.db'
    }
  }
});

async function exportData() {
  console.log('データエクスポート開始...');

  const manufacturers = await prisma.manufacturer.findMany();
  const vehicleModels = await prisma.vehicleModel.findMany();
  const modelTypes = await prisma.modelType.findMany();

  const data = {
    manufacturers,
    vehicleModels,
    modelTypes
  };

  fs.writeFileSync('data-export.json', JSON.stringify(data, null, 2));

  console.log(`エクスポート完了:
  - メーカー: ${manufacturers.length}
  - 車種: ${vehicleModels.length}
  - グレード: ${modelTypes.length}
  `);

  await prisma.$disconnect();
}

exportData().catch(console.error);
