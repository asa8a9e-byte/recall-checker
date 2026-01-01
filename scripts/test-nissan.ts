// 日産のリコール検索ページをテスト
import { chromium } from 'playwright';

async function testNissanRecall() {
  console.log('日産リコール検索ページをテスト中...\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  });
  const page = await context.newPage();

  try {
    console.log('ページにアクセス中...');
    await page.goto('https://www.nissan.co.jp/RECALL/search.html', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    await page.waitForTimeout(3000);

    const title = await page.title();
    console.log('ページタイトル:', title);
    console.log('現在のURL:', page.url());

    // ページの主要なテキストを取得
    const bodyText = await page.textContent('body');
    console.log('\nページ内容（最初の1500文字）:');
    console.log(bodyText?.replace(/\s+/g, ' ').slice(0, 1500));

    // フォーム要素を探す
    console.log('\n--- フォーム要素を探索 ---');

    const inputs = await page.$$('input');
    console.log(`input要素数: ${inputs.length}`);
    for (let i = 0; i < Math.min(inputs.length, 10); i++) {
      const input = inputs[i];
      const name = await input.getAttribute('name');
      const id = await input.getAttribute('id');
      const type = await input.getAttribute('type');
      const placeholder = await input.getAttribute('placeholder');
      console.log(`  input[${i}]: name="${name}", id="${id}", type="${type}", placeholder="${placeholder}"`);
    }

    const selects = await page.$$('select');
    console.log(`\nselect要素数: ${selects.length}`);
    for (let i = 0; i < selects.length; i++) {
      const select = selects[i];
      const name = await select.getAttribute('name');
      const id = await select.getAttribute('id');
      console.log(`  select[${i}]: name="${name}", id="${id}"`);
    }

    const buttons = await page.$$('button');
    console.log(`\nbutton要素数: ${buttons.length}`);
    for (let i = 0; i < buttons.length; i++) {
      const btn = buttons[i];
      const text = await btn.textContent();
      const type = await btn.getAttribute('type');
      console.log(`  button[${i}]: type="${type}", text="${text?.trim()}"`);
    }

    // iframeを確認
    const iframes = await page.$$('iframe');
    console.log(`\niframe要素数: ${iframes.length}`);
    for (let i = 0; i < iframes.length; i++) {
      const iframe = iframes[i];
      const src = await iframe.getAttribute('src');
      console.log(`  iframe[${i}]: src="${src}"`);
    }

  } catch (error) {
    console.error('エラー:', error);
  } finally {
    await browser.close();
  }
}

testNissanRecall();
