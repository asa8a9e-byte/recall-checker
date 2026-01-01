// ダイハツの結果ページをデバッグ
import { chromium } from 'playwright';
import * as cheerio from 'cheerio';

async function debugDaihatsu() {
  const testCase = { prefix: 'S700W', suffix: '0000055' };

  console.log('ダイハツリコール検索を実行中...\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  });

  try {
    const page = await context.newPage();

    await page.goto('https://www.daihatsu.co.jp/info/recall/search/recall_search.php', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    await page.waitForTimeout(3000);

    await page.fill('input[name="model_no"]', testCase.prefix);
    await page.fill('input[name="car_no"]', testCase.suffix);
    await page.waitForTimeout(1000);

    await page.evaluate(() => {
      if (document.forms[1]) document.forms[1].submit();
    });
    await page.waitForTimeout(5000);

    const html = await page.content();
    const $ = cheerio.load(html);
    const bodyText = $('body').text();

    console.log('=== チェック ===');
    console.log('「対象ではありません」含む:', bodyText.includes('対象ではありません'));
    console.log('「以下の通りでございます」含む:', bodyText.includes('以下の通りでございます'));

    // リンクを探す
    console.log('\n=== /info/recall/数字.htm 形式のリンク ===');
    $('a').each((idx, element) => {
      const href = $(element).attr('href') || '';
      const text = $(element).text().trim();

      if (href.includes('/info/recall/') && href.match(/\/\d+\.htm$/)) {
        console.log(`リンク: "${text.slice(0, 50)}"`);
        console.log(`  href: ${href}`);

        // 親のtr要素から情報を取得
        const $row = $(element).closest('tr');
        const cells = $row.find('td');
        console.log(`  セル数: ${cells.length}`);
        if (cells.length >= 4) {
          console.log(`  日付: ${$(cells[0]).text().trim()}`);
          console.log(`  区分: ${$(cells[1]).text().trim()}`);
          console.log(`  内容: ${$(cells[2]).text().trim().slice(0, 50)}`);
          console.log(`  状況: ${$(cells[3]).text().trim()}`);
        }
      }
    });

  } catch (error) {
    console.error('エラー:', error);
  } finally {
    await browser.close();
  }
}

debugDaihatsu();
