// トヨタのリコール検索ページをテストするスクリプト
import { chromium } from 'playwright';

async function testToyotaRecall() {
  console.log('トヨタリコール検索ページをテスト中...\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  });
  const page = await context.newPage();

  try {
    // ページにアクセス
    console.log('ページにアクセス中...');
    await page.goto('https://www.toyota.co.jp/recall-search/dc/search', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    // ページタイトルを取得
    const title = await page.title();
    console.log('ページタイトル:', title);

    // ページのURLを確認
    console.log('現在のURL:', page.url());

    // ページの主要なテキストを取得
    const bodyText = await page.textContent('body');
    console.log('\nページ内容（最初の1000文字）:');
    console.log(bodyText?.slice(0, 1000));

    // フォーム要素を探す
    console.log('\n--- フォーム要素を探索 ---');

    const inputs = await page.$$('input');
    console.log(`input要素数: ${inputs.length}`);

    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];
      const name = await input.getAttribute('name');
      const id = await input.getAttribute('id');
      const type = await input.getAttribute('type');
      const placeholder = await input.getAttribute('placeholder');
      console.log(`  input[${i}]: name="${name}", id="${id}", type="${type}", placeholder="${placeholder}"`);
    }

    // セレクト要素を探す
    const selects = await page.$$('select');
    console.log(`\nselect要素数: ${selects.length}`);

    for (let i = 0; i < selects.length; i++) {
      const select = selects[i];
      const name = await select.getAttribute('name');
      const id = await select.getAttribute('id');
      console.log(`  select[${i}]: name="${name}", id="${id}"`);
    }

    // ボタン要素を探す
    const buttons = await page.$$('button');
    console.log(`\nbutton要素数: ${buttons.length}`);

    // HTMLを保存
    const html = await page.content();
    console.log('\n--- HTML全体の長さ:', html.length, '文字 ---');

  } catch (error) {
    console.error('エラー:', error);
  } finally {
    await browser.close();
  }
}

testToyotaRecall();
