// scripts/sync-to-postgres.ts
// SQLiteからPostgreSQLにデータを同期

import Database from 'better-sqlite3';
import { PrismaClient } from '@prisma/client';

const sqlite = new Database('./prisma/dev.db', { readonly: true });
const prisma = new PrismaClient();

async function syncData() {
  console.log('=== SQLite → PostgreSQL 同期開始 ===\n');

  // SQLiteからデータを読み取り
  console.log('SQLiteからデータを読み取り中...');

  const manufacturers = sqlite.prepare('SELECT * FROM Manufacturer').all() as any[];
  const vehicleModels = sqlite.prepare('SELECT * FROM VehicleModel').all() as any[];
  const modelTypes = sqlite.prepare('SELECT * FROM ModelType').all() as any[];

  console.log(`読み込み完了:
  - メーカー: ${manufacturers.length}
  - 車種: ${vehicleModels.length}
  - 型式: ${modelTypes.length}
`);

  // PostgreSQLにインポート
  console.log('PostgreSQLにインポート中...\n');

  // メーカー
  console.log('メーカーをインポート中...');
  for (const m of manufacturers) {
    await prisma.manufacturer.upsert({
      where: { id: m.id },
      update: {
        name: m.name,
        goonetCode: m.goonetCode,
        updatedAt: new Date()
      },
      create: {
        id: m.id,
        name: m.name,
        goonetCode: m.goonetCode,
        createdAt: new Date(m.createdAt),
        updatedAt: new Date()
      }
    });
  }
  console.log(`✓ ${manufacturers.length}メーカー完了\n`);

  // 車種
  console.log('車種をインポート中...');
  for (const vm of vehicleModels) {
    await prisma.vehicleModel.upsert({
      where: { id: vm.id },
      update: {
        manufacturerId: vm.manufacturerId,
        name: vm.name,
        nameKana: vm.nameKana,
        goonetCode: vm.goonetCode,
        updatedAt: new Date()
      },
      create: {
        id: vm.id,
        manufacturerId: vm.manufacturerId,
        name: vm.name,
        nameKana: vm.nameKana,
        goonetCode: vm.goonetCode,
        createdAt: new Date(vm.createdAt),
        updatedAt: new Date()
      }
    });
  }
  console.log(`✓ ${vehicleModels.length}車種完了\n`);

  // 型式（バッチ処理）
  console.log('型式をインポート中...');
  let count = 0;
  const batchSize = 100;

  for (let i = 0; i < modelTypes.length; i += batchSize) {
    const batch = modelTypes.slice(i, i + batchSize);

    await Promise.all(batch.map(async (mt: any) => {
      try {
        await prisma.modelType.upsert({
          where: { id: mt.id },
          update: {
            vehicleModelId: mt.vehicleModelId,
            typeCode: mt.typeCode,
            gradeName: mt.gradeName,
            displacement: mt.displacement,
            doors: mt.doors,
            transmission: mt.transmission,
            driveSystem: mt.driveSystem,
            seatingCapacity: mt.seatingCapacity,
            fuelEfficiency: mt.fuelEfficiency,
            weight: mt.weight,
            dimensions: mt.dimensions,
            price: mt.price,
            description: mt.description,
            startYear: mt.startYear,
            endYear: mt.endYear,
            catalogUrl: mt.catalogUrl,
            updatedAt: new Date()
          },
          create: {
            id: mt.id,
            vehicleModelId: mt.vehicleModelId,
            typeCode: mt.typeCode,
            gradeName: mt.gradeName,
            displacement: mt.displacement,
            doors: mt.doors,
            transmission: mt.transmission,
            driveSystem: mt.driveSystem,
            seatingCapacity: mt.seatingCapacity,
            fuelEfficiency: mt.fuelEfficiency,
            weight: mt.weight,
            dimensions: mt.dimensions,
            price: mt.price,
            description: mt.description,
            startYear: mt.startYear,
            endYear: mt.endYear,
            catalogUrl: mt.catalogUrl,
            createdAt: new Date(mt.createdAt),
            updatedAt: new Date()
          }
        });
      } catch (e) {
        // 個別エラーは無視して続行
      }
    }));

    count += batch.length;
    if (count % 1000 === 0 || count === modelTypes.length) {
      console.log(`  ${count}/${modelTypes.length}...`);
    }
  }
  console.log(`✓ ${modelTypes.length}型式完了\n`);

  // 最終確認
  const pgManufacturers = await prisma.manufacturer.count();
  const pgVehicleModels = await prisma.vehicleModel.count();
  const pgModelTypes = await prisma.modelType.count();

  console.log('=== PostgreSQL 最終状態 ===');
  console.log(`  メーカー: ${pgManufacturers}`);
  console.log(`  車種: ${pgVehicleModels}`);
  console.log(`  型式: ${pgModelTypes}`);
  console.log('\n✨ 同期完了！');

  sqlite.close();
  await prisma.$disconnect();
}

syncData().catch(console.error);
