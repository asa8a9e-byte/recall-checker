import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkStats() {
  const manufacturersCount = await prisma.manufacturer.count();
  const modelsCount = await prisma.vehicleModel.count();
  const typesCount = await prisma.modelType.count();

  console.log('データベース統計:');
  console.log(`メーカー数: ${manufacturersCount}`);
  console.log(`車種数: ${modelsCount}`);
  console.log(`グレード数: ${typesCount}`);

  // グレードがある車種の数
  const modelsWithTypes = await prisma.vehicleModel.findMany({
    include: {
      _count: {
        select: { modelTypes: true }
      }
    }
  });

  const modelsWithData = modelsWithTypes.filter(m => m._count.modelTypes > 0);
  console.log(`グレードデータがある車種数: ${modelsWithData.length}`);

  // サンプル: グレードがある車種を10件表示
  console.log('\nグレードがある車種（サンプル10件）:');
  modelsWithData.slice(0, 10).forEach(m => {
    console.log(`  ${m.name} (${m._count.modelTypes}グレード)`);
  });

  await prisma.$disconnect();
}

checkStats();
