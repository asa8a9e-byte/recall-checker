import { checkMLITRecall } from '../src/lib/recall-checker/mlit';

async function test() {
  console.log('=== 国交省リコール検索テスト（HTTP版） ===\n');

  // エクストレイルでテスト
  const result = await checkMLITRecall('エクストレイル', '5AA-T33');

  console.log('\n=== 検索結果 ===');
  console.log(`車種: ${result.maker} ${result.model}`);
  console.log(`リコール対象: ${result.hasRecall ? 'はい' : 'いいえ'}`);
  console.log(`リコール件数: ${result.recalls.length}件\n`);

  if (result.recalls.length > 0) {
    console.log('リコール情報:');
    result.recalls.forEach((recall, i) => {
      console.log(`\n${i + 1}. ${recall.title}`);
      console.log(`   ID: ${recall.recallId}`);
      console.log(`   詳細URL: ${recall.detailUrl || 'なし'}`);
      console.log(`   説明: ${recall.description}`);
    });
  }
}

test().catch(console.error);
