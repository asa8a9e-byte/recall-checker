// src/lib/recall-checker/subaru.ts

import { chromium, Browser } from 'playwright';
import * as cheerio from 'cheerio';
import { RecallCheckResult, RecallInfo } from '@/types';
import { splitChassisNumber } from './index';

const SUBARU_RECALL_URL = 'https://recall.subaru.co.jp/lqsb/';

// 開発モード
const DEV_MODE = false;

export async function checkSubaruRecall(chassisNumber: string): Promise<RecallCheckResult> {
  // 開発モードではモックデータを返す
  if (DEV_MODE) {
    return getMockResult(chassisNumber);
  }

  // 車台番号を分割（VMG-000001 -> VMG, 000001）
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

    await page.goto(SUBARU_RECALL_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3000);

    // スバルは2つの入力欄（txtCarNoKami=型式, txtCarNoShimo=シリアル）
    await page.fill('input[name="txtCarNoKami"]', prefix);
    await page.fill('input[name="txtCarNoShimo"]', suffix);
    await page.waitForTimeout(1000);

    // 検索ボタンをクリック
    await page.click('input[name="btnSearch"]');
    await page.waitForTimeout(5000);

    const html = await page.content();
    const resultUrl = page.url();
    const recalls = parseSubaruResults(html, resultUrl);

    return {
      chassisNumber,
      maker: 'スバル',
      hasRecall: recalls.length > 0,
      recalls,
      checkedAt: new Date().toISOString(),
      cached: false
    };

  } catch (error) {
    console.error('スバルリコールチェックエラー:', error);
    throw new Error(`スバルのリコール検索に失敗しました: ${error}`);
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
      id: 'subaru-mock-1',
      recallId: 'S2024-001',
      title: 'エンジン制御プログラム不具合',
      description: 'エンジン制御プログラムに不具合があり、エンストする可能性があります。',
      severity: 'high',
      status: 'pending',
      publishedAt: '2024-09-15'
    }
  ] : [];

  return {
    chassisNumber,
    maker: 'スバル',
    hasRecall,
    recalls: mockRecalls,
    checkedAt: new Date().toISOString(),
    cached: false
  };
}

function parseSubaruResults(html: string, resultUrl: string = ''): RecallInfo[] {
  const $ = cheerio.load(html);
  const recalls: RecallInfo[] = [];
  const bodyText = $('body').text();

  // リコールなしのチェック
  if (bodyText.includes('対象のリコール等はございません')) {
    return [];
  }

  // popup03リンクから直接リコール情報を抽出（最も確実な方法）
  let recallIndex = 0;
  $('a').each((index, element) => {
    const $link = $(element);
    const href = $link.attr('href') || '';
    const text = $link.text().trim();

    // javascript:popup03('URL') からURLを抽出
    const urlMatch = href.match(/popup\d*\(['"]([^'"]+)['"]\)/);
    if (urlMatch && text) {
      const detailUrl = urlMatch[1];

      // 親のtr要素から実施状況と区分を取得
      const $row = $link.closest('tr');
      const cells = $row.find('td');
      let statusText = '';
      let category = '';
      let dateText = '';

      if (cells.length >= 5) {
        statusText = $(cells[1]).text().trim();
        category = $(cells[2]).text().trim();
        dateText = $(cells[4]).text().trim();
      }

      recalls.push({
        id: `subaru-${recallIndex}`,
        recallId: detailUrl.match(/([^/]+)\.html$/)?.[1] || `S${Date.now()}-${recallIndex}`,
        title: category ? `${category}: ${text}` : text,
        description: `詳細: ${detailUrl}`,
        severity: category.includes('リコール') ? 'high' : 'medium',
        status: statusText.includes('実施済') ? 'completed' : 'pending',
        publishedAt: extractDate(dateText) || new Date().toISOString().split('T')[0]
      });
      recallIndex++;
    }
  });

  // リコールの可能性があるがパースできなかった場合
  if (recalls.length === 0 && bodyText.includes('リコール') && !bodyText.includes('ございません')) {
    recalls.push({
      id: 'subaru-unknown',
      recallId: `S${Date.now()}`,
      title: 'リコール対象の可能性があります',
      description: resultUrl ? `詳細: ${resultUrl}` : `詳細: ${SUBARU_RECALL_URL}`,
      severity: 'medium',
      status: 'pending',
      publishedAt: new Date().toISOString().split('T')[0]
    });
  }

  return recalls;
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

function extractDate(text: string): string | null {
  // YYYY/MM/DD または YYYY年MM月DD日 形式を抽出
  const match = text.match(/(\d{4})[\/年](\d{1,2})[\/月](\d{1,2})/);
  if (match) {
    const [, year, month, day] = match;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return null;
}
