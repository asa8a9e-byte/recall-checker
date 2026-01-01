// src/lib/recall-checker/daihatsu.ts

import { chromium, Browser } from 'playwright';
import * as cheerio from 'cheerio';
import { RecallCheckResult, RecallInfo } from '@/types';
import { splitChassisNumber } from './index';

const DAIHATSU_RECALL_URL = 'https://www.daihatsu.co.jp/info/recall/search/recall_search.php';

// 開発モード
const DEV_MODE = false;

export async function checkDaihatsuRecall(chassisNumber: string): Promise<RecallCheckResult> {
  // 開発モードではモックデータを返す
  if (DEV_MODE) {
    return getMockResult(chassisNumber);
  }

  // 車台番号を分割（LA650S-0000001 -> LA650S, 0000001）
  const [prefix, suffix] = splitChassisNumber(chassisNumber);

  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    const page = await context.newPage();

    await page.goto(DAIHATSU_RECALL_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3000);

    // ダイハツは2つの入力欄（model_no=型式, car_no=シリアル）
    await page.fill('input[name="model_no"]', prefix);
    await page.fill('input[name="car_no"]', suffix);
    await page.waitForTimeout(1000);

    // 検索ボタンをクリック（2番目のフォームをsubmit）
    await page.evaluate(() => {
      if (document.forms[1]) {
        document.forms[1].submit();
      }
    });
    await page.waitForTimeout(5000);

    const html = await page.content();
    const resultUrl = page.url();
    const recalls = parseDaihatsuResults(html, resultUrl);

    return {
      chassisNumber,
      maker: 'ダイハツ',
      hasRecall: recalls.length > 0,
      recalls,
      checkedAt: new Date().toISOString(),
      cached: false
    };

  } catch (error) {
    console.error('ダイハツリコールチェックエラー:', error);
    throw new Error(`ダイハツのリコール検索に失敗しました: ${error}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// 開発用モックデータ
function getMockResult(chassisNumber: string): RecallCheckResult {
  const hasRecall = !chassisNumber.includes('0');

  const mockRecalls: RecallInfo[] = hasRecall ? [
    {
      id: 'daihatsu-mock-1',
      recallId: 'D2024-001',
      title: 'CVTオイル漏れ',
      description: 'CVTからオイルが漏れる可能性があります。',
      severity: 'medium',
      status: 'pending',
      publishedAt: '2024-09-15'
    }
  ] : [];

  return {
    chassisNumber,
    maker: 'ダイハツ',
    hasRecall,
    recalls: mockRecalls,
    checkedAt: new Date().toISOString(),
    cached: false
  };
}

function parseDaihatsuResults(html: string, resultUrl: string = ''): RecallInfo[] {
  const $ = cheerio.load(html);
  const recalls: RecallInfo[] = [];
  const bodyText = $('body').text();

  // リコールなしのチェック（「対象ではありません」を検索結果メッセージとして含む場合）
  // 注意: 「対象項目なし」はヘルプテキストにも含まれるため使わない
  if (bodyText.includes('おクルマは「リコール・改善対策・サービスキャンペーン」の対象ではありません')) {
    return [];
  }

  // リコール詳細リンクから情報を抽出（/info/recall/数字.htm 形式）
  let recallIndex = 0;
  $('a').each((index, element) => {
    const $link = $(element);
    const href = $link.attr('href') || '';
    const text = $link.text().trim();

    // リコール詳細ページへのリンクを検出（99367.htm のような形式）
    if (href.includes('/info/recall/') &&
        href.match(/\d+\.htm$/) &&
        text) {

      const fullUrl = href.startsWith('http') ? href : `https://www.daihatsu.co.jp${href}`;

      // 親のtr要素から日付と区分と修理状況を取得
      const $row = $link.closest('tr');
      const cells = $row.find('td');
      let dateText = '';
      let category = '';
      let statusText = '';

      if (cells.length >= 4) {
        dateText = $(cells[0]).text().trim();
        category = $(cells[1]).text().trim();
        statusText = $(cells[3]).text().trim();
      }

      recalls.push({
        id: `daihatsu-${recallIndex}`,
        recallId: href.match(/(\d+)\.htm$/)?.[1] || `D${Date.now()}-${recallIndex}`,
        title: category ? `${category}: ${text}` : text,
        description: `詳細: ${fullUrl}`,
        severity: category.includes('リコール') ? 'high' : 'medium',
        status: statusText.includes('修理済') ? 'completed' : 'pending',
        publishedAt: extractDate(dateText) || new Date().toISOString().split('T')[0]
      });
      recallIndex++;
    }
  });

  // リコールの可能性があるがパースできなかった場合
  if (recalls.length === 0 && bodyText.includes('以下の通りでございます')) {
    recalls.push({
      id: 'daihatsu-unknown',
      recallId: `D${Date.now()}`,
      title: 'リコール対象の可能性があります',
      description: resultUrl ? `詳細: ${resultUrl}` : `詳細: ${DAIHATSU_RECALL_URL}`,
      severity: 'medium',
      status: 'pending',
      publishedAt: new Date().toISOString().split('T')[0]
    });
  }

  return recalls;
}

function extractDate(text: string): string | null {
  // YYYY/MM/DD 形式を抽出
  const match = text.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (match) {
    const [, year, month, day] = match;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return null;
}

function determineSeverity(text: string): 'high' | 'medium' | 'low' {
  if (text.includes('エアバッグ') || text.includes('ブレーキ') || text.includes('火災') || text.includes('リコール')) {
    return 'high';
  }
  if (text.includes('改善対策')) {
    return 'medium';
  }
  return 'low';
}
