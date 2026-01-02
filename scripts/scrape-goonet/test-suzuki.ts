// scripts/scrape-goonet/test-suzuki.ts
// スズキのデータを取得してテスト

import { getPrisma } from './utils';
import { fetchManufacturers } from './1-fetch-manufacturers';
import { fetchModels } from './2-fetch-models';
import { fetchGradeDetails } from './4-fetch-grade-details';

async function testSuzuki() {
  console.log('\n🚗 スズキのデータ取得テスト開始\n');
  console.log('=' .repeat(60));

  const prisma = getPrisma();

  try {
    // ステップ1: メーカー情報を取得（スズキのみ）
    console.log('\n【ステップ1】メーカー情報を確認中...\n');

    let suzuki = await prisma.manufacturer.findFirst({
      where: { name: 'スズキ' }
    });

    if (!suzuki) {
      console.log('スズキがデータベースにありません。メーカー一覧を取得します...');
      await fetchManufacturers();

      suzuki = await prisma.manufacturer.findFirst({
        where: { name: 'スズキ' }
      });

      if (!suzuki) {
        throw new Error('スズキの取得に失敗しました');
      }
    }

    console.log(`✓ スズキ (${suzuki.goonetCode})\n`);

    // ステップ2: スズキの車種一覧を取得
    console.log('\n【ステップ2】スズキの車種一覧を取得中...\n');

    const existingModels = await prisma.vehicleModel.count({
      where: { manufacturerId: suzuki.id }
    });

    if (existingModels === 0) {
      console.log('車種データがありません。取得します...');
      await fetchModels([suzuki]);
    } else {
      console.log(`既に${existingModels}車種が登録されています`);
    }

    const models = await prisma.vehicleModel.findMany({
      where: { manufacturerId: suzuki.id },
      include: { manufacturer: true },
      orderBy: { name: 'asc' }
    });

    console.log(`\n✓ ${models.length}車種を取得しました\n`);

    // 車種一覧を表示
    console.log('【スズキの車種一覧】');
    models.forEach((model, index) => {
      console.log(`  ${index + 1}. ${model.name} (${model.goonetCode})`);
    });

    // ステップ3: グレード・型式詳細を取得（最初の3車種のみテスト）
    console.log('\n\n【ステップ3】グレード・型式詳細を取得中（最初の3車種）...\n');

    const testModels = models.slice(0, 3);
    await fetchGradeDetails(testModels);

    // 結果を表示
    console.log('\n\n【取得結果サマリー】\n');

    for (const model of testModels) {
      const grades = await prisma.modelType.findMany({
        where: { vehicleModelId: model.id },
        orderBy: { gradeName: 'asc' }
      });

      console.log(`\n${model.name}: ${grades.length}グレード`);

      if (grades.length > 0) {
        console.log('─'.repeat(100));
        console.log(
          '  グレード'.padEnd(20) +
          '型式'.padEnd(20) +
          '排気量'.padEnd(12) +
          '変速機'.padEnd(12) +
          '駆動'.padEnd(16) +
          '価格'
        );
        console.log('─'.repeat(100));

        grades.slice(0, 5).forEach(grade => {
          console.log(
            `  ${(grade.gradeName || '-').padEnd(18)}` +
            `${grade.typeCode.padEnd(18)}` +
            `${(grade.displacement || '-').padEnd(10)}` +
            `${(grade.transmission || '-').padEnd(10)}` +
            `${(grade.driveSystem || '-').padEnd(14)}` +
            `${grade.price ? (parseInt(grade.price).toLocaleString() + '円') : '-'}`
          );
        });

        if (grades.length > 5) {
          console.log(`  ... 他${grades.length - 5}グレード`);
        }
        console.log('');
      }
    }

    // 全体統計
    const totalGrades = await prisma.modelType.count({
      where: {
        vehicleModel: {
          manufacturerId: suzuki.id
        }
      }
    });

    console.log('\n' + '='.repeat(60));
    console.log('\n✨ テスト完了！\n');
    console.log('【統計】');
    console.log(`  メーカー: スズキ`);
    console.log(`  車種数: ${models.length}`);
    console.log(`  グレード数: ${totalGrades}`);
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
  testSuzuki()
    .then(() => {
      console.log('テストが正常に完了しました');
      process.exit(0);
    })
    .catch(error => {
      console.error('テストが失敗しました:', error);
      process.exit(1);
    });
}

export { testSuzuki };
