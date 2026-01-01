// ダイハツのリコール検索を実行
import { chromium } from 'playwright';

async function searchDaihatsuRecall() {
  // テスト用車台番号
  const testCase = { prefix: 'S700W', suffix: '0000055' };

  console.log('ダイハツリコール検索を実行中...\n');
  console.log(`検索: ${testCase.prefix}-${testCase.suffix}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  try {
    const page = await context.newPage();

    console.log('ページにアクセス中...');
    await page.goto('https://www.daihatsu.co.jp/info/recall/search/recall_search.php', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    await page.waitForTimeout(3000);

    // フォームに入力
    console.log('フォームに入力中...');
    await page.fill('input[name="model_no"]', testCase.prefix);
    await page.fill('input[name="car_no"]', testCase.suffix);
    await page.waitForTimeout(1000);

    // 検索ボタンをクリック（2番目のフォームをsubmit）
    console.log('検索ボタンをクリック...');
    await page.evaluate(() => {
      // ダイハツは2番目のフォーム（index 1）を使う
      if (document.forms[1]) {
        document.forms[1].submit();
      }
    });

    // 結果を待つ
    await page.waitForTimeout(5000);

    console.log('\n結果URL:', page.url());

    // 結果を取得
    const bodyText = await page.textContent('body');
    console.log('\n--- 結果 ---');
    console.log(bodyText?.replace(/\s+/g, ' ').slice(0, 3000));

    // リンクを探す
    console.log('\n--- ページ内リンク ---');
    const links = await page.$$('a');
    for (const link of links) {
      const href = await link.getAttribute('href');
      const text = await link.textContent();
      if (href && text && text.trim() && (href.includes('recall') || href.includes('RECALL') || href.includes('.pdf'))) {
        console.log(`  [${text.trim().slice(0, 60)}] -> ${href}`);
      }
    }

  } catch (error) {
    console.error('エラー:', error);
  } finally {
    await browser.close();
  }
}

searchDaihatsuRecall();
