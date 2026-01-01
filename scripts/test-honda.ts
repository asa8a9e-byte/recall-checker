// ホンダのリコール検索ページをテスト
import { chromium } from 'playwright';

async function testHondaRecall() {
  const chassisNumber = 'ZC8-1000001'; // シビック TYPE R

  console.log('ホンダリコール検索を実行中...\n');
  console.log(`検索: ${chassisNumber}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  });

  try {
    const page = await context.newPage();

    console.log('\nページにアクセス中...');
    await page.goto('https://recallsearch4.honda.co.jp/sqs/r001/R00101.do?fn=link.disp', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    await page.waitForTimeout(3000);

    const title = await page.title();
    console.log('ページタイトル:', title);
    console.log('現在のURL:', page.url());

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

    // ボタンを探す
    const buttons = await page.$$('button, input[type="submit"], input[type="button"]');
    console.log(`\nボタン要素数: ${buttons.length}`);
    for (let i = 0; i < buttons.length; i++) {
      const btn = buttons[i];
      const text = await btn.textContent();
      const value = await btn.getAttribute('value');
      const type = await btn.getAttribute('type');
      const name = await btn.getAttribute('name');
      console.log(`  button[${i}]: type="${type}", name="${name}", value="${value}", text="${text?.trim()}"`);
    }

    // ページ内容を確認
    const bodyText = await page.textContent('body');
    console.log('\n--- ページ内容（最初の1500文字）---');
    console.log(bodyText?.replace(/\s+/g, ' ').slice(0, 1500));

  } catch (error) {
    console.error('エラー:', error);
  } finally {
    await browser.close();
  }
}

testHondaRecall();
