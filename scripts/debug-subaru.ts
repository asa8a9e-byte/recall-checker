// スバルの結果ページのHTML構造をデバッグ
import { chromium } from 'playwright';
import * as cheerio from 'cheerio';

async function debugSubaruRecall() {
  const testCase = { prefix: 'VM4', suffix: '002001' };

  console.log('スバルリコール検索を実行中...\n');
  console.log(`検索: ${testCase.prefix}-${testCase.suffix}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  });

  try {
    const page = await context.newPage();

    await page.goto('https://recall.subaru.co.jp/lqsb/', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    await page.waitForTimeout(3000);

    await page.fill('input[name="txtCarNoKami"]', testCase.prefix);
    await page.fill('input[name="txtCarNoShimo"]', testCase.suffix);
    await page.waitForTimeout(1000);

    await page.click('input[name="btnSearch"]');
    await page.waitForTimeout(5000);

    const html = await page.content();
    const $ = cheerio.load(html);

    // テーブルの構造を確認
    console.log('\n=== テーブル構造 ===');
    $('table').each((tableIdx, table) => {
      const rows = $(table).find('tr');
      console.log(`\nテーブル ${tableIdx}: ${rows.length} 行`);

      rows.each((rowIdx, row) => {
        const cells = $(row).find('td, th');
        if (cells.length >= 3) {
          console.log(`  行 ${rowIdx}: ${cells.length} セル`);
          cells.each((cellIdx, cell) => {
            const text = $(cell).text().trim().slice(0, 30);
            const link = $(cell).find('a');
            const href = link.attr('href') || '';
            if (href) {
              console.log(`    セル ${cellIdx}: "${text}" -> href="${href.slice(0, 80)}"`);
            } else {
              console.log(`    セル ${cellIdx}: "${text}"`);
            }
          });
        }
      });
    });

    // popup03を含むリンクを探す
    console.log('\n=== popup03リンク ===');
    $('a').each((idx, element) => {
      const href = $(element).attr('href') || '';
      if (href.includes('popup')) {
        const text = $(element).text().trim().slice(0, 50);
        console.log(`リンク ${idx}: "${text}"`);
        console.log(`  href: ${href}`);

        // URL抽出テスト
        const urlMatch = href.match(/popup\d*\(['"]([^'"]+)['"]\)/);
        if (urlMatch) {
          console.log(`  抽出URL: ${urlMatch[1]}`);
        } else {
          console.log(`  抽出失敗!`);
        }
      }
    });

  } catch (error) {
    console.error('エラー:', error);
  } finally {
    await browser.close();
  }
}

debugSubaruRecall();
