import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkData() {
  // エクストレイルを検索
  const models = await prisma.vehicleModel.findMany({
    where: {
      name: {
        contains: 'エクストレイル'
      }
    },
    include: {
      manufacturer: true,
      modelTypes: true
    }
  });

  console.log(`エクストレイル検索結果: ${models.length}件\n`);

  for (const model of models) {
    console.log(`車種: ${model.manufacturer.name} ${model.name}`);
    console.log(`グレード数: ${model.modelTypes.length}`);
    if (model.modelTypes.length > 0) {
      console.log('グレード例:');
      model.modelTypes.slice(0, 5).forEach(type => {
        console.log(`  - ${type.gradeName || '(名前なし)'} / ${type.typeCode}`);
      });
    }
    console.log('');
  }

  await prisma.$disconnect();
}

checkData();
