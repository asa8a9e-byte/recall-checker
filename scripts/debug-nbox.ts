import { chromium } from 'playwright';
import * as cheerio from 'cheerio';

async function debugNBOX() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    // N-BOXのカタログページ
    await page.goto('https://www.goo-net.com/catalog/HONDA/N_BOX/', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    await page.waitForTimeout(3000);

    const html = await page.content();
    const $ = cheerio.load(html);

    console.log('=== N-BOX グレードテーブル ===\n');

    // 全てのテーブルを確認
    $('table').each((tableIndex, table) => {
      const $table = $(table);
      const headers = $table.find('th').map((_, th) => $(th).text().trim()).get();

      console.log(`\nテーブル ${tableIndex + 1}:`);
      console.log('ヘッダー:', headers.join(' | '));

      $table.find('tr').each((rowIndex, row) => {
        if (rowIndex === 0) return; // ヘッダー行スキップ

        const $row = $(row);
        const cells = $row.find('td');

        if (cells.length >= 2) {
          const cell0 = $(cells[0]).text().trim();
          const cell1 = $(cells[1]).text().trim();

          console.log(`  行${rowIndex}: [${cell0}] [${cell1}]`);
        }
      });
    });

    console.log('\n\n=== ページHTML（最初の5000文字） ===');
    console.log(html.substring(0, 5000));

  } catch (error) {
    console.error('エラー:', error);
  } finally {
    await page.waitForTimeout(10000); // 10秒待機してブラウザを確認
    await browser.close();
  }
}

debugNBOX();
