// scripts/scrape-goonet/check-stats.ts
// データベースの統計情報を表示

import { getPrisma } from './utils';

async function checkStats() {
  const prisma = getPrisma();

  try {
    // スズキの詳細統計
    const suzuki = await prisma.manufacturer.findFirst({
      where: { name: 'スズキ' },
      include: {
        vehicleModels: {
          include: {
            modelTypes: true
          }
        }
      }
    });

    if (!suzuki) {
      console.log('スズキが見つかりません');
      return;
    }

    console.log('\n【スズキの詳細統計】\n');
    console.log(`メーカー: ${suzuki.name}`);
    console.log(`車種数: ${suzuki.vehicleModels.length}`);

    const totalGrades = suzuki.vehicleModels.reduce((sum, model) => sum + model.modelTypes.length, 0);
    console.log(`総グレード数: ${totalGrades}\n`);

    // グレード数の多い車種トップ10
    const modelStats = suzuki.vehicleModels
      .map(model => ({
        name: model.name,
        gradeCount: model.modelTypes.length
      }))
      .sort((a, b) => b.gradeCount - a.gradeCount)
      .slice(0, 10);

    console.log('【グレード数トップ10】\n');
    modelStats.forEach((model, index) => {
      console.log(`  ${index + 1}. ${model.name}: ${model.gradeCount}グレード`);
    });

    // グレードデータのサンプル表示（ジムニー）
    const jimny = suzuki.vehicleModels.find(m => m.name.includes('ジムニー') && !m.name.includes('シエラ'));
    if (jimny) {
      const jimnyGrades = await prisma.modelType.findMany({
        where: { vehicleModelId: jimny.id },
        take: 5
      });

      console.log(`\n\n【${jimny.name}のグレードサンプル】\n`);
      jimnyGrades.forEach(grade => {
        console.log(`グレード: ${grade.gradeName || '-'}`);
        console.log(`型式: ${grade.typeCode}`);
        console.log(`排気量: ${grade.displacement || '-'}`);
        console.log(`変速機: ${grade.transmission || '-'}`);
        console.log(`駆動: ${grade.driveSystem || '-'}`);
        console.log(`価格: ${grade.price ? parseInt(grade.price).toLocaleString() + '円' : '-'}`);
        console.log('---');
      });
    }

    // 全メーカーのサマリー
    console.log('\n\n【全メーカーサマリー】\n');
    const allManufacturers = await prisma.manufacturer.findMany({
      include: {
        vehicleModels: {
          include: {
            modelTypes: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    let totalModels = 0;
    let totalGradesAll = 0;

    allManufacturers.forEach(maker => {
      const modelCount = maker.vehicleModels.length;
      const gradeCount = maker.vehicleModels.reduce((sum, model) => sum + model.modelTypes.length, 0);

      if (modelCount > 0) {
        console.log(`  ${maker.name}: ${modelCount}車種, ${gradeCount}グレード`);
        totalModels += modelCount;
        totalGradesAll += gradeCount;
      }
    });

    console.log('\n' + '='.repeat(60));
    console.log(`\n合計: ${totalModels}車種, ${totalGradesAll}グレード\n`);

  } catch (error) {
    console.error('エラー:', error);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  checkStats()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}
