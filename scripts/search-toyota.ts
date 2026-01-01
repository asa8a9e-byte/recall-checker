// トヨタのリコール検索を実行
import { chromium } from 'playwright';

async function searchToyotaRecall() {
  // テスト用の型式（ユーザー提供）
  const testCases = [
    { prefix: 'MXPK11', suffix: '0000001' },  // アクア
    { prefix: 'NHP10', suffix: '0000001' },   // アクア
  ];

  console.log('トヨタリコール検索を実行中...\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  });

  try {
    for (const testCase of testCases) {
      console.log(`\n=== 検索: ${testCase.prefix}-${testCase.suffix} ===`);

      const page = await context.newPage();

      await page.goto('https://www.toyota.co.jp/recall-search/dc/search', {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });
      await page.waitForTimeout(3000);

      // フォームに入力
      await page.fill('input[name="FRAME_DIV"]', testCase.prefix);
      await page.fill('input[name="FRAME_NO"]', testCase.suffix);

      // 検索ボタンをクリック
      await page.click('input[name="imageField"]');

      // 結果を待つ
      await page.waitForTimeout(5000);

      // 結果ページのURLと内容を取得
      console.log('結果URL:', page.url());

      const bodyText = await page.textContent('body');
      console.log('\n結果（最初の2000文字）:');
      console.log(bodyText?.replace(/\s+/g, ' ').slice(0, 2000));

      await page.close();
    }
  } catch (error) {
    console.error('エラー:', error);
  } finally {
    await browser.close();
  }
}

searchToyotaRecall();
