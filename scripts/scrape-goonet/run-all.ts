// scripts/scrape-goonet/run-all.ts
// Goo-netから全メーカー・全車種・全グレードのデータを取得

import { fetchManufacturers } from './1-fetch-manufacturers';
import { fetchModels } from './2-fetch-models';
import { fetchGradeDetails } from './4-fetch-grade-details';
import { getPrisma, updateScrapingStatus } from './utils';

async function runAll() {
  console.log('\n🚀 Goo-net 全データ取得開始\n');
  console.log('=' .repeat(60));

  const prisma = getPrisma();
  const startTime = Date.now();

  try {
    // ステップ1: メーカー一覧を取得
    console.log('\n【ステップ1】メーカー一覧を取得中...\n');
    await updateScrapingStatus('goonet-manufacturers', 'running');

    let manufacturerCount = 0;
    try {
      manufacturerCount = await fetchManufacturers();
      await updateScrapingStatus('goonet-manufacturers', 'idle', true, undefined, manufacturerCount);
      console.log(`✓ ${manufacturerCount}メーカーを取得しました\n`);
    } catch (error) {
      await updateScrapingStatus('goonet-manufacturers', 'error', false, String(error));
      throw error;
    }

    // ステップ2: 各メーカーの車種一覧を取得
    console.log('\n【ステップ2】全メーカーの車種一覧を取得中...\n');
    await updateScrapingStatus('goonet-models', 'running');

    const manufacturers = await prisma.manufacturer.findMany({
      orderBy: { name: 'asc' }
    });

    let modelCount = 0;
    try {
      modelCount = await fetchModels(manufacturers);
      await updateScrapingStatus('goonet-models', 'idle', true, undefined, modelCount);
      console.log(`✓ ${modelCount}車種を取得しました\n`);
    } catch (error) {
      await updateScrapingStatus('goonet-models', 'error', false, String(error));
      throw error;
    }

    // ステップ3: 各車種のグレード・型式詳細を取得
    console.log('\n【ステップ3】全車種のグレード・型式詳細を取得中...\n');
    await updateScrapingStatus('goonet-grades', 'running');

    const models = await prisma.vehicleModel.findMany({
      include: { manufacturer: true },
      orderBy: { name: 'asc' }
    });

    let gradeCount = 0;
    try {
      gradeCount = await fetchGradeDetails(models);
      await updateScrapingStatus('goonet-grades', 'idle', true, undefined, gradeCount);
      console.log(`✓ ${gradeCount}グレードを取得しました\n`);
    } catch (error) {
      await updateScrapingStatus('goonet-grades', 'error', false, String(error));
      throw error;
    }

    // 最終サマリー
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000 / 60).toFixed(2);

    console.log('\n' + '='.repeat(60));
    console.log('\n✨ 全データ取得完了！\n');
    console.log('【取得データサマリー】');
    console.log(`  メーカー数: ${manufacturerCount}`);
    console.log(`  車種数: ${modelCount}`);
    console.log(`  グレード数: ${gradeCount}`);
    console.log(`  所要時間: ${duration}分`);
    console.log('\n' + '='.repeat(60) + '\n');

    // データベース統計を表示
    const stats = await prisma.manufacturer.findMany({
      include: {
        vehicleModels: {
          include: {
            modelTypes: true
          }
        }
      }
    });

    console.log('【メーカー別データ統計】\n');
    for (const maker of stats) {
      const modelCount = maker.vehicleModels.length;
      const gradeCount = maker.vehicleModels.reduce((sum, model) => sum + model.modelTypes.length, 0);
      console.log(`  ${maker.name}: ${modelCount}車種, ${gradeCount}グレード`);
    }

    console.log('\n' + '='.repeat(60) + '\n');

  } catch (error) {
    console.error('\n❌ エラーが発生しました:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// スタンドアローン実行
if (require.main === module) {
  runAll()
    .then(() => {
      console.log('処理が正常に完了しました');
      process.exit(0);
    })
    .catch(error => {
      console.error('処理が失敗しました:', error);
      process.exit(1);
    });
}

export { runAll };
