// scripts/scrape-goonet/index.ts

import { updateScrapingStatus, cleanup } from './utils';
import { fetchManufacturers } from './1-fetch-manufacturers';
import { fetchModels } from './2-fetch-models';
import { fetchModelTypes } from './3-fetch-model-types';

async function main() {
  console.log('\n');
  console.log('═══════════════════════════════════════════════');
  console.log('  Goo-net 車種・型式データ一括取得');
  console.log('═══════════════════════════════════════════════');
  console.log('\n');

  const startTime = Date.now();
  let totalManufacturers = 0;
  let totalModels = 0;
  let totalTypes = 0;

  try {
    // スクレイピング開始
    await updateScrapingStatus('goonet', 'running');

    // Stage 1: メーカー一覧取得
    console.log('\n📋 Stage 1/3: メーカー一覧を取得します...\n');
    totalManufacturers = await fetchManufacturers();

    if (totalManufacturers === 0) {
      throw new Error('メーカー情報が取得できませんでした');
    }

    // Stage 2: 車種一覧取得
    console.log('\n📋 Stage 2/3: 車種一覧を取得します...\n');
    totalModels = await fetchModels();

    if (totalModels === 0) {
      console.log('⚠ 車種情報が取得できませんでした。Stage 3をスキップします。');
    } else {
      // Stage 3: 型式一覧取得
      console.log('\n📋 Stage 3/3: 型式一覧を取得します...\n');
      totalTypes = await fetchModelTypes();
    }

    // 成功時のステータス更新
    const totalRecords = totalManufacturers + totalModels + totalTypes;
    await updateScrapingStatus('goonet', 'idle', true, undefined, totalRecords);

    // 実行時間計算
    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;

    // 結果サマリー表示
    console.log('\n');
    console.log('═══════════════════════════════════════════════');
    console.log('  ✅ 全ステージ完了');
    console.log('═══════════════════════════════════════════════');
    console.log('\n📊 取得結果:');
    console.log(`  - メーカー: ${totalManufacturers}件`);
    console.log(`  - 車種:     ${totalModels}件`);
    console.log(`  - 型式:     ${totalTypes}件`);
    console.log(`  - 合計:     ${totalRecords}件`);
    console.log('\n⏱ 実行時間:');
    console.log(`  ${minutes}分${seconds}秒`);
    console.log('\n');

  } catch (error) {
    // エラー時のステータス更新
    const errorMessage = error instanceof Error ? error.message : '不明なエラー';
    await updateScrapingStatus('goonet', 'error', false, errorMessage);

    console.log('\n');
    console.log('═══════════════════════════════════════════════');
    console.log('  ❌ エラーが発生しました');
    console.log('═══════════════════════════════════════════════');
    console.error('\n詳細:', error);
    console.log('\n');

    process.exit(1);
  } finally {
    // クリーンアップ
    await cleanup();
  }
}

// スクリプト実行
if (require.main === module) {
  main()
    .then(() => {
      console.log('✅ すべての処理が正常に完了しました\n');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ 予期しないエラー:', error);
      process.exit(1);
    });
}

export { main as scrapeGoonet };
