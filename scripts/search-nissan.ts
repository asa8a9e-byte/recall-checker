// 日産のリコール検索を実行してリンクを取得
import { chromium } from 'playwright';

async function searchNissanRecall() {
  // ノートの車台番号で検索
  const testCase = { prefix: 'E12', suffix: '000001' };

  console.log('日産リコール検索を実行中...\n');
  console.log(`検索: ${testCase.prefix}-${testCase.suffix}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  });

  try {
    const page = await context.newPage();

    await page.goto('https://www.nissan.co.jp/RECALL/search.html', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    await page.waitForTimeout(3000);

    // フォームに入力
    await page.fill('input[name="frameno"]', testCase.prefix);
    await page.fill('input[name="chassino"]', testCase.suffix);

    // 検索ボタンをクリック
    await page.click('button:has-text("検索")');

    // 結果を待つ
    await page.waitForTimeout(5000);

    console.log('\n結果URL:', page.url());

    // リンクを取得
    console.log('\n--- ページ内のリンク ---');
    const links = await page.$$('a');
    for (const link of links) {
      const href = await link.getAttribute('href');
      const text = await link.textContent();
      // リコール関連のリンクをフィルタ
      if (href && (href.includes('recall') || href.includes('RECALL') ||
          text?.includes('リコール') || text?.includes('改善対策'))) {
        console.log(`  [${text?.trim().slice(0, 50)}] -> ${href}`);
      }
    }

    // 結果テキストを取得
    const bodyText = await page.textContent('body');
    console.log('\n--- 結果テキスト（リコール関連部分）---');

    // リコール関連のテキストを抽出
    const lines = bodyText?.split(/\s+/).filter(line =>
      line.includes('リコール') || line.includes('改善') || line.includes('対象')
    );
    console.log(lines?.join('\n'));

    // テーブルや結果リストを探す
    console.log('\n--- テーブル/リスト要素 ---');
    const tables = await page.$$('table');
    console.log(`table要素数: ${tables.length}`);

    const lists = await page.$$('ul, ol');
    console.log(`リスト要素数: ${lists.length}`);

    // 結果エリアを探す
    const resultAreas = await page.$$('.result, .search-result, #result, [class*="result"]');
    console.log(`結果エリア: ${resultAreas.length}`);

    // HTMLの一部を出力
    const html = await page.content();
    // リコール関連の部分を抽出
    const recallMatch = html.match(/リコール.{0,500}/g);
    if (recallMatch) {
      console.log('\n--- HTML内のリコール関連 ---');
      recallMatch.slice(0, 5).forEach(m => console.log(m.slice(0, 200)));
    }

  } catch (error) {
    console.error('エラー:', error);
  } finally {
    await browser.close();
  }
}

searchNissanRecall();
