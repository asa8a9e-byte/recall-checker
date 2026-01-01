// スバルのリコール検索を実行
import { chromium } from 'playwright';

async function searchSubaruRecall() {
  // テスト用車台番号（例：レヴォーグ）
  const testCase = { prefix: 'VM4', suffix: '002001' };

  console.log('スバルリコール検索を実行中...\n');
  console.log(`検索: ${testCase.prefix}-${testCase.suffix}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  try {
    const page = await context.newPage();

    console.log('ページにアクセス中...');
    await page.goto('https://recall.subaru.co.jp/lqsb/', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    await page.waitForTimeout(3000);

    // フォームに入力
    console.log('フォームに入力中...');
    await page.fill('input[name="txtCarNoKami"]', testCase.prefix);
    await page.fill('input[name="txtCarNoShimo"]', testCase.suffix);
    await page.waitForTimeout(1000);

    // 検索ボタンをクリック
    console.log('検索ボタンをクリック...');
    await page.click('input[name="btnSearch"]');

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

searchSubaruRecall();
